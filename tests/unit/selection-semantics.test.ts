/**
 * Click and selection rules, as source assertions.
 *
 * These behaviours live inside client components and would need a DOM harness to
 * exercise directly. What is worth guarding is not the rendering — it is the
 * *decision*: a click in this product opens, and selection is an explicit mode that
 * only the three-dot menu enters. Both were the opposite before, and both are the
 * kind of thing a later edit can quietly reverse while every other test still
 * passes.
 *
 * The assertions are deliberately narrow: they check that the branch exists and
 * that the menu offers "Select", not the exact expression, so refactoring the click
 * handler does not break the test for no reason.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FOLDER_COLOURS, assignFolderColours } from "@/lib/drive/folder-colour";
import { ShareCardArt } from "@/components/marketing/feature-art";

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");

describe("click semantics", () => {
  for (const file of [
    "src/components/dashboard/file-grid.tsx",
    "src/components/dashboard/file-list.tsx",
  ]) {
    it(`${path.basename(file)} opens on click rather than selecting`, () => {
      const source = read(file);

      // There must be a branch on select mode, and opening must be the other side of it.
      expect(source).toMatch(/selectMode/);
      expect(source).toMatch(/onOpen\(/);

      // The old unconditional single-select must be gone: a plain click used to call
      // `select(item.id)` with no mode check anywhere.
      expect(source).not.toMatch(/else select\(item\.id\);/);
    });

    it(`${path.basename(file)} offers Select in the row menu`, () => {
      expect(read(file)).toMatch(/label: "Select"/);
    });
  }

  it("the three-dot button does not change the selection", () => {
    const grid = read("src/components/dashboard/file-grid.tsx");
    const list = read("src/components/dashboard/file-list.tsx");

    for (const source of [grid, list]) {
      // The menu button used to call `select(item.id)` / `onActivate`.
      expect(source).not.toMatch(/onClick=\{\(event\) => \{\s*event\.stopPropagation\(\);\s*select\(item\.id\)/);
      expect(source).toMatch(/setMenuOpen\(true\)/);
    }
  });
});

describe("select mode", () => {
  const store = read("src/components/dashboard/drive-store.tsx");

  it("is explicit state, entered deliberately", () => {
    expect(store).toMatch(/const \[selectMode, setSelectMode\] = React\.useState\(false\)/);
    expect(store).toMatch(/beginSelection/);
  });

  it("clears when the selection empties, so the bar cannot outlive it", () => {
    // Without this, deleting the last selected item leaves "0 selected" on screen.
    expect(store).toMatch(/selectMode && selected\.size === 0/);
  });

  it("is left by clicking empty space, but not by clicking a control", () => {
    // The exclusion list is the important half: pressing "Move" in the bar must not
    // clear the selection it is about to act on.
    expect(store).toMatch(/data-item-id/);
    expect(store).toMatch(/role='toolbar'|role=\\"toolbar\\"/);
    expect(store).toMatch(/mousedown/);
  });
});

describe("the star button", () => {
  const bar = read("src/components/dashboard/selection-bar.tsx");

  it("is not filled for a mixed selection", () => {
    // `filled` is the whole contract: a filled icon on a half-starred selection
    // claims a state half the items are not in.
    expect(bar).toMatch(/const filled = state === "all"/);
    expect(bar).toMatch(/fill-\[#F9A53B\]/);
  });

  it("reports its pressed state to assistive tech", () => {
    expect(bar).toMatch(/aria-pressed=\{filled\}/);
  });
});

describe("the move dialog", () => {
  const dialog = read("src/components/dashboard/move-dialog.tsx");

  it("excludes the folder the items already live in", () => {
    expect(dialog).toMatch(/id === currentParentId/);
  });

  it("asks the server for folders rather than taking them as a prop", () => {
    expect(dialog).toMatch(/\/api\/folders/);
  });
});

describe("every-format upload", () => {
  it("has no extension blocklist anywhere in the app", () => {
    // The decision is documented in `UPLOAD_LIMITS`; this asserts nothing still
    // enforces the opposite. A blocklist left behind in the server path would
    // reject files the UI accepts, which is the worst of both.
    for (const file of [
      "src/lib/drive/types.ts",
      "src/components/dashboard/upload-manager.tsx",
      "src/domain/storage/upload-service.ts",
    ]) {
      expect(read(file), `${file} still mentions blockedExtensions`).not.toMatch(/blockedExtensions/);
    }
  });

  it("keeps the checks that do something", () => {
    const service = read("src/domain/storage/upload-service.ts");
    // Size is still validated: it is the one input that can actually cause harm.
    expect(service).toMatch(/input\.size <= 0/);
  });
});

describe("folder colours", () => {
  it("gives neighbouring folders different colours", () => {
    // The property the colour exists for. A hash-based assignment could not hold it:
    // with four colours, two random folders collide a quarter of the time.
    const ids = Array.from({ length: 12 }, (_, index) => `folder-${index}`);
    const assigned = assignFolderColours(ids);
    const sequence = ids.map((id) => assigned.get(id)!.to);

    for (let index = 1; index < sequence.length; index += 1) {
      expect(sequence[index], `folders ${index - 1} and ${index} share a colour`).not.toBe(
        sequence[index - 1],
      );
    }
  });

  it("spreads an eight-folder listing evenly, not onto two colours", () => {
    const ids = Array.from({ length: 8 }, (_, index) => `f${index}`);
    const assigned = assignFolderColours(ids);
    const used = new Set([...assigned.values()].map((colour) => colour.to));
    expect(used.size).toBe(FOLDER_COLOURS.length);
  });

  it("uses the marketing hero palette and nothing else", () => {
    // The four pairs are the folder art on the landing page; a fifth colour invented
    // here would be a folder that does not exist anywhere else in the product.
    expect(FOLDER_COLOURS.map((colour) => colour.to)).toEqual([
      "#3B7DE8",
      "#38BD8B",
      "#FB8F3D",
      "#8B5CF6",
    ]);
  });

  it("is stable for the same listing", () => {
    const ids = ["a", "b", "c", "d"];
    const first = [...assignFolderColours(ids).values()].map((colour) => colour.to);
    const second = [...assignFolderColours(ids).values()].map((colour) => colour.to);
    expect(second).toEqual(first);
  });

  it("handles an empty listing without a first element", () => {
    expect(assignFolderColours([]).size).toBe(0);
  });
});

/**
 * The rules from this round of work.
 *
 * Each of these is a decision that a later edit could quietly reverse while every
 * other test still passed, so each one is asserted where it lives.
 */
