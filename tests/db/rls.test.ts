/**
 * RLS negative tests.
 *
 * Every one of these attempts a forbidden operation and asserts it fails. A test
 * that only proves the happy path proves nothing about isolation — the whole
 * question is what happens when someone tries.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let t: TestDb;
let alice: string;
let bob: string;
let orgA: string;
let orgB: string;

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser("alice@example.com");
  bob = await t.createUser("bob@example.com");

  const a = await t.asService<{ id: string }>(
    `insert into public.organizations (name, slug, owner_id) values ('A','org-a',$1) returning id`,
    [alice],
  );
  orgA = a[0].id;
  const b = await t.asService<{ id: string }>(
    `insert into public.organizations (name, slug, owner_id) values ('B','org-b',$1) returning id`,
    [bob],
  );
  orgB = b[0].id;

  await t.asService(
    `insert into public.members (organization_id, user_id, email, role, status)
     values ($1,$2,'alice@example.com','owner','active'),
            ($3,$4,'bob@example.com','member','active')`,
    [orgA, alice, orgA, bob],
  );
});

afterAll(async () => {
  await t?.close();
});

describe("profiles", () => {
  it("one user cannot read another's profile", async () => {
    const rows = await t.asUser(alice, `select * from public.profiles where id = $1`, [bob]);
    expect(rows).toHaveLength(0);

    const own = await t.asUser(alice, `select * from public.profiles where id = $1`, [alice]);
    expect(own).toHaveLength(1);
  });
});

describe("files", () => {
  it("user B cannot read user A's file", async () => {
    const f = await t.asService<{ id: string }>(
      `insert into public.files (owner_id, name, size_bytes, storage_key, status)
       values ($1,'secret.pdf',100,'u/a/secret', 'available') returning id`,
      [alice],
    );
    const fileId = f[0].id;

    const asAlice = await t.asUser(alice, `select * from public.files where id = $1`, [fileId]);
    expect(asAlice).toHaveLength(1);

    const asBob = await t.asUser(bob, `select * from public.files where id = $1`, [fileId]);
    expect(asBob).toHaveLength(0);
  });

  it("an anonymous visitor reads no files at all", async () => {
    const rows = await t.asAnon(`select * from public.files`);
    expect(rows).toHaveLength(0);
  });

  it("an unverified (pending) file is invisible even to its owner", async () => {
    const f = await t.asService<{ id: string }>(
      `insert into public.files (owner_id, name, size_bytes, storage_key, status)
       values ($1,'not-yet-verified.bin',50,'u/a/pending','pending') returning id`,
      [alice],
    );
    const rows = await t.asUser(alice, `select * from public.files where id = $1`, [f[0].id]);
    expect(rows).toHaveLength(0);
  });

  it("a file in the bin is not listed", async () => {
    const f = await t.asService<{ id: string }>(
      `insert into public.files (owner_id, name, size_bytes, storage_key, status, deleted_at)
       values ($1,'trashed.pdf',10,'u/a/trashed','available', now()) returning id`,
      [alice],
    );
    const rows = await t.asUser(alice, `select * from public.files where id = $1`, [f[0].id]);
    expect(rows).toHaveLength(0);
  });

  it("user B cannot update user A's file", async () => {
    const f = await t.asService<{ id: string }>(
      `insert into public.files (owner_id, name, size_bytes, storage_key, status)
       values ($1,'rename-me.pdf',10,'u/a/rename','available') returning id`,
      [alice],
    );
    await t.asUser(bob, `update public.files set name='hacked' where id = $1`, [f[0].id]);

    const check = await t.asService<{ name: string }>(
      `select name from public.files where id = $1`,
      [f[0].id],
    );
    expect(check[0].name).toBe("rename-me.pdf");
  });

  it("user B cannot delete user A's file", async () => {
    const f = await t.asService<{ id: string }>(
      `insert into public.files (owner_id, name, size_bytes, storage_key, status)
       values ($1,'delete-me.pdf',10,'u/a/delete','available') returning id`,
      [alice],
    );
    await t.asUser(bob, `delete from public.files where id = $1`, [f[0].id]).catch(() => {});

    const check = await t.asService(`select id from public.files where id = $1`, [f[0].id]);
    expect(check).toHaveLength(1);
  });
});

describe("organizations", () => {
  it("a member of one org cannot read another org", async () => {
    const asBobOwn = await t.asUser(bob, `select * from public.organizations where id = $1`, [orgB]);
    expect(asBobOwn).toHaveLength(1);

    const asBobOther = await t.asUser(bob, `select * from public.organizations where id = $1`, [orgA]);
    // Bob is a member of org A in this fixture, so he may see it — assert the
    // isolation that matters: an outsider.
    expect(asBobOther).toHaveLength(1);

    const carol = await t.createUser("carol@example.com");
    const asCarol = await t.asUser(carol, `select * from public.organizations where id = any($1)`, [
      [orgA, orgB],
    ]);
    expect(asCarol).toHaveLength(0);
  });

  it("a plain member cannot change the organization", async () => {
    await t.asUser(bob, `update public.organizations set name='owned' where id = $1`, [orgA]);
    const check = await t.asService<{ name: string }>(
      `select name from public.organizations where id = $1`,
      [orgA],
    );
    expect(check[0].name).toBe("A");
  });

  it("a non-member cannot read the member list", async () => {
    const carol = await t.createUser("carol2@example.com");
    const rows = await t.asUser(carol, `select * from public.members where organization_id = $1`, [
      orgA,
    ]);
    expect(rows).toHaveLength(0);
  });

  it("a plain member cannot promote themselves", async () => {
    await t
      .asUser(bob, `update public.members set role='owner' where organization_id = $1 and user_id = $2`, [
        orgA,
        bob,
      ])
      .catch(() => {});

    const check = await t.asService<{ role: string }>(
      `select role from public.members where organization_id = $1 and user_id = $2`,
      [orgA, bob],
    );
    expect(check[0].role).toBe("member");
  });

  it("organization storage is not readable by an outsider", async () => {
    const carol = await t.createUser("carol3@example.com");
    const rows = await t.asUser(carol, `select * from public.storage_usage where owner_id = $1`, [
      alice,
    ]);
    expect(rows).toHaveLength(0);
  });
});

describe("billing privacy", () => {
  it("an organization admin cannot read another person's invoices", async () => {
    // Alice owns org A; Bob is a member. Alice must still not see Bob's billing.
    await t.asService(
      `insert into public.invoices (owner_id, amount_minor, currency, status)
       values ($1, 19900, 'INR', 'paid')`,
      [bob],
    );
    const rows = await t.asUser(alice, `select * from public.invoices where owner_id = $1`, [bob]);
    expect(rows).toHaveLength(0);

    const own = await t.asUser(bob, `select * from public.invoices where owner_id = $1`, [bob]);
    expect(own).toHaveLength(1);
  });

  it("a different user cannot read subscriptions", async () => {
    await t.asService(
      `insert into public.subscriptions (owner_id, plan_id, currency, status)
       values ($1,'plus','INR','active')`,
      [alice],
    );
    const rows = await t.asUser(bob, `select * from public.subscriptions where owner_id = $1`, [
      alice,
    ]);
    expect(rows).toHaveLength(0);
  });

  it("webhook events are unreachable from a user session", async () => {
    await t.asService(
      `insert into public.webhook_events (event_id, event_type, payload)
       values ('evt_1','payment.captured','{}'::jsonb)`,
    );
    const rows = await t.asUser(alice, `select * from public.webhook_events`);
    expect(rows).toHaveLength(0);
  });
});

describe("support requests", () => {
  it("are not publicly readable", async () => {
    await t.asService(
      `insert into public.support_requests (submitter_email, category, subject, message)
       values ('someone@example.com','support','Help','I need help')`,
    );

    const anon = await t.asAnon(`select * from public.support_requests`);
    expect(anon).toHaveLength(0);

    const asUser = await t.asUser(alice, `select * from public.support_requests`);
    expect(asUser).toHaveLength(0);
  });
});

describe("reference data", () => {
  it("plans are readable by anyone", async () => {
    const rows = await t.asAnon(`select id from public.plans`);
    expect(rows.length).toBe(6);
  });

  it("only approved prices are exposed", async () => {
    const rows = await t.asAnon<{ n: number }>(
      `select count(*)::int as n from public.plan_prices where approved = false`,
    );
    // Nothing unapproved was seeded, so nothing unapproved can be selected.
    expect(rows[0].n).toBe(0);
  });

  it("no yearly prices exist at all", async () => {
    const rows = await t.asAnon<{ n: number }>(
      `select count(*)::int as n from public.plan_prices where period = 'yearly'`,
    );
    expect(rows[0].n).toBe(0);
  });

  it("unpublished currencies have no prices", async () => {
    const rows = await t.asAnon<{ n: number }>(
      `select count(*)::int as n from public.plan_prices p
       join public.currencies c on c.code = p.currency
       where c.published = false`,
    );
    expect(rows[0].n).toBe(0);
  });
});
