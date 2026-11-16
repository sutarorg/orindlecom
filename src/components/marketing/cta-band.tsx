import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Closing conversion band.
 *
 * Measured from the reference: 876 × 137 at 941px, 20px radius, inside the
 * container gutters (never full-bleed), pastel multi-hue gradient, centred copy
 * with a 23px headline, 14px subhead and a 38px pill. The 3D folder stack and
 * soft cloud are the only raster imagery on the page and are cropped by the
 * band's overflow.
 */
export function CtaBand() {
  return (
    <section className="pb-14 pt-2 sm:pb-16 lg:pb-20">
      <div className="container-or">
        <div className="relative isolate overflow-hidden rounded-[20px] px-5 py-9 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          {/* pastel gradient field */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,#EDE9FE_0%,#E3E4FE_22%,#DDE7FD_42%,#E8E4FB_58%,#FBE7DC_76%,#E3F0F7_92%,#EAF1F8_100%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(80%_120%_at_18%_120%,rgba(180,178,250,0.55),rgba(255,255,255,0)_62%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(70%_110%_at_88%_10%,rgba(255,214,196,0.55),rgba(255,255,255,0)_60%)]"
          />

          {/* decorative tiles */}
          <span
            aria-hidden="true"
            className="absolute right-[26%] top-[38%] h-[16px] w-[16px] rotate-[16deg] rounded-[4px] bg-[#8CB8FB]/70 max-sm:hidden"
          />
          <span
            aria-hidden="true"
            className="absolute right-[9%] top-[62%] h-[10px] w-[10px] rotate-[28deg] rounded-[3px] bg-[#8CB8FB]/60 max-sm:hidden"
          />

          {/* 3D folder stack, left */}
          <Image
            src="/art/cta-folder.png"
            alt=""
            aria-hidden="true"
            width={420}
            height={412}
            className="pointer-events-none absolute -bottom-2 left-1 z-0 w-[92px] select-none drop-shadow-[0_16px_24px_rgba(70,90,170,0.20)] sm:left-3 sm:w-[118px] lg:bottom-0 lg:left-6 lg:w-[150px]"
            priority={false}
          />

          {/* 3D cloud, right */}
          <Image
            src="/art/cta-cloud.png"
            alt=""
            aria-hidden="true"
            width={800}
            height={484}
            className="pointer-events-none absolute -bottom-1 right-0 z-0 w-[128px] select-none opacity-95 drop-shadow-[0_16px_24px_rgba(120,110,150,0.14)] sm:right-2 sm:w-[158px] lg:bottom-0 lg:right-8 lg:w-[186px]"
            priority={false}
          />

          <div className="relative z-10 mx-auto max-w-[520px] text-center">
            <h2 className="text-[length:var(--brand-h2-size)] font-extrabold leading-[1.24] tracking-[var(--brand-h2-tracking)] text-ink">
              Your next home for files starts here.
            </h2>
            <p className="mx-auto mt-2 max-w-[380px] text-[length:var(--brand-body-size)] leading-[1.5] tracking-[-0.02em] text-text">
              Get started with 10 GB of free cloud storage.
            </p>
            <div className="mt-5 flex justify-center lg:mt-6">
              <Button
                asChild
                size="lg"
                pill
                className="h-[38px] px-5 text-[12.5px] tracking-[-0.01em] lg:h-11 lg:px-6 lg:text-[13.5px]"
              >
                <Link href="/signup">
                  Create Your Free Account
                  <ArrowRight className="h-[14px] w-[14px]" strokeWidth={2.2} />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
