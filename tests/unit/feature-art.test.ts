/**
 * The three feature illustrations, rendered and measured.
 *
 * These are drawings, so the interesting failures are geometric: text that runs out of
 * its panel, a screen whose content is wider than the glass it is drawn on, two
 * elements landing on top of each other. None of that is visible from the source, and
 * all of it was present in the first draft — the storage legend overflowed the panel
 * and the tablet's tile row was clipped by its frame.
 *
 * So these tests render the components to markup and read the numbers back out. They
 * do not check that the picture is pretty; they check that every label it claims to
 * draw fits inside the box it claims to be in.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DevicesArt, ShareCardArt, StorePanelArt } from "@/components/marketing/feature-art";

/**
 * Pull the text nodes out of the rendered SVG, with their x/y.
 *
 * One matcher over the raw `<text …>value<` runs, not two: an earlier version scanned
 * twice (once for each attribute order) and double-counted every label, which made the
 * geometry assertions pass for the wrong reason.
 */
function texts(markup: string) {
  return [...markup.matchAll(/<text([^>]*)>([^<]*)</g)]
    .map((match) => {
      const attrs = match[1];
      const x = /\bx="([-\d.]+)"/.exec(attrs)?.[1];
      const y = /\by="([-\d.]+)"/.exec(attrs)?.[1];
      if (x === undefined || y === undefined) return null;
      return {
        x: Number(x),
        y: Number(y),
        anchor: /text-anchor="(\w+)"/.exec(attrs)?.[1],
        value: match[2],
      };
    })
    .filter((t): t is { x: number; y: number; anchor: string | undefined; value: string } => t !== null);
}

const ALL = [
  ["StorePanelArt", StorePanelArt],
  ["DevicesArt", DevicesArt],
  ["ShareCardArt", ShareCardArt],
] as const;

describe("feature illustrations", () => {
  for (const [name, Art] of ALL) {
    describe(name, () => {
      const markup = renderToStaticMarkup(createElement(Art));

      it("is one SVG in the shared 290 × 200 box", () => {
        expect(markup.match(/<svg/g)).toHaveLength(1);
        expect(markup).toContain('viewBox="0 0 290 200"');
      });

      it("keeps every label inside the box", () => {
        // A drawing whose own text runs outside the frame is broken at every size.
        const outside = texts(markup).filter((t) => t.x < 0 || t.x > 290 || t.y < 8 || t.y > 200);
        expect(outside.map((t) => t.value)).toEqual([]);
      });

      it("is decorative: no title or role that would make it a control", () => {
        expect(markup).toContain('aria-hidden="true"');
        expect(markup).not.toContain("<title");
      });

      it("renders no placeholder lorem and no invented names", () => {
        // Every string on screen is either a real product word or a figure that the
        // drawing computes. No "John Doe", no "example@example.com".
        const strings = texts(markup).map((t) => t.value);
        expect(strings.join(" ")).not.toMatch(/lorem|john|jane|example@/i);
      });
    });
  }

  it("states one capacity figure and derives the rest from it", () => {
    const markup = renderToStaticMarkup(createElement(StorePanelArt));
    /*
     * The donut's two labels are `text-anchor="middle"` with no x, so they have no
     * x/readable position of their own — but they are still text the drawing shows.
     * Collect every `<text>` value, not just the positioned ones.
     */
    const values = [...markup.matchAll(/<text[^>]*>([^<]*)</g)].map((m) => m[1]);
    // The panel must not claim two different used-amounts.
    const used = values.filter((v) => /GB used/.test(v));
    expect(used).toEqual(["6 GB used"]);
    expect(values).toContain("6 GB");
    expect(values).toContain("of 10 GB");
    // 6 + 4 = 10, so the free figure is not a second invention.
    expect(values).toContain("4 GB free");
  });

  it("gives the phone a layout of its own, not the laptop's scaled down", () => {
    // The tell is the folder tile row: three on the laptop, two on the tablet, none on
    // the phone, whose 32px-wide glass cannot hold a grid.
    const markup = renderToStaticMarkup(createElement(DevicesArt));
    const tileRects = [...markup.matchAll(/rx="4" fill="#FBFCFE"/g)];
    expect(tileRects).toHaveLength(3 + 2);
  });
});

describe("the pastel discs", () => {
  /*
   * A circle whose centre sits outside the viewBox is cropped into a shape with two
   * straight sides — a corner, not a circle. It reads as a blobby backdrop rather than
   * a disc, which is what these are. So every disc must sit wholly inside the 290x200
   * box: centre minus radius >= 0, centre plus radius <= the edge.
   */
  const BOX = { w: 290, h: 200 };

  for (const [name, Art] of ALL) {
    it(`${name} draws its discs as complete circles`, () => {
      const markup = renderToStaticMarkup(createElement(Art));
      const discs = [...markup.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map((m) => ({
        cx: Number(m[1]),
        cy: Number(m[2]),
        r: Number(m[3]),
      }));

      // The pastel backdrops are the large circles; the small marks are icons.
      const large = discs.filter((d) => d.r >= 18);
      expect(large.length).toBeGreaterThanOrEqual(2);

      for (const disc of large) {
        expect(disc.cx - disc.r).toBeGreaterThanOrEqual(0);
        expect(disc.cy - disc.r).toBeGreaterThanOrEqual(0);
        expect(disc.cx + disc.r).toBeLessThanOrEqual(BOX.w);
        expect(disc.cy + disc.r).toBeLessThanOrEqual(BOX.h);
      }
    });
  }
});
