"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { OAUTH_PROVIDER_LABEL, type OAuthProvider } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

/**
 * Social sign-in button.
 *
 * Only rendered for providers the deployment has actually enabled — a button
 * that always errors is worse than no button. See `NEXT_PUBLIC_AUTH_PROVIDERS`.
 *
 * The Google mark is drawn as four explicit paths rather than a single-colour
 * icon, because Google's brand guidelines require the four-colour mark on a
 * white button with a specific mark-to-text ratio.
 */
export function SocialSignIn({
  providers,
  next,
  className,
}: {
  providers: ReadonlyArray<OAuthProvider>;
  next?: string;
  className?: string;
}) {
  if (providers.length === 0) return null;

  return (
    <div className={cn("space-y-2.5", className)}>
      {providers.map((provider) => (
        <ProviderButton key={provider} provider={provider} next={next} />
      ))}
    </div>
  );
}

function ProviderButton({ provider, next }: { provider: OAuthProvider; next?: string }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onClick = async () => {
    setPending(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (next) query.set("next", next);
      const response = await fetch(`/api/auth/oauth/${provider}/start?${query.toString()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const payload = (await response.json()) as { ok?: boolean; url?: string; message?: string };

      if (!response.ok || !payload.ok || !payload.url) {
        setError(payload.message ?? "That sign-in method isn't available right now.");
        setPending(false);
        return;
      }

      // Full navigation to the provider's consent screen. Keeping `pending` set
      // through the redirect means the button stays quiet while the browser
      // leaves the page.
      window.location.assign(payload.url);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setPending(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-busy={pending || undefined}
        className={cn(
          "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--brand-border-strong)] bg-white",
          "text-[13.5px] font-semibold text-ink shadow-[var(--brand-shadow-xs)]",
          "transition-[background-color,border-color,transform] duration-150 ease-[var(--brand-ease-out)]",
          "hover:border-[#c3cade] hover:bg-[var(--brand-surface-muted)] active:translate-y-px",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} aria-hidden="true" />
        ) : (
          provider === "google" && <GoogleMark />
        )}
        <span>{pending ? `Opening ${OAUTH_PROVIDER_LABEL[provider]}…` : `Continue with ${OAUTH_PROVIDER_LABEL[provider]}`}</span>
      </button>
      {error && (
        <p role="alert" className="mt-1.5 text-[11.5px] font-medium text-[#C93B2B]">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-[17px] w-[17px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
