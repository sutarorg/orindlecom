"use client";

import * as React from "react";
import { FolderPlus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { NOT_CONNECTED_MESSAGE } from "@/lib/drive/repository";
import { cn } from "@/lib/utils";

/**
 * New folder dialog.
 *
 * Validates the name the way a filesystem does — no empty, no path separators,
 * no leading dot, length capped — and then reports honestly that the folder
 * wasn't created, because there is no storage backend to create it in.
 *
 * The validation is the point of showing this dialog at all: it is the same
 * rule set the backend will enforce, so the contract is visible now rather
 * than discovered later.
 */

const FORBIDDEN = /[\\/:*?"<>|]/;

export function NewFolderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const inputId = React.useId();

  React.useEffect(() => {
    if (open) {
      setName("");
      setError(undefined);
      setPending(false);
    }
  }, [open]);

  const validate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "Give the folder a name.";
    if (trimmed.length > 120) return "Keep the name under 120 characters.";
    if (FORBIDDEN.test(trimmed)) return 'A name can\'t contain \\ / : * ? " < > |';
    if (trimmed.startsWith(".")) return "A name can't start with a dot.";
    return undefined;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = validate(name);
    if (message) {
      setError(message);
      return;
    }
    setPending(true);
    // The repository call lives on the server; with no storage connected it
    // returns `not_configured`. Reporting that is more useful than a spinner
    // that never resolves.
    await new Promise((resolve) => setTimeout(resolve, 450));
    setPending(false);
    onClose();
    toast({
      tone: "error",
      title: "Folder wasn't created",
      description: NOT_CONNECTED_MESSAGE,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New folder"
      description="Folders keep related files together and share a permission."
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--brand-border-strong)] bg-white px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-w-[92px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="new-folder-form"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 sm:min-w-[110px]"
          >
            {pending ? (
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            ) : (
              <FolderPlus className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden="true" />
            )}
            {pending ? "Creating…" : "Create folder"}
          </button>
        </>
      }
    >
      <form id="new-folder-form" onSubmit={submit} noValidate>
        <label htmlFor={inputId} className="mb-1.5 block text-[12.5px] font-semibold text-ink">
          Folder name
        </label>
        <input
          id={inputId}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(undefined);
          }}
          onBlur={() => {
            if (name) setError(validate(name));
          }}
          placeholder="Project files"
          data-autofocus
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            "h-10 w-full rounded-xl border bg-white px-3 text-[13.5px] text-ink placeholder:text-text-subtle",
            "focus:outline-none focus:ring-[3px]",
            error
              ? "border-[#D6455D] focus:border-[#D6455D] focus:ring-[rgba(214,69,93,0.16)]"
              : "border-[var(--brand-border-strong)] focus:border-primary focus:ring-[rgba(49,120,251,0.16)]",
          )}
        />
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-[11.5px] font-medium text-[#C93B2B]">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
