"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Check,
  Loader2,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/dashboard/page-header";
import { BUSINESS_NOT_CONNECTED } from "@/lib/business/repository";
import { can, roleName } from "@/lib/business/roles";
import {
  FOLDER_ACCESS_DESCRIPTION,
  FOLDER_ACCESS_LABEL,
  INVITATION_EXPIRY_DAYS,
  type FolderAccess,
  type Organization,
} from "@/lib/business/types";
import { OrganizationHeader } from "./organization-header";
import { RoleBoundaryNote } from "./role-selector";
import { cn } from "@/lib/utils";

/**
 * Organization settings.
 *
 * Grouped by who is affected: the profile affects how the organization appears,
 * the defaults affect new members, and governance affects what can be undone.
 *
 * Sections that would need a backend capability we don't have are shown as
 * "not available yet" with the reason — never as a switch that flips and saves
 * nothing. An organization settings page full of inert toggles is the fastest
 * way to make an admin lose trust in every other setting on it.
 */
export function BusinessSettingsView({
  organization,
  memberCount: _memberCount,
  activeMemberCount,
}: {
  organization: Organization;
  memberCount: number;
  activeMemberCount: number;
}) {
  const viewerRole = organization.viewerRole;
  const canEdit = can(viewerRole, "org.edit");
  const canDelete = can(viewerRole, "org.delete");

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Organization settings"
        description="How the organization appears, what new members get by default, and the controls that can't be undone."
        className="mb-4"
      />

      <OrganizationHeader organization={organization} className="mb-4" />

      <div className="space-y-4">
        <ProfileSection organization={organization} canEdit={canEdit} />
        <DefaultsSection canEdit={canEdit} />
        <InvitationsSection canEdit={canEdit} />
        <GovernanceSection organization={organization} memberCount={activeMemberCount} />
        {canDelete && <DangerZone organization={organization} />}
      </div>
    </div>
  );
}

const section = "overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white";
const sectionHead = "border-b border-[var(--brand-border-soft)] px-4 py-3";

function ProfileSection({
  organization,
  canEdit,
}: {
  organization: Organization;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState(organization.name);
  const [initials, setInitials] = React.useState(organization.initials);
  const [pending, setPending] = React.useState(false);
  const nameId = React.useId();
  const initialsId = React.useId();

  React.useEffect(() => {
    setName(organization.name);
    setInitials(organization.initials);
  }, [organization.name, organization.initials]);

  const dirty = name.trim() !== organization.name || initials.trim() !== organization.initials;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty) return;
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setPending(false);
    toast({ tone: "error", title: "Settings weren't saved", description: BUSINESS_NOT_CONNECTED });
  };

  return (
    <section className={section}>
      <div className={sectionHead}>
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink">
          <Building2 className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          Organization profile
        </h2>
      </div>
      <form onSubmit={save} className="px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <label htmlFor={nameId} className="mb-1 block text-[11.5px] font-semibold text-ink">
              Organization name
            </label>
            <input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canEdit}
              maxLength={80}
              className="h-9 w-full rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[12.5px] text-ink focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)] disabled:cursor-not-allowed disabled:bg-[var(--brand-canvas)] disabled:text-text-muted"
            />
            <p className="mt-1 text-[10.5px] text-text-subtle">
              Shown to everyone in the organization and on invitation emails.
            </p>
          </div>
          <div className="shrink-0">
            <label htmlFor={initialsId} className="mb-1 block text-[11.5px] font-semibold text-ink">
              Mark
            </label>
            <input
              id={initialsId}
              value={initials}
              onChange={(event) => setInitials(event.target.value.toUpperCase().slice(0, 2))}
              disabled={!canEdit}
              maxLength={2}
              aria-describedby={`${initialsId}-hint`}
              className="h-9 w-[68px] rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-center text-[12.5px] font-semibold uppercase text-ink focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)] disabled:cursor-not-allowed disabled:bg-[var(--brand-canvas)] disabled:text-text-muted"
            />
            <span id={`${initialsId}-hint`} className="sr-only">
              Two letters shown on the organization badge
            </span>
          </div>
        </div>

        {canEdit ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={!dirty || pending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-45"
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.4} aria-hidden="true" />
              ) : (
                <Save className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
              )}
              Save changes
            </button>
            {!dirty && <span className="text-[10.5px] text-text-subtle">No changes to save</span>}
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-text-subtle">
            <Lock className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            Only owners and admins can edit the organization profile.
          </p>
        )}
      </form>
    </section>
  );
}

