import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { SharedItemView } from "@/components/share/shared-item-view";
import { resolvePublicLink } from "@/lib/share/public-link";
import { CANONICAL_ORIGIN } from "@/config/seo";

/**
 * A public share link.
 *
 * One route, three permission levels. The link row carries the permission the owner
 * chose, and the page renders exactly that: a viewer page has no comment box and no
 * editor, a commenter page has the comment box and no editor, an editor page has
 * both. Three separate pages that differed only in which panel they hid would drift;
 * one page whose controls come from the resolved permission cannot.
 *
 * `noindex` because a share link is private by design. A link that gets indexed
 * becomes a public document, which is the opposite of what "anyone with the link"
 * means.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const item = await resolvePublicLink(token);

  /*
   * A dead token must not produce a metadata title that reveals what was there.
   * `noindex` in both cases; the item name appears only while the link resolves.
   */
  return {
    title: item ? `${item.name} · Shared with you` : "This link isn't available",
    description: item
      ? `${item.name} was shared with you on Orindle.`
      : "This share link is not available.",
    robots: { index: false, follow: false, nocache: true },
    alternates: { canonical: `${CANONICAL_ORIGIN}/s/${token}` },
  };
}

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const item = await resolvePublicLink(token);

  if (!item) notFound();

  return (
    <SiteShell>
      <SharedItemView token={token} item={item} />
    </SiteShell>
  );
}
