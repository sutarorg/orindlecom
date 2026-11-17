"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  Eye,
  Loader2,
  MessageSquare,
  PencilLine,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/drive/client";
import { formatBytes } from "@/lib/drive/format";
import type { PublicLinkItem } from "@/lib/share/public-link";
import { cn } from "@/lib/utils";

/**
 * The public face of a shared file.
 *
 * Built on the marketing shell (same header, same footer, same type scale), because
 * a recipient arriving from an email should recognise the product they were told
 * about — a bare viewer on a different chrome reads as a phishing page.
 *
 * The permission decides what this renders, and the decision is made from the
 * resolved link, never from a query parameter:
 *
 *   viewer    — the file and a download. Nothing else.
 *   commenter — the file, a download, and a comment box.
 *   editor    — the file, a download, an inline editor for text, and a comment box.
 *
 * The controls are a consequence of the permission, not a gate in front of it: the
 * server refuses a comment on a viewer link even if the box were somehow present.
 */

export function SharedItemView({ token, item }: { token: string; item: PublicLinkItem }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [text, setText] = React.useState<string | null>(null);
  // The fetch runs on mount, so true is the honest initial value: painting "no
  // preview" for one frame before the request lands would flash the wrong answer.
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);

  const canComment = item.permission === "commenter" || item.permission === "editor";
  const canEdit = item.permission === "editor";

  React.useEffect(() => {
    let active = true;

    void api
      .get<{
        url: string | null;
        text: string | null;
        previewable: boolean;
      }>(`/api/s/${encodeURIComponent(token)}/content`)
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setUrl(result.data.url);
        setText(result.data.text);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const download = async () => {
    if (item.kind !== "file") return;
    setDownloading(true);
    const result = await api.post<{ url: string; filename: string }>(`/api/s/${encodeURIComponent(token)}`, {
      action: "download",
    });
    setDownloading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = result.data.url;
    anchor.download = result.data.filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-20 pt-24 sm:pt-28">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <PermissionChip permission={item.permission} />
          <h1 className="mt-2.5 truncate text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink-strong sm:text-[26px]">
            {item.name}
          </h1>
          <p className="mt-1 text-[12.5px] text-text-muted">
            {item.kind === "file" && item.size !== null && `${formatBytes(item.size)} · `}
            Shared by {item.ownerName || "the owner"} on Orindle
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {item.kind === "file" && (
            <button
              type="button"
              onClick={() => void download()}
              disabled={downloading}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-55"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} aria-hidden />
              ) : (
                <Download className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              )}
              {downloading ? "Preparing…" : "Download"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-[var(--brand-border-soft)] bg-white shadow-[var(--brand-shadow-sm)]">
        <div className="flex min-h-[320px] items-center justify-center bg-[var(--brand-canvas)] p-4 sm:min-h-[440px]">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-text-muted">
              <Loader2 className="h-6 w-6 animate-spin text-primary" strokeWidth={2} aria-hidden />
              <p className="text-[12px]">Loading…</p>
            </div>
          ) : error ? (
            <p className="max-w-sm text-center text-[12.5px] leading-relaxed text-text-muted">{error}</p>
          ) : item.kind === "folder" ? (
            <p className="max-w-sm text-center text-[12.5px] leading-relaxed text-text-muted">
              This link points at a folder. Its owner can share the files inside it
              individually.
            </p>
          ) : (
            <Stage item={item} url={url} text={text} canEdit={canEdit} token={token} />
          )}
        </div>
      </div>

      {canComment && <CommentBox token={token} />}

      <div className="mt-10 flex flex-col items-start justify-between gap-3 rounded-xl border border-[var(--brand-border-soft)] bg-[var(--brand-surface)] px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-[13px] font-semibold text-ink">Get your own space on Orindle</p>
          <p className="mt-0.5 text-[12px] text-text-muted">10 GB free, no card required.</p>
        </div>
        <Link
          href="/signup"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Create a free account
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function PermissionChip({ permission }: { permission: PublicLinkItem["permission"] }) {
  const config = {
    viewer: { icon: Eye, label: "Can view", tone: "text-text-muted" },
    commenter: { icon: MessageSquare, label: "Can comment", tone: "text-[#2A62B8]" },
    editor: { icon: PencilLine, label: "Can edit", tone: "text-[#2A8F68]" },
  }[permission];

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-border)] bg-white px-2.5 py-1 text-[11px] font-semibold",
        config.tone,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.2} aria-hidden />
      {config.label}
      <span className="sr-only">
        — the owner chose this permission for this link, and it is enforced on the server
      </span>
    </span>
  );
}

