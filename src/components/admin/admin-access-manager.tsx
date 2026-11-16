"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Owner-only controls for one platform administrator.
 *
 * Two rules visible in the UI rather than only in the API:
 *
 *   - A non-owner sees a disabled control that explains why. "Disabled with a
 *     reason" beats "absent", because an absent button reads as a missing feature.
 *   - The last active owner's revoke control is disabled with the reason stated.
 *     The database enforces this too; showing it here means the operator does not
 *     discover the rule by hitting an error.
 *
 * Confirmation is a two-step inline flow rather than `window.confirm`, so the
 * dialog is styled, focus-managed and readable by a screen reader.
 */

export function AdminAccessManager({
  targetUserId,
  targetEmail,
  role,
  isActive,
  canManage,
  isSelf,
  activeOwners,
}: {
  targetUserId: string;
  targetEmail: string | null;
  role: "owner" | "admin";
  isActive: boolean;
  canManage: boolean;
  isSelf: boolean;
  activeOwners: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState<"revoke" | "promote" | "demote" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const isLastOwner = role === "owner" && isActive && activeOwners <= 1;
  const revokeBlocked = !canManage || isSelf || isLastOwner;

  const revokeReason = !canManage
    ? "Only the platform owner can change administrator access."
    : isSelf
      ? "You cannot revoke your own access."
      : isLastOwner
        ? "This is the last active owner. Grant ownership to someone else first."
        : null;

  async function mutate(method: "POST" | "DELETE", payload: unknown) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/admins", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; message: string }
        | null;

      if (!response.ok || !body || !body.ok) {
        setMessage({
          tone: "error",
          text: body && "message" in body ? body.message : "That change didn't save.",
        });
        return;
      }

      setMessage({ tone: "ok", text: "Saved and recorded in the audit log." });
      setConfirming(null);
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "The request failed. Nothing changed." });
    } finally {
      setBusy(false);
    }
  }

  const linkClass =
    "inline-flex h-7 items-center gap-1 rounded-md border border-[var(--brand-border-strong)] px-2 text-[11px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] disabled:opacity-45 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        {isActive ? (
          <>
            {role === "admin" && (
              <button
                type="button"
                disabled={!canManage || busy}
                onClick={() => setConfirming(confirming === "promote" ? null : "promote")}
                title={!canManage ? "Only the platform owner can promote" : undefined}
                className={linkClass}
              >
                <ShieldCheck className="h-3 w-3" strokeWidth={2.2} aria-hidden />
                Make owner
              </button>
            )}
            {role === "owner" && !isLastOwner && (
              <button
                type="button"
                disabled={!canManage || busy}
                onClick={() => setConfirming(confirming === "demote" ? null : "demote")}
                title={!canManage ? "Only the platform owner can change roles" : undefined}
                className={linkClass}
              >
                Make admin
              </button>
            )}
            <button
              type="button"
              disabled={revokeBlocked || busy}
              onClick={() => setConfirming(confirming === "revoke" ? null : "revoke")}
              title={revokeReason ?? undefined}
              className={cn(linkClass, "text-[#C93B2B] hover:bg-[#FDF3F2]")}
            >
              <ShieldOff className="h-3 w-3" strokeWidth={2.2} aria-hidden />
              Revoke
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!canManage || busy}
            onClick={() => mutate("POST", { userId: targetUserId, role })}
            className={linkClass}
          >
            Restore
          </button>
        )}
      </div>

      {revokeReason && (
        <p className="max-w-[220px] text-right text-[10px] leading-snug text-text-subtle">
          {revokeReason}
        </p>
      )}

      {confirming && (
        <div
          role="alertdialog"
          aria-label="Confirm administrator change"
          className="rounded-lg border border-[var(--brand-border-strong)] bg-white p-2 text-left shadow-sm"
        >
          <p className="text-[10.5px] leading-snug text-text">
            {confirming === "revoke" && `Revoke platform access for ${targetEmail ?? "this account"}?`}
            {confirming === "promote" && `Make ${targetEmail ?? "this account"} a platform owner?`}
            {confirming === "demote" && `Change ${targetEmail ?? "this account"} to platform admin?`}
          </p>
          <div className="mt-1.5 flex gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirming === "revoke") return mutate("DELETE", { userId: targetUserId });
                return mutate("POST", {
                  userId: targetUserId,
                  role: confirming === "promote" ? "owner" : "admin",
                });
              }}
              className="inline-flex h-6 items-center rounded bg-[#C93B2B] px-2 text-[10.5px] font-bold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(null)}
              className="inline-flex h-6 items-center rounded border border-[var(--brand-border-strong)] px-2 text-[10.5px] font-semibold text-text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "max-w-[220px] text-right text-[10px] leading-snug",
            message.tone === "ok" ? "text-[#1B7F4B]" : "text-[#C93B2B]",
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

/**
 * Owner-only form to grant platform administrator access to an existing,
 * verified Orindle account by email address.
 */
export function GrantAdminForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"admin" | "owner">("admin");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const emailId = React.useId();
  const roleId = React.useId();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setMessage({ tone: "error", text: "Enter a valid account email address." });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleaned, role }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; message: string }
        | null;

      if (!response.ok || !body || !body.ok) {
        setMessage({
          tone: "error",
          text: body && "message" in body ? body.message : "Could not grant platform access.",
        });
        return;
      }

      setEmail("");
      setRole("admin");
      setMessage({
        tone: "ok",
        text: `Granted platform ${role} access to ${cleaned} and recorded in the audit log.`,
      });
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "The request failed. Nothing changed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-3 rounded-xl border border-[var(--brand-border)] bg-white p-3.5"
    >
      <p className="text-[12px] font-bold text-ink">Grant platform access</p>
      <p className="mt-0.5 text-[11px] text-text-muted">
        Add an existing, verified Orindle account as a platform administrator or owner.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label htmlFor={emailId} className="mb-1 block text-[10.5px] font-semibold text-ink">
            Account email
          </label>
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
            className="h-8 w-full rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[12px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="w-[130px]">
          <label htmlFor={roleId} className="mb-1 block text-[10.5px] font-semibold text-ink">
            Role
          </label>
          <select
            id={roleId}
            value={role}
            onChange={(event) => setRole(event.target.value as "admin" | "owner")}
            className="h-8 w-full rounded-lg border border-[var(--brand-border-strong)] bg-white px-2 text-[12px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11.5px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
          {busy ? "Granting…" : "Grant access"}
        </button>
      </div>
      {message && (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "mt-2 text-[11px] font-medium",
            message.tone === "ok" ? "text-[#1B7F4B]" : "text-[#C93B2B]",
          )}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
