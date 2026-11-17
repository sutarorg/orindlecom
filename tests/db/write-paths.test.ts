/**
 * The two write paths that were reporting "Something went wrong on our side".
 *
 * Both were generic `unknown` errors. The cause was not an error code — it was that the
 * write never matched the row it was asked to write, because PostgREST implements
 * `.select()` on a write as `RETURNING`, and `RETURNING` is filtered by the table's
 * SELECT policy. These tests pin both failures and the fix (migration 0022).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "./harness";

let t: TestDb;
let user: string;
let other: string;

beforeAll(async () => {
  t = await createTestDb();
  user = await t.createUser("writes@example.com");
  await t.verifyUser(user);
  other = await t.createUser("other@example.com");
  await t.verifyUser(other);
});

afterAll(async () => {
  await t?.close();
});

/** Seed a pending file plus its upload session, the way prepareUpload does. */
async function seedUpload(storageKey: string, size: number, owner = user) {
  const [file] = await t.asService<{ id: string }>(
    `insert into public.files (owner_id, name, storage_key, status, size_bytes)
     values ($1, 'photo.jpg', $2, 'pending', 0) returning id`,
    [owner, storageKey],
  );
  const [session] = await t.asService<{ id: string }>(
    `insert into public.upload_sessions (owner_id, file_id, storage_key, multipart, declared_size, expires_at)
     values ($1, $2, $3, false, $4, now() + interval '1 hour') returning id`,
    [owner, file.id, storageKey, size],
  );
  return { fileId: file.id, taskId: session.id };
}

