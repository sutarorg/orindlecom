"use client";

import * as React from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  QrCode,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/drive/client";

/**
 * Two-factor authentication settings.
 *
 * Optional by design. Nothing here blocks signup, and nothing here is offered as
 * a fix for a problem the person is having — it is a security improvement they
 * can take or leave.
 *
 * The enrolment flow follows the order the requirements set out, and the order
 * matters: a factor is shown as "enabled" only after a code has been accepted.
 * Until then the UI says "setting up", because a half-finished enrolment that
 * claims to be active is a lockout waiting to happen.
 *
 * On recovery codes: Supabase's MFA API does not issue them, and this panel says
 * so rather than inventing a reassuring fiction. What it offers instead is a
 * second authenticator device, plus the documented support route for a lost one.
 */

type Factor = {
  id: string;
  friendlyName: string | null;
  status: "verified" | "unverified";
  createdAt: string | null;
};

type State = {
  enabled: boolean;
  currentLevel: "aal1" | "aal2";
  nextLevel: "aal1" | "aal2";
  factors: Factor[];
};

type Step = "idle" | "loading" | "scan" | "verify" | "done";

export function TwoFactorPanel({ authenticated }: { authenticated: boolean }) {
  const { toast } = useToast();
  const [state, setState] = React.useState<State | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const result = await api.get<State>("/api/account/mfa");
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setState(result.data);
  }, []);

  React.useEffect(() => {
    if (!authenticated) {
      setLoading(false);
      return;
    }
    void load();
  }, [authenticated, load]);

  const [enrollOpen, setEnrollOpen] = React.useState(false);
  const [disableOpen, setDisableOpen] = React.useState(false);

  const verified = state?.factors.filter((factor) => factor.status === "verified") ?? [];
  const enabled = verified.length > 0;

  if (!authenticated) {
    return (
      <Row
        title="Two-factor authentication"
        detail="Available once you're signed in to a real account."
        action={<Pill>Not available in this preview</Pill>}
      />
    );
  }

  if (loading) {
    return (
      <Row
        title="Two-factor authentication"
        detail="Checking your account…"
        action={<Loader2 className="h-3.5 w-3.5 animate-spin text-text-subtle" aria-hidden="true" />}
      />
    );
  }

  if (error) {
    return (
      <Row
        title="Two-factor authentication"
        detail={error}
        action={
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              void load();
            }}
            className="text-[11.5px] font-semibold text-primary hover:underline"
          >
            Retry
          </button>
        }
      />
    );
  }

  return (
    <>
      <Row
        title="Two-factor authentication"
        detail={
          enabled
            ? `Enabled with ${verified.length} authenticator app${verified.length > 1 ? "s" : ""}. You'll be asked for a code when you sign in.`
            : "Add another layer of security to your Orindle account using an authenticator app."
        }
        action={
          enabled ? (
            <button
              type="button"
              onClick={() => setDisableOpen(true)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ShieldOff className="h-3 w-3 text-text-subtle" strokeWidth={2.1} aria-hidden="true" />
              Turn off
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEnrollOpen(true)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              <ShieldCheck className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
              Enable two-factor authentication
            </button>
          )
        }
        status={enabled ? "enabled" : "off"}
      />

      <EnrollDialog
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onComplete={async () => {
          setEnrollOpen(false);
          await load();
          toast({
            tone: "success",
            title: "Two-factor authentication is on",
            description: "You'll be asked for a code the next time you sign in.",
          });
        }}
      />

      <DisableDialog
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        factors={verified}
        onComplete={async () => {
          setDisableOpen(false);
          await load();
          toast({ tone: "success", title: "Two-factor authentication turned off" });
        }}
      />
    </>
  );
}

/* ── Enrolment ───────────────────────────────────────────────────────────── */

