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
import { api } from "@/lib/drive/client";
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
  // The URL the server returned, if a link has been created. Null until then —
  // there is nothing to show before the backend has agreed one exists.
  const [linkUrl, setLinkUrl] = React.useState<string | null>(null);
  /*
   * The link's permission is its own state.
   *
   * It used to share `permission` with the invite form, so choosing "Can edit" for
   * an email also silently changed what the public link allowed — and that change
   * was only ever local, because nothing wrote it back.
   */
  const [linkPermission, setLinkPermission] = React.useState<PermissionLevel>("viewer");
  const [copied, setCopied] = React.useState(false);
  /** Set when an invitation was created but the email could not be sent. */
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const emailId = React.useId();

  React.useEffect(() => {
    if (item) {
      setEmail("");
      setError(undefined);
      setPermission("viewer");
      setPending(false);
      setCopied(false);
      setLinkEnabled(false);
      setLinkUrl(null);
      setLinkPermission("viewer");
      setInviteUrl(null);
    }
  }, [item]);

  const [grants, setGrants] = React.useState<
    { id: string; email: string; permission: PermissionLevel }[]
  >([]);

  const loadGrants = React.useCallback(async (id: string) => {
    const result = await api.get<{
      grants: { id: string; email: string; permission: PermissionLevel }[];
    }>(`/api/files/${id}/grants`);
    // A failure here is not worth a toast: the dialog still works for adding
    // access, and an empty list is the honest default.
    setGrants(result.ok ? result.data.grants : []);
  }, []);

  React.useEffect(() => {
    if (item) void loadGrants(item.id);
  }, [item, loadGrants]);

  /**
   * Load the link that already exists, if any.
   *
   * Without this the dialog opened claiming "Link sharing is off" for a file that
   * already had a public link, and the first Copy press created a *second* link
   * while the original kept working. The link is server state, so it is read from
   * the server rather than assumed from this session.
   */
  React.useEffect(() => {
    if (!item) return;
    let active = true;

    void api
      .get<{ url: string | null; permission: PermissionLevel; enabled: boolean } | null>(
        `/api/files/${item.id}/link`,
      )
      .then((result) => {
        if (!active || !result.ok) return;
        const link = result.data;
        if (link?.enabled && link.url) {
          setLinkEnabled(true);
          setLinkUrl(new URL(link.url, window.location.origin).toString());
          setLinkPermission(link.permission);
        }
      });

    return () => {
      active = false;
    };
  }, [item]);

  const revokeGrant = async (grantId: string) => {
    const result = await api.del(`/api/grants/${grantId}`);
    if (!result.ok) {
      toast({ tone: "error", title: "Access wasn't removed", description: result.message });
      return;
    }
    setGrants((current) => current.filter((grant) => grant.id !== grantId));
    toast({ tone: "success", title: "Access removed" });
  };

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

    const result = await api.post<{
      email: string;
      permission: PermissionLevel;
      invited: boolean;
      delivered: boolean;
      inviteUrl: string | null;
      deliveryError: string | null;
      expiresAt: string;
    }>(`/api/files/${item.id}/grants`, { email: email.trim().toLowerCase(), permission });

    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setEmail("");
    void loadGrants(item.id);

    /*
     * An address with no account is no longer an error — it becomes an invitation.
     * What is reported depends on what actually happened: if the mail provider is
     * not configured, saying "invitation sent" would be a lie, so the link is shown
     * for the owner to pass on themselves.
     */
    if (!result.data.invited) {
      toast({
        tone: "success",
        title: "Access granted",
        description: `${result.data.email} can now ${PERMISSION_LABEL[result.data.permission].toLowerCase()}.`,
      });
      return;
    }

    if (result.data.delivered) {
      toast({
        tone: "success",
        title: "Invitation sent",
        description: `${result.data.email} will get access as soon as they open the link and sign up.`,
      });
      return;
    }

    /*
     * A failed send reports the failure, and says what it was.
     *
     * It used to say "Email isn't configured" for every possible cause, which was
     * wrong in production — the provider was configured and rejecting the message —
     * and sent anyone reading it looking in the wrong place. The invitation itself
     * still exists and its link still works, so both facts are given: the mail did not
     * go, and here is the link to pass on yourself.
     */
    setInviteUrl(result.data.inviteUrl);
    toast({
      tone: "error",
      title: `The invitation email to ${result.data.email} wasn't sent`,
      description: result.data.deliveryError
        ? `${result.data.deliveryError}. The invitation is still active — copy the link below and send it yourself.`
        : "Copy the invitation link below and send it yourself — the invitation is active either way.",
    });
  };

  /**
   * Create the link, or re-show the one that exists.
   *
   * "Copy" on a live link must copy it — not mint a second one. Only when there is
   * no link does this create one, and the URL that is copied is the one the server
   * returned, never a client-side guess: a constructed URL could point at a token
   * that was never issued, which is how a dead link ends up in someone's inbox.
   */
  const copyLink = async () => {
    setPending(true);

    if (!linkUrl) {
      const created = await api.put<{ url: string | null; enabled: boolean }>(
        `/api/files/${item.id}/link`,
        { permission: linkPermission },
      );

      if (!created.ok || !created.data.enabled || !created.data.url) {
        setPending(false);
        toast({
          tone: "error",
          title: "Link wasn't created",
          description: created.ok ? "That link isn't active." : created.message,
        });
        return;
      }

      const absolute = new URL(created.data.url, window.location.origin).toString();
      setLinkUrl(absolute);
      setLinkEnabled(true);
      await writeToClipboard(absolute);
      setPending(false);
      return;
    }

    await writeToClipboard(linkUrl);
    setPending(false);
  };

  const writeToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      // The tick is confirmation, not decoration: it reverts, so a second copy
      // press is visibly a new action rather than a no-op on a stale checkmark.
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access needs a secure context and permission. The link is on
      // screen either way, so say so rather than claiming the copy worked.
      toast({
        tone: "error",
        title: "Couldn't copy automatically",
        description: "The link is shown below — select it and copy it manually.",
      });
    }
  };

  /**
   * Turn link sharing off.
   *
   * This has to revoke the link on the server. It used to only flip local state, so
   * the link kept working for anyone who already had it — the dialog said "off"
   * while the URL was still live, which is the worst possible answer: it tells the
   * owner their file is private when it is not.
   */
  const disableLink = async () => {
    setPending(true);
    const result = await api.del(`/api/files/${item.id}/link`);
    setPending(false);

    if (!result.ok) {
      toast({ tone: "error", title: "The link is still active", description: result.message });
      return;
    }

    setLinkEnabled(false);
    setLinkUrl(null);
    setCopied(false);
    toast({ tone: "success", title: "Link turned off", description: "The old URL no longer opens." });
  };

  /**
   * Change what the link allows.
   *
   * Writes the new permission to the existing link, so the public page changes for
   * everyone immediately. Choosing a level and having it apply only to a link you
   * create later is not a setting, it is a note to self.
   */
  const changeLinkPermission = async (level: PermissionLevel) => {
    const previous = linkPermission;
    setLinkPermission(level);

    const result = await api.put<{ url: string | null; enabled: boolean }>(
      `/api/files/${item.id}/link`,
      { permission: level },
    );

    if (!result.ok || !result.data.enabled) {
      // Put the selector back rather than leaving it showing a level the server
      // refused.
      setLinkPermission(previous);
      toast({ tone: "error", title: "That change wasn't saved", description: result.ok ? undefined : result.message });
      return;
    }

    if (result.data.url) {
      setLinkUrl(new URL(result.data.url, window.location.origin).toString());
    }
    setCopied(false);
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

        {inviteUrl && (
          <div className="mt-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-2">
            <p className="text-[11px] font-medium text-text-muted">Invitation link</p>
            <input
              readOnly
              value={inviteUrl}
              aria-label="Invitation link"
              onFocus={(event) => event.currentTarget.select()}
              className="mt-1 w-full rounded border border-[var(--brand-border)] bg-white px-1.5 py-1 font-mono text-[10.5px] text-text-muted focus:outline-none"
            />
          </div>
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

        {grants.length === 0 ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-[var(--brand-canvas)] px-2.5 py-2 text-[11px] leading-relaxed text-text-muted">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
            No one else has access yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {grants.map((grant) => (
              <li
                key={grant.id}
                className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5"
              >
                <span className="min-w-0 truncate text-[12px] text-ink">{grant.email}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[10.5px] font-medium text-text-subtle">
                    {PERMISSION_LABEL[grant.permission]}
                  </span>
                  <button
                    type="button"
                    onClick={() => void revokeGrant(grant.id)}
                    aria-label={`Remove access for ${grant.email}`}
                    className="flex h-6 w-6 items-center justify-center rounded text-text-subtle transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-[#C93B2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <UserX className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
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
                ? `${PERMISSION_LABEL[linkPermission]} — anyone with the link can open it.`
                : "Link sharing is off. Only people you invite can open this."}
            </p>
            {linkEnabled && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <select
                  value={linkPermission}
                  onChange={(event) => void changeLinkPermission(event.target.value as PermissionLevel)}
                  aria-label="Link permission level"
                  className="h-7 rounded-md border border-[var(--brand-border-strong)] bg-white px-1.5 text-[11px] font-medium text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-[rgba(49,120,251,0.16)]"
                >
                  {(Object.keys(PERMISSION_LABEL) as PermissionLevel[]).map((level) => (
                    <option key={level} value={level}>
                      {PERMISSION_LABEL[level]}
                    </option>
                  ))}
                </select>
                {linkUrl && (
                  <input
                    readOnly
                    value={linkUrl}
                    aria-label="Share link"
                    onFocus={(event) => event.currentTarget.select()}
                    className="h-7 w-full rounded-md border border-[var(--brand-border)] bg-[var(--brand-canvas)] px-1.5 font-mono text-[10.5px] text-text-muted focus:outline-none"
                  />
                )}
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
                onClick={() => void disableLink()}
                disabled={pending}
                aria-label="Turn off link sharing"
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-[#C93B2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <UserX className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void copyLink()}
              disabled={pending}
              className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-[var(--brand-border-strong)] bg-white px-2 text-[11px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            >
              <Globe className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Create link
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
