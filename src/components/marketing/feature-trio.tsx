import { FEATURES } from "./feature-art";
import { SectionHeading } from "./section-heading";

/**
 * "Everything you need. Nothing you don't."
 *
 * Measured from the reference:
 *   heading centred, cap-top 500, ink width 521px
 *   columns at x 52 / 357 / 656, ~57px gutters
 *   step badge 22px, then 22px gap, h3, 8px gap, two-line body
 *   illustration 200px tall, cropped by the section's bottom edge
 */
export function FeatureTrio() {
  return (
    <section className="relative overflow-hidden pb-16 pt-12 sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20">
      <div className="container-or">
        <SectionHeading className="mx-auto max-w-[640px] text-center">
          Everything you need. Nothing you don&rsquo;t.
        </SectionHeading>

        <div className="mt-8 grid gap-x-10 gap-y-12 sm:mt-10 md:grid-cols-3 md:gap-x-7 lg:mt-12 lg:gap-x-12">
          {FEATURES.map(({ step, title, body, badgeClass, Art }) => (
            <div key={step} className="flex flex-col">
              <span
                className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-semibold leading-none tracking-[0.01em] ${badgeClass}`}
                aria-hidden="true"
              >
                {step}
              </span>

              <h3 className="mt-[18px] text-[length:var(--brand-h3-size)] font-bold leading-[1.3] tracking-[var(--brand-h3-tracking)] text-ink">
                {title}
              </h3>
              <p className="mt-[7px] max-w-[218px] text-[length:var(--brand-body-size)] leading-[1.55] tracking-[-0.02em] text-text-muted">
                {body}
              </p>

              {/*
                The three drawings share one horizontal line.

                Each card is its own flex column, and the heading and body above the art
                are different lengths ("Store without the clutter" wraps to two lines at
                some widths, "Access from anywhere" does not). Stacked normally, that
                pushed the plates to three different heights. `mt-auto` puts each plate at
                the bottom of its own column instead, and because the columns in a grid
                row are the same height, that is one line for all three — with the plates
                the same fixed height, so their tops line up too.

                The `mt-*` values live on the wrapper's margin, so the gap above a pushed
                plate is still 28px when nothing was pushed.
              */}
              <div className="flex flex-1 items-end">
                <div className="mt-7 h-[170px] w-full max-w-[290px] sm:h-[180px] lg:mt-8 lg:h-[200px]">
                  <Art />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
