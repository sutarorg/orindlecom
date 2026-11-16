import Link from "next/link";
import { ArrowRight, CircleHelp, Info } from "lucide-react";

/**
 * Article feedback.
 *
 * This is deliberately not a thumbs-up / thumbs-down widget. There is no store
 * for article ratings yet, and a button that looks like it records an answer but
 * silently discards it is worse than no button: it teaches the reader that their
 * input goes nowhere, and it gives whoever runs the help centre a signal that
 * does not exist.
 *
 * What ships instead is the action that does work today — telling a person — and
 * a plain statement that per-article ratings are not collected. The contract for
 * adding real feedback without changing this component's call site is in
 * docs/support/article-system.md.
 */
export function ArticleFeedback({ slug, title }: { slug: string; title: string }) {
  const subject = encodeURIComponent(`Help article feedback: ${title}`);
  const mailto = `mailto:tejassutar.business@gmail.com?subject=${subject}&body=${encodeURIComponent(
    `Article: /help/articles/${slug}\n\nWhat was unclear or missing?\n\n`,
  )}`;

  return (
    <section
      aria-labelledby="article-feedback-heading"
      className="mt-9 rounded-[12px] border border-[var(--brand-border)] p-4"
    >
      <h2
        id="article-feedback-heading"
        className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink"
      >
        <CircleHelp className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2.2} aria-hidden="true" />
        Did this answer your question?
      </h2>

      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Link
          href="/contact?subject=support"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Ask a person
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
        </Link>
        <a
          href={mailto}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--brand-border-strong)] bg-white px-3.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Tell us what was missing
        </a>
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-[1.55] text-text-subtle">
        <Info className="mt-px h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden="true" />
        Per-article ratings aren&rsquo;t collected yet — there is nowhere to store them, so there is
        no voting control. Your message goes to a real inbox.
      </p>
    </section>
  );
}
