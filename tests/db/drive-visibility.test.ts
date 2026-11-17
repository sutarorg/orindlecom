/**
 * The drive's read paths, against a real PostgreSQL.
 *
 * Every case here was a customer-visible bug, and every one of them is a row-level
 * security question rather than a UI question — which is exactly why they were
 * invisible to component tests and to a code review. A policy that filters out the
 * rows a screen needs looks correct in isolation.
 *
 *   - the bin stayed empty forever, because access required `deleted_at is null`
 *   - a folder could not be starred, because there was no column for it
 *   - moving a file silently failed, because `update ... returning` reads the row
 *     back through the SELECT policy
 *   - sharing with someone with no account reached nobody
 *   - a public link resolved for nobody, so /s/… served nothing
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, pgError, type TestDb } from "./harness";

let db: TestDb;
let owner: string;
let stranger: string;
let ownerFolder: string;
let ownerFile: string;

beforeEach(async () => {
  db = await createTestDb();
  owner = await db.createUser("owner@example.com");
  stranger = await db.createUser("stranger@example.com");
  await db.verifyUser(owner);
  await db.verifyUser(stranger);

  // A folder and a file inside it, created through the same function the app uses.
  const folder = await db.asUser<{ id: string }>(
    owner,
    "select (public.create_folder($1, null)).id",
    ["Reports"],
  );
  ownerFolder = folder[0].id;

  /*
   * Seeded as the service role with status 'available'.
   *
   * A user cannot insert an available file directly — `files_insert` requires
   * `status = 'pending'`, which is the rule that stops an unverified upload from
   * being listed. Tests that seeded through the user role were tripping that
   * policy, not a bug in the feature under test.
   */
  const file = await db.asService<{ id: string }>(
    `insert into public.files (owner_id, folder_id, name, size_bytes, mime_type, category, status, storage_key)
     values ($1, $2, 'q3.pdf', 1024, 'application/pdf', 'pdf', 'available', $3)
     returning id`,
    [owner, ownerFolder, `u/${owner}/q3.pdf`],
  );
  ownerFile = file[0].id;
});

afterEach(async () => {
  await db.close();
});

describe("trash", () => {
  it("lists a trashed file to its owner, which is the whole point of a bin", async () => {
    await db.asUser(owner, "update public.files set deleted_at = now() where id = $1", [ownerFile]);

    const rows = await db.asUser<{ kind: string; name: string }>(owner, "select * from public.list_trash()");
    expect(rows.map((row) => `${row.kind}:${row.name}`)).toContain("file:q3.pdf");
  });

  it("keeps a trashed row out of the live listing", async () => {
    await db.asUser(owner, "update public.folders set deleted_at = now() where id = $1", [ownerFolder]);

    const live = await db.asUser<{ id: string }>(
      owner,
      "select id from public.folders where deleted_at is null",
    );
    expect(live.map((row) => row.id)).not.toContain(ownerFolder);

    const bin = await db.asUser<{ kind: string; name: string }>(owner, "select * from public.list_trash()");
    expect(bin.map((row) => `${row.kind}:${row.name}`)).toContain("folder:Reports");
  });

  it("does not show one customer's trash to another", async () => {
    await db.asUser(owner, "update public.files set deleted_at = now() where id = $1", [ownerFile]);

    const other = await db.asUser<{ id: string }>(stranger, "select * from public.list_trash()");
    expect(other).toHaveLength(0);
  });

  it("still hides a trashed file from a grantee who could see it while it was live", async () => {
    await db.asUser(
      owner,
      `insert into public.share_grants (file_id, grantee_id, granted_by, permission)
       values ($1, $2, $3, 'viewer')`,
      [ownerFile, stranger, owner],
    );

    // Live: the grant makes it readable.
    expect(
      await db.asUser(stranger, "select id from public.files where id = $1", [ownerFile]),
    ).toHaveLength(1);

    // Trashed: the bin belongs to the owner, so the grant must not carry over.
    await db.asUser(owner, "update public.files set deleted_at = now() where id = $1", [ownerFile]);
    expect(
      await db.asUser(stranger, "select id from public.files where id = $1", [ownerFile]),
    ).toHaveLength(0);
  });

  it("restores a trashed file back into the live listing", async () => {
    await db.asUser(owner, "update public.files set deleted_at = now() where id = $1", [ownerFile]);

    // Restore goes through the function, because the owner cannot read the trashed
    // row it would otherwise have to update.
    expect(
      await db.asUser<{ n: number }>(owner, "select public.restore_items(array[$1]::uuid[]) as n", [
        ownerFile,
      ]),
    ).toEqual([{ n: 1 }]);

    const live = await db.asUser<{ id: string }>(
      owner,
      "select id from public.files where id = $1 and deleted_at is null",
      [ownerFile],
    );
    expect(live).toHaveLength(1);
    expect(await db.asUser(owner, "select * from public.list_trash()")).toHaveLength(0);
  });
});

