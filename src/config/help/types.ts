/**
 * Help centre content model.
 *
 * Articles are data. The one structural rule that matters: an article's body is
 * an array of blocks, not HTML, so the same content can be searched, extracted
 * into a category listing, and rendered with consistent typography without any
 * of those three things drifting.
 */

export type HelpCategoryId =
  | "getting-started"
  | "account"
  | "storage"
  | "files"
  | "sharing"
  | "billing"
  | "business";

export interface HelpCategory {
  id: HelpCategoryId;
  title: string;
  /** One line, used on the help home card and at the top of the category page. */
  description: string;
  /** Longer framing, only on the category header. */
  intro?: string;
}

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "steps"; items: Array<{ title: string; text: string }> }
  | { type: "list"; items: string[] }
  | { type: "note"; tone: "info" | "warning"; text: string }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "link"; href: string; label: string; text: string }
  | { type: "placeholder"; text: string };

export interface HelpArticle {
  slug: string;
  title: string;
  category: HelpCategoryId;
  /** Standfirst. Also the text used in search results. */
  summary: string;
  /** ISO date of the last content edit. */
  updated: string;
  /** Estimated reading time in minutes, computed from the body at build time. */
  body: HelpBlock[];
  /** Slugs of related articles, resolved and validated at render time. */
  related?: string[];
  /** Marks the small set pinned to the help home. */
  featured?: boolean;
  keywords?: string[];
}
