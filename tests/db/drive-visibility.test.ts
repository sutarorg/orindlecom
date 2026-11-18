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

/** Create a folder through the same function the app calls, as the given user. */
async function makeFolderAs(userId: string, name: string, parentId: string | null) {
  const rows = await db.asUser<{ id: string }>(userId, "select (public.create_folder($1, $2)).id", [
    name,
    parentId,
  ]);
  return rows[0].id;
}

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
    /*
     * `commenter`, not `editor`. Migration 0025 removed the edit level: the column's
     * check constraint now admits only `viewer` and `commenter`, so this insert is
     * also the regression test for that narrowing — see the dedicated case below.
     */
    await db.asUser(
      owner,
      `insert into public.share_grants (file_id, grantee_id, granted_by, permission)
       values ($1, $2, $3, 'commenter')`,
      [ownerFile, stranger, owner],
    );

    const rows = await db.asUser<{ name: string; owned: boolean }>(
      owner,
      "select name, owned from public.list_shared()",
    );
    expect(rows).toEqual([{ name: "q3.pdf", owned: true }]);
  });

  it("refuses an `editor` grant: the level no longer exists", async () => {
    await expect(
      db.asUser(
        owner,
        `insert into public.share_grants (file_id, grantee_id, granted_by, permission)
         values ($1, $2, $3, 'editor')`,
        [ownerFile, stranger, owner],
      ),
    ).rejects.toThrow(/share_grants_permission_check/);
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

  it("shows an anonymous visitor the comments on the file it points at", async () => {
    /*
     * The regression this guards: a comment could be written through a public link
     * and then read by nobody — `file_comments` is guarded by `has_file_access`, and
     * an anonymous visitor has no user id to check. `link_comments` is the read path,
     * and it is scoped to the token rather than to the table.
     */
    await db.asUser(
      owner,
      `insert into public.share_links (file_id, token, permission, expires_at, created_by)
       values ($1, 'comment-token', 'commenter', now() + interval '7 days', $2)`,
      [ownerFile, owner],
    );
    await db.asService(
      `insert into public.file_comments (file_id, author_id, author_name, body, external)
       values ($1, null, 'Asha', 'Looks right to me', true),
              ($1, null, '', 'No name given', true)`,
      [ownerFile],
    );

    const rows = await db.asAnon<{ author_name: string; body: string }>(
      "select author_name, body from public.link_comments('comment-token') order by body",
    );

    expect(rows).toEqual([
      { author_name: "Asha", body: "Looks right to me" },
      // A blank name is shown as "User" — decided on the server, so the dashboard and
      // the public page cannot disagree about what a nameless comment is called.
      { author_name: "User", body: "No name given" },
    ]);
  });

  it("shows nothing through a revoked link", async () => {
    await db.asUser(
      owner,
      `insert into public.share_links (file_id, token, permission, expires_at, revoked_at, created_by)
       values ($1, 'dead-comment-token', 'commenter', now() + interval '7 days', now(), $2)`,
      [ownerFile, owner],
    );
    expect(
      await db.asAnon("select * from public.link_comments('dead-comment-token')"),
    ).toHaveLength(0);
  });

  it("names no other file's comments", async () => {
    // A token resolves to one file. There is no token that returns the table.
    expect(await db.asAnon("select * from public.link_comments('nope')")).toHaveLength(0);
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

describe("trash retention", () => {
  it("carries the deletion time out, so a countdown can be honest", async () => {
    // The bin used to report a full retention window for everything, because the
    // deadline was a hard-coded null. It is derived from this timestamp now, so the
    // timestamp has to come out of the function.
    await db.asUser(
      owner,
      "update public.files set deleted_at = now() - interval '20 days' where id = $1",
      [ownerFile],
    );

    const rows = await db.asUser<{ deleted_at: string }>(
      owner,
      "select deleted_at from public.list_trash() where id = $1",
      [ownerFile],
    );

    expect(rows).toHaveLength(1);
    const daysAgo = (Date.now() - new Date(rows[0].deleted_at).getTime()) / 86_400_000;
    expect(daysAgo).toBeGreaterThan(19);
    expect(daysAgo).toBeLessThan(21);
  });
});

/*
 * ── The hierarchy ──────────────────────────────────────────────────────────
 *
 * A folder tree is the one structure in the product that is only correct as a whole.
 * Every case below is about a relationship — between a folder and its parent, between
 * a stored path and the subtree beneath it, between a count and the rows it counts —
 * so none of them can be checked by looking at a single row.
 */
describe("folder hierarchy", () => {
  const makeFolder = makeFolderAs;

  async function pathOf(id: string) {
    const rows = await db.asService<{ path: string; depth: number }>(
      "select path, depth from public.folders where id = $1",
      [id],
    );
    return rows[0];
  }

  it("writes a path that names every ancestor, outermost first", async () => {
    const projects = await makeFolder(owner, "Projects", null);
    const website = await makeFolder(owner, "Website", projects);
    const design = await makeFolder(owner, "Design", website);

    expect((await pathOf(projects)).path).toBe(`/${projects}/`);
    expect((await pathOf(website)).path).toBe(`/${projects}/${website}/`);
    expect((await pathOf(design)).path).toBe(`/${projects}/${website}/${design}/`);
    expect((await pathOf(design)).depth).toBe(2);
  });

  it("carries the whole subtree when a folder moves", async () => {
    /*
     * The defect: the path trigger fired only for the row being updated, so moving
     * `Website` rewrote `Website.path` and left `Design` holding the old prefix. The
     * tree still *looked* right — `parent_id` never lied — while every ancestry read
     * (breadcrumb, descendant query, "is this inside that") was answered from a string
     * that pointed at a folder that was no longer above it.
     */
    const projects = await makeFolder(owner, "Projects", null);
    const website = await makeFolder(owner, "Website", projects);
    const design = await makeFolder(owner, "Design", website);
    const assets = await makeFolder(owner, "Assets", null);

    await db.asUser(owner, "select public.move_folder($1, $2)", [website, assets]);

    expect((await pathOf(website)).path).toBe(`/${assets}/${website}/`);
    // The grandchild moved with it, at the right depth under the new parent.
    expect((await pathOf(design)).path).toBe(`/${assets}/${website}/${design}/`);
    expect((await pathOf(design)).depth).toBe(2);
  });

  it("re-parents a subtree correctly more than once", async () => {
    // A second move is where a rescore written against the previous path would drift.
    const a = await makeFolder(owner, "A", null);
    const b = await makeFolder(owner, "B", a);
    const c = await makeFolder(owner, "C", b);
    const d = await makeFolder(owner, "D", c);

    await db.asUser(owner, "select public.move_folder($1, null)", [c]);
    expect((await pathOf(d)).path).toBe(`/${c}/${d}/`);
    expect((await pathOf(d)).depth).toBe(1);

    await db.asUser(owner, "select public.move_folder($1, $2)", [c, a]);
    expect((await pathOf(c)).path).toBe(`/${a}/${c}/`);
    expect((await pathOf(d)).path).toBe(`/${a}/${c}/${d}/`);
    expect((await pathOf(d)).depth).toBe(2);
  });

  it("moves a folder back to the root and shortens its descendants' paths", async () => {
    const a = await makeFolder(owner, "A", null);
    const b = await makeFolder(owner, "B", a);
    const c = await makeFolder(owner, "C", b);

    await db.asUser(owner, "select public.move_folder($1, null)", [b]);

    expect((await pathOf(b)).path).toBe(`/${b}/`);
    expect((await pathOf(c)).path).toBe(`/${b}/${c}/`);
    expect((await pathOf(c)).depth).toBe(1);
  });

  it("refuses to move a folder into its own descendant", async () => {
    // The cycle check predates this round; it must survive the rescore trigger.
    const a = await makeFolder(owner, "A", null);
    const b = await makeFolder(owner, "B", a);

    await expect(
      db.asUser(owner, "select public.move_folder($1, $2)", [a, b]),
    ).rejects.toThrow(/cycle|descendant/i);

    // Nothing changed, including the paths.
    expect((await pathOf(a)).path).toBe(`/${a}/`);
    expect((await pathOf(b)).path).toBe(`/${a}/${b}/`);
  });

  it("keeps two folders with the same name in different branches distinct", async () => {
    /*
     * A unique live name per parent is a rule the schema enforces, so the two `Reports`
     * live under different parents. What matters here is that the *paths* are distinct —
     * which is what stops a name collision becoming an id collision, and what a
     * leaf-only URL could not express.
     */
    const one = await makeFolder(owner, "Client A", null);
    const two = await makeFolder(owner, "Client B", null);
    const first = await makeFolder(owner, "Reports", one);
    const second = await makeFolder(owner, "Reports", two);

    expect((await pathOf(first)).path).toBe(`/${one}/${first}/`);
    expect((await pathOf(second)).path).toBe(`/${two}/${second}/`);
    expect(first).not.toBe(second);
  });

  it("refuses two live folders with the same name in one parent", async () => {
    // The conflict is the rule that stops an upload silently merging into an existing
    // folder of the same name.
    const parent = await makeFolder(owner, "Parent", null);
    await makeFolder(owner, "Reports", parent);
    await expect(makeFolder(owner, "Reports", parent)).rejects.toThrow(/folders_unique_live_name/);
  });

  it("does not let one customer see another's folder or its path", async () => {
    const mine = await makeFolderAs(owner, "Private", null);
    const rows = await db.asUser<{ id: string }>(stranger, "select id from public.folders where id = $1", [mine]);
    expect(rows).toHaveLength(0);
  });
});

describe("child counts", () => {
  const makeFolder = (name: string, parentId: string | null) => makeFolderAs(owner, name, parentId);

  async function makeFile(folderId: string | null, name: string, status = "available") {
    const rows = await db.asService<{ id: string }>(
      `insert into public.files (owner_id, folder_id, name, size_bytes, mime_type, category, status, storage_key)
       values ($1, $2, $3, 512, 'application/pdf', 'pdf', $4, $5) returning id`,
      [owner, folderId, name, status, `u/${owner}/${name}`],
    );
    return rows[0].id;
  }

  it("counts direct child folders and direct available files", async () => {
    const parent = await makeFolder("Parent", null);
    await makeFolder("Child A", parent);
    await makeFolder("Child B", parent);
    await makeFile(parent, "a.pdf");
    await makeFile(parent, "b.pdf");

    const rows = await db.asUser<{ folder_id: string; child_count: number }>(
      owner,
      "select * from public.folder_child_counts(array[$1]::uuid[])",
      [parent],
    );
    expect(rows).toEqual([{ folder_id: parent, child_count: 4 }]);
  });

  it("counts direct children only — a grandchild is not a child", async () => {
    // The count has to agree with what opening the folder shows, and that listing is
    // direct contents. A recursive count would say 2 here and the folder would open
    // with one row in it.
    const parent = await makeFolder("Parent", null);
    const child = await makeFolder("Child", parent);
    await makeFile(child, "deep.pdf");

    const [row] = await db.asUser<{ child_count: number }>(
      owner,
      "select * from public.folder_child_counts(array[$1]::uuid[])",
      [parent],
    );
    expect(row.child_count).toBe(1);
  });

  it("excludes deleted, trashed and unavailable rows", async () => {
    const parent = await makeFolder("Parent", null);
    await makeFile(parent, "available.pdf");
    await makeFile(parent, "pending.pdf", "pending");
    await makeFile(parent, "quarantined.pdf", "quarantined");
    const trashed = await makeFile(parent, "trashed.pdf");
    await db.asUser(owner, "update public.files set deleted_at = now() where id = $1", [trashed]);

    const gone = await makeFolder("Gone", parent);
    await db.asUser(owner, "update public.folders set deleted_at = now() where id = $1", [gone]);

    const [row] = await db.asUser<{ child_count: number }>(
      owner,
      "select * from public.folder_child_counts(array[$1]::uuid[])",
      [parent],
    );
    // Only the available, live file.
    expect(row.child_count).toBe(1);
  });

  it("omits an empty folder rather than reporting a meaningless row", async () => {
    const empty = await makeFolder("Empty", null);
    const rows = await db.asUser(owner, "select * from public.folder_child_counts(array[$1]::uuid[])", [
      empty,
    ]);
    expect(rows).toHaveLength(0);
  });

  it("counts many folders in one statement", async () => {
    /*
     * The reason this is a function at all. Sixty folder cards must not mean sixty
     * queries; one call returns all sixty counts.
     */
    const ids = await Promise.all([
      makeFolder("One", null),
      makeFolder("Two", null),
      makeFolder("Three", null),
    ]);
    await makeFile(ids[0], "x.pdf");
    await makeFile(ids[0], "y.pdf");

    const rows = await db.asUser<{ folder_id: string; child_count: number }>(
      owner,
      "select * from public.folder_child_counts(array[$1,$2,$3]::uuid[])",
      ids,
    );
    const byId = new Map(rows.map((row) => [row.folder_id, row.child_count]));
    expect(byId.get(ids[0])).toBe(2);
    expect(byId.get(ids[1])).toBeUndefined();
    expect(byId.get(ids[2])).toBeUndefined();
  });

  it("agrees with the contents the folder page lists", async () => {
    /*
     * The invariant a count has to hold: the badge and the page are the same question
     * asked twice. Both exclude trashed rows and unavailable files, so they must agree
     * after a trash and after a restore.
     */
    const parent = await makeFolder("Parent", null);
    await makeFolder("Child", parent);
    const file = await makeFile(parent, "a.pdf");

    const countNow = async () => {
      const [row] = await db.asUser<{ child_count: number }>(
        owner,
        "select * from public.folder_child_counts(array[$1]::uuid[])",
        [parent],
      );
      return row?.child_count ?? 0;
    };

    expect(await countNow()).toBe(2);

    await db.asUser(owner, "update public.files set deleted_at = now() where id = $1", [file]);
    expect(await countNow()).toBe(1);

    await db.asUser(owner, "select public.restore_items(array[$1]::uuid[])", [file]);
    expect(await countNow()).toBe(2);
  });

  it("does not report another owner's contents", async () => {
    const mine = await makeFolder("Mine", null);
    await makeFile(mine, "secret.pdf");

    // Through RLS: the stranger's call sees no rows, so the function cannot be used to
    // probe whether an id belongs to somebody.
    const rows = await db.asUser(stranger, "select * from public.folder_child_counts(array[$1]::uuid[])", [
      mine,
    ]);
    expect(rows).toHaveLength(0);
  });
});

describe("global file listing", () => {
  const makeFolder = (name: string, parentId: string | null) => makeFolderAs(owner, name, parentId);

  async function makeFile(folderId: string | null, name: string) {
    const rows = await db.asService<{ id: string }>(
      `insert into public.files (owner_id, folder_id, name, size_bytes, mime_type, category, status, storage_key)
       values ($1, $2, $3, 512, 'application/pdf', 'pdf', 'available', $4) returning id`,
      [owner, folderId, name, `u/${owner}/${name}`],
    );
    return rows[0].id;
  }

  it("returns files at every depth, which is what My Files means", async () => {
    /*
     * The listing that used to be wrong: `parentId: null` means the *root*, so the page
     * named "My Files" showed only files sitting at the top level. Everything inside a
     * folder was invisible there.
     */
    const projects = await makeFolder("Projects", null);
    const website = await makeFolder("Website", projects);

    await makeFile(null, "root.pdf");
    await makeFile(projects, "mid.pdf");
    const deep = await makeFile(website, "deep.pdf");

    // Unfiltered: every live available file this owner has.
    // The unfiltered question — every live available file, wherever it sits. This is
    // what the page's query now is. (`q3.pdf` is the suite's own fixture.)
    const all = await db.asUser<{ name: string }>(
      owner,
      "select name from public.files where deleted_at is null and status = 'available' order by name",
    );
    expect(all.map((row) => row.name)).toEqual(["deep.pdf", "mid.pdf", "q3.pdf", "root.pdf"]);

    // The root question is a different one, and still answerable.
    const root = await db.asUser<{ name: string }>(
      owner,
      "select name from public.files where folder_id is null and deleted_at is null",
    );
    expect(root.map((row) => row.name)).toEqual(["root.pdf"]);

    // And the deep file really is inside the nested folder.
    const inside = await db.asUser<{ name: string }>(
      owner,
      "select name from public.files where folder_id = $1",
      [website],
    );
    expect(inside.map((row) => row.name)).toEqual(["deep.pdf"]);
    expect(deep).toBeTruthy();
  });

  it("never lists a file that is not available", async () => {
    await db.asService(
      `insert into public.files (owner_id, folder_id, name, size_bytes, mime_type, category, status, storage_key)
       values ($1, null, 'pending.pdf', 512, 'application/pdf', 'pdf', 'pending', $2)`,
      [owner, `u/${owner}/pending.pdf`],
    );

    const rows = await db.asUser<{ name: string }>(
      owner,
      "select name from public.files where deleted_at is null and status = 'available'",
    );
    expect(rows.map((row) => row.name)).not.toContain("pending.pdf");
  });

  it("does not list another owner's files at any depth", async () => {
    const folder = await makeFolder("Private", null);
    await makeFile(folder, "secret.pdf");

    const rows = await db.asUser<{ name: string }>(stranger, "select name from public.files");
    expect(rows).toHaveLength(0);
  });
});

describe("folder ancestry", () => {
  it("returns the chain root first, including the folder itself", async () => {
    const a = await makeFolderAs(owner, "Projects", null);
    const b = await makeFolderAs(owner, "Website", a);
    const c = await makeFolderAs(owner, "Design", b);

    const chain = await db.asUser<{ id: string; name: string; depth: number }>(
      owner,
      "select id, name, depth from public.folder_ancestry($1)",
      [c],
    );
    expect(chain.map((row) => row.name)).toEqual(["Projects", "Website", "Design"]);
    expect(chain.map((row) => row.depth)).toEqual([0, 1, 2]);
  });

  it("is empty for a folder the caller cannot see", async () => {
    const mine = await makeFolderAs(owner, "Private", null);
    const chain = await db.asUser(stranger, "select * from public.folder_ancestry($1)", [mine]);
    expect(chain).toHaveLength(0);
  });
});

describe("the acceptance scenario", () => {
  it("shows a deeply nested tree at its correct locations, with accurate counts", async () => {
    /*
     * The round's acceptance criterion, as one database test: create
     * `Projects/Website/Design`, put a file at each level, then ask every question the
     * UI asks — the whole tree, one folder's contents, one folder's count, the ancestry
     * of the deepest folder — and finally move the root of the tree and ask them again.
     * If the hierarchy, the counts and the global listing can all be answered from the
     * rows, the screens built on them can be too.
     */
    const projects = await makeFolderAs(owner, "Projects", null);
    const website = await makeFolderAs(owner, "Website", projects);
    const design = await makeFolderAs(owner, "Design", website);

    const addFile = (folder: string | null, name: string) =>
      db.asService(
        `insert into public.files (owner_id, folder_id, name, size_bytes, mime_type, category, status, storage_key)
         values ($1, $2, $3, 10, 'image/png', 'images', 'available', $4)`,
        [owner, folder, name, `u/${owner}/${name}`],
      );

    await addFile(design, "homepage.png");
    await addFile(website, "brief.pdf");

    // Every file in the account, wherever it sits, exactly once — the global view.
    // (`q3.pdf` is this suite's own fixture, created in Reports at the top level.)
    const all = await db.asUser<{ name: string }>(owner, "select name from public.files order by name");
    expect(all.map((row) => row.name)).toEqual(["brief.pdf", "homepage.png", "q3.pdf"]);

    // One folder's direct contents — the folder page.
    const inWebsite = await db.asUser<{ name: string }>(
      owner,
      "select name from public.folders where parent_id = $1",
      [website],
    );
    expect(inWebsite.map((row) => row.name)).toEqual(["Design"]);

    // Counts that agree with those contents: Website holds Design + brief.pdf.
    const counts = await db.asUser<{ folder_id: string; child_count: number }>(
      owner,
      "select * from public.folder_child_counts(array[$1,$2]::uuid[])",
      [website, design],
    );
    const byFolder = new Map(counts.map((row) => [row.folder_id, row.child_count]));
    expect(byFolder.get(website)).toBe(2);
    expect(byFolder.get(design)).toBe(1);

    // The ancestry a breadcrumb and a nested URL are both built from.
    const chain = await db.asUser<{ name: string }>(owner, "select name from public.folder_ancestry($1)", [
      design,
    ]);
    expect(chain.map((row) => row.name)).toEqual(["Projects", "Website", "Design"]);

    // Move the top of the tree under a new root: nothing above breaks.
    const archive = await makeFolderAs(owner, "Archive", null);
    await db.asUser(owner, "select public.move_folder($1, $2)", [projects, archive]);

    const paths = await db.asService<{ name: string; path: string }>(
      "select name, path from public.folders order by depth, name",
    );
    expect(paths.find((row) => row.name === "Design")?.path).toBe(
      `/${archive}/${projects}/${website}/${design}/`,
    );

    // The files did not move with it — they are pinned to their folders, not paths.
    const stillThere = await db.asUser<{ name: string }>(
      owner,
      "select name from public.files where folder_id = $1",
      [design],
    );
    expect(stillThere.map((row) => row.name)).toEqual(["homepage.png"]);
  });
});