describe("the original failures", () => {
  it("insert ... returning a folder fails RLS, though the same insert without returning succeeds", async () => {
    // This is exactly what createFolder did, and why folders could never be created.
    await expect(
      t.asUser(
        user,
        `insert into public.folders (owner_id, name, parent_id) values ($1, 'A', null) returning id`,
        [user],
      ),
    ).rejects.toThrow(/row-level security/);

    await expect(
      t.asUser(user, `insert into public.folders (owner_id, name, parent_id) values ($1, 'B', null)`, [
        user,
      ]),
    ).resolves.toBeDefined();
  });

  it("updating a pending file to available matches no row, even its own owner", async () => {
    const { fileId } = await seedUpload("u/x/2026/01/raw", 10);

    // Exactly what step 12 did. `[]` is `matchedNoRow` in the diagnostics.
    const rows = await t.asUser(
      user,
      `update public.files set size_bytes = 10, status = 'available'
        where storage_key = $1 and owner_id = $2 returning id`,
      ["u/x/2026/01/raw", user],
    );
    expect(rows).toHaveLength(0);

    // And the row is genuinely untouched, which is why the file never appeared.
    const [row] = await t.asService<{ status: string }>(
      `select status from public.files where id = $1`,
      [fileId],
    );
    expect(row.status).toBe("pending");
  });

  it("a client cannot insert an activity event at all", async () => {
    // No INSERT grant, by design — the log must not be forgeable. The upload path
    // writes it through finalize_upload instead.
    await expect(
      t.asUser(
        user,
        `insert into public.activity_events (actor_id, subject_type, kind)
         values ($1, 'file', 'file.uploaded')`,
        [user],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("create_folder", () => {
  it("returns the created folder, with path and depth filled in by the trigger", async () => {
    const rows = await t.asUser<{ id: string; name: string; path: string; depth: number }>(
      user,
      `select * from public.create_folder($1, null)`,
      ["Reports"],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Reports");
    expect(rows[0].depth).toBe(0);
    expect(rows[0].path).toBe(`/${rows[0].id}/`);
  });

  it("nests under a parent the caller owns", async () => {
    const [parent] = await t.asUser<{ id: string }>(
      user,
      `select * from public.create_folder($1, null)`,
      ["Parent"],
    );
    const [child] = await t.asUser<{ depth: number; path: string }>(
      user,
      `select * from public.create_folder($1, $2)`,
      ["Child", parent.id],
    );

    expect(child.depth).toBe(1);
    expect(child.path).toBe(`/${parent.id}/${child.path.split("/")[2]}/`);
  });

  it("takes ownership from the session, never from the caller", async () => {
    const [row] = await t.asUser<{ owner_id: string }>(
      user,
      `select * from public.create_folder($1, null)`,
      ["Mine"],
    );
    expect(row.owner_id).toBe(user);
  });

  it("refuses a parent owned by somebody else", async () => {
    const [theirs] = await t.asUser<{ id: string }>(
      other,
      `select * from public.create_folder($1, null)`,
      ["Their folder"],
    );

    await expect(
      t.asUser(user, `select * from public.create_folder($1, $2)`, ["Sneaky", theirs.id]),
    ).rejects.toThrow(/parent_not_found/);
  });

  it("rejects a duplicate name in the same parent as a conflict", async () => {
    await t.asUser(user, `select * from public.create_folder($1, null)`, ["Twice"]);

    const error = await t
      .asUser(user, `select * from public.create_folder($1, null)`, ["Twice"])
      .then(() => null)
      .catch((e: unknown) => e);

    expect((error as { code?: string }).code).toBe("23505");
  });

  it("refuses a blank name", async () => {
    await expect(
      t.asUser(user, `select * from public.create_folder($1, null)`, ["   "]),
    ).rejects.toThrow(/invalid_name/);
  });
});

describe("finalize_upload", () => {
  it("flips a pending file to available and returns the row", async () => {
    const { fileId, taskId } = await seedUpload("u/x/2026/01/ok", 1024);

    const rows = await t.asUser<{ id: string; status: string; size_bytes: number }>(
      user,
      `select * from public.finalize_upload($1, $2, 'available')`,
      [taskId, 1024],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(fileId);
    expect(rows[0].status).toBe("available");
    expect(Number(rows[0].size_bytes)).toBe(1024);
  });

  it("writes the activity event it used to fail to write", async () => {
    const rows = await t.asService<{ kind: string; subject_id: string }>(
      `select kind, subject_id from public.activity_events where kind = 'file.uploaded'`,
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("confirms only the session it finished", async () => {
    const { taskId } = await seedUpload("u/x/2026/01/confirm", 10);
    await t.asUser(user, `select * from public.finalize_upload($1, 10, 'available')`, [taskId]);

    const [row] = await t.asService<{ status: string }>(
      `select status from public.upload_sessions where id = $1`,
      [taskId],
    );
    expect(row.status).toBe("confirmed");
  });

  it("will not finish somebody else's upload", async () => {
    const { taskId } = await seedUpload("u/x/2026/01/theirs", 10, other);

    await expect(
      t.asUser(user, `select * from public.finalize_upload($1, 10, 'available')`, [taskId]),
    ).rejects.toThrow(/upload_not_found/);
  });

  it("will not finish an upload twice", async () => {
    const { taskId } = await seedUpload("u/x/2026/01/twice", 10, other);
    await t.asService(`update public.upload_sessions set status = 'confirmed' where id = $1`, [
      taskId,
    ]);

    await expect(
      t.asUser(other, `select * from public.finalize_upload($1, 10, 'available')`, [taskId]),
    ).rejects.toThrow(/upload_already_finished/);
  });

  it("refuses a status outside available/quarantined", async () => {
    const { taskId } = await seedUpload("u/x/2026/01/badstatus", 10);

    await expect(
      t.asUser(user, `select * from public.finalize_upload($1, 10, 'pending')`, [taskId]),
    ).rejects.toThrow(/invalid_status/);
  });

  it("commits the reservation, so the bytes stop being merely reserved", async () => {
    const { taskId } = await seedUpload("u/x/2026/01/commit", 500);
    // Mirror reserve_storage, which prepareUpload calls before the object exists.
    await t.asService(`insert into public.storage_usage (owner_id) values ($1) on conflict do nothing`, [user]);
    const [res] = await t.asService<{ id: string }>(
      `insert into public.storage_reservations (owner_id, requested_bytes, upload_id)
       values ($1, 1000, $2) returning id`,
      [user, taskId],
    );

    await t.asUser(user, `select * from public.finalize_upload($1, 500, 'available')`, [taskId]);

    const [row] = await t.asService<{ status: string; bytes_used: number }>(
      `select status, bytes_used from public.storage_reservations where id = $1`,
      [res.id],
    );
    expect(row.status).toBe("committed");
    expect(Number(row.bytes_used)).toBe(500);
  });

  it("keeps a quarantined file out of the available listing", async () => {
    const { taskId } = await seedUpload("u/x/2026/01/scan", 10);

    const [file] = await t.asUser<{ id: string }>(
      user,
      `select * from public.finalize_upload($1, 10, 'quarantined')`,
      [taskId],
    );
    expect(file).toBeTruthy();

    const visible = await t.asUser(user, `select id from public.files where id = $1`, [file.id]);
    expect(visible).toHaveLength(0);
  });
});
