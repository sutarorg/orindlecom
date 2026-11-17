"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/drive/client";

/**
 * First-run organization setup card + invitation acceptor.
 *
 * Shown on `/business` when the signed-in user does not yet belong
 * to any organization, or when arriving via `?invite=<token>`.
 */
export function CreateOrganizationCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const inviteToken = searchParams.get("invite");
  const [name, setName] = React.useState("");
  const [initials, setInitials] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [accepting, setAccepting] = React.useState(false);
  const nameId = React.useId();
  const initialsId = React.useId();

  const acceptInvite = async () => {
    if (!inviteToken) return;
    setAccepting(true);
    const result = await api.post<{ organization: { name: string } }>(
      "/api/organizations/invitations/accept",
      { token: inviteToken },
    );
    setAccepting(false);

    if (!result.ok) {
      toast({ tone: "error", title: "Invitation couldn't be accepted", description: result.message });
      return;
    }

    toast({
      tone: "success",
      title: `Joined ${result.data.organization.name}`,
      description: "You now have access to the team's shared folders.",
    });
    router.replace("/business");
    router.refresh();
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for your organization.");
      return;
    }
    if (trimmed.length > 120) {
      setError("Keep the name under 120 characters.");
      return;
    }

    setError(null);
    setPending(true);
    const result = await api.post<{ organization: { id: string; name: string } }>(
      "/api/organizations",
      {
        name: trimmed,
        initials: initials.trim() || undefined,
      },
    );
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    toast({
      tone: "success",
      title: `${result.data.organization.name} created`,
      description: "Your organization inherits your active storage plan.",
    });
    router.refresh();
  };

  return (
    /*
     * Centred in the content area, not just horizontally centred inside it.
     *
     * This card is the whole page when it appears — there is no organization, so
     * there is nothing above or below it. It was pinned to the top with
     * `mx-auto … py-6`, which put a single card in the upper third of a tall empty
     * column: the card looked misplaced rather than deliberate.
     *
     * `min-h-full` + `justify-center` centres it in whatever height the shell gives
     * the main region, and `flex-1` on `main` lets that be the full viewport. The
     * padding keeps it off the edges on a short screen, and `items-center` keeps the
     * card itself from stretching.
     */
    <div className="mx-auto flex min-h-full w-full max-w-[680px] flex-col items-center justify-center gap-4 px-4 py-8 sm:px-6">
      {inviteToken && (
        <section className="w-full overflow-hidden rounded-2xl border border-primary/30 bg-primary-soft/30 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <Mail className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold tracking-[-0.02em] text-ink">
                You have a workspace invitation
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-text-muted">
                Accept to join the organization with the role assigned by the administrator who
                invited you.
              </p>
              <button
                type="button"
                disabled={accepting}
                onClick={() => void acceptInvite()}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-55"
              >
                {accepting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                )}
                {accepting ? "Joining…" : "Accept invitation"}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="w-full overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
        <div className="border-b border-[var(--brand-border-soft)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Building2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-[16px] font-extrabold tracking-[-0.03em] text-ink">
                Create your Business workspace
              </h1>
              <p className="text-[12px] text-text-muted">
                Share folders, manage roles, and pool storage under your current Orindle plan.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={create} noValidate className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <label htmlFor={nameId} className="mb-1 block text-[12px] font-semibold text-ink">
                Organization name
              </label>
              <input
                id={nameId}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Acme Studio"
                maxLength={120}
                className="h-9 w-full rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[12.5px] text-ink placeholder:text-text-subtle focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]"
              />
            </div>
            <div className="shrink-0">
              <label htmlFor={initialsId} className="mb-1 block text-[12px] font-semibold text-ink">
                Mark (optional)
              </label>
              <input
                id={initialsId}
                value={initials}
                onChange={(event) => setInitials(event.target.value.toUpperCase().slice(0, 2))}
                placeholder="AS"
                maxLength={2}
                className="h-9 w-[80px] rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-center text-[12.5px] font-semibold uppercase text-ink placeholder:text-text-subtle focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-2 text-[11.5px] font-medium text-[#C93B2B]">
              {error}
            </p>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-text-subtle">
            Business workspaces inherit the organization owner&rsquo;s active storage plan with no
            separate per-seat fee. You start as Owner and can invite Admins and Members right away.
          </p>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[12.5px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-55"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} aria-hidden="true" />}
              {pending ? "Creating…" : "Create organization"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
