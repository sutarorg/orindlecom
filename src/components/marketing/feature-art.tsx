import { Clock, Folder, Home, Share2, Trash2 } from "lucide-react";
import { CloudGlyph } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * Feature illustrations.
 *
 * The reference draws three product-language vignettes rather than stock art:
 *   01 a storage panel with a donut and legend rows
 *   02 three overlapping device frames
 *   03 a share dialog with a link chip
 *
 * All three are built here in HTML/CSS so they stay crisp, themeable and
 * responsive. No raster imagery, and no invented user data: the only numbers
 * shown are capacity figures (2.4 GB of 10 GB) which are clearly illustrative.
 */

/* ------------------------------------------------------------------ */
/*  01 — Store without the clutter                                     */
/* ------------------------------------------------------------------ */

export function StorePanelArt({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-full w-full", className)} aria-hidden="true">
      {/* pastel circles */}
      <span className="absolute -top-1 right-[4%] h-[104px] w-[104px] rounded-full bg-[#DFF4F2]" />
      <span className="absolute bottom-[-14px] right-[-6px] h-[86px] w-[86px] rounded-full bg-[#FFE6DC]" />

      <div className="relative flex h-full overflow-hidden rounded-[16px] border border-[var(--brand-border)] bg-white shadow-[var(--brand-shadow-lg)]">
        {/* icon rail */}
        <div className="flex w-[44px] shrink-0 flex-col items-center gap-4 border-r border-[var(--brand-border-soft)] bg-[var(--brand-surface-muted)] py-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-white shadow-[var(--brand-shadow-xs)]">
            <CloudGlyph className="h-[11px] w-[17px] text-primary" />
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-primary-soft">
            <Home className="h-3 w-3 text-primary" strokeWidth={2} />
          </span>
          <Folder className="h-3 w-3 text-text-subtle" strokeWidth={1.8} />
          <Clock className="h-3 w-3 text-text-subtle" strokeWidth={1.8} />
          <Share2 className="h-3 w-3 text-text-subtle" strokeWidth={1.8} />
          <Trash2 className="h-3 w-3 text-text-subtle" strokeWidth={1.8} />
        </div>

        {/* body */}
        <div className="flex min-w-0 flex-1 gap-3 p-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold tracking-[-0.02em] text-ink">Storage</p>

            {/* donut */}
            <div className="mt-2.5 flex items-center gap-3">
              <div className="relative h-[68px] w-[68px] shrink-0">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#EDF0F8"
                    strokeWidth="4"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#3178FB"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="24 100"
                    pathLength={100}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[13px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                    2.4 GB
                  </span>
                  <span className="mt-0.5 text-[8px] leading-none text-text-subtle">of 10 GB</span>
                </div>
              </div>

              {/* legend rows */}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {[
                  { color: "#3178FB", w: "88%" },
                  { color: "#8B5CF6", w: "56%" },
                  { color: "#FB7A5F", w: "34%" },
                ].map((row) => (
                  <div key={row.color} className="flex items-center gap-1.5">
                    <span
                      className="h-[6px] w-[6px] shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="h-[5px] rounded-full bg-[#EDF0F8]" style={{ width: row.w }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  02 — Access from anywhere                                          */
/* ------------------------------------------------------------------ */

function MiniLibrary({ rows = 2 }: { rows?: number }) {
  return (
    <div className="flex h-full flex-col gap-1.5 bg-white p-1.5">
      <div className="flex items-center gap-1">
        <CloudGlyph className="h-[5px] w-[8px] text-primary" />
        <span className="text-[4px] font-bold tracking-[-0.02em] text-ink">Orindle</span>
      </div>
      <div className="flex gap-1">
        {[
          ["#7FB2FA", "#3B7DE8"],
          ["#8CE3BE", "#38BD8B"],
          ["#FFC078", "#FB8F3D"],
        ].map(([from, to], i) => (
          <div
            key={i}
            className="flex flex-1 flex-col items-center gap-[2px] rounded-[3px] bg-[#FBFCFE] py-[3px]"
          >
            <svg viewBox="0 0 48 40" className="h-[9px] w-[11px]">
              <path
                d="M4.5 11.2c0-2 1.6-3.6 3.6-3.6h8.1c1 0 1.9.4 2.6 1.1l2 2.1c.5.5 1.2.8 1.9.8h13.2c2 0 3.6 1.6 3.6 3.6v17c0 2-1.6 3.6-3.6 3.6H8.1c-2 0-3.6-1.6-3.6-3.6v-21Z"
                fill={from}
              />
              <path d="M4.5 11.2h39" stroke={to} strokeWidth="6" opacity=".35" />
            </svg>
            <span className="h-[2px] w-[10px] rounded-full bg-[#E9EDF6]" />
          </div>
        ))}
      </div>
      {rows > 1 &&
        [0, 1].map((r) => (
          <div key={r} className="flex flex-col gap-[3px]">
            <span className="h-[2px] w-[16px] rounded-full bg-[#EDF0F8]" />
            <span className="h-[2px] w-full rounded-full bg-[#F3F6FB]" />
          </div>
        ))}
    </div>
  );
}

export function DevicesArt({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-full w-full", className)} aria-hidden="true">
      <span className="absolute left-1/2 top-2 h-[110px] w-[110px] -translate-x-1/2 rounded-full bg-[#DFF4F2]" />

      <div className="relative flex h-full items-end justify-center gap-0">
        {/* laptop */}
        <div className="relative w-[62%] translate-y-1">
          <div className="overflow-hidden rounded-t-[5px] border-[3px] border-[#1B2036] bg-[#1B2036] shadow-[var(--brand-shadow-md)]">
            <div className="h-[86px] overflow-hidden rounded-[1px] bg-white">
              <MiniLibrary rows={2} />
            </div>
          </div>
          <div className="mx-auto h-[4px] w-[112%] rounded-b-[3px] bg-[#2A3049]" />
        </div>

        {/* tablet */}
        <div className="relative -ml-4 w-[36%] translate-y-2">
          <div className="overflow-hidden rounded-[6px] border-[3px] border-[#1B2036] bg-[#1B2036] shadow-[var(--brand-shadow-md)]">
            <div className="h-[74px] overflow-hidden rounded-[2px] bg-white">
              <MiniLibrary rows={1} />
            </div>
          </div>
        </div>

        {/* phone */}
        <div className="relative -ml-3 w-[17%] translate-y-3">
          <div className="overflow-hidden rounded-[5px] border-[2.5px] border-[#1B2036] bg-[#1B2036] shadow-[var(--brand-shadow-md)]">
            <div className="h-[52px] overflow-hidden rounded-[2px] bg-white">
              <MiniLibrary rows={1} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  03 — Share with simplicity                                         */
/* ------------------------------------------------------------------ */

export function ShareCardArt({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-full w-full", className)} aria-hidden="true">
      <span className="absolute right-[-10px] top-[-8px] h-[100px] w-[100px] rounded-full bg-[#FFE6DC]" />
      <span className="absolute bottom-[-10px] left-[-8px] h-[74px] w-[74px] rounded-full bg-[#F1ECFE]" />

      {/* link chip */}
      <div className="absolute -top-3 right-2 z-10 flex h-[38px] w-[38px] rotate-6 items-center justify-center rounded-[11px] border border-white bg-[#EAF1FF] shadow-[var(--brand-shadow-md)]">
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" aria-hidden="true">
          <path
            d="M10.2 13.8a3.4 3.4 0 0 0 4.8 0l2.6-2.6a3.4 3.4 0 0 0-4.8-4.8l-1 1"
            stroke="#3178FB"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M13.8 10.2a3.4 3.4 0 0 0-4.8 0l-2.6 2.6a3.4 3.4 0 0 0 4.8 4.8l1-1"
            stroke="#3178FB"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="relative flex h-full flex-col rounded-[16px] border border-[var(--brand-border)] bg-white p-3.5 shadow-[var(--brand-shadow-lg)]">
        <p className="text-[12px] font-bold tracking-[-0.025em] text-ink">Share folder</p>

        <div className="mt-2.5 flex h-[30px] items-center rounded-[8px] border border-[var(--brand-border-soft)] px-2.5">
          <span className="truncate text-[9px] text-text-subtle">
            Add people or email address…
          </span>
        </div>

        <div className="mt-2 flex h-[30px] items-center justify-between rounded-[8px] border border-[var(--brand-border-soft)] px-2.5">
          <span className="text-[9px] text-text">Can view</span>
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-text-subtle" fill="none">
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="mt-auto flex h-[26px] w-[64px] items-center justify-center self-end rounded-full bg-primary text-[9px] font-semibold text-white shadow-[var(--brand-shadow-primary)]">
          Share
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section composition                                                */
/* ------------------------------------------------------------------ */

export const FEATURES = [
  {
    step: "01",
    title: "Store without the clutter",
    body: "Keep your digital world organized in one place.",
    badgeClass: "bg-primary-soft text-primary",
    Art: StorePanelArt,
  },
  {
    step: "02",
    title: "Access from anywhere",
    body: "Your files, ready whenever you need them.",
    badgeClass: "bg-primary-soft text-primary",
    Art: DevicesArt,
  },
  {
    step: "03",
    title: "Share with simplicity",
    body: "Share files and folders without the friction.",
    badgeClass: "bg-[#F1ECFE] text-[#8B5CF6]",
    Art: ShareCardArt,
  },
] as const;
