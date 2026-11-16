"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import type { PlanIconName } from "@/config/pricing";

/**
 * Plan icons.
 *
 * The reference draws these as thin 1.6px strokes with a soft gradient on the
 * duotone fills. Cloud / leaf / star / gem / bolt / crown are drawn here rather
 * than taken from a library so the stroke weight, corner radii and optical
 * sizing match across all six.
 */

const ACCENT_VAR: Record<string, string> = {
  blue: "#3178FB",
  green: "#34C77B",
  violet: "#8B5CF6",
  coral: "#FB5F8A",
  amber: "#F9A53B",
};

export function planAccentHex(accent: string) {
  return ACCENT_VAR[accent] ?? ACCENT_VAR.blue;
}

export function PlanIcon({
  name,
  accent = "blue",
  className,
  strokeWidth = 1.7,
}: {
  name: PlanIconName;
  accent?: keyof typeof ACCENT_VAR;
  className?: string;
  strokeWidth?: number;
}) {
  const color = planAccentHex(accent);
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5", className)}
      aria-hidden="true"
      focusable="false"
    >
      {name === "cloud" && (
        <path
          {...common}
          d="M7.2 18.5h9.4a3.9 3.9 0 0 0 .5-7.77 5.1 5.1 0 0 0-9.8-1.1A3.94 3.94 0 0 0 7.2 18.5Z"
        />
      )}
      {name === "leaf" && (
        <path
          {...common}
          d="M19 4.5c0 8.4-4.1 12.6-9.2 12.6a4.3 4.3 0 0 1-4.3-4.3C5.5 7.6 11.2 4.5 19 4.5Z"
        />
      )}
      {name === "leaf" && <path {...common} d="M12.4 16.8 15 11" />}
      {name === "star" && (
        <path
          {...common}
          d="m12 3.6 2.5 5.1 5.6.8-4 3.95.94 5.55L12 16.35l-5.04 2.65.94-5.55-4-3.95 5.6-.8L12 3.6Z"
        />
      )}
      {name === "gem" && (
        <>
          <path {...common} d="M8.1 3.8h7.8l3.4 4.7-7.3 11.7L4.7 8.5l3.4-4.7Z" />
          <path {...common} d="M4.7 8.5h14.6M9.6 8.5 12 20.2l2.4-11.7M8.1 3.8 9.6 8.5M15.9 3.8 14.4 8.5" />
        </>
      )}
      {name === "bolt" && (
        <path {...common} d="M13.5 2.8 5.6 13.4h5.2l-.6 7.8 8.2-10.9h-5.3l.4-7.5Z" />
      )}
      {name === "crown" && (
        <>
          <path {...common} d="M3.4 8.1 7.1 12l4.9-6.7L16.9 12l3.7-3.9-1.4 10.4H4.8L3.4 8.1Z" />
          <path {...common} d="M8.2 18.5h7.6" />
        </>
      )}
    </svg>
  );
}

/**
 * Duotone folder glyph used in the product mockups. Two-stop gradient with a
 * lighter tab, matching the reference's four folder colours.
 */
export function FolderGlyph({
  from,
  to,
  className,
}: {
  from: string;
  to: string;
  className?: string;
}) {
  // Unique per instance and per colour pair: duplicate SVG gradient ids cause
  // every folder to paint with the first one's colours.
  const reactId = useId().replace(/:/g, "");
  const id = `fg-${from.replace("#", "")}-${to.replace("#", "")}-${reactId}`;
  return (
    <svg viewBox="0 0 48 40" className={cn("h-10 w-11", className)} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="6" y1="4" x2="40" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <path
        d="M4.5 11.2c0-2 1.6-3.6 3.6-3.6h8.1c1 0 1.9.4 2.6 1.1l2 2.1c.5.5 1.2.8 1.9.8h13.2c2 0 3.6 1.6 3.6 3.6v17c0 2-1.6 3.6-3.6 3.6H8.1c-2 0-3.6-1.6-3.6-3.6v-21Z"
        fill={`url(#${id})`}
      />
      <path
        d="M4.5 15.6h39"
        stroke="rgba(255,255,255,.42)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M8.1 7.6h8.1c1 0 1.9.4 2.6 1.1l2 2.1"
        stroke="rgba(255,255,255,.55)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Duotone database/stack glyph used by the storage capacity chips. */
export function StackGlyph({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-6 w-6", className)} aria-hidden="true">
      <ellipse cx="12" cy="6.1" rx="7" ry="2.9" fill="none" stroke={color} strokeWidth="1.6" />
      <path
        d="M5 6.1v5.6c0 1.6 3.13 2.9 7 2.9s7-1.3 7-2.9V6.1"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5 11.7v5.6c0 1.6 3.13 2.9 7 2.9s7-1.3 7-2.9v-5.6"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".55"
      />
    </svg>
  );
}