describe("the tile has no selection checkbox", () => {
  it("does not render one", () => {
    // Selection starts from the three-dot menu's "Select". A checkbox on the plate
    // duplicated that and made a plain click look like it had two meanings.
    const grid = read("src/components/dashboard/file-grid.tsx");
    expect(grid).not.toMatch(/Selection checkbox/i);
    expect(grid).not.toMatch(/type="checkbox"/);
  });
});

describe("the overflow button paints over the thumbnail", () => {
  it("carries an explicit z-index and an opaque surface", () => {
    // DOM order alone did not win: the thumbnail painted its own opaque plate and
    // covered the dots on exactly the files where a menu matters most.
    const grid = read("src/components/dashboard/file-grid.tsx");
    expect(grid).toMatch(/absolute right-1\.5 top-1\.5 z-20/);
    expect(grid).toMatch(/bg-white\/95/);
  });
});

describe("a selected tile never opens a preview", () => {
  it("is enforced in the manager, not only in the tile", () => {
    const manager = read("src/components/dashboard/file-manager.tsx");
    expect(manager).toMatch(/if \(selected\.size > 0\) return;/);
  });
});

describe("archives have no preview", () => {
  it("is absent from the previewable set", () => {
    const panel = read("src/components/dashboard/preview-panel.tsx");
    const set = /const PREVIEWABLE = new Set<DriveItem\["category"\]>\(\[([\s\S]*?)\]\)/.exec(panel);
    expect(set, "PREVIEWABLE not found").toBeTruthy();
    expect(set![1]).not.toMatch(/"archive"/);
  });

  it("has no archive stage left behind", () => {
    expect(read("src/components/dashboard/preview-panel.tsx")).not.toMatch(/ArchiveStage/);
  });
});

