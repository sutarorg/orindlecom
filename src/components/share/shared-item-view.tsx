"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Download, Eye, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
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
 *   commenter — the file, a download, the conversation so far, and a comment box.
 *
 * There is no editor any more: a public link can be read and replied to, not
 * rewritten. The controls are a consequence of the permission, not a gate in front
 * of it — the server refuses a comment on a viewer link even if the box were
 * somehow present.
 */

export function SharedItemView({ token, item }: { token: string; item: PublicLinkItem }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [text, setText] = React.useState<string | null>(null);
  // The fetch runs on mount, so true is the honest initial value: painting "no
  // preview" for one frame before the request lands would flash the wrong answer.
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);

  const canComment = item.permission === "commenter";

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
            <Stage item={item} url={url} text={text} />
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
}: {
  item: PublicLinkItem;
  url: string | null;
  text: string | null;
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
    return (
      <pre className="h-[520px] w-full overflow-auto whitespace-pre-wrap rounded-lg bg-white p-4 font-mono text-[12px] leading-relaxed text-text">
        {text}
      </pre>
    );
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
 * The conversation on a shared file.
 *
 * Two parts, and both matter: the comments already left, and the box to add one.
 * Only the box was rendered before, and the comments it wrote were never read back
 * anywhere — an anonymous visitor posted into a void, and the owner could not see
 * what a recipient had said. A comment section that shows nothing after you comment
 * reads as a broken form, which is exactly what it was.
 *
 * The list is fetched through `GET /api/s/:token/comments`, which resolves the link
 * server-side; this component never decides who may read what.
 */
interface PublicComment {
  id: string;
  authorName: string;
  body: string;
  external: boolean;
  createdAt: string;
}

function CommentThread({
  comments,
  loading,
}: {
  comments: PublicComment[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <p className="mt-3 text-[12px] text-text-subtle">Loading comments…</p>
    );
  }

  if (comments.length === 0) {
    return (
      <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">
        No comments yet. If you have a question about this file, leave one below.
      </p>
    );
  }

  return (
    <ol className="mt-3 space-y-2.5">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="rounded-lg border border-[var(--brand-border-soft)] bg-[var(--brand-canvas)] px-3.5 py-2.5"
        >
          <div className="flex items-baseline justify-between gap-3">
            {/*
              The name is what the server decided to show. A visitor who left the
              optional name field blank arrives here as "User" — that mapping lives
              in `link_comments`, so the dashboard and this page agree.
            */}
            <p className="truncate text-[12px] font-semibold text-ink">{comment.authorName}</p>
            <time
              dateTime={comment.createdAt}
              className="shrink-0 text-[11px] text-text-subtle"
            >
              {formatCommentTime(comment.createdAt)}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-text">
            {comment.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

function formatCommentTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function CommentBox({ token }: { token: string }) {
  const [body, setBody] = React.useState("");
  const [author, setAuthor] = React.useState("");
  const [state, setState] = React.useState<"idle" | "posting" | "posted" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);
  const [comments, setComments] = React.useState<PublicComment[]>([]);
  const [loadingComments, setLoadingComments] = React.useState(true);

  const load = React.useCallback(async () => {
    const result = await api.get<{ comments: PublicComment[] }>(
      `/api/s/${encodeURIComponent(token)}/comments`,
    );
    // A failed read shows the empty state rather than an error banner: the box still
    // works, and a scary message above it would discourage the comment the visitor
    // came to leave.
    setComments(result.ok ? result.data.comments : []);
    setLoadingComments(false);
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

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
    setAuthor("");
    // Read back what the server now holds, so the thread shows the new comment with
    // the name the server actually stored — not a client-side guess at it.
    await load();
  };

  return (
    <section className="mt-4 rounded-xl border border-[var(--brand-border-soft)] bg-white p-4" aria-label="Comments">
      <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden />
        Comments
        {comments.length > 0 && (
          <span className="ml-0.5 rounded-full bg-[var(--brand-surface-muted)] px-1.5 text-[10.5px] font-semibold text-text-muted">
            {comments.length}
          </span>
        )}
      </h2>

      <CommentThread comments={comments} loading={loadingComments} />

      <div className="mt-4 border-t border-[var(--brand-border-soft)] pt-3.5">
        <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
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
              : message ??
                "Leave the name blank and your comment shows as “User”. No account needed."}
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
      </div>
    </section>
  );
}
