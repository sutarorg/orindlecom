import Link from "next/link";
import { ArrowRight, CircleSlash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductMockup } from "@/components/product/product-mockup";
import { HeroBackdrop } from "./hero-backdrop";

/**
 * Hero.
 *
 * Measured against the reference at 941px:
 *   headline cap-top 121, first-baseline 159, pitch 54.5 → 56px / 0.974 / −0.052em
 *   body top 293 (23px below the headline's descender), 14px / 1.64
 *   CTA row top 361 (32px below the body), buttons 38px tall, 13.5px
 *   assurance line top 415, 12px
 *   copy column ends at x 393; the mockup begins at x 398
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pb-10 pt-[22px] sm:pt-8 lg:pb-20 lg:pt-[42px]">
      <HeroBackdrop />

      <div className="container-or">
        <div className="grid items-center gap-9 lg:grid-cols-[minmax(0,0.79fr)_minmax(0,1.03fr)] lg:gap-2 xl:gap-6">
          {/* ---------------- copy ---------------- */}
          <div className="max-w-[430px] lg:max-w-[400px] xl:max-w-[470px]">
            <h1 className="type-display">
              Your files.
              <br />
              Your world.
              <br />
              <span className="text-primary">One simple place.</span>
            </h1>

            <p className="mt-[18px] max-w-[21rem] text-[length:var(--brand-text-body-size)] leading-[var(--brand-text-body-line)] tracking-[var(--brand-text-body-tracking)] text-text-muted sm:mt-5">
              Store, access and share your files from anywhere. A simpler way to keep
              everything together.
            </p>

            <div className="mt-[28px] flex gap-3 sm:mt-6 sm:gap-3.5">
              <Button
                asChild
                size="lg"
                pill
                className="h-[38px] px-[14px] text-[12.5px] tracking-[-0.005em] lg:h-11 lg:px-5 lg:text-[13.5px]"
              >
                <Link href="/signup">
                  Get 10 GB Free
                  <ArrowRight className="h-[15px] w-[15px]" strokeWidth={2.2} />
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="lg"
                pill
                className="h-[38px] px-[14px] text-[12.5px] tracking-[-0.005em] lg:h-11 lg:px-5 lg:text-[13.5px]"
              >
                <Link href="/pricing">Explore Plans</Link>
              </Button>
            </div>

            {/*
              Desktop only.

              On a phone this line sat directly under the two stacked buttons and pushed
              the mockup — the one thing that shows what the product is — below the fold.
              The same reassurance is on the pricing page and in the signup form, so
              nothing is lost that a phone visitor cannot find two taps away.
            */}
            <p className="mt-[20px] hidden items-center gap-[6px] text-[length:var(--brand-text-caption-size)] text-text-subtle sm:mt-6 sm:flex">
              <CircleSlash
                className="h-[13px] w-[13px] shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              No credit card required
            </p>
          </div>

          {/* ---------------- mockup ---------------- */}
          <div className="relative lg:-mr-1 xl:-mr-4">
            <div className="mx-auto w-full max-w-[520px] lg:ml-auto lg:mr-0 lg:max-w-none lg:pl-1">
              <ProductMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
