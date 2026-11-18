"use client";

import * as React from "react";
import { CloudUpload, FolderUp } from "lucide-react";
import { useUploadManager } from "./upload-manager";
import { cn } from "@/lib/utils";

/**
 * "Upload" as two distinct actions: files, or a whole folder.
 *
 * The sidebar button was labelled "Upload" and opened a file picker, so a folder
 * could not be uploaded from the one place in the product called Upload. The
 * capability existed — the upload manager has rebuilt a picked directory's tree since
 * it was written — but only the page header offered it, and only on some pages. So the
 * button now asks which of the two you mean.
 *
 * The two actions are deliberately not one button with a modifier: they produce
 * different results (loose files versus a recreated tree), so they are separate menu
 * items with separate labels, which is also what makes them usable with a screen
 * reader and reachable by keyboard.
 *
 * `parentId` is the folder being viewed. It is threaded to both paths, because the
 * alternative — uploading to the account root while the page shows a folder — is the
 * bug this replaces: the old picker ignored the open folder entirely, so an upload
 * begun inside `Research/Reports` landed at the top level.
 */

export interface UploadPickerHandles {
  openFiles: () => void;
  openFolder: () => void;
}

export function useUploadPicker(parentId: string | null) {
  const { addFiles, addFolder } = useUploadManager();
  const filesRef = React.useRef<HTMLInputElement>(null);
  const folderRef = React.useRef<HTMLInputElement>(null);

  const openFiles = React.useCallback(() => filesRef.current?.click(), []);
  const openFolder = React.useCallback(() => folderRef.current?.click(), []);

  /**
   * The two hidden inputs.
   *
   * Each one clears its own value after a pick. A file input keeps its selection, so
   * re-picking the same directory a second time fires no `change` event — the browser
   * sees the same value and stays silent. That is a real bug and it looks like the
   * button stopped working. Clearing the value is what makes a retry a retry.
   */
  const inputs = (
    <>
      <input
        ref={filesRef}
        type="file"
        multiple
        className="hidden"
        data-testid="upload-picker-files"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) addFiles(files, parentId);
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        data-testid="upload-picker-folder"
        // React does not type these; they are real attributes and the only way to ask
        // a browser for a directory rather than a file.
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) void addFolder(files, parentId);
        }}
      />
    </>
  );

  return { openFiles, openFolder, inputs };
}

/**
 * The chooser itself: two rows, rendered by the sidebar or the mobile button.
 *
 * A plain absolutely-positioned panel rather than the shared `Menu`, because `Menu` is
 * anchored to a DOM node and positioned through a portal; here the anchor is a
 * full-width button inside a scrolling column, and a portal would need its own
 * collision handling to stay on screen. This panel is narrow, opens upward from the
 * bottom of the sidebar, and closes on Escape, on outside click, and on blur to
 * anywhere else.
 */
export function UploadChooser({
  open,
  onClose,
  onPickFiles,
  onPickFolder,
  collapsed = false,
  align = "start",
}: {
  open: boolean;
  onClose: () => void;
  onPickFiles: () => void;
  onPickFolder: () => void;
  /** In the icon rail the panel must not assume the full sidebar width. */
  collapsed?: boolean;
  align?: "start" | "end";
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const options: Array<{ label: string; hint: string; icon: typeof CloudUpload; run: () => void }> = [
    {
      label: "Upload files",
      hint: "Pick one or more files",
      icon: CloudUpload,
      run: onPickFiles,
    },
    {
      label: "Upload folder",
      hint: "Keeps the folder structure",
      icon: FolderUp,
      run: onPickFolder,
    },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Upload"
      className={cn(
        "absolute z-[60] w-[220px] overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white p-1 shadow-[0_16px_40px_-12px_rgba(23,29,58,0.28)]",
        "motion-safe:animate-[fadeIn_100ms_ease-out]",
        align === "start" ? "left-0" : "right-0",
        collapsed ? "bottom-full mb-2" : "top-full mt-1.5",
      )}
    >
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            option.run();
          }}
          className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:bg-[var(--brand-surface-muted)] focus-visible:outline-none"
        >
          <option.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-[12.5px] font-semibold text-ink">{option.label}</span>
            <span className="mt-0.5 block text-[10.5px] text-text-muted">{option.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
