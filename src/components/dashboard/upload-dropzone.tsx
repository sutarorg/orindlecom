"use client";

import * as React from "react";
import { CloudUpload } from "lucide-react";
import { useUploadManager } from "./upload-manager";

/**
 * Walk a dropped directory and produce `File` objects carrying a relative path.
 *
 * `FileSystemEntry` is a non-standard, callback-based API that predates promises and
 * has no reliable DOM types for the read methods, so it is read defensively. Each
 * entry's `fullPath` is rewritten onto `webkitRelativePath` so the rest of the pipeline
 * sees exactly what a `webkitdirectory` picker produces.
 *
 * Shared with `UploadZone` rather than duplicated: dropping a folder in one place and
 * the other behaving differently would be a bug waiting to be reported twice.
 */
export function collectDirectory(
  directory: FileSystemDirectoryEntry,
  path: string,
  out: File[],
): Promise<void> {
  return new Promise((resolve) => {
    const reader = directory.createReader();
    // `readEntries` returns at most 100 per call and signals the end with an empty
    // batch, so it must be called repeatedly.
    const readBatch = () => {
      reader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve();
          return;
        }

        for (const entry of entries) {
          if (entry.isDirectory) {
            await collectDirectory(entry as FileSystemDirectoryEntry, `${path}/${entry.name}`, out);
          } else {
            const file = await new Promise<File | null>((done) => {
              (entry as FileSystemFileEntry).file(
                (result) => {
                  Object.defineProperty(result, "webkitRelativePath", {
                    value: `${path}/${entry.name}`,
                    configurable: true,
                  });
                  done(result);
                },
                () => done(null),
              );
            });
            if (file) out.push(file);
          }
        }

        readBatch();
      }, () => resolve());
    };

    readBatch();
  });
}

/**
 * Whole-window drop target.
 *
 * Dragging a file anywhere over the dashboard raises a single overlay rather than
 * making the visitor aim for a box. Guarded against the classic bug: a `dragleave`
 * fires when the pointer crosses a child element, so the overlay counts enter/leave and
 * only hides when the counter reaches zero.
 *
 * Files dragged from another page (where `dataTransfer.types` carries `text/uri-list`
 * and not `Files`) are ignored so we don't hijack ordinary link dragging.
 *
 * Two things it used to get wrong, both now fixed here:
 *
 *   1. **It flattened folders.** `dataTransfer.files` refuses to expose a directory's
 *      contents, so a dropped folder arrived as zero files and simply vanished — with a
 *      message saying it had been uploaded. Reading through `webkitGetAsEntry` is the
 *      only way to see inside one, and it is what the zone on the page already did.
 *   2. **It ignored the folder being viewed.** It handed every file to `addFiles` with
 *      no parent, so a drop inside `Research/Reports` landed at the root while the
 *      overlay said the opposite.
 */
export function UploadDropzone({ parentId = null }: { parentId?: string | null }) {
  const { addFiles, addFolder } = useUploadManager();
  const [dragging, setDragging] = React.useState(false);
  const depth = React.useRef(0);

  // The window listener is installed once; the destination is read through a ref so a
  // navigation does not tear down and re-add every listener on the page.
  const parentRef = React.useRef(parentId);
  React.useEffect(() => {
    parentRef.current = parentId;
  }, [parentId]);

  React.useEffect(() => {
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      if (depth.current === 1) setDragging(true);
    };

    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      // Required, or the drop event never fires.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };

    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);

      const transfer = event.dataTransfer;
      if (!transfer) return;

      const target = parentRef.current;
      const entries = Array.from(transfer.items ?? [])
        .map((item) =>
          (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null })
            .webkitGetAsEntry?.(),
        )
        .filter((entry): entry is FileSystemEntry => Boolean(entry));

      const directories = entries.filter((entry) => entry.isDirectory);

      if (directories.length === 0) {
        const files = Array.from(transfer.files ?? []);
        if (files.length) addFiles(files, target);
        return;
      }

      /*
       * Collect synchronously from the drop's own event.
       *
       * Directory reads are asynchronous but the entries were captured while the
       * gesture was still live, so the tree survives the `await`. The loose files —
       * anything dropped beside the folders — go to the same destination rather than
       * being split off to the root.
       */
      const collected: File[] = [];
      void (async () => {
        for (const entry of directories) {
          await collectDirectory(entry as FileSystemDirectoryEntry, entry.name, collected);
        }
        const looseFiles = Array.from(transfer.files ?? []).filter(
          (file) => !file.webkitRelativePath,
        );
        if (collected.length > 0) await addFolder(collected, target);
        if (looseFiles.length > 0) addFiles(looseFiles, target);
      })();
    };

    // Escape cancels a drag in progress, which browsers don't do for us.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dragging) {
        depth.current = 0;
        setDragging(false);
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [addFiles, addFolder, dragging]);

  if (!dragging) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[180] flex items-center justify-center bg-[rgba(14,20,48,0.28)] p-6 backdrop-blur-[2px] motion-safe:animate-[fadeIn_120ms_ease-out]"
      role="status"
      aria-live="polite"
    >
      <div className="flex max-w-[420px] flex-col items-center rounded-[20px] border-2 border-dashed border-white/70 bg-white/95 px-10 py-12 text-center shadow-[0_24px_60px_-12px_rgba(23,29,58,0.35)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <CloudUpload className="h-7 w-7" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <p className="mt-4 text-[16px] font-extrabold tracking-[-0.03em] text-ink">
          Drop to upload
        </p>
        <p className="mt-1 text-[12.5px] text-text-muted">
          {parentId ? "Files and folders go into the folder you're viewing." : "Files and folders go into My Files."}
        </p>
      </div>
    </div>
  );
}
