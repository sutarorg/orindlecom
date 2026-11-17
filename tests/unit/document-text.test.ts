/**
 * Reading documents is the one place this app parses untrusted bytes itself, so the
 * parsers are tested against real files rather than against fixtures we wrote to
 * match our own assumptions.
 *
 * The cases that matter are the ones that would fail quietly in production: a
 * malformed archive that must return null instead of throwing (a tile must never
 * take down a grid), and a deflate bomb that must be refused rather than inflated.
 */
import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { documentText, listZipEntries, plainTextOpening } from "@/lib/drive/document-text";

/**
 * A minimal but genuinely valid ZIP: stored/deflated entries, real central
 * directory, real local headers. Hand-built because the alternative is checking a
 * binary fixture into the repo for a 20-line test.
 */
function buildZip(entries: Array<{ name: string; content: string; deflate?: boolean }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const raw = Buffer.from(entry.content, "utf8");
    const useDeflate = entry.deflate !== false;
    const body = useDeflate ? deflateRawSync(raw) : raw;
    const nameBytes = Buffer.from(entry.name, "utf8");

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);
    locals.push(local, body);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centrals.push(central);

    offset += local.length + body.length;
  }

  const centralSize = centrals.reduce((sum, buffer) => sum + buffer.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, ...centrals, eocd]);
}

describe("documentText", () => {
  it("reads the opening of a Word document", () => {
    const docx = buildZip([
      {
        name: "word/document.xml",
        content:
          '<?xml version="1.0"?><w:document><w:body>' +
          '<w:p><w:r><w:t>Quarterly report</w:t></w:r></w:p>' +
          '<w:p><w:r><w:t xml:space="preserve">Revenue up 12% &amp; churn down</w:t></w:r></w:p>' +
          "</w:body></w:document>",
      },
    ]);

    const text = documentText(docx);
    expect(text).toContain("Quarterly report");
    expect(text).toContain("Revenue up 12% & churn down");
  });

  it("reads spreadsheet cells", () => {
    const xlsx = buildZip([
      {
        name: "xl/sharedStrings.xml",
        content: "<sst><si><t>Region</t></si><si><t>Revenue</t></si></sst>",
      },
      {
        name: "xl/worksheets/sheet1.xml",
        content: "<worksheet><sheetData><row><c><v>North</v></c><c><v>4200</v></c></row></sheetData></worksheet>",
      },
    ]);

    expect(documentText(xlsx)).toContain("Region");
  });

  it("never throws on input that is not a zip at all", () => {
    expect(documentText(Buffer.from("just some plain text, not a zip"))).toBeNull();
    expect(documentText(Buffer.alloc(0))).toBeNull();
    // A truncated archive: the EOCD points past the end of the buffer.
    expect(documentText(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBeNull();
  });

  it("returns null when the package has no text in it", () => {
    const empty = buildZip([{ name: "word/document.xml", content: "<w:document><w:body/></w:document>" }]);
    expect(documentText(empty)).toBeNull();
  });

  it("refuses to inflate a decompression bomb", () => {
    // 8 MiB of zeros compresses to a few kilobytes. The reader is bounded at 4 MiB
    // per entry, so this must come back null rather than filling memory.
    const bomb = buildZip([{ name: "word/document.xml", content: "A".repeat(8 * 1024 * 1024) }]);
    expect(documentText(bomb)).toBeNull();
  });

  it("refuses an archive whose entry count runs past the buffer", () => {
    const zip = buildZip([{ name: "word/document.xml", content: "<w:t>hi</w:t>" }]);
    // Corrupt the declared entry count without changing the buffer length.
    zip.writeUInt16LE(60000, zip.length - 22 + 10);
    expect(() => listZipEntries(zip)).not.toThrow();
  });
});

describe("plainTextOpening", () => {
  it("returns the start of a text file", () => {
    expect(plainTextOpening(Buffer.from("line one\nline two\n"))).toBe("line one\nline two");
  });

  it("refuses binary that was given a text extension", () => {
    const binary = Buffer.from([0x00, 0x01, 0x02, 0x00, 0xff, 0xfe]);
    expect(plainTextOpening(binary)).toBeNull();
  });

  it("refuses a buffer that is mostly non-printable even without a NUL", () => {
    // No zero bytes, but not text either — this would render as mojibake.
    const noise = Buffer.alloc(1000);
    for (let i = 0; i < noise.length; i += 1) noise[i] = 0x80 + (i % 0x70);
    expect(plainTextOpening(noise)).toBeNull();
  });

  it("caps what it returns so a tile cannot be handed a whole book", () => {
    const long = Buffer.from("word ".repeat(10_000));
    expect(plainTextOpening(long)!.length).toBeLessThanOrEqual(400);
  });
});
