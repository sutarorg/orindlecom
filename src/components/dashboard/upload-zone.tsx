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
export function UploadZone({ compact = false }: { compact?: boolean }) {
  const { addFiles } = useUploadManager();
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    addFiles(Array.from(files));
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
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
          handleFiles(event.dataTransfer.files);
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
