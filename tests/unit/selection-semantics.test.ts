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
import path from "node:path";
import { describe, expect, it } from "vitest";

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
