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
import { ancestorCrumbs, ancestorPathIds, pathIds } from "@/lib/drive/folder-path";

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
