"use client";

import * as React from "react";
import {
  AlertTriangle,
  Bell,
  Download,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/drive/client";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { TwoFactorPanel } from "@/components/security/two-factor-panel";

function planInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || "OR").toUpperCase();
}

const sectionClass = "overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white";
const headClass = "border-b border-[var(--brand-border-soft)] px-4 py-3";

export function SettingsView({
  user,
  authenticated,
}: {
  user: { name: string; email: string };
  authenticated: boolean;
}) {
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <ProfileSection user={user} authenticated={authenticated} />
      <SecuritySection authenticated={authenticated} onSaved={() => toast({ tone: "success", title: "Done" })} />
      <DataExportSection authenticated={authenticated} />
      <NotificationsSection />
      <DangerZone user={user} />
    </div>
  );
}

function ProfileSection({
  user,
  authenticated,
}: {
  user: { name: string; email: string };
  authenticated: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = React.useState(user.name);
  const [pending, setPending] = React.useState(false);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [nextEmail, setNextEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [emailPending, setEmailPending] = React.useState(false);

  const nameId = React.useId();
  const emailInputId = React.useId();
  const initial = React.useRef(user.name);

  React.useEffect(() => {
    setName(user.name);
    initial.current = user.name;
  }, [user.name]);

  React.useEffect(() => {
    if (emailOpen) {
      setNextEmail("");
      setEmailError(null);
      setEmailPending(false);
    }
  }, [emailOpen]);

  const dirty = name.trim() !== initial.current && name.trim().length > 0;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty) return;
    setPending(true);

    const result = await api.patch<{ fullName: string }>("/api/users/me", {
      fullName: name.trim(),
    });

    setPending(false);

    if (!result.ok) {
      toast({
        tone: "error",
        title: "Name wasn't saved",
        description: result.message,
      });
      return;
    }

    initial.current = result.data.fullName;
    toast({ tone: "success", title: "Name saved", description: "That's how it'll appear now." });
    router.refresh();
  };

  const requestEmailChange = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleaned = nextEmail.trim().toLowerCase();
    if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (cleaned === user.email.toLowerCase()) {
      setEmailError("That is already your current email address.");
      return;
    }

    setEmailError(null);
    setEmailPending(true);

    const result = await api.post<{ requested: boolean; note: string }>("/api/users/me/email", {
      email: cleaned,
    });

    setEmailPending(false);

    if (!result.ok) {
      setEmailError(result.message);
      return;
    }

    setEmailOpen(false);
    toast({
      tone: "success",
      title: "Confirmation sent",
      description: result.data.note,
    });
  };

  return (
    <>
      <section className={sectionClass}>
        <div className={headClass}>
          <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink">
            <User className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
            Profile
          </h2>
        </div>
        <form onSubmit={save} className="px-4 py-4">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8B5CF6,#3178FB)] text-[14px] font-bold text-white"
              aria-hidden="true"
            >
              {planInitials(user.name)}
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <label htmlFor={nameId} className="mb-1 block text-[11.5px] font-semibold text-ink">
                  Display name
                </label>
                <input
                  id={nameId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[12.5px] text-ink focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]"
                  autoComplete="name"
                />
              </div>
              <div>
                <span className="mb-1 block text-[11.5px] font-semibold text-ink">Email</span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[12.5px] text-text">
                    <Mail className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
                    {user.email}
                    {!authenticated && (
                      <span className="rounded bg-[var(--brand-surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-text-subtle">
                        placeholder
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEmailOpen(true)}
                    className="inline-flex h-7 items-center rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[11px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Change email
                  </button>
                </div>
                <p className="mt-1 text-[10.5px] leading-relaxed text-text-subtle">
                  We send a verification link to your new address and notify your current address
                  before anything switches.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={!dirty || pending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-45"
            >
              {pending && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.4} aria-hidden="true" />}
              Save changes
            </button>
            {!dirty && <span className="text-[10.5px] text-text-subtle">No changes to save</span>}
          </div>
        </form>
      </section>

      <Dialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        title="Change email address"
        description="Your current email stays active until you confirm the link sent to the new address."
        size="sm"
      >
        <form onSubmit={requestEmailChange} noValidate>
          <div>
            <label htmlFor={emailInputId} className="mb-1 block text-[11px] font-semibold text-ink">
              New email address
            </label>
            <input
              id={emailInputId}
              type="email"
              value={nextEmail}
              autoComplete="email"
              data-autofocus
              placeholder="you@example.com"
              aria-invalid={emailError ? true : undefined}
              onChange={(event) => {
                setNextEmail(event.target.value);
                if (emailError) setEmailError(null);
              }}
              className="h-9 w-full rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[12.5px] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]"
            />
          </div>
          {emailError && (
            <p role="alert" className="mt-2 text-[11px] font-medium text-[#C93B2B]">
              {emailError}
            </p>
          )}
          <div className="mt-3.5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEmailOpen(false)}
              className="h-8 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[11.5px] font-semibold text-ink hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={emailPending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11.5px] font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-60"
            >
              {emailPending && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.4} aria-hidden="true" />}
              Send verification
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function SecuritySection({
  authenticated,
  onSaved: _onSaved,
}: {
  authenticated: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
      setPending(false);
    }
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (next.length < 8) return setError("Use at least 8 characters.");
    if (!/[a-zA-Z]/.test(next) || !/[0-9]/.test(next)) {
      return setError("Include at least one letter and one number.");
    }
    if (next !== confirm) return setError("The two new passwords don't match.");
    if (next === current) return setError("Choose a password you haven't used here before.");

    setError(null);
    setPending(true);

    const result = await api.post<{ changed: boolean }>("/api/users/me/password", {
      current,
      next,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setOpen(false);
    toast({
      tone: "success",
      title: "Password changed",
      description: "Use your new password next time you sign in.",
    });
  };

  return (
    <>
      <section className={sectionClass}>
        <div className={headClass}>
          <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink">
            <ShieldCheck className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
            Account security
          </h2>
        </div>
        <ul className="divide-y divide-[var(--brand-border-soft)]">
          <li className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-ink">Password</p>
              <p className="text-[10.5px] text-text-subtle">
                {authenticated ? "Managed by Supabase Auth" : "Not available in this preview"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <KeyRound className="h-3 w-3 text-text-subtle" strokeWidth={2.1} aria-hidden="true" />
              Change
            </button>
          </li>
          <TwoFactorPanel authenticated={authenticated} />
        </ul>
      </section>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Change password"
        description="Use at least 8 characters with a letter and a number."
        size="sm"
      >
        <form onSubmit={submit} noValidate>
          <div className="space-y-2.5">
            {[
              { label: "Current password", value: current, set: setCurrent, ac: "current-password" },
              { label: "New password", value: next, set: setNext, ac: "new-password", auto: true },
              { label: "Confirm new password", value: confirm, set: setConfirm, ac: "new-password" },
            ].map((field) => (
              <div key={field.label}>
                <label className="mb-1 block text-[11px] font-semibold text-ink">{field.label}</label>
                <input
                  type="password"
                  value={field.value}
                  autoComplete={field.ac}
                  data-autofocus={field.auto ? true : undefined}
                  aria-invalid={error ? true : undefined}
                  onChange={(event) => {
                    field.set(event.target.value);
                    if (error) setError(null);
                  }}
                  className="h-9 w-full rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[12.5px] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]"
                />
              </div>
            ))}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-[11px] font-medium text-[#C93B2B]">
              {error}
            </p>
          )}
          <div className="mt-3.5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[11.5px] font-semibold text-ink hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11.5px] font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.4} aria-hidden="true" />}
              Update password
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function DataExportSection({ authenticated }: { authenticated: boolean }) {
  const { toast } = useToast();
  const [exporting, setExporting] = React.useState(false);

  const exportData = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/users/me/export", { credentials: "same-origin" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        toast({
          tone: "error",
          title: "Export failed",
          description: body?.message ?? "We couldn't prepare your account export right now.",
        });
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `orindle-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      toast({
        tone: "success",
        title: "Account export downloaded",
        description: "Your profile, file metadata, shares, and billing history were saved as JSON.",
      });
    } catch {
      toast({
        tone: "error",
        title: "Export failed",
        description: "A network error interrupted the download. Try again.",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className={sectionClass}>
      <div className={headClass}>
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink">
          <Download className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          Your data
        </h2>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-ink">Export account data</p>
          <p className="mt-0.5 max-w-[440px] text-[10.5px] leading-relaxed text-text-subtle">
            Download a JSON copy of your profile, folder and file catalogue, active shares,
            subscription history, and recent activity.
          </p>
        </div>
        <button
          type="button"
          disabled={exporting || !authenticated}
          onClick={() => void exportData()}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <Download className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          )}
          {exporting ? "Preparing…" : "Download JSON"}
        </button>
      </div>
    </section>
  );
}

function NotificationsSection() {
  return (
    <section className={sectionClass}>
      <div className={headClass}>
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink">
          <Bell className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          Email notifications
        </h2>
      </div>
      <div className="px-4 py-4">
        <p className="text-[12px] font-medium text-ink">Essential account emails only</p>
        <p className="mt-1 max-w-[480px] text-[11.5px] leading-relaxed text-text-muted">
          Orindle only sends transactional emails directly tied to your account — verification,
          security alerts, billing receipts, workspace invitations, and storage threshold warnings.
          We do not send marketing newsletters or promotional mail.
        </p>
      </div>
    </section>
  );
}

function DangerZone({ user }: { user: { name: string; email: string } }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const requestDeletion = async () => {
    setOpen(false);
    setPending(true);

    const result = await api.post<{ purgeOn: string; note: string }>("/api/users/me/delete", {
      confirmation: user.email,
    });

    setPending(false);

    if (!result.ok) {
      toast({ tone: "error", title: "Account wasn't scheduled", description: result.message });
      return;
    }

    toast({
      tone: "success",
      title: "Deletion scheduled",
      description: result.data.note,
    });
  };

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[#F0CDCD] bg-white">
        <div className="flex items-center gap-1.5 border-b border-[#F0CDCD] bg-[#FDF3F2] px-4 py-3">
          <AlertTriangle className="h-3.5 w-3.5 text-[#C93B2B]" strokeWidth={2.2} aria-hidden="true" />
          <h2 className="text-[13px] font-bold tracking-[-0.02em] text-[#8F2D20]">Danger zone</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-ink">Delete account</p>
            <p className="mt-0.5 max-w-[420px] text-[10.5px] leading-relaxed text-text-subtle">
              Schedules your profile and every file, folder and share for deletion. Your account
              becomes read-only now and is permanently removed after the 7-day grace period. Signing
              in before then cancels it.
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => setOpen(true)}
            className="h-8 shrink-0 rounded-lg border border-[#E5B4B4] bg-white px-2.5 text-[11.5px] font-semibold text-[#C93B2B] transition-colors hover:bg-[#FDF3F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6455D]"
          >
            Delete account
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => void requestDeletion()}
        title="Delete your account?"
        confirmLabel="Delete account"
        destructive
        requireTyping={user.email}
      >
        This schedules every file, folder, share and your profile for deletion after the 7-day grace
        period. <strong className="font-semibold text-ink">After 7 days it cannot be undone.</strong>{" "}
        Type your email address to confirm.
      </ConfirmDialog>
    </>
  );
}