describe("the bin's menus", () => {
  const grid = read("src/components/dashboard/file-grid.tsx");
  const list = read("src/components/dashboard/file-list.tsx");
  const bar = read("src/components/dashboard/selection-bar.tsx");

  it("offers exactly Restore, Select and Delete in a row", () => {
    for (const source of [grid, list]) {
      const branch = /if \(mode === "trash"\) \{([\s\S]*?)\n    \}/.exec(source);
      expect(branch, "trash menu branch not found").toBeTruthy();
      const body = branch![1];
      expect(body).toMatch(/label: "Restore"/);
      expect(body).toMatch(/label: "Select"/);
      expect(body).toMatch(/label: "Delete permanently"/);
      // No star, no share, no preview of a deleted file.
      expect(body).not.toMatch(/label: "Share"/);
      expect(body).not.toMatch(/label: "Preview"/);
      expect(body).not.toMatch(/Star/);
    }
  });

  it("offers exactly Restore, Download and Delete in the selection bar", () => {
    const branch = /mode === "trash" \? \(([\s\S]*?)\n        \) : \(/.exec(bar);
    expect(branch, "trash bar branch not found").toBeTruthy();
    const body = branch![1];
    expect(body).toMatch(/label="Restore"/);
    expect(body).toMatch(/label="Download"/);
    expect(body).toMatch(/label="Delete"/);
    expect(body).not.toMatch(/label="Move"/);
    expect(body).not.toMatch(/label="Share"/);
    expect(body).not.toMatch(/StarButton/);
  });
});

describe("sharing has two levels", () => {
  it("does not define an edit permission", () => {
    // The type is the contract; a `PermissionLevel` that still admitted `editor`
    // would let a selector offer a level no constraint accepts.
    const types = read("src/lib/drive/types.ts");
    expect(types).toMatch(/export type PermissionLevel = "viewer" \| "commenter";/);
    expect(types).not.toMatch(/editor: "Can edit"/);
  });

  it("has no public edit route", () => {
    expect(() => read("src/app/api/s/[token]/edit/route.ts")).toThrow();
  });
});

describe("comments on a shared file", () => {
  it("are read back through the link, not only written", () => {
    expect(() => read("src/app/api/s/[token]/comments/route.ts")).not.toThrow();
    const view = read("src/components/share/shared-item-view.tsx");
    expect(view).toMatch(/\/comments`/);
  });

  it("show a blank name as User, decided on the server", () => {
    const migration = read("supabase/migrations/0025_view_and_comment_only.sql");
    expect(migration).toMatch(/then 'User'/);
    // And the client does not invent a substitute of its own.
    expect(read("src/app/api/s/[token]/route.ts")).not.toMatch(/author \|\| "Guest"/);
  });
});

describe("new folders nest where they were created", () => {
  it("the shell derives the parent from the folder route", () => {
    const shell = read("src/components/dashboard/dashboard-shell.tsx");
    expect(shell).toMatch(/\\\/dashboard\\\/folders/);
    expect(shell).toMatch(/parentId=\{currentFolderId\}/);
  });
});

describe("the bin never shows a star", () => {
  it("is excluded in both views", () => {
    // Trashing does not clear `starred`, so the flag survives — but a star in the
    // bin invites an action nothing there can perform.
    for (const file of [
      "src/components/dashboard/file-grid.tsx",
      "src/components/dashboard/file-list.tsx",
    ]) {
      expect(read(file)).toMatch(/item\.starred && mode !== "trash"/);
    }
  });
});

describe("the tile's thumbnail is a downscaled image, not the original", () => {
  it("points the plate at the thumbnail route", () => {
    const thumb = read("src/components/dashboard/file-thumbnail.tsx");
    expect(thumb).toMatch(/\/api\/thumbnails\/\$\{encodeURIComponent\(item\.id\)\}\/image/);
  });

  it("the route downscales, re-encodes and caches", () => {
    const route = read("src/app/api/thumbnails/[id]/image/route.ts");
    expect(route).toMatch(/\.resize\(TILE_PX, TILE_PX/);
    expect(route).toMatch(/\.webp\(\{ quality: TILE_QUALITY/);
    expect(route).toMatch(/max-age=31536000, immutable/);
    // Visibility is decided by the repository read, not by the request.
    expect(route).toMatch(/const meta = await repo\.get\(id\);\s*\n\s*if \(!meta\.ok\)/);
  });
});

describe("the feature illustrations", () => {
  const art = read("src/components/marketing/feature-art.tsx");

  it("are single SVG compositions, not stacked divs", () => {
    // Each drawing is one <svg> with its own viewBox, so the slot's height changes the
    // scale and never the layout. A div build reflows — and the first div build had
    // text overflowing its own panel at the tablet width.
    const svgs = art.match(/<svg/g) ?? [];
    expect(svgs.length).toBeGreaterThanOrEqual(3);
    expect(art).toMatch(/viewBox="0 0 290 200"/);
    expect(art).toMatch(/preserveAspectRatio="xMidYMax meet"/);
  });

  it("derive every figure from one constant, so the drawing cannot contradict itself", () => {
    // The donut's arc, its label and the usage bar all read from `usedFraction`.
    expect(art).toMatch(/const usedFraction = 0\.24/);
    expect(art).toMatch(/circumference \* usedFraction/);
    expect(art).toMatch(/CONTENT_W \* usedFraction/);
    // And the bar's segments are the legend's own colours, in order.
    expect(art).toMatch(/const shares = \[0\.5, 0\.3, 0\.2\]/);
  });

  it("do not advertise the retired edit permission", () => {
    // "Can edit" was removed from the product in migration 0025. An illustration that
    // offered it would be the same lie as a settings screen that did.
    // Assert on the rendered text, not the source: the comment explaining the removal
    // names the retired level, and a source grep cannot tell a comment from a label.
    const rendered = renderToStaticMarkup(createElement(ShareCardArt));
    expect(rendered).not.toMatch(/Can edit/);
    expect(rendered).toMatch(/Can view/);
  });

  it("are decorative and correctly hidden from assistive tech", () => {
    for (const match of art.matchAll(/<svg[\s\S]{0,600}?>/g)) {
      expect(match[0]).toMatch(/aria-hidden="true"/);
    }
  });
});

describe("marketing copy about sharing", () => {
  const copy = read("src/components/marketing/product-preview.tsx");

  it("offers the access levels that exist, and only those", () => {
    /*
     * The product has two levels: view and comment. "Edit" was removed from the model
     * in migration 0025, so copy promising it is a promise the shared link cannot keep —
     * and the marketing page is exactly where that promise gets made.
     */
    expect(copy).not.toMatch(/edit access|can edit|edit or view/i);
    expect(copy).toMatch(/view or comment access/);
  });
});
