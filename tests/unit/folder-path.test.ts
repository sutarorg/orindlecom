/**
 * Folder ancestry.
 *
 * The database stores a folder's position as a slash-delimited list of ids and nothing
 * else. Turning that into a breadcrumb has three cases that are easy to get wrong and
 * invisible when you do: the folder itself must not appear as its own parent, a root
 * folder must produce no crumbs at all, and a name that is missing must not become an
 * id on screen.
 */
import { describe, expect, it } from "vitest";
import {
  ancestorCrumbs,
  ancestorPathIds,
  canonicalCrumbs,
  folderHref,
  folderHrefFromIds,
  matchesAncestry,
  parseFolderPath,
  pathIds,
} from "@/lib/drive/folder-path";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("pathIds", () => {
  it("reads the stored form", () => {
    // The trigger writes a leading and trailing slash.
    expect(pathIds(`/${A}/${B}/${C}/`)).toEqual([A, B, C]);
  });

  it("treats the empty and malformed cases as no path", () => {
    expect(pathIds(null)).toEqual([]);
    expect(pathIds(undefined)).toEqual([]);
    expect(pathIds("")).toEqual([]);
    expect(pathIds("/")).toEqual([]);
    expect(pathIds("///")).toEqual([]);
  });
});

describe("ancestorPathIds", () => {
  it("drops the folder itself", () => {
    // The stored path ends with the row's own id, so a breadcrumb that used it whole
    // would list the folder as its own parent.
    expect(ancestorPathIds(`/${A}/${B}/${C}/`)).toEqual([A, B]);
  });

  it("gives a root folder no ancestors", () => {
    // A folder at the top level stores just its own id. One crumb would be the folder,
    // and the page already says its name.
    expect(ancestorPathIds(`/${A}/`)).toEqual([]);
  });
});

describe("ancestorCrumbs", () => {
  const names = new Map([
    [A, "Clients"],
    [B, "Acme"],
  ]);

  it("labels the chain in order, outermost first", () => {
    expect(ancestorCrumbs(`/${A}/${B}/${C}/`, names)).toEqual([
      { id: A, name: "Clients" },
      { id: B, name: "Acme" },
    ]);
  });

  it("never puts an id on screen for a folder it could not name", () => {
    // A missing name is an empty label, not the uuid: an id in a breadcrumb is a
    // database detail the visitor should never see.
    const crumbs = ancestorCrumbs(`/${A}/${C}/`, names);
    expect(crumbs).toEqual([{ id: A, name: "Clients" }]);
    expect(ancestorCrumbs(`/${C}/x/`, new Map())).toEqual([{ id: C, name: "" }]);
  });
});

describe("canonical URLs", () => {
  it("addresses a folder by its whole chain, not by its leaf", () => {
    /*
     * The app used `/dashboard/folders/<leaf>` for every folder, so two folders with the
     * same name in different branches produced the same address and nothing about the
     * hierarchy could be read from a link.
     */
    expect(folderHref([{ id: A, name: "Projects" }])).toBe(`/dashboard/folders/${A}`);
    expect(
      folderHref([
        { id: A, name: "Projects" },
        { id: B, name: "Website" },
        { id: C, name: "Design" },
      ]),
    ).toBe(`/dashboard/folders/${A}/${B}/${C}`);
    expect(folderHrefFromIds([A, B, C])).toBe(`/dashboard/folders/${A}/${B}/${C}`);
  });

  it("keeps the one-id form working, because it is a chain of length one", () => {
    expect(folderHref([{ id: A, name: "Projects" }])).toBe(folderHrefFromIds([A]));
  });
});

describe("parseFolderPath", () => {
  it("accepts a chain of uuids", () => {
    expect(parseFolderPath([A])).toEqual([A]);
    expect(parseFolderPath([A, B, C])).toEqual([A, B, C]);
  });

  it("rejects anything that is not a uuid, before the database is touched", () => {
    expect(parseFolderPath([])).toBeNull();
    expect(parseFolderPath(["not-a-uuid"])).toBeNull();
    expect(parseFolderPath([A, "B"])).toBeNull();
    // A trailing slash arrives as no segment, but a stray empty one must not pass.
    expect(parseFolderPath([A, ""])).toBeNull();
  });
});

describe("matchesAncestry", () => {
  it("accepts the URL that names the real chain", () => {
    expect(matchesAncestry([A, B, C], `/${A}/${B}/${C}/`)).toBe(true);
  });

  it("rejects a chain of the wrong length", () => {
    // A one-id URL for a nested folder — the legacy form. It is valid, but it is not
    // canonical, so it redirects rather than rendering.
    expect(matchesAncestry([C], `/${A}/${B}/${C}/`)).toBe(false);
    // Skipping a level is not "close enough": the breadcrumb would not match the tree.
    expect(matchesAncestry([A, C], `/${A}/${B}/${C}/`)).toBe(false);
  });

  it("rejects a chain in the wrong order", () => {
    expect(matchesAncestry([B, A, C], `/${A}/${B}/${C}/`)).toBe(false);
  });

  it("rejects an id that is simply not an ancestor", () => {
    // This is the shape of `/dashboard/folders/<someone-elses-id>/<your-id>`: the leaf
    // is real and readable, so only the ancestry comparison catches it.
    const stranger = "99999999-9999-4999-8999-999999999999";
    expect(matchesAncestry([stranger, C], `/${A}/${B}/${C}/`)).toBe(false);
  });

  it("rejects an empty or missing stored path", () => {
    expect(matchesAncestry([A], null)).toBe(false);
    expect(matchesAncestry([A], "")).toBe(false);
  });
});

describe("canonicalCrumbs", () => {
  it("labels every level, including the folder itself", () => {
    const names = new Map([
      [A, "Projects"],
      [B, "Website"],
      [C, "Design"],
    ]);
    expect(canonicalCrumbs(`/${A}/${B}/${C}/`, names)).toEqual([
      { id: A, name: "Projects" },
      { id: B, name: "Website" },
      { id: C, name: "Design" },
    ]);
  });

  it("keeps the id even when the name is missing", () => {
    // A breadcrumb without a label is unhelpful; a breadcrumb without a link is broken.
    expect(canonicalCrumbs(`/${A}/`, new Map())).toEqual([{ id: A, name: "" }]);
  });
});
