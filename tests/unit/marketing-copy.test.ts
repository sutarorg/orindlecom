/**
 * The landing page's copy and its responsive omissions.
 *
 * These are one-line facts that are easy to undo accidentally and invisible to a type
 * checker: a line of text that should only appear on desktop, a footnote that repeats a
 * promise already made twice above it, an address that was removed on purpose.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (file: string) => readFile(path.join(ROOT, file), "utf8");

describe("the hero's assurance line", () => {
  it("is desktop only", async () => {
    /*
     * On a phone it sat under two full-width stacked buttons and pushed the mockup —
     * the only thing on the page that shows what the product is — below the fold. The
     * claim itself is not lost: it is on the pricing page and in signup.
     */
    const hero = await read("src/components/marketing/hero.tsx");
    expect(hero).toMatch(/hidden items-center gap-\[6px\][^"]*sm:flex/);
    expect(hero).toContain("No credit card required");
  });

  it("does not use a breakpoint that would hide it on tablets", async () => {
    // `md:flex` would have hidden it on small tablets too, where there is room for it.
    const hero = await read("src/components/marketing/hero.tsx");
    const assurance = hero.slice(hero.indexOf("No credit card required") - 700, hero.indexOf("No credit card required"));
    expect(assurance).not.toMatch(/\bmd:hidden|md:flex/);
  });
});

describe("the pricing footnote", () => {
  it("says only what has not already been said", async () => {
    /*
     * It used to restate the storage promise and the location-based pricing, both of
     * which are already shown elsewhere on the page — and at 11.5px in the subtlest
     * colour, a four-clause sentence was being used as a footnote.
     */
    const section = await read("src/components/pricing/pricing-section.tsx");
    expect(section).toContain("Save 20% with annual billing. No credit card required.");
    expect(section).not.toMatch(/Storage is shared across every device/);
    expect(section).not.toMatch(/Prices are shown automatically/);
    expect(section).not.toMatch(/required to start/);
  });
});

describe("the footer", () => {
  it("does not publish a support address in the bottom bar", async () => {
    const footer = await read("src/components/layout/site-footer.tsx");
    expect(footer).not.toMatch(/Support:\s*\{?"?\s*\/>/);
    expect(footer).not.toMatch(/mailto:\$\{SITE\.supportEmail\}/);
    // The copyright line stays; the bar is not empty.
    expect(footer).toContain("All rights reserved.");
  });

  it("keeps the address reachable where it belongs", async () => {
    /*
     * Removing it from the footer bar is not the same as removing it from the site.
     * The legal pages still show it, which is where someone looking for support
     * contact details actually goes.
     */
    const legal = await read("src/components/layout/legal-page.tsx");
    expect(legal).toContain("SITE.supportEmail");
  });
});

describe("the feature trio", () => {
  it("aligns the three plates on one line", async () => {
    /*
     * The headings above the art have different lengths, so "Store without the clutter"
     * wraps to two lines at some widths while "Access from anywhere" does not. Without
     * pinning, the three drawings start at three different heights.
     */
    const trio = await read("src/components/marketing/feature-trio.tsx");
    // The art block is pushed to the bottom of an equal-height column.
    expect(trio).toMatch(/flex flex-1 items-end/);
    // Every plate is the same height, so their tops line up once their bottoms do.
    expect(trio).toMatch(/h-\[170px\].*sm:h-\[180px\].*lg:h-\[200px\]/s);
  });
});
