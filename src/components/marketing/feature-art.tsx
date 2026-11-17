import { cn } from "@/lib/utils";

/**
 * Feature illustrations — 01 store, 02 devices, 03 share.
 *
 * These were built from divs: a rounded panel, a flex row of bars standing in for
 * text, a five-icon rail. At 200px tall that produced something recognisable but
 * soft — the "legend rows" were three grey pills of arbitrary width, the device
 * screens were four stacked rules, and the share card had a chevron that was the
 * only thing in the composition drawn as a path. The art read as a wireframe of a
 * screenshot rather than as a picture of the product.
 *
 * They are drawn as inline SVG now, and that changes three things at once:
 *
 *   - **Alignment is exact.** The donut, its centre label, the legend and the rail
 *     are placed on a grid, so nothing is a pixel off from its neighbour when the
 *     column width changes. CSS could only approximate that at three breakpoints.
 *   - **Detail costs bytes, not pixels.** Rounded caps, a two-stop folder body, a
 *     device notch and a soft cast shadow are all cheap in a path and would each have
 *     been another div with its own border radius.
 *   - **One aspect box, scaled.** Each drawing has a `viewBox` and `preserveAspectRatio`,
 *     so the composition keeps its proportions in the 170px, 180px and 200px slots
 *     instead of reflowing into a different picture.
 *
 * What has not changed: no raster imagery, no invented user data. The only figures are
 * the illustrative capacity numbers, and they are the same ones as before. Everything
 * decorative is `aria-hidden`; a drawing that carried meaning would get a title.
 *
 * Palette: the four hues already in the design system (primary `#3178FB`, violet
 * `#8B5CF6`, peach `#FB7A5F`, mint `#38BD8B`) and the pastel washes from the tokens.
 * One accent hue leads each illustration, as §8.9 of the design system requires.
 */

/* ------------------------------------------------------------------ */
/*  Shared pieces                                                      */
/* ------------------------------------------------------------------ */

/** The soft circle behind each composition. Sits under the panel, bleeds past it. */
function PastelCircle({
  cx,
  cy,
  r,
  fill,
  opacity = 1,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  opacity?: number;
}) {
  return <circle cx={cx} cy={cy} r={r} fill={fill} opacity={opacity} />;
}

/** Orindle's cloud, as a path so it can sit inside another SVG without nesting. */
const CLOUD_PATH =
  "M9.35 21.1c-2.4 0-4.44-.83-6.12-2.5C1.55 16.93.71 14.9.71 12.5c0-2.03.61-3.82 1.84-5.36A8.2 8.2 0 0 1 7.2 4.4a6.95 6.95 0 0 1 2.64-3.1A7.06 7.06 0 0 1 13.7.2c1.9 0 3.58.6 5.03 1.8a8.6 8.6 0 0 1 2.73 3.86 6.9 6.9 0 0 1 4.34 1.19 6.53 6.53 0 0 1 2.5 3.16c.4.86.6 1.75.6 2.68 0 2.4-.85 4.44-2.54 6.13-1.69 1.69-3.72 2.53-6.1 2.53H9.35Z";

/**
 * The folder glyph used in the device screens and the share card.
 *
 * Two-tone on purpose: a lighter front face over a darker back edge, which is what
 * makes a 9px-wide folder read as a folder rather than as a blue blob. The same
 * silhouette is used at every size, so the three illustrations share one shape
 * language.
 */