describe("starring folders", () => {
  it("persists, so a starred folder can be listed", async () => {
    await db.asUser(owner, "select public.set_folder_star($1, true)", [ownerFolder]);

    const starred = await db.asUser<{ name: string }>(
      owner,
      "select name from public.folders where starred and deleted_at is null",
    );
    expect(starred.map((row) => row.name)).toEqual(["Reports"]);
  });

  it("refuses to star somebody else's folder", async () => {
    await expect(
      db.asUser(stranger, "select public.set_folder_star($1, true)", [ownerFolder]),
    ).rejects.toSatisfy((error: unknown) => pgError(error).includes("not_found"));
  });

  it("clears the star again", async () => {
    await db.asUser(owner, "select public.set_folder_star($1, true)", [ownerFolder]);
    await db.asUser(owner, "select public.set_folder_star($1, false)", [ownerFolder]);
    expect(
      await db.asUser(owner, "select id from public.folders where starred"),
    ).toHaveLength(0);
  });
});

describe("moving", () => {
  it("moves a file into another folder through the definer path", async () => {
    const other = await db.asUser<{ id: string }>(
      owner,
      "select (public.create_folder($1, null)).id",
      ["Archive"],
    );

    await db.asUser(owner, "select public.move_file($1, $2)", [ownerFile, other[0].id]);

    const row = await db.asUser<{ folder_id: string }>(
      owner,
      "select folder_id from public.files where id = $1",
      [ownerFile],
    );
    expect(row[0].folder_id).toBe(other[0].id);
  });

  it("moves a file to the root with a null parent", async () => {
    await db.asUser(owner, "select public.move_file($1, null)", [ownerFile]);
    const row = await db.asUser<{ folder_id: string | null }>(
      owner,
      "select folder_id from public.files where id = $1",
      [ownerFile],
    );
    expect(row[0].folder_id).toBeNull();
  });

  it("refuses a move into a folder that is not yours", async () => {
    const theirs = await db.asUser<{ id: string }>(
      stranger,
      "select (public.create_folder($1, null)).id",
      ["Theirs"],
    );
    await expect(
      db.asUser(owner, "select public.move_file($1, $2)", [ownerFile, theirs[0].id]),
    ).rejects.toSatisfy((error: unknown) => pgError(error).includes("parent_not_found"));
  });

  it("refuses to move a folder into itself", async () => {
    await expect(
      db.asUser(owner, "select public.move_folder($1, $1)", [ownerFolder]),
    ).rejects.toSatisfy((error: unknown) => pgError(error).includes("cycle"));
  });

  it("refuses to move a folder into its own descendant", async () => {
    const child = await db.asUser<{ id: string }>(
      owner,
      "select (public.create_folder($1, $2)).id",
      ["Child", ownerFolder],
    );
    const grandchild = await db.asUser<{ id: string }>(
      owner,
      "select (public.create_folder($1, $2)).id",
      ["Grandchild", child[0].id],
    );

    await expect(
      db.asUser(owner, "select public.move_folder($1, $2)", [ownerFolder, grandchild[0].id]),
    ).rejects.toSatisfy((error: unknown) => pgError(error).includes("cycle"));
  });

  it("allows an arbitrarily deep folder tree", async () => {
    // "Users can create folders inside folders" — no depth limit in the schema, and
    // none should appear here.
    let parent: string | null = null;
    for (let depth = 0; depth < 25; depth += 1) {
      const created: { id: string }[] = await db.asUser<{ id: string }>(
        owner,
        "select (public.create_folder($1, $2)).id",
        [`level-${depth}`, parent],
      );
      parent = created[0].id;
    }
    const deepest: { depth: number }[] = await db.asUser<{ depth: number }>(
      owner,
      "select depth from public.folders where id = $1",
      [parent],
    );
    expect(deepest[0].depth).toBeGreaterThanOrEqual(24);
  });
});

