import { permanentRedirect } from "next/navigation";

/**
 * Permanent move to the new auth routes.
 *
 * The old `/sign-in` URLs were published and may sit in bookmarks, emails and
 * the sitemap history. A 308 keeps the query string intact, so a link to
 * `/sign-in?plan=plus` still lands on the right screen.
 */
export default async function LegacyRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
  }
  const suffix = query.toString();
  permanentRedirect(`/login${suffix ? `?${suffix}` : ""}`);
}
