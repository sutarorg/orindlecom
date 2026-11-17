"use client";

import * as React from "react";
import { CloudUpload } from "lucide-react";
import { useUploadManager } from "./upload-manager";
import { cn } from "@/lib/utils";

/**
 * Upload dropzone.
 *
 * Two sizes: a tall empty-state target for a library with nothing in it, and a
 * compact bar once there are files to look at. Both accept drag-and-drop and
 * both open the file picker — the region is a button, not a div, so it is
 * reachable and activatable by keyboard.
 *
 * The drag state is local here (the window-level overlay is separate) so the
 * zone itself lights up under the pointer.
 */
/**
 * Walk a dropped directory and produce `File` objects carrying a relative path.
 *
 * `FileSystemEntry` is a non-standard, callback-based API that predates promises and
 * has no TypeScript DOM types for the read methods in all versions, so it is read
 * defensively. Each entry's `fullPath` is rewritten onto a `webkitRelativePath` so
 * the rest of the pipeline sees exactly what a `webkitdirectory` picker produces.
 */
function collectDirectory(
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

export function UploadZone({ compact = false }: { compact?: boolean }) {
  const { addFiles, addFolder } = useUploadManager();
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  /**
   * A drop, which may be files, folders, or both.
   *
   * `webkitGetAsEntry` is the only way to tell a dropped folder from a dropped file:
   * `dataTransfer.files` flattens a folder into nothing (the browser refuses to
   * expose a directory's contents that way). So the drop is walked through the entry
   * API first, and only falls back to the flat file list when entries are not
   * available. Dropping a folder recreates it, the same as picking one.
   */
  const handleDrop = async (transfer: DataTransfer) => {
    const items = Array.from(transfer.items ?? []);

    const entries = items
      .map((item) =>
        (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null })
          .webkitGetAsEntry?.(),
      )
      .filter((entry): entry is FileSystemEntry => Boolean(entry));

    if (entries.length === 0) {
      addFiles(Array.from(transfer.files));
      return;
    }

    const directoryEntries = entries.filter((entry) => entry.isDirectory);

    if (directoryEntries.length === 0) {
      addFiles(Array.from(transfer.files));
      return;
    }

    // Build File objects with a synthetic relative path so `addFolder` can rebuild
    // the tree. Reading must happen inside the drop's user activation window, which
    // is why this collects rather than streams.
    const collected: File[] = [];
    for (const entry of directoryEntries) {
      await collectDirectory(entry as FileSystemDirectoryEntry, entry.name, collected);
    }

    // Any loose files dropped alongside the folders still upload, at the top level.
    const looseFiles = Array.from(transfer.files).filter((file) => !file.webkitRelativePath);
    if (collected.length > 0) await addFolder(collected);
    if (looseFiles.length > 0) addFiles(looseFiles);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) addFiles(files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleDrop(event.dataTransfer);
        }}
        className={cn(
          "group flex w-full items-center justify-center rounded-xl border-2 border-dashed transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          dragging
            ? "border-primary bg-primary-soft/60"
            : "border-[var(--brand-border-strong)] bg-white hover:border-primary/50 hover:bg-[var(--brand-canvas)]",
          compact ? "gap-2.5 px-4 py-3" : "flex-col gap-3 px-6 py-10",
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center rounded-xl transition-colors",
            compact ? "h-8 w-8" : "h-12 w-12",
            dragging ? "bg-primary text-white" : "bg-primary-soft text-primary",
          )}
        >
          <CloudUpload
            className={compact ? "h-4 w-4" : "h-6 w-6"}
            strokeWidth={1.9}
            aria-hidden="true"
          />
        </span>
        <span className={compact ? "text-left" : "text-center"}>
          <span className={cn("block font-semibold text-ink", compact ? "text-[12.5px]" : "text-[14px]")}>
            {dragging ? "Drop to upload" : "Drag files here, or click to browse"}
          </span>
          {!compact && (
            <span className="mt-1 block text-[11.5px] text-text-muted">
              Images, documents, video and more. No per-file limit — bounded only by your storage allowance.
            </span>
          )}
        </span>
      </button>
    </>
  );
}