describe("shared", () => {
  it("lists an item somebody granted me", async () => {
    await db.asUser(
      owner,
      `insert into public.share_grants (file_id, grantee_id, granted_by, permission)
       values ($1, $2, $3, 'viewer')`,
      [ownerFile, stranger, owner],
    );

    const rows = await db.asUser<{ name: string; owned: boolean }>(
      stranger,
      "select name, owned from public.list_shared()",
    );
    expect(rows).toEqual([{ name: "q3.pdf", owned: false }]);
  });

  it("lists an item I granted to somebody", async () => {
    await db.asUser(
      owner,
      `insert into public.share_grants (file_id, grantee_id, granted_by, permission)
       values ($1, $2, $3, 'editor')`,
      [ownerFile, stranger, owner],
    );

    const rows = await db.asUser<{ name: string; owned: boolean }>(
      owner,
      "select name, owned from public.list_shared()",
    );
    expect(rows).toEqual([{ name: "q3.pdf", owned: true }]);
  });

  it("shows nothing to someone who has neither shared nor been shared with", async () => {
    expect(await db.asUser(stranger, "select * from public.list_shared()")).toHaveLength(0);
  });
});

describe("share invitations to people with no account", () => {
  it("is claimed once the invited person signs up and confirms", async () => {
    await db.asService(
      `insert into public.share_invitations (email, file_id, permission, token, invited_by)
       values ($1, $2, 'viewer', 'tok-abc', $3)`,
      ["newcomer@example.com", ownerFile, owner],
    );

    // They sign up. Until the address is confirmed, nothing is claimed.
    const newcomer = await db.createUser("newcomer@example.com");
    expect(
      await db.asUser<{ n: number }>(newcomer, "select public.claim_share_invitations() as n"),
    ).toEqual([{ n: 0 }]);

    await db.verifyUser(newcomer);
    expect(
      await db.asUser<{ n: number }>(newcomer, "select public.claim_share_invitations() as n"),
    ).toEqual([{ n: 1 }]);

    // And now it is theirs to see.
    const shared = await db.asUser<{ name: string }>(newcomer, "select name from public.list_shared()");
    expect(shared.map((row) => row.name)).toEqual(["q3.pdf"]);
  });

  it("is not claimed by an account with a different address", async () => {
    await db.asService(
      `insert into public.share_invitations (email, file_id, permission, token, invited_by)
       values ($1, $2, 'viewer', 'tok-def', $3)`,
      ["someone-else@example.com", ownerFile, owner],
    );

    expect(
      await db.asUser<{ n: number }>(stranger, "select public.claim_share_invitations() as n"),
    ).toEqual([{ n: 0 }]);
  });
});

describe("public share links", () => {
  it("resolves a live link for an anonymous visitor", async () => {
    await db.asUser(
      owner,
      `insert into public.share_links (file_id, token, permission, expires_at, created_by)
       values ($1, 'live-token', 'viewer', now() + interval '7 days', $2)`,
      [ownerFile, owner],
    );

    const rows = await db.asAnon<{ name: string; permission: string }>(
      "select name, permission from public.resolve_share_link('live-token')",
    );
    expect(rows).toEqual([{ name: "q3.pdf", permission: "viewer" }]);
  });

  it("resolves nothing for an expired or revoked link", async () => {
    await db.asUser(
      owner,
      `insert into public.share_links (file_id, token, permission, expires_at, created_by)
       values ($1, 'old-token', 'viewer', now() - interval '1 day', $2)`,
      [ownerFile, owner],
    );
    await db.asUser(
      owner,
      `insert into public.share_links (file_id, token, permission, expires_at, revoked_at, created_by)
       values ($1, 'revoked-token', 'viewer', now() + interval '7 days', now(), $2)`,
      [ownerFile, owner],
    );

    expect(await db.asAnon("select * from public.resolve_share_link('old-token')")).toHaveLength(0);
    expect(await db.asAnon("select * from public.resolve_share_link('revoked-token')")).toHaveLength(0);
  });

  it("resolves nothing for a token that never existed", async () => {
    expect(await db.asAnon("select * from public.resolve_share_link('nope')")).toHaveLength(0);
  });
});

describe("email verifications", () => {
  it("is invisible to the customer, who must not be able to read their own token", async () => {
    await db.asService(
      `insert into public.email_verifications (user_id, email, token_hash, expires_at)
       values ($1, 'owner@example.com', 'hash-1', now() + interval '1 day')`,
      [owner],
    );

    await expect(
      db.asUser(owner, "select * from public.email_verifications"),
    ).rejects.toThrow(/permission denied/i);
  });
});
