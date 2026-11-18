"use client";

import * as React from "react";
import { CloudUpload } from "lucide-react";
import { useUploadManager } from "./upload-manager";
import { cn } from "@/lib/utils";

/**
 * "Upload files" button that actually opens a file picker.
 *
 * Exists as its own component so every empty state can offer the primary action
 * without each page growing its own hidden input. Passes through to the single
 * upload manager, so there is one code path that accepts files.
 */
export function UploadTrigger({
  children = "Upload files",
  parentId = null,
  variant = "primary",
  className,
  icon: Icon = CloudUpload,
}: {
  children?: React.ReactNode;
  /**
   * Where the picked files land.
   *
   * Defaults to the root, which is right for the first-use state on a page that shows
   * the whole drive. The folder page passes its own id so "Upload files" from an empty
   * folder fills that folder rather than the top of the account.
   */
  parentId?: string | null;
  variant?: "primary" | "secondary";
  className?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
}) {
  const { addFiles } = useUploadManager();
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) addFiles(files, parentId);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          variant === "primary"
            ? "bg-primary text-white shadow-[var(--brand-shadow-primary)] hover:bg-primary-hover"
            : "border border-[var(--brand-border-strong)] bg-white text-ink hover:bg-[var(--brand-surface-muted)]",
          className,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        {children}
      </button>
    </>
  );
}