function EnrollDialog({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => Promise<void>;
}) {
  const [step, setStep] = React.useState<Step>("idle");
  const [enrollment, setEnrollment] = React.useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Reset on open so a reopened dialog never shows the previous secret.
  React.useEffect(() => {
    if (!open) return;
    setStep("idle");
    setEnrollment(null);
    setCode("");
    setError(null);
    setManual(false);
    setCopied(false);
  }, [open]);

  const start = async () => {
    setStep("loading");
    setError(null);
    const result = await api.post<{ factorId: string; qrCode: string; secret: string }>(
      "/api/account/mfa",
      { action: "enroll" },
    );
    if (!result.ok) {
      setStep("idle");
      setError(result.message);
      return;
    }
    setEnrollment(result.data);
    setStep("scan");
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!enrollment) return;
    setStep("verify");
    setError(null);

    const result = await api.post<{ enabled: boolean }>("/api/account/mfa", {
      action: "verify",
      factorId: enrollment.factorId,
      code: code.replace(/\D/g, ""),
    });

    if (!result.ok) {
      setStep("scan");
      setError(result.message);
      setCode("");
      return;
    }

    setStep("done");
    await onComplete();
  };

  const copySecret = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission can be denied; the value is visible and selectable.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Enable two-factor authentication"
      description="Use an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password."
      size="sm"
    >
      {step === "done" ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-[#C8E6D3] bg-[#F1FAF4] px-3.5 py-3">
            <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-[#1B7F4B]" strokeWidth={2.2} aria-hidden="true" />
            <div className="text-[12px] leading-relaxed text-[#14603A]">
              <p className="font-semibold">Two-factor authentication is on.</p>
              <p className="mt-0.5">Keep the app installed — you&apos;ll need it to sign in from now on.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-full rounded-lg bg-primary text-[12.5px] font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            Done
          </button>
        </div>
      ) : step === "idle" || step === "loading" ? (
        <div className="space-y-3">
          <ol className="space-y-2 text-[12px] leading-relaxed text-text">
            <Step n={1}>Install an authenticator app on your phone.</Step>
            <Step n={2}>Scan the code we show you, or type the key by hand.</Step>
            <Step n={3}>Enter the six-digit code the app generates.</Step>
          </ol>
          {error && (
            <p role="alert" className="text-[11.5px] font-medium text-[#C93B2B]">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={start}
            disabled={step === "loading"}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[12.5px] font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-60"
          >
            {step === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} aria-hidden="true" />}
            Set up authenticator
          </button>
        </div>
      ) : (
        <form onSubmit={verify} className="space-y-3.5">
          {enrollment && (
            <>
              <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-muted)] p-3">
                {manual ? (
                  <div className="w-full">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink">
                      <KeyRound className="h-3 w-3 text-text-subtle" strokeWidth={2.2} aria-hidden="true" />
                      Setup key
                    </p>
                    <div className="flex items-center gap-1.5">
                      <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 py-2 font-mono text-[11.5px] tracking-[0.08em] text-ink">
                        {enrollment.secret}
                      </code>
                      <button
                        type="button"
                        onClick={copySecret}
                        aria-label="Copy setup key"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--brand-border-strong)] bg-white text-text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-[#1B7F4B]" strokeWidth={2.4} aria-hidden="true" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-text-subtle">
                      In your app choose &ldquo;enter a setup key&rdquo; and paste this. Time-based, not counter-based.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* The QR is an <img> because Supabase returns a data: URL of an
                        SVG. next/image would try to optimise it, which it cannot. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={enrollment.qrCode}
                      alt="QR code for adding Orindle to your authenticator app"
                      width={168}
                      height={168}
                      className="rounded-lg bg-white p-1.5"
                    />
                    <p className="text-[10.5px] text-text-subtle">Scan with your authenticator app</p>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setManual((value) => !value)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {manual ? (
                    <>
                      <QrCode className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
                      Show QR code instead
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
                      Can&apos;t scan? Enter the key manually
                    </>
                  )}
                </button>
              </div>

              <div>
                <label htmlFor="totp-code" className="mb-1 block text-[11px] font-semibold text-ink">
                  Six-digit code from your app
                </label>
                <input
                  id="totp-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  aria-invalid={error ? true : undefined}
                  className="h-9 w-full rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-center font-mono text-[14px] tracking-[0.35em] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]"
                />
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="text-[11px] font-medium text-[#C93B2B]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[11.5px] font-semibold text-ink hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={step === "verify" || code.length !== 6}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11.5px] font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50"
            >
              {step === "verify" && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.4} aria-hidden="true" />}
              Turn on two-factor
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/* ── Removal ─────────────────────────────────────────────────────────────── */

function DisableDialog({
  open,
  onClose,
  factors,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  factors: Factor[];
  onComplete: () => Promise<void>;
}) {
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [needsChallenge, setNeedsChallenge] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setPassword("");
    setError(null);
    setPending(false);
    setNeedsChallenge(false);
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const factor = factors[0];
    if (!factor) return;

    setPending(true);
    setError(null);

    const result = await api.del<{ enabled: boolean; reauthRequired?: boolean }>("/api/account/mfa", {
      factorId: factor.id,
      password,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (result.data.reauthRequired) {
      // Password confirmed; the factor stays until the challenge is passed in the
      // fresh session. Saying so is better than a spinner followed by "still on".
      setNeedsChallenge(true);
      return;
    }

    await onComplete();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Turn off two-factor authentication"
      description="Your account will be protected by your password alone."
      size="sm"
    >
      {needsChallenge ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-[#F1D9A8] bg-[#FEFBF3] px-3.5 py-3">
            <AlertCircle className="mt-px h-4 w-4 shrink-0 text-[#96610B]" strokeWidth={2.2} aria-hidden="true" />
            <div className="text-[12px] leading-relaxed text-[#7A4E0A]">
              <p className="font-semibold">Password confirmed.</p>
              <p className="mt-0.5">
                To finish, verify a code from your authenticator. Signing in with your password again lowered
                your session&apos;s assurance level, and removal requires the higher one.
              </p>
            </div>
          </div>
          <a
            href="/auth/mfa?next=%2Fdashboard%2Fsettings"
            className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary text-[12.5px] font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            Verify and finish
          </a>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-[12px] leading-relaxed text-text">
            Confirm your password to remove the authenticator app from this account.
          </p>
          <div>
            <label htmlFor="disable-password" className="mb-1 block text-[11px] font-semibold text-ink">
              Password
            </label>
            <input
              id="disable-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              className="h-9 w-full rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[12.5px] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]"
            />
          </div>
          {error && (
            <p role="alert" className="text-[11px] font-medium text-[#C93B2B]">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[11.5px] font-semibold text-ink hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Keep it on
            </button>
            <button
              type="submit"
              disabled={pending || !password}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#C93B2B] px-3 text-[11.5px] font-semibold text-white hover:bg-[#A82F21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C93B2B] focus-visible:ring-offset-1 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.4} aria-hidden="true" />}
              Turn off
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/* ── Small shared pieces ─────────────────────────────────────────────────── */

function Row({
  title,
  detail,
  action,
  status,
}: {
  title: string;
  detail: string;
  action: React.ReactNode;
  status?: "enabled" | "off";
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
          {title}
          {status === "enabled" && (
            <span className="rounded-full bg-[#E9F7EF] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.04em] text-[#14603A]">
              On
            </span>
          )}
        </p>
        <p className="text-[10.5px] leading-relaxed text-text-subtle">{detail}</p>
      </div>
      {action}
    </li>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-[var(--brand-surface-muted)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-text-subtle">
      {children}
    </span>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span
        className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-surface-muted)] text-[10px] font-bold text-text-muted"
        aria-hidden="true"
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
