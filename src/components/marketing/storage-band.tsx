import { StackGlyph } from "@/components/brand/plan-icon";
import { PLANS } from "@/config/pricing";
import { SectionHeading } from "./section-heading";

const CHIP_TINTS: Record<string, string> = {
  free: "#34C77B",
  basic: "#F9A53B",
  plus: "#4F8DFA",
  premium: "#8B5CF6",
  ultra: "#34C77B",
  max: "#FB7A5F",
};

/**
 * "A little more room for everything."
 *
 * Measured from the reference:
 *   headline two lines at x 37, 23px / 1.28, followed by a 76 × 3 gradient rule
 *   capacity card 482 × 116 at x 420, six chips in a row
 *   a periwinkle swoosh bleeding to the right viewport edge behind the card
 */
export function StorageBand() {
  return (
    <section className="relative overflow-hidden py-14 sm:py-16 lg:py-20">
      {/* swoosh */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full max-w-[1080px]"
      >
        <div className="absolute right-0 top-2 h-[210px] w-full rounded-l-[120px] bg-[radial-gradient(120%_100%_at_100%_0%,rgba(190,196,251,0.55),rgba(214,219,253,0.28)_55%,rgba(255,255,255,0)_80%)]" />
        <div className="absolute bottom-[-30px] right-[-4%] h-[130px] w-[74%] rounded-[100px] bg-[radial-gradient(100%_100%_at_50%_50%,rgba(112,128,246,0.28),rgba(255,255,255,0)_72%)]" />
        <span className="absolute right-[16%] top-[14px] h-[22px] w-[22px] rotate-[-24deg] rounded-[7px] bg-[#8CB8FB]/80" />
        <span className="absolute right-[3%] top-[42px] h-[14px] w-[14px] rotate-[18deg] rounded-[4px] bg-[#A8C8FD]/70" />
      </div>

      <div className="container-or">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-12">
          <div className="max-w-[400px]">
            <SectionHeading>
              A little more
              <br />
              room for everything.
            </SectionHeading>
            <span
              aria-hidden="true"
              className="mt-5 block h-[3px] w-[76px] rounded-full bg-[linear-gradient(90deg,#8B6DF6,#F7A8B8_55%,#FFC9A8)] sm:mt-6"
            />
          </div>

          <div className="rounded-[16px] border border-[var(--brand-border)] bg-white/80 p-3 shadow-[var(--brand-shadow-md)] backdrop-blur-sm sm:p-4">
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PLANS.map((plan) => (
                <li
                  key={plan.id}
                  className="flex flex-col items-center justify-center gap-2 rounded-[10px] py-3"
                >
                  <span
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]"
                    style={{ backgroundColor: `${CHIP_TINTS[plan.id]}14` }}
                  >
                    <StackGlyph color={CHIP_TINTS[plan.id]} className="h-[21px] w-[21px]" />
                  </span>
                  <span className="text-[11.5px] font-semibold leading-none tracking-[-0.01em] text-ink sm:text-[12px]">
                    {plan.storage}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
