"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import type { DriveItem } from "@/lib/drive/types";

/**
 * Rename dialog.
 *
 * Validation mirrors the server's rule set exactly, so the person sees the problem
 * before a round trip. The server still decides: if it refuses, the dialog stays open
 * with the server's own sentence rather than closing over a toast.
 *
 * The extension is pre-selected only when the name looks like it has one, so
 * renaming "report.pdf" to "statement" does not silently produce "statement.pdf" —
 * the caret lands after the extension, which is the convention people expect from a
 * file manager.
 */
export function RenameDialog({
  item,
  onClose,
  onRename,
}: {
  item: DriveItem | null;
  onClose: () => void;
  /** Resolves to an error message, or null when the rename was accepted. */
  onRename: (id: string, name: string) => Promise<string | null>;
}) {
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const errorId = React.useId();

  React.useEffect(() => {
    if (item) {
      setName(item.name);
      setError(undefined);
      setPending(false);
    }
  }, [item]);

  // Select the stem on open, leaving the extension out of the selection.
  React.useEffect(() => {
    if (!item) return;
    const input = inputRef.current;
    if (!input) return;
    const dot = item.kind === "folder" ? -1 : item.name.lastIndexOf(".");
    input.focus();
    input.setSelectionRange(0, dot > 0 ? dot : item.name.length);
  }, [item]);

  const validate = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return "Give it a name.";
    if (trimmed === item?.name) return "That's the current name.";
    if (trimmed.length > 255) return "Keep the name under 255 characters.";
    if (/[/\\:*?"<>|]/.test(trimmed)) return 'A name can\u2019t contain \\ / : * ? " < > |';
    if (trimmed.startsWith(".")) return "A name can\u2019t start with a dot.";
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(trimmed.split(".")[0] ?? "")) {
      return "That name is reserved by Windows. Try another.";
    }
    return undefined;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item) return;

    const message = validate(name);
    if (message) {
      setError(message);
      return;
    }

    setPending(true);
    const serverError = await onRename(item.id, name.trim());
    setPending(false);

    if (serverError) {
      setError(serverError);
      return;
    }
    onClose();
  };

  return (
    <Dialog open={Boolean(item)} onClose={onClose} title="Rename">
      <form onSubmit={submit} noValidate>
        <label htmlFor={inputId} className="block text-[12px] font-medium text-ink">
          New name
        </label>
        <input
          ref={inputRef}
          id={inputId}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="mt-1.5 h-9 w-full rounded-lg border border-[var(--brand-border)] bg-white px-2.5 text-[13px] text-ink focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.14)]"
        />

        {error && (
          <p id={errorId} role="alert" className="mt-2 text-[11.5px] text-[#C93B2B]">
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[12px] font-medium text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="h-8 rounded-lg bg-primary px-3 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {pending ? "Renaming…" : "Rename"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
