/**
 * Server-side validation.
 *
 * These are the checks that actually count. The client validates too, as a
 * courtesy, but a request can arrive from curl — so every one of these must hold
 * without a browser having been involved.
 */
import { describe, expect, it } from "vitest";
import { validateItemName, requireString, requireStringArray, requireUuid } from "@/lib/api";

describe("item names", () => {
  it("accepts ordinary names, including spaces and unicode", () => {
    expect(validateItemName("Quarterly report.pdf")).toBe("Quarterly report.pdf");
    expect(validateItemName("  trimmed.txt  ")).toBe("trimmed.txt");
    expect(validateItemName("नमस्कार.txt")).toBe("नमस्कार.txt");
    expect(validateItemName("résumé (final) v2.docx")).toBe("résumé (final) v2.docx");
  });

  it("trims rather than rejecting surrounding whitespace", () => {
    // A name that is only spaces is empty; a name with spaces around it is fine.
    expect(validateItemName("   notes.md   ")).toBe("notes.md");
  });

  it("rejects path separators", () => {
    // The name is displayed, searched and echoed back. A separator would suggest
    // a hierarchy that does not exist.
    expect(() => validateItemName("a/b.txt")).toThrow();
    expect(() => validateItemName("a\\b.txt")).toThrow();
  });

  it("rejects the traversal names", () => {
    expect(() => validateItemName(".")).toThrow();
    expect(() => validateItemName("..")).toThrow();
  });

  it("rejects control characters", () => {
    expect(() => validateItemName("bad\u0000name.txt")).toThrow();
    expect(() => validateItemName("new\nline.txt")).toThrow();
  });

  it("rejects a leading dot, so nobody creates hidden files by accident", () => {
    expect(() => validateItemName(".env")).toThrow();
    expect(() => validateItemName(".gitignore")).toThrow();
  });

  it("rejects Windows device names, which break downloads on the most common desktop", () => {
    expect(() => validateItemName("CON")).toThrow();
    expect(() => validateItemName("con.txt")).toThrow();
    expect(() => validateItemName("LPT1.log")).toThrow();
    // A name that merely starts with those letters is fine.
    expect(validateItemName("console.log")).toBe("console.log");
  });

  it("rejects an empty name and an over-long one", () => {
    expect(() => validateItemName("")).toThrow();
    expect(() => validateItemName("   ")).toThrow();
    expect(() => validateItemName("a".repeat(256))).toThrow();
    expect(validateItemName("a".repeat(255))).toHaveLength(255);
  });
});

describe("required strings", () => {
  it("rejects a missing key rather than coercing it", () => {
    expect(() => requireString({}, "name")).toThrow();
    expect(() => requireString({ name: 123 }, "name")).toThrow();
    expect(() => requireString({ name: null }, "name")).toThrow();
  });

  it("enforces the maximum length", () => {
    expect(() => requireString({ x: "a".repeat(11) }, "x", { max: 10 })).toThrow();
    expect(requireString({ x: "abc" }, "x", { max: 10 })).toBe("abc");
  });
});

describe("uuids", () => {
  const valid = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("accepts a uuid", () => {
    expect(requireUuid({ id: valid }, "id")).toBe(valid);
  });

  it("rejects anything that is not a uuid", () => {
    // This matters: ids are interpolated into query filters, so a non-uuid is
    // both a correctness bug and an injection surface.
    expect(() => requireUuid({ id: "1" }, "id")).toThrow();
    expect(() => requireUuid({ id: "'; drop table files; --" }, "id")).toThrow();
    expect(() => requireUuid({ id: "../../etc/passwd" }, "id")).toThrow();
  });

  it("treats a missing value as optional only when asked", () => {
    expect(requireUuid({}, "id", true)).toBeNull();
    expect(() => requireUuid({}, "id")).toThrow();
  });
});

describe("id arrays", () => {
  const a = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const b = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";

  it("accepts a list of uuids", () => {
    expect(requireStringArray({ ids: [a, b] }, "ids")).toHaveLength(2);
  });

  it("rejects an empty selection", () => {
    // "Select something first" is a better message than a silent no-op.
    expect(() => requireStringArray({ ids: [] }, "ids")).toThrow();
    expect(() => requireStringArray({}, "ids")).toThrow();
  });

  it("rejects a batch larger than the cap, so one request cannot stall the server", () => {
    const many = Array.from({ length: 501 }, () => a);
    expect(() => requireStringArray({ ids: many }, "ids", 500)).toThrow();
  });

  it("rejects a list containing a non-uuid", () => {
    expect(() => requireStringArray({ ids: [a, "not-a-uuid"] }, "ids")).toThrow();
  });
});
