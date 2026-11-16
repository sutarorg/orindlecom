import { articleInternalLinks, articleWords, type BlogArticle } from "./types";
import { bestGoogleDriveAlternatives } from "./articles/best-google-drive-alternatives";
import { googleDriveVsDropboxVsOneDrive } from "./articles/google-drive-vs-dropbox-vs-onedrive";
import { bestFreeCloudStorage } from "./articles/best-free-cloud-storage";
import { howMuchCloudStorageDoYouNeed } from "./articles/how-much-cloud-storage-do-you-need";
import { cloudStorageVsCloudBackup } from "./articles/cloud-storage-vs-cloud-backup";
import { howToShareLargeFilesOnline } from "./articles/how-to-share-large-files-online";
import { bestCloudStorageForSmallBusiness } from "./articles/best-cloud-storage-for-small-business";
import { isCloudStorageSafe } from "./articles/is-cloud-storage-safe";
import { howToOrganizeDigitalFiles } from "./articles/how-to-organize-digital-files";
import { howToMoveFilesFromGoogleDrive } from "./articles/how-to-move-files-from-google-drive";

/**
 * Published articles, newest first.
 *
 * Adding an article to this array is what publishes it: the index page, the
 * sitemap, the structured data and the audit all read from here. There is no
 * separate draft state, deliberately — an article that exists in the codebase but
 * not in this array cannot be reached by a crawler, so there is no half-published
 * state to reason about.
 */
export const BLOG_ARTICLES: BlogArticle[] = [
  bestGoogleDriveAlternatives,
  googleDriveVsDropboxVsOneDrive,
  bestFreeCloudStorage,
  howMuchCloudStorageDoYouNeed,
  cloudStorageVsCloudBackup,
  howToShareLargeFilesOnline,
  bestCloudStorageForSmallBusiness,
  isCloudStorageSafe,
  howToOrganizeDigitalFiles,
  howToMoveFilesFromGoogleDrive,
].sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : 0));

export function articleBySlug(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((article) => article.slug === slug);
}

/** Reading time at 200 words per minute, rounded up, minimum one minute. */
export function readingMinutes(article: BlogArticle): number {
  return Math.max(1, Math.round(articleWords(article) / 200));
}

/** Related articles resolved to full objects, for the footer of an article page. */
export function relatedArticles(article: BlogArticle): BlogArticle[] {
  return article.related
    .map((slug) => articleBySlug(slug))
    .filter((entry): entry is BlogArticle => Boolean(entry));
}

/** Every internal href an article body or related list points at, for the link audit. */
export function allArticleLinks(): string[] {
  const links = new Set<string>();
  for (const article of BLOG_ARTICLES) {
    links.add(`/blog/${article.slug}`);
    for (const href of articleInternalLinks(article)) links.add(href);
  }
  return [...links];
}

export { articleWords };
export type { BlogArticle };
