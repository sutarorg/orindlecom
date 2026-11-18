/**
 * The interaction rules the drive had wrong.
 *
 * Everything here is a rule that lives in a component's source rather than in a type,
 * so it can only be checked by reading the component. That is weaker than a behavioural
 * test, and it is what is available without a DOM: there is no browser in this
 * environment, so a test that clicked a menu would not run anywhere.
 *
 * Each assertion names the behaviour it stands in for. If a future change breaks the
 * behaviour, this fails and points at the reason.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (file: string) => readFile(path.join(ROOT, file), "utf8");

describe("the row menu", () => {
  it("stops its clicks from reaching the tile that opened it", async () => {
    /*
     * The menu is a portal, and a portal relocates where its children paint, not who
     * their React parent is. A click on "Share" therefore bubbled through the component
     * tree into the tile's onClick, which opened the preview — the glitch where choosing
     * a row action also previewed the file.
     */
    const menu = await read("src/components/ui/menu.tsx");
    expect(menu).toMatch(/onClick=\{\(event\) => \{[\s\S]{0,900}?event\.stopPropagation\(\)/);
  });

  it("opens with no item highlighted", async () => {
    /*
     * Focusing item one painted it with the focus background, which reads as "already
     * chosen" — and in the bin it made "Restore" look like the default action on a
     * deleted file.
     */
    const menu = await read("src/components/ui/menu.tsx");
    expect(menu).toMatch(/panelRef\.current\?\.focus\(\)/);
    expect(menu).not.toMatch(/items_\(\)\[0\]\?\.focus\(\)/);
    // The panel has to be focusable for that to work.
    expect(menu).toMatch(/tabIndex=\{-1\}/);
  });

  it("highlights on keyboard focus, not on the browser's neutral focus", async () => {
    const menu = await read("src/components/ui/menu.tsx");
    expect(menu).not.toMatch(/ focus:bg-/);
    expect(menu).toMatch(/focus-visible:bg-/);
  });

  it("offers Preview for a file and names an icon for every entry", async () => {
    /*
     * "Preview" was the only entry with no icon, so it looked like a heading above a
     * list of icons rather than something you could press. Both views share the menu,
     * so both are checked.
     */
    for (const file of ["src/components/dashboard/file-grid.tsx", "src/components/dashboard/file-list.tsx"]) {
      const source = await read(file);
      expect(source).toMatch(/label: item\.kind === "folder" \? "Open" : "Preview"/);
      expect(source).toMatch(/icon: item\.kind === "folder" \? FolderInput : Eye/);
    }
  });
});

describe("the preview panel", () => {
  it("clears its loading state on success, not only on failure", async () => {
    /*
     * `setLoading(false)` was called only on the error branch, so a successful mint
     * left `loading` true forever. The render checks `loading` first, so the panel sat
     * on "Loading preview…" while the image had already arrived — the single longest
     * "load" in the product, which was really a state bug.
     */
    const panel = await read("src/components/dashboard/preview-panel.tsx");
    const stage = panel.slice(panel.indexOf("function PreviewStage"));
    /*
     * `setLoading(false)` must follow the success path that sets the source, and it
     * must come *before* the error branch — the bug was that the only call sat inside
     * the error branch, so success never cleared the flag.
     */
    const successIndex = stage.indexOf("setSource(result.data.url)");
    const errorIndex = stage.indexOf("setErrorMessage(result.message)");
    expect(successIndex).toBeGreaterThan(-1);
    const between = stage.slice(successIndex, errorIndex > successIndex ? errorIndex : successIndex + 400);
    expect(between).toMatch(/setLoading\(false\)/);
  });

  it("keeps a signed URL between opens instead of minting one each time", async () => {
    const panel = await read("src/components/dashboard/preview-panel.tsx");
    expect(panel).toMatch(/const PREVIEW_URL_TTL_MS/);
    expect(panel).toMatch(/function cachedUrl/);
    // The TTL has to be inside the five-minute life of a signed URL.
    expect(panel).toMatch(/4 \* 60 \* 1000/);
  });

  it("warms the neighbouring files so arrow-stepping does not stall", async () => {
    const panel = await read("src/components/dashboard/preview-panel.tsx");
    expect(panel).toMatch(/export function prefetchPreview/);
    expect(panel).toMatch(/prefetchPreview\(previous\);\s*\n\s*prefetchPreview\(next\);/);
  });
});