function Stage({
  item,
  url,
  text,
  canEdit,
  token,
}: {
  item: PublicLinkItem;
  url: string | null;
  text: string | null;
  canEdit: boolean;
  token: string;
}) {
  if (item.category === "image" && url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={item.name} className="max-h-[560px] max-w-full rounded-lg object-contain" />
    );
  }
  if (item.category === "video" && url) {
    return <video src={url} controls className="max-h-[560px] max-w-full rounded-lg" />;
  }
  if (item.category === "audio" && url) {
    return <audio src={url} controls className="w-full max-w-lg" />;
  }
  if (item.category === "pdf" && url) {
    return <iframe src={url} title={item.name} className="h-[560px] w-full rounded-lg border-0" />;
  }
  if (text !== null) {
    return <TextBody text={text} editable={canEdit} token={token} />;
  }

  return (
    <div className="max-w-sm text-center">
      <ShieldCheck className="mx-auto h-8 w-8 text-text-subtle" strokeWidth={1.6} aria-hidden />
      <p className="mt-3 text-[13px] font-semibold text-ink">Preview not available here</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">
        This format can&apos;t be shown in a browser. Download it to open it in the app that made it.
      </p>
    </div>
  );
}

/**
 * Text and code, with an editor when the link allows one.
 *
 * The editor is local until saved, and "saved" only reports success once the server
 * has said so — a shared document that silently discards an edit is worse than one
 * that refuses to open it. Saving is refused by the server for viewer and commenter
 * links regardless of what this component renders.
 */
function TextBody({ text, editable, token }: { text: string; editable: boolean; token: string }) {
  const [value, setValue] = React.useState(text);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState<"idle" | "ok" | "error">("idle");

  if (!editable) {
    return (
      <pre className="h-[520px] w-full overflow-auto whitespace-pre-wrap rounded-lg bg-white p-4 font-mono text-[12px] leading-relaxed text-text">
        {text}
      </pre>
    );
  }

  return (
    <div className="flex h-[520px] w-full flex-col">
      <textarea
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setSaved("idle");
        }}
        spellCheck={false}
        aria-label="Edit this document"
        className="min-h-0 flex-1 resize-none rounded-t-lg border-0 bg-white p-4 font-mono text-[12px] leading-relaxed text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      />
      <div className="flex items-center justify-end gap-2 rounded-b-lg border-t border-[var(--brand-border-soft)] bg-white px-3 py-2">
        {saved === "ok" && <span className="text-[11.5px] text-[#2A8F68]">Saved</span>}
        {saved === "error" && <span className="text-[11.5px] text-[#C93B2B]">Not saved</span>}
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            setSaved("idle");
            // Wired to the save endpoint; refuses for links that are not editors.
            void api
              .post(`/api/s/${encodeURIComponent(token)}/edit`, { body: value })
              .then((result) => setSaved(result.ok ? "ok" : "error"))
              .finally(() => setSaving(false));
          }}
          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[12px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-55"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function CommentBox({ token }: { token: string }) {
  const [body, setBody] = React.useState("");
  const [author, setAuthor] = React.useState("");
  const [state, setState] = React.useState<"idle" | "posting" | "posted" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  const post = async () => {
    setState("posting");
    setMessage(null);

    const result = await api.post(`/api/s/${encodeURIComponent(token)}`, {
      action: "comment",
      body,
      author,
    });

    if (!result.ok) {
      setState("error");
      setMessage(result.message);
      return;
    }

    setState("posted");
    setBody("");
  };

  return (
    <section className="mt-4 rounded-xl border border-[var(--brand-border-soft)] bg-white p-4" aria-label="Comments">
      <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden />
        Leave a comment
      </h2>

      <div className="mt-3 grid gap-2 sm:grid-cols-[200px_1fr]">
        <label className="sr-only" htmlFor="comment-author">
          Your name
        </label>
        <input
          id="comment-author"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          placeholder="Your name (optional)"
          maxLength={120}
          className="h-9 rounded-lg border border-[var(--brand-border-strong)] px-3 text-[12.5px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <label className="sr-only" htmlFor="comment-body">
          Your comment
        </label>
        <input
          id="comment-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a note about this file…"
          maxLength={4000}
          className="h-9 rounded-lg border border-[var(--brand-border-strong)] px-3 text-[12.5px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-text-subtle">
          {state === "posted"
            ? "Your comment was posted."
            : message ?? "Your name appears with the comment. No account needed."}
        </p>
        <button
          type="button"
          onClick={() => void post()}
          disabled={state === "posting" || body.trim().length === 0}
          className="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-55"
        >
          {state === "posting" ? "Posting…" : "Post comment"}
        </button>
      </div>
    </section>
  );
}
