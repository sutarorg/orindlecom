"use client";

import * as React from "react";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cloudflare Turnstile widget.
 *
 * Rendered only when a site key is configured — a challenge that cannot verify
 * is worse than none, because it produces a token the server then rejects.
 *
 * The widget is explicit-render rather than the auto-rendering script tag, for
 * two reasons: React owns the DOM here and an implicitly-rendering widget fights
 * StrictMode's double-mount, and explicit rendering gives us the callback that
 * puts the token into a hidden input the server action can read.
 *
 * Accessibility: the widget is a third-party iframe, so we do not control its
 * internals. What we do control is the status text around it, which is in a live
 * region — a screen-reader user hears "verification complete" rather than
 * discovering that the submit button is now enabled.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "flexible";
    },
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function isTurnstileEnabled(): boolean {
  return Boolean(SITE_KEY);
}

export type TurnstileStatus = "idle" | "loading" | "ready" | "verifying" | "verified" | "error" | "expired";

export function TurnstileWidget({
  onToken,
  className,
  /** Bumped by the parent after a failed submit to force a fresh challenge. */
  resetKey = 0,
}: {
  onToken: (token: string | null) => void;
  className?: string;
  resetKey?: number;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const widgetId = React.useRef<string | null>(null);
  const [status, setStatus] = React.useState<TurnstileStatus>("loading");

  // Keep the latest callback without re-rendering the widget when it changes.
  const onTokenRef = React.useRef(onToken);
  React.useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  React.useEffect(() => {
    if (!SITE_KEY) return;

    let cancelled = false;

    const mount = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      // Explicit render into a fresh container each time, so a re-mount cannot
      // leave two widgets stacked on top of each other.
      containerRef.current.innerHTML = "";
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme: "light",
        size: "flexible",
        callback: (token) => {
          setStatus("verified");
          onTokenRef.current(token);
        },
        "error-callback": () => {
          setStatus("error");
          // A failed challenge is not a token. Clearing it prevents a stale
          // value from being submitted after the widget reports failure.
          onTokenRef.current(null);
        },
        "expired-callback": () => {
          setStatus("expired");
          onTokenRef.current(null);
        },
      });
      setStatus("ready");
    };

    if (window.turnstile) {
      mount();
    } else {
      const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      const script = existing ?? document.createElement("script");
      if (!existing) {
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.turnstile = "true";
        document.head.appendChild(script);
      }
      script.addEventListener("load", mount, { once: true });
      // If the script is already loaded but the API is not yet visible, retry
      // once on the next tick rather than waiting for an event that fired before
      // this component existed.
      const timer = window.setTimeout(mount, 1500);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        script.removeEventListener("load", mount);
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  // Reset when the parent asks for a fresh challenge.
  React.useEffect(() => {
    if (!resetKey || !window.turnstile || !widgetId.current) return;
    window.turnstile.reset(widgetId.current);
    setStatus("ready");
    onTokenRef.current(null);
  }, [resetKey]);

  if (!SITE_KEY) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div ref={containerRef} className="min-h-[65px]" />
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-medium",
          status === "verified" ? "text-[#1B7F4B]" : status === "error" ? "text-[#C93B2B]" : "text-text-subtle",
        )}
      >
        {status === "verified" && (
          <>
            <ShieldCheck className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
            Verification complete.
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
            Verification failed. Reload the page to try again.
          </>
        )}
        {status === "expired" && "That check expired — complete it again."}
        {status === "loading" && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.4} aria-hidden="true" />
            Loading verification…
          </>
        )}
        {(status === "ready" || status === "verifying") && "One quick check that you're a person."}
      </p>
    </div>
  );
}
