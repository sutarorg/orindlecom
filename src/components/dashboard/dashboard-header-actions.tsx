"use client";

import * as React from "react";
import { CloudUpload, FolderPlus } from "lucide-react";
import { useUploadManager } from "./upload-manager";
import { NewFolderDialog } from "./new-folder-dialog";
import { cn } from "@/lib/utils";

/**
 * Page-level primary actions.
 *
 * Upload is the primary because that is what a storage product exists for; the
 * file picker is shared with the shell's hidden input through the upload
 * manager, so there is exactly one code path that accepts files.
 */
export function DashboardActions({
  showFolder = true,
  showUpload = true,
  /**
   * On the folders route the only sensible creation is a folder — offering
   * "upload files" there would drop files at the root while the visitor is
   * looking at a folder list. `showUpload={false}` keeps the action honest.
   */
  showFolderOnly = false,
  className,
}: {
  showFolder?: boolean;
  showUpload?: boolean;
  showFolderOnly?: boolean;
  className?: string;
}) {
  const { addFiles } = useUploadManager();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [folderOpen, setFolderOpen] = React.useState(false);

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
      {(showFolder || showFolderOnly) && (
        <button
          type="button"
          onClick={() => setFolderOpen(true)}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[12.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            className,
          )}
        >
          <FolderPlus className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2.1} aria-hidden="true" />
          New folder
        </button>
      )}
      {showUpload && !showFolderOnly && (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <CloudUpload className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
        Upload files
      </button>
      )}
      <NewFolderDialog open={folderOpen} onClose={() => setFolderOpen(false)} />
    </>
  );
}
