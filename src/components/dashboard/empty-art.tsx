import { cn } from "@/lib/utils";

/**
 * First-run illustrations.
 *
 * Drawn as inline SVG rather than exported bitmaps: they inherit the token
 * palette, stay crisp at every density, and cost nothing to load on the screen
 * where the product is trying to feel instant.
 *
 * Each one borrows the visual language of the marketing site — a soft pastel
 * plane with floating sheets — so the dashboard's first impression is the same
 * product the visitor just signed up for.
 */

export function EmptyLibraryArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 160"
      fill="none"
      className={cn("h-auto w-full", className)}
      role="presentation"
    >
      {/* pastel planes */}
      <ellipse cx="120" cy="138" rx="96" ry="14" fill="#EAF1FF" opacity="0.75" />
      <circle cx="52" cy="40" r="26" fill="#EFE9FD" opacity="0.85" />
      <circle cx="196" cy="52" r="20" fill="#DFF4F2" opacity="0.9" />
      <circle cx="176" cy="118" r="12" fill="#FFE6DC" opacity="0.8" />

      {/* the folder body */}
      <g>
        <path
          d="M62 62.5c0-3.6 2.9-6.5 6.5-6.5h26.8c1.9 0 3.7.85 5 2.33l4.6 5.17h56.6c3.6 0 6.5 2.9 6.5 6.5v52.5c0 3.6-2.9 6.5-6.5 6.5h-93c-3.6 0-6.5-2.9-6.5-6.5V62.5Z"
          fill="#DCE9FF"
        />
        <path
          d="M62 70.5c0-3.6 2.9-6.5 6.5-6.5h93c3.6 0 6.5 2.9 6.5 6.5v50.5c0 3.6-2.9 6.5-6.5 6.5h-93c-3.6 0-6.5-2.9-6.5-6.5V70.5Z"
          fill="#F4F8FF"
          stroke="#BFD6FF"
          strokeWidth="1.4"
        />
      </g>

      {/* sheets lifting out of the folder */}
      <g>
        <rect x="104" y="34" width="42" height="52" rx="5" fill="#FFFFFF" stroke="#D5DAEA" strokeWidth="1.3" transform="rotate(-8 104 34)" />
        <rect x="112" y="46" width="22" height="2.6" rx="1.3" fill="#DCE3F3" transform="rotate(-8 112 46)" />
        <rect x="111" y="53" width="28" height="2.6" rx="1.3" fill="#E7ECF7" transform="rotate(-8 111 53)" />
        <rect x="110" y="60" width="18" height="2.6" rx="1.3" fill="#E7ECF7" transform="rotate(-8 110 60)" />
      </g>
      <g>
        <rect x="140" y="42" width="36" height="44" rx="5" fill="#FFFFFF" stroke="#D5DAEA" strokeWidth="1.3" transform="rotate(7 140 42)" />
        <circle cx="158" cy="56" r="5" fill="#BFD6FF" transform="rotate(7 158 56)" />
        <rect x="147" y="66" width="20" height="2.4" rx="1.2" fill="#E7ECF7" transform="rotate(7 147 66)" />
        <rect x="146" y="72" width="14" height="2.4" rx="1.2" fill="#E7ECF7" transform="rotate(7 146 72)" />
      </g>

      {/* upload arrow badge */}
      <g>
        <circle cx="120" cy="98" r="16" fill="#3178FB" />
        <path
          d="M120 105.5V91m0 0-5 5m5-5 5 5"
          stroke="#FFFFFF"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** For the folders route: a small tree of nested folders. */
export function EmptyFoldersArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 150" fill="none" className={cn("h-auto w-full", className)} role="presentation">
      <ellipse cx="120" cy="132" rx="88" ry="12" fill="#EAF1FF" opacity="0.7" />
      <circle cx="196" cy="34" r="18" fill="#EFE9FD" opacity="0.85" />
      <circle cx="44" cy="100" r="14" fill="#DFF4F2" opacity="0.9" />

      {/* root folder */}
      <path
        d="M84 44.5c0-3 2.4-5.5 5.5-5.5h21.4c1.6 0 3.1.7 4.2 1.9l3.6 4.1h42.8c3 0 5.5 2.4 5.5 5.5v44c0 3-2.4 5.5-5.5 5.5h-72c-3 0-5.5-2.4-5.5-5.5v-50Z"
        fill="#DCE9FF"
      />
      <path
        d="M84 51.5c0-3 2.4-5.5 5.5-5.5h72c3 0 5.5 2.4 5.5 5.5v42c0 3-2.4 5.5-5.5 5.5h-72c-3 0-5.5-2.4-5.5-5.5v-42Z"
        fill="#F4F8FF"
        stroke="#BFD6FF"
        strokeWidth="1.4"
      />

      {/* child folder */}
      <path
        d="M104 84c0-2.4 1.9-4.4 4.4-4.4h16.2c1.3 0 2.5.6 3.4 1.5l2.9 3.3h32.7c2.4 0 4.4 1.9 4.4 4.4v26c0 2.4-1.9 4.4-4.4 4.4h-55.2c-2.4 0-4.4-1.9-4.4-4.4V84Z"
        fill="#FFFFFF"
        stroke="#BFD6FF"
        strokeWidth="1.4"
      />
      <rect x="112" y="96" width="26" height="2.6" rx="1.3" fill="#E2E8F6" />
      <rect x="112" y="102" width="18" height="2.6" rx="1.3" fill="#EDF1F9" />
    </svg>
  );
}

/** For Recent / Starred: a clock or star motif without being literal. */
export function EmptyCollectionArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 130" fill="none" className={cn("h-auto w-full", className)} role="presentation">
      <ellipse cx="100" cy="112" rx="70" ry="10" fill="#EAF1FF" opacity="0.7" />
      <circle cx="48" cy="32" r="17" fill="#EFE9FD" opacity="0.8" />
      <circle cx="158" cy="44" r="13" fill="#DFF4F2" opacity="0.9" />

      <rect x="58" y="34" width="84" height="60" rx="9" fill="#FFFFFF" stroke="#D5DAEA" strokeWidth="1.5" />
      <rect x="72" y="50" width="34" height="3" rx="1.5" fill="#DCE3F3" />
      <rect x="72" y="59" width="50" height="3" rx="1.5" fill="#E9EEF8" />
      <rect x="72" y="68" width="26" height="3" rx="1.5" fill="#E9EEF8" />
      <circle cx="124" cy="76" r="10" fill="#EAF1FF" />
      <path
        d="M124 70.5V76l3.6 2.2"
        stroke="#3178FB"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