function DefaultsSection({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const [access, setAccess] = React.useState<FolderAccess>("viewer");
  const [pending, setPending] = React.useState(false);

  const save = async () => {
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 450));
    setPending(false);
    toast({ tone: "error", title: "Default wasn't saved", description: BUSINESS_NOT_CONNECTED });
  };

  return (
    <section className={section}>
      <div className={sectionHead}>
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink">
          <Users className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          Team defaults
        </h2>
      </div>
      <div className="px-4 py-4">
        <p className="text-[11.5px] font-semibold text-ink">Default access on shared folders</p>
        <p className="mt-0.5 max-w-[520px] text-[11px] leading-relaxed text-text-muted">
          What a new member gets on folders marked open to the organization. Individual folders can
          override this.
        </p>

        <div className="mt-2.5 space-y-1.5" role="radiogroup" aria-label="Default folder access">
          {(Object.keys(FOLDER_ACCESS_LABEL) as FolderAccess[]).map((level) => (
            <label
              key={level}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                access === level
                  ? "border-primary bg-primary-soft/40"
                  : "border-[var(--brand-border)] hover:bg-[var(--brand-canvas)]",
                !canEdit && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="default-access"
                value={level}
                checked={access === level}
                disabled={!canEdit}
                onChange={() => setAccess(level)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--brand-primary)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                  {FOLDER_ACCESS_LABEL[level]}
                  {access === level && (
                    <Check className="h-3 w-3 text-primary" strokeWidth={3} aria-hidden="true" />
                  )}
                </span>
                <span className="mt-0.5 block text-[10.5px] leading-relaxed text-text-muted">
                  {FOLDER_ACCESS_DESCRIPTION[level]}
                </span>
              </span>
            </label>
          ))}
        </div>
        <RoleBoundaryNote>
          The safer default is view. Most organizations widen access for the folders that need it,
          because a folder shared by accident is harder to walk back than one shared deliberately.
        </RoleBoundaryNote>

        {canEdit && (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            {pending && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.4} aria-hidden="true" />}
            Save default
          </button>
        )}
      </div>
    </section>
  );
}

function InvitationsSection({ canEdit }: { canEdit: boolean }) {
  return (
    <section className={section}>
      <div className={sectionHead}>
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink">
          <Mail className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          Invitations
        </h2>
      </div>
      <ul className="divide-y divide-[var(--brand-border-soft)]">
        <li className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-ink">Invitation lifetime</p>
            <p className="text-[10.5px] text-text-subtle">
              An unaccepted invitation stops working after this.
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-[var(--brand-surface-muted)] px-2 py-1 text-[11px] font-semibold tabular-nums text-text">
            {INVITATION_EXPIRY_DAYS} days
          </span>
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-ink">Who can invite</p>
            <p className="text-[10.5px] text-text-subtle">Fixed by role, not configurable.</p>
          </div>
          <span className="shrink-0 text-[11px] font-medium text-text">Owners and admins</span>
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
              <Bell className="h-3 w-3 text-text-subtle" strokeWidth={2} aria-hidden="true" />
              Reminder emails
            </p>
            <p className="text-[10.5px] text-text-subtle">
              Not available yet — no scheduled email delivery exists.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--brand-surface-muted)] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-text-subtle">
            Planned
          </span>
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-ink">Domain restriction</p>
            <p className="text-[10.5px] text-text-subtle">
              Not available yet — invitations aren&rsquo;t restricted by email domain.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--brand-surface-muted)] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-text-subtle">
            Planned
          </span>
        </li>
      </ul>
      {!canEdit && (
        <p className="flex items-center gap-1.5 border-t border-[var(--brand-border-soft)] px-4 py-2 text-[10.5px] text-text-subtle">
          <Lock className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Only owners and admins can change invitation preferences.
        </p>
      )}
    </section>
  );
}

function GovernanceSection({
  organization,
  memberCount,
}: {
  organization: Organization;
  memberCount: number;
}) {
  return (
    <section className={section}>
      <div className={sectionHead}>
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink">
          <ShieldCheck className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          Ownership and access
        </h2>
      </div>
      <ul className="divide-y divide-[var(--brand-border-soft)]">
        <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-ink">Transfer ownership</p>
            <p className="mt-0.5 max-w-[460px] text-[10.5px] leading-relaxed text-text-subtle">
              Moves the owner role to another admin. You become an admin in the same step, so the
              organization is never ownerless.
            </p>
          </div>
          <Link
            href="/dashboard/business/members"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Members
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-ink">Your role</p>
            <p className="text-[10.5px] text-text-subtle">
              Assigned by whoever invited you.
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-ink">
            {roleName(organization.viewerRole)}
          </span>
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-ink">People with access</p>
            <p className="text-[10.5px] text-text-subtle">
              Accepted members. Pending invitations aren&rsquo;t counted.
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ink">{memberCount}</span>
        </li>
      </ul>
    </section>
  );
}

function DangerZone({ organization }: { organization: Organization }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-[#F0CDCD] bg-white">
        <div className="flex items-center gap-1.5 border-b border-[#F0CDCD] bg-[#FDF3F2] px-4 py-3">
          <AlertTriangle className="h-3.5 w-3.5 text-[#C93B2B]" strokeWidth={2.2} aria-hidden="true" />
          <h2 className="text-[13px] font-bold tracking-[-0.02em] text-[#8F2D20]">Danger zone</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-ink">Delete organization</p>
            <p className="mt-0.5 max-w-[440px] text-[10.5px] leading-relaxed text-text-subtle">
              Removes every shared folder and revokes all access. Members keep their personal
              accounts and personal files. There is no undo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-8 shrink-0 rounded-lg border border-[#E5B4B4] bg-white px-2.5 text-[11.5px] font-semibold text-[#C93B2B] transition-colors hover:bg-[#FDF3F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6455D]"
          >
            Delete organization
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          toast({
            tone: "error",
            title: "Organization wasn't deleted",
            description: BUSINESS_NOT_CONNECTED,
          });
        }}
        title={`Delete ${organization.name}?`}
        confirmLabel="Delete organization"
        destructive
        requireTyping={organization.name}
      >
        Every shared folder, every access grant and every invitation is removed for the whole team.{" "}
        <strong className="font-semibold text-ink">This can&rsquo;t be undone.</strong> Type the
        organization name to confirm.
      </ConfirmDialog>
    </>
  );
}
