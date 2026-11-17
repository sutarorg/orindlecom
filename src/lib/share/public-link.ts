import "server-only";

/**
 * Resolving a public share link.
 *
 * The one read path in the product with no session behind it, so it is
 * deliberately narrow.
 *
 * Why the service client and not the caller's: `links_select_creator` allows only
 * `created_by = auth.uid()`, so an anonymous visitor cannot read the link row at
 * all, and `has_file_access(id, null)` is false by design. The permission model for
 * a public link is not "what can this user see" — it is "what did the owner publish",
 * and that question is answered by the link row itself.
 *
 * What keeps this from being a hole:
 *   - the token must exist, be unrevoked, and be unexpired;
 *   - the file must still be live (`deleted_at is null`, `status = 'available'`),
 *     so trashing a file immediately kills every link to it;
 *   - the database function returns only the fields a preview needs — no owner id,
 *     no folder structure, no sibling names;
 *   - a token that does not resolve returns "not found", never "expired", because a
 *     distinct expired message would confirm that a guessed token was once real.
 */
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";
import { isStorageConfigured, presignGet } from "@/lib/r2/client";

export interface PublicLinkItem {
  id: string;
  kind: "file" | "folder";
  name: string;
  size: number | null;
  mimeType: string | null;
  category: string;
  permission: "viewer" | "commenter" | "editor";
  ownerName: string;
  expiresAt: string | null;
}

export interface PublicLinkResolved {
  item: PublicLinkItem;
  /** Short-lived signed URL, inline disposition. Null when the format needs no bytes. */
  url: string | null;
  expiresIn: number | null;
}

type ResolveRow = {
  id: string;
  kind: string;
  name: string;
  size_bytes: number | null;
  mime_type: string | null;
  category: string | null;
  permission: string;
  owner_name: string | null;
  expires_at: string | null;
};

/**
 * Resolve a token to an item, or null.
 *
 * A null answer is the only failure shape: the page cannot distinguish "no such
 * token" from "revoked" from "expired", and it does not need to — all three mean
 * the same thing to the visitor, and distinguishing them tells an attacker whether
 * a token was ever valid.
 */
export async function resolvePublicLink(token: string): Promise<PublicLinkItem | null> {
  if (!token || token.length < 8 || token.length > 200) return null;

  /*
   * A deployment without the service role cannot resolve any link, and that is not
   * an exception the visitor should see — it is the same answer as any other
   * unresolvable token, because the page has nothing to show either way. Throwing
   * here produced a 500 for every public link on an unconfigured environment, which
   * is both a worse experience and a needless disclosure that a secret is missing.
   */
  if (!isServiceConfigured()) return null;

  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("resolve_share_link", { p_token: token });

  if (error || !data) return null;

  const rows = data as ResolveRow[];
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    kind: row.kind === "folder" ? "folder" : "file",
    name: row.name,
    size: row.size_bytes === null ? null : Number(row.size_bytes),
    mimeType: row.mime_type,
    category: row.category ?? "other",
    permission:
      row.permission === "editor" ? "editor" : row.permission === "commenter" ? "commenter" : "viewer",
    ownerName: row.owner_name ?? "",
    expiresAt: row.expires_at,
  };
}

/**
 * A signed read URL for a file behind a public link.
 *
 * Minted with the service client because there is no session to mint it with. The
 * link's expiry was checked by the caller; this URL is much shorter-lived than the
 * link, so a copied URL stops working on its own.
 *
 * The content type is egress-checked here rather than inherited from storage: the
 * row's `mime_type` is supplied by the uploader, and serving an attacker-chosen
 * type inline is how a shared file becomes a script. Markup, SVG and anything
 * unrecognised are forced to `application/octet-stream`, which a browser downloads
 * instead of rendering. Plain media keeps its type so the preview works.
 */
const RENDERABLE_INLINE = new Set([
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/mp4",
]);

const RENDERABLE_IMAGES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
]);

export async function publicFileUrl(
  fileId: string,
  disposition: "inline" | "attachment",
  contentTypeHint: string | null,
): Promise<{ url: string; expiresIn: number; filename: string; safe: boolean } | null> {
  if (!isStorageConfigured() || !isServiceConfigured()) return null;

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("files")
    .select("name, mime_type, storage_key, status, deleted_at")
    .eq("id", fileId)
    .eq("status", "available")
    .is("deleted_at", null)
    .maybeSingle();

  if (!data?.storage_key) return null;

  const mime = (contentTypeHint ?? (data.mime_type as string | null) ?? "").toLowerCase();
  const renderable = RENDERABLE_INLINE.has(mime) || RENDERABLE_IMAGES.has(mime);
  const effective: "inline" | "attachment" = disposition === "inline" && renderable ? "inline" : "attachment";

  try {
    const url = await presignGet(data.storage_key as string, {
      expiresIn: 300,
      filename: data.name as string,
      disposition: effective,
      contentType: renderable ? mime : "application/octet-stream",
    });
    return { url, expiresIn: 300, filename: data.name as string, safe: renderable };
  } catch {
    return null;
  }
}

/**
 * The opening text of a document behind a public link, for the document viewer.
 *
 * Read server-side from the object, bounded, and returned as text — the bytes never
 * reach the browser, so a shared `.docx` cannot be used to deliver anything.
 */
export async function publicDocumentText(
  fileId: string,
  category: string,
  maxBytes = 8 * 1024 * 1024,
): Promise<string | null> {
  if (!isStorageConfigured() || !isServiceConfigured()) return null;

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("files")
    .select("storage_key, size_bytes, status, deleted_at")
    .eq("id", fileId)
    .eq("status", "available")
    .is("deleted_at", null)
    .maybeSingle();

  if (!data?.storage_key) return null;
  if (Number(data.size_bytes ?? 0) > maxBytes) return null;

  try {
    const url = await presignGet(data.storage_key as string, {
      expiresIn: 60,
      disposition: "attachment",
      contentType: "application/octet-stream",
    });
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const { documentText, plainTextOpening } = await import("@/lib/drive/document-text");
    return category === "text" || category === "code"
      ? plainTextOpening(buffer, 4000)
      : documentText(buffer);
  } catch {
    return null;
  }
}