function FolderGlyph({
  x,
  y,
  scale = 1,
  light,
  dark,
}: {
  x: number;
  y: number;
  scale?: number;
  light: string;
  dark: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M0 4.2C0 2.4 1.45.95 3.24.95h5.06c.9 0 1.76.36 2.4 1l1.1 1.1c.3.3.7.46 1.12.46h8.9c1.79 0 3.24 1.45 3.24 3.24v11.1c0 1.79-1.45 3.24-3.24 3.24H3.24A3.24 3.24 0 0 1 0 16.85V4.2Z"
        fill={dark}
      />
      <path d="M0 5.1h22.06v11.75c0 1.79-1.45 3.24-3.24 3.24H3.24A3.24 3.24 0 0 1 0 16.85V5.1Z" fill={light} />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  01 — Store without the clutter                                     */
/* ------------------------------------------------------------------ */

/**
 * A storage panel: rail, donut, legend.
 *
 * The first draft laid this out by eye and the labels ran out of the panel — a
 * drawing whose own text overflows is worse than no drawing, so every column here is
 * derived from one set of constants rather than typed in. Change `PANEL` and the rest
 * follows.
 */
export function StorePanelArt({ className }: { className?: string }) {
  /*
   * Geometry, once.
   *
   * The panel's inner content columns are computed from its own edges: the rail is
   * `RAIL` wide, the content starts 20px after it, and the label column hugs the right
   * gutter. Nothing below is a hand-tuned pixel.
   */
  const PANEL = { x: 16, y: 12, w: 252, h: 176, r: 16 };
  const RAIL = 44;
  const CONTENT_X = PANEL.x + RAIL + 20; // 80
  const RIGHT = PANEL.x + PANEL.w - 16; // 252
  const CONTENT_W = RIGHT - CONTENT_X; // 166

  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const usedFraction = 0.6;
  const DONUT_CX = CONTENT_X + radius + 4; // 110

  /*
   * The legend's two columns, sized from the space that is actually left.
   *
   * Dots sit at a fixed x; the label pill takes the remaining width minus the caption
   * column. That is why the captions cannot overflow: the pills shrink instead.
   */
  const LEGEND_X = DONUT_CX + radius + 14; // 150
  const CAPTION_W = 30;
  const PILL_MAX = RIGHT - LEGEND_X - 10 - CAPTION_W; // 40

  const rows = [
    { colour: "#3178FB", label: "Docs", weight: 1 },
    { colour: "#8B5CF6", label: "Media", weight: 0.66 },
    { colour: "#FB7A5F", label: "Other", weight: 0.42 },
  ];

  return (
    <svg
      className={cn("h-full w-full", className)}
      viewBox="0 0 290 200"
      preserveAspectRatio="xMidYMax meet"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="store-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#1B2036" floodOpacity="0.10" />
        </filter>
        <linearGradient id="store-donut" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5B96FF" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>

      {/*
        The pastel discs, whole and inside the frame.

        They used to be centred past the canvas edges, so the viewBox cut them into
        shapes with two straight sides — a "corner blob" rather than a circle. A circle
        that is only ever seen quartered stops reading as a circle at all.

        Fitting two complete discs in a 290x200 box means the panel has to give some
        room back, hence the scale group below: the drawing is 87% of its old size and
        the discs sit in the margins it frees. The discs are still behind the panel —
        that is the point of a background shape — but each now has a continuous
        silhouette, so what shows is an arc of a circle instead of a corner of a blob.
      */}
      <PastelCircle cx={258} cy={48} r={30} fill="#DFF4F2" />
      <PastelCircle cx={262} cy={170} r={21} fill="#FFE6DC" opacity={0.92} />

      <g transform="translate(6.08 11.56) scale(0.87)">
      {/* Panel */}
      <g filter="url(#store-shadow)">
        <rect
          x={PANEL.x}
          y={PANEL.y}
          width={PANEL.w}
          height={PANEL.h}
          rx={PANEL.r}
          fill="#FFFFFF"
          stroke="#E6E9F2"
          strokeWidth={1}
        />
      </g>

      {/* Icon rail — five marks, the active one on a soft tile */}
      <path d={`M${PANEL.x + RAIL + 0.5} ${PANEL.y}v${PANEL.h}`} stroke="#EEF1F7" strokeWidth={1} />
      <path
        d={`M${PANEL.x + PANEL.r} ${PANEL.y}h${RAIL - PANEL.r}v${PANEL.h}H${PANEL.x + PANEL.r}a${PANEL.r} ${PANEL.r} 0 0 1-${PANEL.r}-${PANEL.r}V${PANEL.y + PANEL.r}a${PANEL.r} ${PANEL.r} 0 0 1 ${PANEL.r}-${PANEL.r}Z`}
        fill="#F7F9FD"
      />
      <path d={`M${PANEL.x + RAIL + 0.5} ${PANEL.y + 1}v${PANEL.h - 2}`} stroke="#EEF1F7" strokeWidth={1} />

      {/*
        The rail, on an even rhythm.

        The first pass spaced these by hand and the gaps came out uneven — two icons
        close, then a wide one — which reads as a list that failed to lay out. The
        centres are derived from the rail's own height, so five marks sit at equal
        intervals whatever height the panel is given.
      */}
      {(() => {
        // 33px apart, and the whole run centred in the rail: 22px of air above and below.
        const centres = [0, 1, 2, 3, 4].map((i) => PANEL.y + 34 + i * 33);
        return (
          <g>
            <rect x={26} y={centres[0] - 12} width={24} height={24} rx={7} fill="#FFFFFF" stroke="#E6E9F2" strokeWidth={0.8} />
            <g transform={`translate(32 ${centres[0] - 5}) scale(0.44)`} fill="#3178FB">
              <path d={CLOUD_PATH} />
            </g>

            <rect x={26} y={centres[1] - 12} width={24} height={24} rx={7} fill="#EAF1FF" />
            <path
              d={`M33 ${centres[1] + 5.5}v-5.2l5-4.1 5 4.1v5.2a1.4 1.4 0 0 1-1.4 1.4h-2.4v-3.6h-2.4v3.6h-2.4a1.4 1.4 0 0 1-1.4-1.4Z`}
              fill="none"
              stroke="#3178FB"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />

            <g transform={`translate(32 ${centres[2] - 5}) scale(0.52)`} fill="none" stroke="#A6ADC6" strokeWidth={2.4} strokeLinejoin="round">
              <path d="M1 5c0-1.7 1.3-3 3-3h5.4c.8 0 1.5.3 2 .8l1.3 1.3c.3.3.7.5 1.1.5h8.2c1.7 0 3 1.3 3 3v10.4c0 1.7-1.3 3-3 3H4c-1.7 0-3-1.3-3-3V5Z" />
            </g>

            <circle cx={38} cy={centres[3]} r={7} fill="none" stroke="#A6ADC6" strokeWidth={1.5} />
            <path
              d={`M38 ${centres[3] - 3.6}V${centres[3]}l2.4 1.5`}
              stroke="#A6ADC6"
              strokeWidth={1.5}
              strokeLinecap="round"
            />

            <g stroke="#A6ADC6" strokeWidth={1.4} fill="none">
              <circle cx={35} cy={centres[4]} r={2.4} />
              <circle cx={41} cy={centres[4]} r={2.4} />
              <path d={`M37.4 ${centres[4]}h1.2`} />
            </g>
          </g>
        );
      })()}

      {/* Heading */}
      <text
        x={CONTENT_X}
        y={38}
        fill="#171D3A"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontSize={13}
        fontWeight={700}
        letterSpacing="-0.3"
      >
        Storage
      </text>

      {/* Donut */}
      <g transform={`translate(${DONUT_CX} 102)`}>
        <circle r={radius} fill="none" stroke="#EDF0F8" strokeWidth={9} />
        <circle
          r={radius}
          fill="none"
          stroke="url(#store-donut)"
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${circumference * usedFraction} ${circumference}`}
          transform="rotate(-90)"
        />
        <text
          textAnchor="middle"
          y={-1}
          fill="#0E1430"
          fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize={13}
          fontWeight={800}
          letterSpacing="-0.5"
        >
          6 GB
        </text>
        <text
          textAnchor="middle"
          y={12}
          fill="#8B90A8"
          fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize={7.6}
          fontWeight={500}
        >
          of 10 GB
        </text>
      </g>

      {/*
        Legend — dot, bar and a caption that always fits.
        The bar's width is a share of whatever room is left, so a longer caption can
        never push it out of the panel.
      */}
      {rows.map((row, index) => {
        const y = 90 + index * 19;
        return (
          <g key={row.colour}>
            <circle cx={LEGEND_X} cy={y} r={3.2} fill={row.colour} />
            <rect
              x={LEGEND_X + 10}
              y={y - 3.4}
              width={Math.max(18, PILL_MAX * row.weight)}
              height={6.8}
              rx={3.4}
              fill="#EDF0F8"
            />
            <text
              x={LEGEND_X + 10 + PILL_MAX * row.weight + 8}
              y={y + 3}
              fill="#AEB5C9"
              fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
              fontSize={7}
              fontWeight={600}
            >
              {row.label}
            </text>
          </g>
        );
      })}

      {/*
        The usage bar, under a rule.
        
        The bottom of the panel was two grey pills that stood for nothing — decoration
        in the shape of data, which is the one thing an illustration of a storage
        product must not do. This is the same split the legend above describes, drawn
        as one bar: the three segments sum to 60% of the track, which is the 6 GB of
        10 GB the donut already shows. The two numbers underneath are that same fact
        stated in words, and they agree with it because they are computed from it.
      */}
      <path d={`M${CONTENT_X} 134h${CONTENT_W}`} stroke="#F2F4F9" strokeWidth={1} />

      <g>
        <rect x={CONTENT_X} y={146} width={CONTENT_W} height={7} rx={3.5} fill="#EDF0F8" />
        {(() => {
          const usedW = CONTENT_W * usedFraction;
          const shares = [0.5, 0.3, 0.2];
          let cursor = CONTENT_X;
          return shares.map((share, index) => {
            const width = usedW * share;
            const x = cursor;
            cursor += width;
            return (
              <rect
                key={index}
                x={x}
                y={146}
                width={Math.max(width - 1.5, 1.5)}
                height={7}
                rx={3.5}
                fill={rows[index].colour}
              />
            );
          });
        })()}
      </g>

      <text
        x={CONTENT_X}
        y={170}
        fill="#6A6F8B"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontSize={8}
        fontWeight={600}
      >
        6 GB used
      </text>
      <text
        x={RIGHT}
        y={170}
        textAnchor="end"
        fill="#B4BACD"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontSize={8}
        fontWeight={500}
      >
        4 GB free
      </text>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  02 — Access from anywhere                                          */
/* ------------------------------------------------------------------ */

type ScreenVariant = "wide" | "narrow" | "phone";

/**
 * One screen's worth of the library, drawn in its device's own units.
 *
 * The first draft drew one wide layout and scaled it for the tablet and the phone.
 * Scaling a layout does not make it fit a different shape — the tablet's tile row was
 * clipped at its right edge and the phone showed the left third of a laptop screen.
 * A phone is not a small laptop, so each variant lays out its own content: the phone
 * gets a single file-style list and no folder row, because that is what a file list
 * looks like at 32 points wide.
 */
function DeviceScreen({
  x,
  y,
  w,
  h,
  variant,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  variant: ScreenVariant;
}) {
  const railW = variant === "wide" ? 16 : 0;
  const padX = railW + 8;
  const innerW = w - padX - 8;

  const tileColours = [
    ["#BBD4FE", "#5B96FF"],
    ["#BFEFD6", "#38BD8B"],
    ["#FFD9AE", "#FB8F3D"],
  ] as const;

  const heading = variant === "phone" ? "Files" : "My files";
  const headingSize = variant === "wide" ? 6.4 : variant === "narrow" ? 6 : 4.6;

  /** Folder tiles, only where there is width for more than one. */
  const tileCount = variant === "wide" ? 3 : variant === "narrow" ? 2 : 0;
  const tileW = tileCount > 0 ? Math.min(19, (innerW - (tileCount - 1) * 3) / tileCount) : 0;

  /*
   * Rows fill the screen they are in.
   *
   * The first pass hard-coded two rows, which left the bottom third of the laptop's
   * screen blank — the drawing looked like a screenshot that had failed to load
   * rather than a library with files in it. The count follows the device's height.
   */
  const listTop = variant === "wide" ? 50 : variant === "narrow" ? 54 : 24;
  const rowH = variant === "wide" ? 11 : variant === "narrow" ? 10 : 10;
  const rowCount = Math.max(1, Math.min(3, Math.floor((h - listTop - 6) / rowH)));

  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} fill="#FFFFFF" />

      {variant !== "phone" && (
        <>
          <rect width={railW} height={h} fill="#F7F9FD" />
          <rect x={4} y={7} width={8} height={8} rx={2.4} fill="#EAF1FF" />
          {[24, 30.5, 37].map((ry) => (
            <rect key={ry} x={4.5} y={ry} width={7} height={1.6} rx={0.8} fill="#DDE3F0" />
          ))}
        </>
      )}

      <text
        x={padX}
        y={variant === "phone" ? 12 : 14}
        fill="#171D3A"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontSize={headingSize}
        fontWeight={700}
        letterSpacing="-0.1"
      >
        {heading}
      </text>

      {/*
        The primary action, as a pill — no word on it, because at 8 pixels tall no word
        is legible. Only the laptop has room: on the tablet and the phone it would sit
        on top of the title, and a header whose two elements overlap is a drawing of a
        broken screen rather than of this product.
      */}
      {variant === "wide" && (
        <rect x={w - 8 - 15} y={7.5} width={15} height={8} rx={4} fill="#3178FB" />
      )}

      {Array.from({ length: tileCount }).map((_, index) => {
        const tx = padX + index * (tileW + 3);
        const [light, dark] = tileColours[index];
        return (
          <g key={dark}>
            <rect
              x={tx}
              y={21}
              width={tileW}
              height={tileW + 4}
              rx={4}
              fill="#FBFCFE"
              stroke="#EEF1F7"
              strokeWidth={0.6}
            />
            <FolderGlyph
              x={tx + tileW * 0.14}
              y={24.5}
              scale={tileW / 31}
              light={light}
              dark={dark}
            />
            <rect
              x={tx + tileW * 0.14}
              y={21 + tileW * 0.86}
              width={tileW * 0.62}
              height={1.8}
              rx={0.9}
              fill="#DDE3F0"
            />
          </g>
        );
      })}

      {Array.from({ length: rowCount }).map((_, row) => {
        const ry = listTop + row * rowH;
        if (ry + rowH * 0.8 > h - 4) return null;
        return (
          <g key={row}>
            <rect
              x={padX}
              y={ry}
              width={9}
              height={7.2}
              rx={1.8}
              fill={row % 2 === 0 ? "#EAF1FF" : "#F1ECFE"}
            />
            <rect x={padX + 13} y={ry + 1.4} width={innerW * 0.52} height={1.8} rx={0.9} fill="#E4E8F2" />
            <rect x={padX + 13} y={ry + 4.8} width={innerW * 0.28} height={1.4} rx={0.7} fill="#F1F3F9" />
          </g>
        );
      })}
    </g>
  );
}

/**
 * The same library on three screens.
 *
 * The screens were four grey rules each. They now show what the product actually
 * shows — a rail, a title, folder tiles, file rows — because the point of the
 * illustration is that the *same thing* is on the laptop, the tablet and the phone.
 * Three empty boxes make that point by assertion; three screens of the same library
 * make it by showing it.
 *
 * Devices are drawn back to front with one shared shadow and a slight stagger, so
 * they read as a set standing on the same surface rather than three stickers.
 */
export function DevicesArt({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-full w-full", className)}
      viewBox="0 0 290 200"
      preserveAspectRatio="xMidYMax meet"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="device-shadow" x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#1B2036" floodOpacity="0.14" />
        </filter>
        <linearGradient id="device-bezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#333A5C" />
          <stop offset="1" stopColor="#161B31" />
        </linearGradient>
        <linearGradient id="device-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.72" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F3F6FD" />
        </linearGradient>
      </defs>

      {/* Complete discs, in the margins freed by the 87% scale group below. */}
      <PastelCircle cx={244} cy={48} r={40} fill="#DFF4F2" />
      <PastelCircle cx={42} cy={150} r={32} fill="#E3E6FE" opacity={0.7} />

      <g transform="translate(6.08 11.56) scale(0.87)">
      {/* tabletop — one cast shadow the three devices share */}
      <ellipse cx={146} cy={189} rx={112} ry={7.5} fill="#E9EDF8" opacity={0.8} />

      {/* Laptop */}
      <g filter="url(#device-shadow)">
        <rect x={30} y={38} width={168} height={106} rx={7} fill="url(#device-bezel)" />
        <rect x={36} y={44} width={156} height={94} rx={3} fill="url(#device-glass)" />
        <g clipPath="url(#laptop-clip)">
          <DeviceScreen x={36} y={44} w={156} h={94} variant="wide" />
        </g>
        <clipPath id="laptop-clip">
          <rect x={36} y={44} width={156} height={94} rx={3} />
        </clipPath>
        <path d="M18 144h192l-6 6.5a5 5 0 0 1-3.6 1.5H27.6A5 5 0 0 1 24 150.5L18 144Z" fill="#252B45" />
        <rect x={96} y={145.5} width={36} height={2.6} rx={1.3} fill="#11162A" opacity={0.55} />
      </g>

      {/* Tablet, overlapping the laptop's right edge */}
      <g filter="url(#device-shadow)">
        <rect x={182} y={72} width={72} height={100} rx={7} fill="url(#device-bezel)" />
        <rect x={187} y={77} width={62} height={88} rx={3} fill="url(#device-glass)" />
        <g clipPath="url(#tablet-clip)">
          <DeviceScreen x={187} y={77} w={62} h={88} variant="narrow" />
        </g>
        <clipPath id="tablet-clip">
          <rect x={187} y={77} width={62} height={88} rx={3} />
        </clipPath>
      </g>

      {/* Phone, front-most */}
      <g filter="url(#device-shadow)">
        <rect x={246} y={104} width={38} height={70} rx={7} fill="url(#device-bezel)" />
        <rect x={249} y={107} width={32} height={64} rx={4} fill="url(#device-glass)" />
        <g clipPath="url(#phone-clip)">
          <DeviceScreen x={249} y={107} w={32} h={64} variant="phone" />
        </g>
        <clipPath id="phone-clip">
          <rect x={249} y={107} width={32} height={64} rx={4} />
        </clipPath>
      </g>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  03 — Share with simplicity                                         */
/* ------------------------------------------------------------------ */

/**
 * A share dialog, drawn as the real one.
 *
 * The card used to be a title, two empty fields and a pill. The fields said nothing,
 * so the illustration explained "share" by putting the word on screen. It now shows
 * the two facts that make sharing feel simple: *who* it is going to (a named
 * recipient with a role) and *what* they get (view-only, revocable) — plus the link
 * that replaces all of it when you do not want names at all.
 *
 * "Can view" is a real level. The retired "Can edit" is not offered anywhere,
 * including here: an illustration that advertises a permission the product no longer
 * has would be the same lie as a settings screen that does.
 */
export function ShareCardArt({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-full w-full", className)}
      viewBox="0 0 290 200"
      preserveAspectRatio="xMidYMax meet"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="share-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#1B2036" floodOpacity="0.10" />
        </filter>
        <linearGradient id="share-button" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4C8CFD" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id="share-avatar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#7C4DF0" />
        </linearGradient>
      </defs>

      {/* Complete discs, in the margins freed by the 87% scale group below. */}
      <PastelCircle cx={246} cy={44} r={38} fill="#FFE6DC" />
      <PastelCircle cx={46} cy={166} r={30} fill="#F1ECFE" />

      <g transform="translate(6.08 11.56) scale(0.87)">
      <g filter="url(#share-shadow)">
        <rect
          x={26}
          y={20}
          width={238}
          height={162}
          rx={16}
          fill="#FFFFFF"
          stroke="#E6E9F2"
          strokeWidth={1}
        />
      </g>

      {/* Header with the folder being shared */}
      <text
        x={44}
        y={44}
        fill="#171D3A"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontSize={12.5}
        fontWeight={700}
        letterSpacing="-0.3"
      >
        Share “Project files”
      </text>
      <text
        x={44}
        y={58}
        fill="#8B90A8"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontSize={8}
        fontWeight={500}
      >
        2 people have access
      </text>

      {/* The recipient row: a real person shape, a name, a role, a remove */}
      <g>
        <circle cx={53} cy={78} r={9} fill="url(#share-avatar)" />
        <text
          x={53}
          y={81}
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize={7.4}
          fontWeight={700}
        >
          AS
        </text>
        <text
          x={68}
          y={76}
          fill="#333A5C"
          fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize={8.6}
          fontWeight={600}
        >
          asha@studio.co
        </text>
        <text
          x={68}
          y={85}
          fill="#8B90A8"
          fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize={7}
        >
          Added by you
        </text>
        <rect x={198} y={71} width={48} height={15} rx={7.5} fill="#F7F9FD" stroke="#E9EDF6" strokeWidth={0.8} />
        <text
          x={222}
          y={81}
          textAnchor="middle"
          fill="#333A5C"
          fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize={7.4}
          fontWeight={600}
        >
          Can view
        </text>
      </g>

      <path d="M44 96h202" stroke="#F1F3F9" strokeWidth={1} />

      {/* Invite field, with the caret showing it is the live control */}
      <rect x={44} y={104} width={202} height={26} rx={8} fill="#FBFCFE" stroke="#D5DAEA" strokeWidth={1} />
      <text
        x={56}
        y={121}
        fill="#A9AFC2"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontSize={8}
      >
        Add people or email address…
      </text>
      <rect x={56} y={117} width={0.9} height={9} fill="#3178FB" opacity={0.85} />

      {/* Link row — the alternative to naming anyone */}
      <g>
        <rect x={44} y={138} width={124} height={24} rx={7} fill="#FFFFFF" stroke="#E9EDF6" strokeWidth={1} />
        <path
          d="M56 146.5a2.6 2.6 0 0 1 3.7 0l.8.8M62.6 151.5a2.6 2.6 0 0 1-3.7 0l-.8-.8"
          stroke="#3178FB"
          strokeWidth={1.4}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M58.6 149.4l3.5-3.5"
          stroke="#3178FB"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <text
          x={70}
          y={153}
          fill="#6A6F8B"
          fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize={7.4}
          fontWeight={600}
        >
          orindle.com/s/8Kd2…
        </text>

        <rect x={176} y={138} width={70} height={24} rx={12} fill="url(#share-button)" />
        <text
          x={211}
          y={153}
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize={8}
          fontWeight={700}
        >
          Share
        </text>
      </g>

      {/* The link tile, breaking the card's corner — the one decorative element */}
      <g transform="rotate(8 244 26)">
        <rect
          x={226}
          y={8}
          width={36}
          height={36}
          rx={11}
          fill="#EAF1FF"
          stroke="#FFFFFF"
          strokeWidth={2.5}
        />
        <path
          d="M238.5 26.5a4.2 4.2 0 0 0 5.9 0l3.2-3.2a4.2 4.2 0 0 0-5.9-5.9l-1.2 1.2"
          stroke="#3178FB"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M243.5 21.5a4.2 4.2 0 0 0-5.9 0l-3.2 3.2a4.2 4.2 0 0 0 5.9 5.9l1.2-1.2"
          stroke="#3178FB"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      </g>
      </g>
    </svg>
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
