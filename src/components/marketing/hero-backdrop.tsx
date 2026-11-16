/**
 * Hero atmosphere.
 *
 * Reproduces the reference's layered pastel washes. Sampled from the reference:
 *   lavender #F4F3FE at the top-left, deepening to #F2F0FD near the mockup
 *   mint     #CDF3F5 at the top-right corner
 *   peach    #FFE0D6 washing the right edge
 *   a cool blue floor (#E8EEFE) under the product panel
 *
 * Everything is a radial/linear gradient: no imagery, no blur filters, no
 * paint cost. Decorative only.
 */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px] overflow-hidden"
    >
      {/* lavender bloom, top-left — the dominant wash in the reference */}
      <div className="absolute -left-[22%] -top-[34%] h-[900px] w-[92%] max-w-[900px] rounded-full bg-[radial-gradient(closest-side,rgba(198,182,251,0.52),rgba(224,214,252,0.36)_48%,rgba(255,255,255,0)_76%)]" />

      {/* periwinkle lobe reaching toward the product panel */}
      <div className="absolute left-[6%] top-[-6%] h-[620px] w-[52%] rounded-full bg-[radial-gradient(closest-side,rgba(214,215,253,0.55),rgba(233,234,254,0.26)_56%,rgba(255,255,255,0)_80%)]" />

      {/* mint-cyan bloom, top-right (strong in the reference) */}
      <div className="absolute -right-[14%] -top-[26%] h-[720px] w-[64%] rounded-full bg-[radial-gradient(closest-side,rgba(158,231,234,0.85),rgba(196,240,242,0.5)_46%,rgba(255,255,255,0)_76%)]" />

      {/* peach-blush edge wash, right */}
      <div className="absolute -right-[14%] top-[4%] h-[600px] w-[42%] rounded-full bg-[radial-gradient(closest-side,rgba(255,186,164,0.62),rgba(255,220,208,0.34)_50%,rgba(255,255,255,0)_76%)]" />

      {/* violet flick behind the panel's lower-left, matching the reference seam */}
      <div className="absolute left-[34%] top-[46%] h-[300px] w-[26%] rounded-full bg-[radial-gradient(closest-side,rgba(190,190,252,0.42),rgba(255,255,255,0)_76%)]" />

      {/* mint pad under the panel's lower-left, as in the reference */}
      <div className="absolute left-[42%] top-[52%] h-[220px] w-[26%] rounded-full bg-[radial-gradient(closest-side,rgba(190,240,238,0.55),rgba(255,255,255,0)_74%)]" />

      {/* cool floor under the product panel */}
      <div className="absolute inset-x-0 top-[300px] h-[430px] bg-[linear-gradient(to_bottom,rgba(228,235,254,0.9),rgba(236,241,255,0.5)_46%,rgba(255,255,255,0)_100%)]" />

      {/* low-contrast arc behind the wordmark */}
      <div className="absolute -left-[30%] top-[12px] h-[560px] w-[560px] rounded-full border border-[rgba(49,120,251,0.06)]" />
    </div>
  );
}