describe("folder nesting", () => {
  it("lists only the top of the tree on the Folders page", async () => {
    /*
     * `list({ scope: "folders" })` with no parent meant *no filter*, so the page showed
     * every folder at every depth, flat. A folder created inside another one appeared
     * both inside its parent and here, and neither list showed the nesting.
     */
    const page = await read("src/app/dashboard/folders/page.tsx");
    expect(page).toMatch(/rootOnly: true/);
  });

  it("populates a folder's ancestry from the path column", async () => {
    // `folderToItem` used to return `path: []` unconditionally, so a folder three
    // levels deep rendered a one-crumb breadcrumb.
    const repo = await read("src/lib/drive/supabase-repository.ts");
    // `path: []` was literal; it now comes from the row's own path column.
    expect(repo).toMatch(/path: names \? ancestorCrumbs\(row\.path, names\) : \[\]/);
    // Files and trash rows carry no ancestry, so they still have an empty path; the
    // *folder* mapping must not.
    const folderMapper = repo.slice(repo.indexOf("function folderToItem"), repo.indexOf("async function listTrash"));
    expect(folderMapper).not.toMatch(/path: \[\]/);
    // The parsing itself is a pure module with its own unit tests.
    const helper = await read("src/lib/drive/folder-path.ts");
    expect(helper).toMatch(/export function ancestorCrumbs/);
  });

  it("creates inside the folder being viewed", async () => {
    const detail = await read("src/components/dashboard/folder-detail.tsx");
    // Both the header action and the empty state must pass the folder, or "New folder"
    // inside a folder would create at the root.
    expect(detail).toMatch(/<DashboardActions parentId=\{folder\.id\} \/>/);
  });
});

