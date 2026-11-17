"use client";

import { useEffect } from "react";

/**
 * Root error boundary.
 *
 * `app/error.tsx` does not cover a failure in the root layout itself — when that
 * throws, Next has no layout in which to render the route boundary, so it looks
 * for this file instead. Without it the document is replaced with a bare stack
 * trace, and in a production build with an empty body: the black screen again.
 *
 * This must render its own `<html>` and `<body>` and cannot rely on the app's
 * stylesheet having loaded, so the styling below is deliberately self-contained.
 * It is the last-resort screen, not a design surface.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[render] global error boundary", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbfcff",
          color: "#171d3a",
          fontFamily:
            '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: "440px",
            width: "100%",
            textAlign: "center",
            background: "#ffffff",
            border: "1px solid #e6e9f2",
            borderRadius: "14px",
            padding: "28px",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Orindle couldn&apos;t load
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: "13.5px", lineHeight: 1.65, color: "#6a6f8b" }}>
            Something failed before the page could render. Reloading is safe — nothing in your
            account was changed.
          </p>
          {error.digest && (
            <p style={{ margin: "12px 0 0", fontSize: "11px", color: "#8b90a8" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "20px",
              height: "40px",
              padding: "0 18px",
              borderRadius: "10px",
              border: "none",
              background: "#3178fb",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Try again
          </button>
          <p style={{ margin: "18px 0 0", fontSize: "11.5px", lineHeight: 1.6, color: "#8b90a8" }}>
            Still stuck? Email{" "}
            <a href="mailto:tejassutar.business@gmail.com" style={{ color: "#3178fb" }}>
              tejassutar.business@gmail.com
            </a>
            .
          </p>
        </div>
      </body>
    </html>
  );
}
