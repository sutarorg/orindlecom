"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ticket controls: status, assignment, reply, internal note.
 *
 * Every control reports the server's answer verbatim. There are no optimistic
 * updates: a reply that says "sent" before Resend accepted it is the same lie as a
 * fake payment confirmation, and this console has exactly one job — telling an
 * operator what actually happened.
 *
 * "Retry" re-submits the same body. The previous attempt is already in the
 * database with a failed delivery state, so a retry creates a second row rather
 * than silently mutating history.
 */

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export function TicketActions({
  ticketId,
  status,
  assigned,
  selfId,
}: {
  ticketId: string;
  status: "open" | "in_progress" | "resolved";
  assigned: boolean;
  selfId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ tone: "ok" | "error"; text: string } | null>(
    null,
  );

  async function post(path: string, body: unknown, key: string) {
    setBusy(key);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/support/${ticketId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { message?: string } }
        | { ok: false; message: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        setFeedback({
          tone: "error",
          text: payload && "message" in payload ? payload.message : "That didn't work. Nothing was changed.",
        });
        return;
      }

      setFeedback({ tone: "ok", text: payload.data.message ?? "Saved." });
      router.refresh();
    } catch {
      setFeedback({ tone: "error", text: "The request failed. Nothing was changed." });
    } finally {
      setBusy(null);
    }
  }

  const buttonClass =
    "inline-flex h-8 items-center rounded-lg border border-[var(--brand-border-strong)] px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
          Status
        </span>
        {(["open", "in_progress", "resolved"] as const).map((next) => (
          <button
            key={next}
            type="button"
            disabled={busy !== null || next === status}
            onClick={() => post("status", { status: next }, `status-${next}`)}
            aria-pressed={next === status}
            className={cn(
              buttonClass,
              next === status && "border-primary bg-primary-soft text-primary-ink",
            )}
          >
            {busy === `status-${next}` ? "Saving…" : STATUS_LABELS[next]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
          Owner
        </span>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => post("assign", { assign: !assigned }, "assign")}
          className={buttonClass}
        >
          {busy === "assign" ? "Saving…" : assigned ? "Release to unassigned" : "Assign to me"}
        </button>
        {assigned && (
          <span className="text-[10.5px] text-text-subtle">
            Assigned to {assigned ? "you" : "nobody"}
          </span>
        )}
        <span className="sr-only">Current operator {selfId}</span>
      </div>

      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium",
            feedback.tone === "ok" ? "bg-[#EAF7F0] text-[#1B7F4B]" : "bg-[#FDF3F2] text-[#C93B2B]",
          )}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}

export function ReplyBox({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"public" | "internal">("public");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function submit() {
    if (!body.trim()) {
      setResult({ tone: "error", text: "Write something first." });
      return;
    }
    setBusy(true);
    setResult(null);

    try {
      const response = await fetch(`/api/admin/support/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, visibility: mode }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { message: string; deliveryStatus: string } }
        | { ok: false; message: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        setResult({
          tone: "error",
          text: payload && "message" in payload ? payload.message : "That didn't work.",
        });
        return;
      }

      // The server's words, not ours: it knows whether the email was accepted.
      const delivered = payload.data.deliveryStatus === "delivered";
      setResult({
        tone: delivered || payload.data.deliveryStatus === "not_applicable" ? "ok" : "error",
        text: payload.data.message,
      });
      // Clear only on a real send. If it failed, the operator's text stays so a
      // retry does not mean retyping.
      if (delivered) setBody("");
      router.refresh();
    } catch {
      setResult({ tone: "error", text: "The request failed. Nothing was sent." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5" role="group" aria-label="Reply visibility">
        {(
          [
            { key: "public" as const, label: "Reply to customer", icon: Send },
            { key: "internal" as const, label: "Internal note", icon: StickyNote },
          ]
        ).map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setMode(option.key)}
            aria-pressed={mode === option.key}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              mode === option.key
                ? "border-primary bg-primary-soft text-primary-ink"
                : "border-[var(--brand-border-strong)] text-text-muted hover:bg-[var(--brand-surface-muted)]",
            )}
          >
            <option.icon className="h-3 w-3" strokeWidth={2.2} aria-hidden />
            {option.label}
          </button>
        ))}
      </div>

      <label htmlFor="admin-reply" className="sr-only">
        {mode === "public" ? "Reply to the customer" : "Internal note"}
      </label>
      <textarea
        id="admin-reply"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={5}
        maxLength={4000}
        placeholder={
          mode === "public"
            ? "This is emailed to the customer and stored on the ticket."
            : "Only the platform team can see this. It is never emailed."
        }
        className="w-full resize-y rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 py-2 text-[12.5px] leading-relaxed text-ink placeholder:text-text-subtle focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {busy ? "Saving…" : mode === "public" ? "Send reply" : "Save note"}
        </button>
        <span className="text-[10.5px] text-text-subtle">{body.length}/4000</span>
      </div>

      {result && (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "rounded-lg px-2.5 py-2 text-[11.5px] leading-relaxed font-medium",
            result.tone === "ok" ? "bg-[#EAF7F0] text-[#1B7F4B]" : "bg-[#FDF3F2] text-[#C93B2B]",
          )}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}
