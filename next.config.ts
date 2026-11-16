import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * These were absent entirely until now — the security checklist recorded that gap
 * rather than pretending otherwise, and this closes it.
 *
 * The CSP is the interesting one. It has to allow:
 *   - Supabase's auth endpoints (connect-src), because sign-in is a fetch.
 *   - Cloudflare R2, because uploads go browser→R2 directly and downloads are
 *     presigned URLs on the bucket host.
 *   - `'unsafe-inline'` for styles, because Tailwind/Next inject inline style
 *     attributes that a nonce cannot cover without rewriting the design system.
 *   - No `'unsafe-eval'`: nothing in the app uses it.
 *
 * `frame-ancestors 'none'` and `X-Frame-Options: DENY` are both set. The header is
 * redundant in modern browsers but is what older ones honour, and a storage
 * product being framed is a clickjacking surface worth closing twice.
 */

const supabaseHost = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
})();

const r2Host = (() => {
  const account = process.env.R2_ACCOUNT_ID?.trim();
  return account ? `https://${account}.r2.cloudflarestorage.com` : "";
})();

const r2PublicHost = (() => {
  const raw = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
})();

const connectSrc = [
  "'self'",
  supabaseHost,
  supabaseHost ? supabaseHost.replace("https://", "wss://") : "",
  r2Host,
  r2PublicHost,
  "https://api.razorpay.com",
  "https://checkout.razorpay.com",
]
  .filter(Boolean)
  .join(" ");

const csp = [
  "default-src 'self'",
  // Next's runtime and Razorpay's checkout script.
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
  // Tailwind and Next emit inline style attributes; a nonce cannot cover them.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: " + [r2PublicHost, r2Host].filter(Boolean).join(" "),
  "font-src 'self' data:",
  // Uploads go straight to R2; auth and payments are fetches.
  `connect-src ${connectSrc}`,
  // Razorpay's checkout runs in a frame.
  "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]
  .join("; ")
  .replace(/\s+/g, " ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Keeps server actions within a predictable payload size for the contact form.
    serverActions: { bodySizeLimit: "256kb" },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Redundant with frame-ancestors for modern browsers, but honoured by
          // older ones and cheap.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops a browser from guessing that a .txt is really a script. Matters
          // most on the paths that serve user-supplied content.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here needs a camera, microphone or location.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // API responses are never rendered, so the page CSP does not apply; these
        // two still do.
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
