"use client";

import * as React from "react";
import { Check, Copy, Globe, Link2, Mail, ShieldCheck, UserX } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  PERMISSION_DESCRIPTION,
  PERMISSION_LABEL,
  type DriveItem,
  type PermissionLevel,
} from "@/lib/drive/types";
import { NOT_CONNECTED_MESSAGE } from "@/lib/drive/repository";
import { cn } from "@/lib/utils";

/**
 * Sharing dialog.
 *
 * Only the three permission levels the backend enforces are offered — no
 * "can manage", no "full control", no ownership transfer, because none of those
 * exist in the contract and a selector full of options that fail is worse than
 * a shorter honest one.
 *
 * The invite flow validates the address, refuses an invite to yourself (with the
 * item owner's identity), and then reports that nothing was sent, since there is
 * no backend to send it.
 */

export function ShareDialog({ item, onClose }: { item: DriveItem | null; onClose: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [permission, setPermission] = React.useState<PermissionLevel>("viewer");
  const [error, setError] = React.useState<string | undefined>();
  const [pending, setPending] = React.useState(false);
  const [linkEnabled, setLinkEnabled] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const emailId = React.useId();

  React.useEffect(() => {
    if (item) {
      setEmail("");
      setError(undefined);
      setPermission("viewer");
      setPending(false);
      setCopied(false);
      setLinkEnabled(false);
    }
  }, [item]);

  const open = Boolean(item);
  if (!item) return <Dialog open={false} onClose={onClose} title="Share" />;

  const validate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter an email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      return "Enter an email address we can send to.";
    }
    if (item.ownerName && trimmed.toLowerCase() === item.ownerName.toLowerCase()) {
      return "That's the person who shared this with you.";
    }
    return undefined;
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = validate(email);
    if (message) {
      setError(message);
      return;
    }
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setPending(false);
    toast({
      tone: "error",
      title: "Invite wasn't sent",
      description: NOT_CONNECTED_MESSAGE,
    });
  };

  const copyLink = async () => {
    // The link is only meaningful once a grant exists server-side. Copying a
    // fake URL to the clipboard would be actively harmful, so this explains
    // instead.
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    setPending(false);
    toast({
      tone: "error",
      title: "No link to copy yet",
      description: NOT_CONNECTED_MESSAGE,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Share “${item.name}”`}
      description={
        item.owned
          ? "Invite people by email, or send a link that anyone can use."
          : `Shared with you by ${item.ownerName ?? "someone else"}. You can change who else has access.`
      }
      size="md"
    >
      {/* Invite */}
      <form onSubmit={invite} noValidate>
        <label htmlFor={emailId} className="mb-1.5 block text-[12.5px] font-semibold text-ink">
          Add people
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Mail
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle"
              strokeWidth={2}
              aria-hidden="true"
            />
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError(undefined);
              }}
              placeholder="name@example.com"
              autoComplete="email"
              data-autofocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${emailId}-error` : undefined}
              className={cn(
                "h-9 w-full rounded-lg border bg-white pl-8 pr-2.5 text-[12.5px] text-ink placeholder:text-text-subtle",
                "focus:outline-none focus:ring-[3px]",
                error
                  ? "border-[#D6455D] focus:border-[#D6455D] focus:ring-[rgba(214,69,93,0.16)]"
                  : "border-[var(--brand-border-strong)] focus:border-primary focus:ring-[rgba(49,120,251,0.16)]",
              )}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={permission}
              onChange={(event) => setPermission(event.target.value as PermissionLevel)}
              aria-label="Permission level"
              className="h-9 rounded-lg border border-[var(--brand-border-strong)] bg-white px-2 text-[12px] font-medium text-text focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]"
            >
              {(Object.keys(PERMISSION_LABEL) as PermissionLevel[]).map((level) => (
                <option key={level} value={level}>
                  {PERMISSION_LABEL[level]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>

        {error ? (
          <p id={`${emailId}-error`} role="alert" className="mt-1.5 text-[11.5px] font-medium text-[#C93B2B]">
            {error}
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-text-subtle">{PERMISSION_DESCRIPTION[permission]}</p>
        )}
      </form>

      {/* People with access */}
      <div className="mt-5">
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
          Who has access
        </p>

        {/* Owner row is real information derived from the record itself. */}
        <ul className="space-y-1">
          <li className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8B5CF6,#3178FB)] text-[10px] font-bold text-white">
              {(item.owned ? "You" : item.ownerName ?? "?").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-ink">
                {item.owned ? "You" : item.ownerName ?? "Owner"}
              </p>
              <p className="text-[10.5px] text-text-subtle">{item.owned ? "Owner" : "Shared with you"}</p>
            </div>
            <span className="rounded bg-[var(--brand-surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-text-subtle">
              Owner
            </span>
          </li>
        </ul>

        {/* No recipients exist yet, and saying so is more useful than a
            spinner that never resolves. */}
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-[var(--brand-canvas)] px-2.5 py-2 text-[11px] leading-relaxed text-text-muted">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
          No one else has access. Recipients appear here once an invite is accepted.
        </p>
      </div>

      {/* Link sharing */}
      <div className="mt-5 rounded-xl border border-[var(--brand-border)] p-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-surface-muted)] text-text-muted">
            <Link2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-ink">Anyone with the link</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
              {linkEnabled
                ? `${PERMISSION_LABEL[permission].toLowerCase()} — anyone with the link can open it.`
                : "Link sharing is off. Only people you invite can open this."}
            </p>
            {linkEnabled && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <select
                  value={permission}
                  onChange={(event) => setPermission(event.target.value as PermissionLevel)}
                  aria-label="Link permission level"
                  className="h-7 rounded-md border border-[var(--brand-border-strong)] bg-white px-1.5 text-[11px] font-medium text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-[rgba(49,120,251,0.16)]"
                >
                  {(Object.keys(PERMISSION_LABEL) as PermissionLevel[]).map((level) => (
                    <option key={level} value={level}>
                      {PERMISSION_LABEL[level]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {linkEnabled ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={copyLink}
                className="flex h-7 items-center gap-1 rounded-md border border-[var(--brand-border-strong)] bg-white px-2 text-[11px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-[#1B8A57]" strokeWidth={2.6} aria-hidden="true" />
                ) : (
                  <Copy className="h-3 w-3" strokeWidth={2.1} aria-hidden="true" />
                )}
                Copy
              </button>
              <button
                type="button"
                onClick={() => setLinkEnabled(false)}
                aria-label="Turn off link sharing"
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-[#C93B2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <UserX className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLinkEnabled(true)}
              className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-[var(--brand-border-strong)] bg-white px-2 text-[11px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Globe className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Turn on
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