describe("card shape", () => {
  it("gives files and folders the same landscape plate", async () => {
    /*
     * Files were square and folders landscape, so a mixed grid had two card heights and
     * rows stepped where the kinds met. Worse, the square crop threw away the sides of
     * every screenshot.
     */
    const thumb = await read("src/components/dashboard/file-thumbnail.tsx");
    expect(thumb).toMatch(/aspect-\[16\/10\]/);
    /*
     * Assert on the class string, not on the whole file: the comment explaining the
     * change has to name the old class, and a grep for a word cannot tell a comment
     * from a class.
     */
    const plateClasses = [...thumb.matchAll(/"(relative aspect-[^"]+)"/g)].map((m) => m[1]);
    expect(plateClasses).toHaveLength(1);
    expect(plateClasses[0]).not.toMatch(/aspect-square/);

    const grid = await read("src/components/dashboard/file-grid.tsx");
    expect(grid).toMatch(/aspect-\[16\/10\]/);
  });

  it("crops the server thumbnail to the same shape as the plate", async () => {
    // A square thumbnail under a landscape plate is cropped twice: the sides go on the
    // server and the top and bottom go again in CSS.
    const route = await read("src/app/api/thumbnails/[id]/image/route.ts");
    expect(route).toMatch(/const TILE_W = 480/);
    expect(route).toMatch(/const TILE_H = 300/);
    expect(route).toMatch(/resize\(TILE_W, TILE_H/);
  });

  it("sizes the folder glyph as a share of its plate, not a fixed sticker", async () => {
    /*
     * A fixed pixel size cannot track a plate that is `w-full aspect-[16/10]`: it grew
     * into the edges on a narrow column and shrank into the middle on a wide one. Only
     * the width is set, so the SVG's 48:40 viewBox keeps the aspect.
     */
    const icon = await read("src/components/dashboard/file-icon.tsx");
    expect(icon).toMatch(/size === "xxl" && "w-\[42%\] h-auto"/);
  });
});

describe("opening a folder", () => {
  it("fetches the folder once and in parallel with its contents", async () => {
    /*
     * The page and its `generateMetadata` each fetched the folder — two identical
     * queries — and the listing was awaited after the folder rather than beside it,
     * even though the listing is scoped by the URL id and does not depend on it.
     *
     * The route is a catch-all now: `/dashboard/folders/a/b/c` is a real address, so
     * one segment is a chain of length one rather than a special case.
     */
    const page = await read("src/app/dashboard/folders/[...path]/page.tsx");
    expect(page).toMatch(/const getFolder = cache\(/);
    // The 404 check still comes before anything renders.
    expect(page).toMatch(/notFound\(\)/);
  });
});

describe("the folder tree in the URL", () => {
  it("parses every depth, not just one", async () => {
    /*
     * The shell matched `/dashboard/folders/<one-uuid>` exactly. On a nested folder's
     * canonical URL it matched nothing, so `currentFolderId` was null and every shell
     * action — Upload, New folder, the mobile button, the drop overlay — silently
     * targeted the account root.
     */
    const shell = await read("src/components/dashboard/dashboard-shell.tsx");
    // A single uuids-only pattern became "any non-empty chain".
    expect(shell).toContain('const match = /^\\/dashboard\\/folders\\/(.+?)\\/?$/i');
    expect(shell).toMatch(/ids\[ids\.length - 1\]/);
  });

  it("threads the active folder into the pickers and the drop overlay", async () => {
    const shell = await read("src/components/dashboard/dashboard-shell.tsx");
    expect(shell).toMatch(/useUploadPicker\(currentFolderId\)/);
    expect(shell).toMatch(/<UploadDropzone parentId=\{currentFolderId\}/);
    expect(shell).toMatch(/<NewFolderDialog[\s\S]{0,200}parentId=\{currentFolderId\}/);
  });

  it("keeps the one-id address working by redirecting to the canonical chain", async () => {
    const page = await read("src/app/dashboard/folders/[...path]/page.tsx");
    // The chain is compared against the folder's own ancestry, never trusted from the URL.
    expect(page).toMatch(/matchesChain\(ids, chainIds\(folder\)\)/);
    expect(page).toMatch(/redirect\(folderHrefFromIds\(chainIds\(resolved\.folder\)\)\)/);
    // A malformed chain is a 404 before any query runs.
    expect(page).toMatch(/parseFolderPath\(segments\)/);
  });

  it("exports a catch-all route so a deep URL is a page, not a 404", async () => {
    // `[...path]` in the directory name is what makes any depth routable; asserting on
    // the file's own existence is the check, so the read succeeding is the point.
    const page = await read("src/app/dashboard/folders/[...path]/page.tsx");
    expect(page).toMatch(/params: Promise<\{ path: string\[\] \}>/);
  });
});

describe("a folder page", () => {
  it("lists child folders as well as files", async () => {
    /*
     * `scope: "files"` means files. The page asked for it, so a folder containing only
     * subfolders rendered "This folder is empty" while those subfolders existed and were
     * reachable from Recent. There was no scope that could say "the contents of this
     * folder"; `all` is it.
     */
    const page = await read("src/app/dashboard/folders/[...path]/page.tsx");
    expect(page).toMatch(/scope: "all", parentId: folder\.id/);
    expect(page).not.toMatch(/scope: "files", parentId/);
  });

  it("builds a cumulative URL for every crumb", async () => {
    const detail = await read("src/components/dashboard/folder-detail.tsx");
    expect(detail).toMatch(/folderHrefFromIds\(trail\.slice\(0, index \+ 1\)/);
    // The old form linked each crumb to its own bare id.
    expect(detail).not.toMatch(/href=\{`\/dashboard\/folders\/\$\{ancestor\.id\}`\}/);
  });

  it("uploads into itself", async () => {
    // The page's drop zone and toolbar used to default to the root, so the copy
    // "goes into the folder you're viewing" was false.
    const detail = await read("src/components/dashboard/folder-detail.tsx");
    expect(detail).toMatch(/<FileManager[\s\S]{0,120}parentId=\{folder\.id\}/);
    const zone = await read("src/components/dashboard/upload-zone.tsx");
    expect(zone).toMatch(/addFiles\(files, parentId\)/);
    expect(zone).toMatch(/addFolder\(collected, parentId\)/);
  });
});

describe("My Files", () => {
  it("asks for the whole drive rather than the root", async () => {
    /*
     * `parentId: null` is the root, so the page named after "My Files" showed only the
     * files that sat at the top level. Everything inside a folder was invisible there.
     */
    const page = await read("src/app/dashboard/files/page.tsx");
    expect(page).toMatch(/list\(\{ scope: "all", withPaths: true \}\)/);
    // The comment above the query names the old call; the call itself must be gone.
    expect(page).not.toMatch(/list\(\{ scope: "files", parentId: null \}\)/);
  });

  it("distinguishes an omitted parent from the root in the API", async () => {
    // `params.get("parentId") || null` collapsed "everywhere" into "the root".
    const route = await read("src/app/api/files/route.ts");
    expect(route).toMatch(/rawParent === null \|\| rawParent === ""/);
    expect(route).toMatch(/: rawParent === "root"\s*\n?\s*\? null/);
    expect(route).not.toMatch(/parentId: params\.get\("parentId"\) \|\| null/);
    expect(route).toMatch(/"all",/);
  });
});

describe("the sidebar upload control", () => {
  it("offers files and folders through an accessible menu", async () => {
    const sidebar = await read("src/components/dashboard/sidebar.tsx");
    expect(sidebar).toMatch(/aria-haspopup="menu"/);
    expect(sidebar).toMatch(/aria-expanded=\{uploadOpen\}/);
    const chooser = await read("src/components/dashboard/upload-chooser.tsx");
    expect(chooser).toMatch(/role="menu"/);
    expect(chooser).toMatch(/label: "Upload files"/);
    expect(chooser).toMatch(/label: "Upload folder"/);
    // The directory picker is a second input, not a modifier on the first.
    expect(chooser).toMatch(/webkitdirectory: ""/);
  });

  it("sends both actions to the folder being viewed", async () => {
    const chooser = await read("src/components/dashboard/upload-chooser.tsx");
    expect(chooser).toMatch(/addFiles\(files, parentId\)/);
    expect(chooser).toMatch(/addFolder\(files, parentId\)/);
  });

  it("clears the picker so re-picking the same directory works", async () => {
    // A file input keeps its selection, so a second pick of the same directory fires no
    // change event — the button appears dead.
    const chooser = await read("src/components/dashboard/upload-chooser.tsx");
    const valueResets = chooser.match(/event\.target\.value = ""/g) ?? [];
    expect(valueResets.length).toBe(2);
  });

  it("collapses the upload control to a blue circle", async () => {
    /*
     * The collapsed sidebar is a 68px rail of circular buttons — the profile avatar, the
     * workspace badge. The upload button was a 40px rounded rectangle in the middle of
     * them, which read as a different kind of control.
     */
    const sidebar = await read("src/components/dashboard/sidebar.tsx");
    expect(sidebar).toMatch(/h-10 w-10 justify-center rounded-full/);
  });

  it("collapses the new-folder control to a light grey circle", async () => {
    const sidebar = await read("src/components/dashboard/sidebar.tsx");
    expect(sidebar).toMatch(/rounded-full bg-\[var\(--brand-surface-muted\)\]/);
  });

  it("leaves the expanded look alone", async () => {
    // A circle in a 248px column would be a different design, not a fix.
    const sidebar = await read("src/components/dashboard/sidebar.tsx");
    expect(sidebar).toMatch(/\?\s*"h-10 w-10 justify-center rounded-full"\s*:\s*"h-10 gap-2 rounded-xl px-3\.5"/);
  });
});

describe("the global drop overlay", () => {
  it("recreates dropped directories instead of flattening them", async () => {
    /*
     * `dataTransfer.files` refuses to expose a directory's contents, so a dropped folder
     * arrived as zero files and vanished behind a message claiming it had uploaded.
     */
    const overlay = await read("src/components/dashboard/upload-dropzone.tsx");
    expect(overlay).toMatch(/webkitGetAsEntry/);
    expect(overlay).toMatch(/collectDirectory/);
    expect(overlay).toMatch(/await addFolder\(collected, target\)/);
  });

  it("targets the open folder rather than the root", async () => {
    const overlay = await read("src/components/dashboard/upload-dropzone.tsx");
    expect(overlay).toMatch(/const target = parentRef\.current/);
    expect(overlay).toMatch(/addFiles\(looseFiles, target\)/);
  });

  it("names the real destination in its own copy", async () => {
    // The overlay said "files go into the folder you're viewing" while sending them to
    // the root — the copy was the bug, stated confidently.
    const overlay = await read("src/components/dashboard/upload-dropzone.tsx");
    expect(overlay).toMatch(/folder you're viewing/);
    expect(overlay).toMatch(/go into My Files/);
  });
});

describe("folder uploads", () => {
  it("creates each folder once, parents first", async () => {
    const manager = await read("src/components/dashboard/upload-manager.tsx");
    expect(manager).toMatch(/const folders = new Map<string, string>\(\)/);
    expect(manager).toMatch(/for \(const segment of segments\)/);
    expect(manager).toMatch(/folders\.set\(key, result\.data\.id\)/);
  });

  it("prepares each file against its own directory", async () => {
    // The tree is created first, then each group is uploaded with the id of the folder
    // it belongs in — which is why a nested file lands where it was on disk.
    const manager = await read("src/components/dashboard/upload-manager.tsx");
    expect(manager).toMatch(/byTarget\.set\(target, \[\.\.\.\(byTarget\.get\(target\) \?\? \[\]\), file\]\)/);
    expect(manager).toMatch(/for \(const \[target, group\] of byTarget\) addFiles\(group, target\)/);
  });

  it("does not silently merge or overwrite on a name conflict", async () => {
    /*
     * A conflict is the server's decision and it is surfaced. Abandoning the subtree is
     * the honest outcome: there is nowhere to put the files, and merging into an
     * existing folder of the same name would mix two directories nobody asked to mix.
     */
    const manager = await read("src/components/dashboard/upload-manager.tsx");
    expect(manager).toMatch(/if \(!result\.ok\) \{[\s\S]{0,220}?failures\.push/);
    expect(manager).toMatch(/if \(failed\.has\(key\)\) return null/);
    expect(manager).toMatch(/skipped \+= 1/);
  });

  it("reports how many files a failure cost", async () => {
    const manager = await read("src/components/dashboard/upload-manager.tsx");
    expect(manager).toMatch(/\$\{skipped\} \$\{skipped === 1 \? "file was" : "files were"\} not uploaded/);
  });

  it("falls back to plain files when the browser ignored the directory attribute", async () => {
    // Uploading them is the closest honest behaviour; silently dropping them is not.
    const manager = await read("src/components/dashboard/upload-manager.tsx");
    expect(manager).toMatch(/if \(withPaths\.length === 0\) \{[\s\S]{0,200}?addFiles\(files, parentId\)/);
  });
});

describe("item counts", () => {
  it("fills the folder count in rather than leaving the placeholder", async () => {
    // Both mappers returned `childCount: 0` and nothing replaced it, so every folder
    // card claimed to be empty. The mapper still starts from zero — it cannot know the
    // count — but `list` now overwrites it from the aggregate.
    const repo = await read("src/lib/drive/supabase-repository.ts");
    expect(repo).toMatch(/childCount: countsResult\.get\(item\.id\) \?\? 0/);
  });

  it("counts in one batched call rather than per folder", async () => {
    const repo = await read("src/lib/drive/supabase-repository.ts");
    expect(repo).toMatch(/folder_child_counts/);
    // The count is fetched once for the whole set of folders on the page.
    expect(repo).toMatch(/folderChildCounts\(supabase, items\.filter/);
  });

  it("leaves counts alone when they could not be measured", async () => {
    // Writing zeroes that were never measured is a false statement about the folder.
    const repo = await read("src/lib/drive/supabase-repository.ts");
    expect(repo).toMatch(/if \(error\) \{[\s\S]{0,400}?return null;/);
  });
});
