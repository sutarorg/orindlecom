/**
 * CSV export.
 *
 * Two things make this harder than joining strings with commas, and both are
 * handled here rather than at the call site:
 *
 *   1. **Formula injection.** A cell beginning with `=`, `+`, `-`, `@`, tab or a
 *      carriage return is executed as a formula by Excel, Sheets and LibreOffice.
 *      A customer's display name is attacker-controlled text — `=HYPERLINK(...)` in
 *      a name field is a known attack against an operator who exports a user list.
 *      Every such cell is prefixed with a single quote, which spreadsheets treat as
 *      "this is text" and which is stripped on import.
 *
 *   2. **Quoting.** A field containing a comma, quote or newline must be wrapped in
 *      quotes with inner quotes doubled, or the whole file shifts by a column.
 */

import "server-only";

const DANGEROUS_PREFIX = /^[=+\-@\t\r]/;

/** Quote and neutralise one cell. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);

  // Neutralise before quoting: the check is on the value the spreadsheet will
  // parse, which is the unquoted content.
  if (DANGEROUS_PREFIX.test(text)) text = `'${text}`;

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) lines.push(row.map(cell).join(","));
  // A trailing newline: POSIX tools and Excel both handle it, and a file that ends
  // mid-line confuses naive parsers.
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * A download response with a filename that cannot be used to traverse anything.
 */
export function csvResponse(csv: string, filename: string): Response {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
