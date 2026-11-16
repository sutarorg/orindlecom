"use client";

import * as React from "react";
import { CloudUpload } from "lucide-react";
import { useUploadManager } from "./upload-manager";

/**
 * Whole-window drop target.
 *
 * Dragging a file anywhere over the dashboard raises a single overlay rather
 * than making the visitor aim for a box. Guarded against the classic bug: a
 * dragleave fires when the pointer crosses a child element, so the overlay
 * counts enter/leave and only hides when the counter reaches zero.
 *
 * Files dragged from another page (where `dataTransfer.types` carries `text/uri-list`
 * and not `Files`) are ignored so we don't hijack ordinary link dragging.
 */
export function UploadDropzone() {
  const { addFiles } = useUploadManager();
  const [dragging, setDragging] = React.useState(false);
  const depth = React.useRef(0);

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
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length) addFiles(files);
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
  }, [addFiles, dragging]);

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
          Files go into the folder you&apos;re viewing.
        </p>
      </div>
    </div>
  );
}
