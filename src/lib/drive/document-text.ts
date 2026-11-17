/**
 * Text out of the document formats a browser cannot render.
 *
 * A `.docx`, `.xlsx` and `.pptx` are ZIP containers of XML. There is no page to
 * rasterise without a full office renderer — which is not something this app will
 * ship, and not something a thumbnail justifies — but the *content* is right there,
 * compressed. Reading the first page's worth of text and showing it on the tile
 * gives a preview you can actually recognise the document by, which is the job a
 * thumbnail does. It is a text plate, not a page image, and the UI says so by
 * rendering it as text rather than pretending otherwise.
 *
 * The ZIP reader is deliberately minimal: find the end-of-central-directory record,
 * walk the entries we want, inflate the ones that are deflated. No dependency, and
 * no code paths for anything the formats we care about use. Everything is bounded —
 * a 2 GB "document" must not be inflated into memory because a grid asked for a
 * thumbnail.
 */
import { inflateRawSync } from "node:zlib";

const MAX_ENTRY_BYTES = 4 * 1024 * 1024; // a single XML part we will inflate
const MAX_TEXT_CHARS = 400;

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/** End-of-central-directory signature. */
const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

function findEocd(buffer: Buffer): number {
  // The record is at the end, followed by a comment of up to 64 KiB.
  const earliest = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD) return offset;
  }
  return -1;
}

/**
 * List the entries in a ZIP.
 *
 * Only the central directory is read, so this is cheap even for a large file: the
 * directory is small and at the end, and nothing is decompressed here.
 */
export function listZipEntries(buffer: Buffer): ZipEntry[] {
  const eocd = findEocd(buffer);
  if (eocd < 0) return [];

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i += 1) {
    if (offset + 46 > buffer.length) break;
    if (buffer.readUInt32LE(offset) !== CENTRAL) break;

    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    entries.push({
      name,
      method: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

/** Inflate one entry, or null if it is empty, stored oddly, or too large. */
export function readZipEntry(buffer: Buffer, entry: ZipEntry): Buffer | null {
  const local = entry.localHeaderOffset;
  if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== LOCAL) return null;

  // The local header repeats the name and extra field lengths, and they can differ
  // from the central directory's, so the data offset must be read from here.
  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const start = local + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;

  if (entry.compressedSize === 0 || entry.compressedSize > MAX_ENTRY_BYTES) return null;
  if (end > buffer.length) return null;

  const data = buffer.subarray(start, end);
  if (entry.method === 0) return data;
  if (entry.method !== 8) return null; // deflate is the only method OOXML uses

  try {
    // `maxOutputLength` is the bound that matters: a small compressed entry can
    // inflate to gigabytes, and this refuses rather than allocating.
    return inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES });
  } catch {
    return null;
  }
}

/**
 * XML → readable text.
 *
 * WordprocessingML and PresentationML put their words in `<w:t>` / `<a:t>` elements;
 * SpreadsheetML puts strings in `<t>` and numbers in `<v>`. Paragraph and row
 * boundaries become separators so the result reads as lines rather than a run-on.
 *
 * Entities are decoded because `&amp;` and `&lt;` in the middle of a sentence look
 * like corruption on a tile.
 */
function xmlToText(xml: string): string {
  const withBreaks = xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/a:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/row>/g, "\n");

  const pieces: string[] = [];
  // The alternation is ordered: cell/run text first, then raw values.
  const pattern = /<(?:w:t|a:t|t)(?:\s[^>]*)?>([^<]*)<\/(?:w:t|a:t|t)>|<(?:w:tab)\/>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(withBreaks))) {
    if (match[0].startsWith("<w:tab")) pieces.push(" ");
    else if (match[1]) pieces.push(match[1]);
  }

  const decoded = pieces
    .join("")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

  return decoded.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Which parts of an OOXML package carry the opening content, in reading order. */
function contentParts(entries: ZipEntry[]): ZipEntry[] {
  const byName = (pattern: RegExp, limit: number) =>
    entries
      .filter((entry) => pattern.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .slice(0, limit);

  const picks = [
    ...byName(/^word\/document\.xml$/i, 1),
    ...byName(/^word\/footnotes\.xml$/i, 1),
    ...byName(/^ppt\/slides\/slide\d+\.xml$/i, 2),
    ...byName(/^xl\/sharedStrings\.xml$/i, 1),
    ...byName(/^xl\/worksheets\/sheet\d+\.xml$/i, 2),
  ];

  return picks;
}

/**
 * The opening text of a document file.
 *
 * Returns null when the input is not an OOXML package, or when the package has no
 * readable text — a spreadsheet of nothing but formulas, or an image-only deck. The
 * caller falls back to the type icon, which is the honest thing to show when there
 * is genuinely nothing to show.
 */
export function documentText(buffer: Buffer): string | null {
  const entries = listZipEntries(buffer);
  if (entries.length === 0) return null;

  const parts = contentParts(entries);
  if (parts.length === 0) return null;

  let text = "";
  for (const part of parts) {
    const xml = readZipEntry(buffer, part);
    if (!xml) continue;
    text += `${xmlToText(xml.toString("utf8"))}\n`;
    if (text.length > MAX_TEXT_CHARS * 2) break;
  }

  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_TEXT_CHARS);
}

/**
 * The opening of a legacy text-bearing format we can read directly.
 *
 * `.rtf`, `.csv`, `.md`, `.txt` and friends are their own text; there is no reason
 * to show an icon for a file whose first paragraph is already sitting in bytes.
 */
export function plainTextOpening(buffer: Buffer, limit = MAX_TEXT_CHARS): string | null {
  // Binary sniff: a NUL in the first chunk means this is not text, whatever the
  // extension claimed.
  const head = buffer.subarray(0, 512);
  if (head.includes(0)) return null;

  const decoded = buffer.subarray(0, 8192).toString("utf8");
  // Printable-ratio check, so a mislabelled binary does not render as mojibake.
  const printable = decoded.replace(/[^\p{L}\p{N}\p{P}\p{Zs}\n\r\t]/gu, "").length;
  if (decoded.length > 0 && printable / decoded.length < 0.9) return null;

  const cleaned = decoded.replace(/\r\n?/g, "\n").trim();
  return cleaned ? cleaned.slice(0, limit) : null;
}
