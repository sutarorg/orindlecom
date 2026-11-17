"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  FolderLock,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { can } from "@/lib/business/roles";
import type {
  BusinessActivityEvent,
  BusinessFolder,
  BusinessRole,
  BusinessStorage,
  Member,
  Organization,
} from "@/lib/business/types";
import { ActivityTimeline } from "./activity-timeline";
import { BusinessStorageCard } from "./business-storage-card";
import { InviteDialog } from "./invite-dialog";
import { MemberAvatar } from "./member-table";
import { MemberStatusPill } from "./member-status";
import { OrganizationHeader } from "./organization-header";
import { RoleBadge } from "./role-badge";

/**
 * Business overview.
 *
 * The getting-started path is designed first, because a new organization is the
 * only state that will ever be seen on day one. It is a three-step checklist
 * rather than a set of empty cards: each step that is already done is marked
 * done, and each remaining step links to the screen that finishes it.
 *
 * Once there is real activity the page becomes an operational summary — but it
 * never shows an empty panel just because the layout has room for one.
 */
export function BusinessOverview({
  organization,
  storage,
  members,
  pendingInvitations,
  folders,
  events,
}: {
  organization: Organization;
  storage: BusinessStorage;
  members: Member[];
  pendingInvitations: number;
  folders: BusinessFolder[];
  events: BusinessActivityEvent[];
}) {
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const canInvite = can(organization.viewerRole, "members.invite");

  const activeMembers = members.filter((member) => member.status === "active");
  const isNew = activeMembers.length <= 1 && folders.length === 0;

  const steps = [
    {
      key: "invite",
      done: members.length > 1,
      title: "Invite your first teammate",
      description: "They get an email, you pick their role. It's how the organization becomes shared.",
      action: canInvite
        ? { label: "Invite member", onClick: () => setInviteOpen(true) }
        : { label: "View members", href: "/business/members" },
      icon: UserPlus,
    },
    {
      key: "folder",
      done: folders.length > 0,
      title: "Create a shared folder",
      description: "One folder with one set of rules beats emailing files around.",
      action: { label: "Shared folders", href: "/business/folders" },
      icon: FolderLock,
    },
    {
      key: "permissions",
      done: members.length > 1 && folders.length > 0,
      title: "Decide who can do what",
      description: "Three roles, each with a clear boundary. Review them before the team grows.",
      action: { label: "See roles", href: "/business/permissions" },
      icon: ShieldCheck,
    },
  ];

  const remaining = steps.filter((step) => !step.done).length;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Organization"
        description={
          isNew
            ? "A shared workspace for your team. Three steps and it's running."
            : "Who's on the team, what they can reach, and how much room is left."
        }
        action={
          canInvite ? (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <UserPlus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
              Invite member
            </button>
          ) : undefined
        }
        className="mb-4"
      />

      <OrganizationHeader organization={organization} className="mb-4" />

      {isNew ? (
        <GettingStarted steps={steps} remaining={remaining} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {/* Members */}
            <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
              <SectionHead
                title="Members"
                icon={Users}
                href="/business/members"
                meta={`${members.length} ${members.length === 1 ? "person" : "people"}`}
              />
              <ul className="divide-y divide-[var(--brand-border-soft)]">
                {members.slice(0, 5).map((member) => (
                  <li key={member.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <MemberAvatar member={member} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-ink">
                        {member.name ?? member.email.split("@")[0]}
                        {member.isViewer && (
                          <span className="ml-1.5 text-[10px] font-normal text-text-subtle">(you)</span>
                        )}
                      </p>
                      <p className="truncate text-[10.5px] text-text-subtle">{member.email}</p>
                    </div>
                    <RoleBadge role={member.role} />
                    <span className="hidden sm:block">
                      <MemberStatusPill status={member.status} showHint />
                    </span>
                  </li>
                ))}
              </ul>
              {pendingInvitations > 0 && (
                <div className="flex items-center gap-2 border-t border-[var(--brand-border-soft)] bg-[var(--brand-canvas)] px-4 py-2">
                  <Mail className="h-3 w-3 shrink-0 text-text-subtle" strokeWidth={2} aria-hidden="true" />
                  <p className="min-w-0 flex-1 text-[10.5px] text-text-muted">
                    {pendingInvitations} invitation{pendingInvitations === 1 ? "" : "s"} waiting to be
                    accepted
                  </p>
                  <Link
                    href="/business/members"
                    className="shrink-0 rounded text-[10.5px] font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Review
                  </Link>
                </div>
              )}
            </section>

            {/* Recent activity — only when it exists */}
            {events.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
                <SectionHead
                  title="Recent activity"
                  icon={Activity}
                  href="/business/activity"
                />
                <div className="px-4 pb-3 pt-1">
                  <ActivityTimeline events={events.slice(0, 6)} />
                </div>
              </section>
            )}

            {/* Folders */}
            {folders.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
                <SectionHead
                  title="Shared folders"
                  icon={FolderLock}
                  href="/business/folders"
                  meta={`${folders.length}`}
                />
                <ul className="divide-y divide-[var(--brand-border-soft)]">
                  {folders.slice(0, 4).map((folder) => (
                    <li key={folder.id}>
                      <Link
                        href="/business/folders"
                        className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-primary">
                          <FolderLock className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-ink">
                            {folder.name}
                          </span>
                          <span className="text-[10.5px] text-text-subtle">
                            {folder.itemCount} items ·{" "}
                            {folder.openToOrganization ? "Everyone" : `${folder.access.length} people`}
                          </span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-subtle" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="space-y-4">
            <BusinessStorageCard storage={storage} variant="compact" />
            <AccessSummary role={organization.viewerRole} />
          </div>
        </div>
      )}

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        organizationId={organization.id}
        actorRole={organization.viewerRole}
        folders={folders}
      />
    </div>
  );
}

function GettingStarted({
  steps,
  remaining,
}: {
  steps: Array<{
    key: string;
    done: boolean;
    title: string;
    description: string;
    action: { label: string; href?: string; onClick?: () => void };
    icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  }>;
  remaining: number;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
      <div className="border-b border-[var(--brand-border-soft)] px-4 py-3.5">
        <h2 className="text-[15px] font-extrabold tracking-[-0.03em] text-ink">
          {remaining === 0 ? "You're set up." : "Set up your organization"}
        </h2>
        <p className="mt-0.5 text-[12px] text-text-muted">
          {remaining === 0
            ? "Everything below is in place. Invite more people as the team grows."
            : `${remaining} ${remaining === 1 ? "step" : "steps"} left. Each one takes under a minute.`}
        </p>
      </div>

      <ol className="divide-y divide-[var(--brand-border-soft)]">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.key} className="flex items-start gap-3 px-4 py-3.5">
              <span
                className={
                  step.done
                    ? "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F1FBF6] text-[#1B8A57] ring-1 ring-[#CBEBD9]"
                    : "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-canvas)] text-text-subtle ring-1 ring-[var(--brand-border)]"
                }
              >
                {step.done ? (
                  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M4.5 10.5l3.5 3.5 7.5-8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <span className={step.done ? "text-text-muted line-through decoration-1" : undefined}>
                    {step.title}
                  </span>
                  {step.done && (
                    <span className="rounded bg-[#F1FBF6] px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-[#1B8A57]">
                      Done
                    </span>
                  )}
                  <span className="text-[10px] font-normal text-text-subtle">
                    Step {index + 1}
                  </span>
                </p>
                <p className="mt-0.5 max-w-[520px] text-[11.5px] leading-relaxed text-text-muted">
                  {step.description}
                </p>
              </div>

              {!step.done &&
                (step.action.href ? (
                  <Link
                    href={step.action.href}
                    className="mt-1 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {step.action.label}
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={step.action.onClick}
                    className="mt-1 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11.5px] font-semibold text-white shadow-[0_1px_2px_rgba(23,29,58,0.12)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  >
                    {step.action.label}
                  </button>
                ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SectionHead({
  title,
  icon: Icon,
  href,
  meta,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  href?: string;
  meta?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--brand-border-soft)] px-4 py-2.5">
      <h2 className="flex items-center gap-1.5 text-[12px] font-bold tracking-[-0.02em] text-ink">
        <Icon className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden />
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {meta && <span className="text-[10.5px] text-text-subtle">{meta}</span>}
        {href && (
          <Link
            href={href}
            className="inline-flex min-h-6 items-center gap-0.5 rounded text-[11px] font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            See all
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}

/** What the viewer's role lets them do, stated on the overview. */
function AccessSummary({ role }: { role: BusinessRole }) {
  const allowed = [
    { key: "members.view", label: "See members" },
    { key: "members.invite", label: "Invite people" },
    { key: "folders.manageAccess", label: "Manage folder access" },
    { key: "billing.manage", label: "Manage billing" },
  ] as const;

  return (
    <section className="rounded-2xl border border-[var(--brand-border)] bg-white p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[12px] font-bold tracking-[-0.02em] text-ink">
          <ShieldCheck className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          Your access
        </h2>
        <RoleBadge role={role} />
      </div>
      <ul className="mt-2 space-y-1">
        {allowed.map((item) => {
          const yes = can(role, item.key);
          return (
            <li key={item.key} className="flex items-center gap-1.5 text-[11px]">
              <span
                className={
                  yes
                    ? "flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#F1FBF6] text-[#1B8A57]"
                    : "flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--brand-surface-muted)] text-text-subtle"
                }
                aria-hidden="true"
              >
                {yes ? (
                  <svg viewBox="0 0 20 20" className="h-2.5 w-2.5">
                    <path
                      d="M4.5 10.5l3.5 3.5 7.5-8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="h-px w-1.5 bg-current" />
                )}
              </span>
              <span className={yes ? "text-text" : "text-text-subtle line-through"}>
                {item.label}
              </span>
              <span className="sr-only">{yes ? "allowed" : "not allowed"}</span>
            </li>
          );
        })}
      </ul>
      <Link
        href="/business/permissions"
        className="mt-2 inline-flex min-h-6 items-center gap-1 rounded text-[10.5px] font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        See what every role can do
        <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
