"use client";

import * as React from "react";
import {
  Loader2,
  Mail,
  Search,
  SearchX,
  ShieldAlert,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/dashboard/page-header";
import { formatDate, formatRelative } from "@/lib/drive/format";
import { BUSINESS_NOT_CONNECTED } from "@/lib/business/repository";
import {
  can,
  removalBlocker,
  roleChangeBlocker,
  roleDefinition,
} from "@/lib/business/roles";
import {
  INVITATION_EXPIRY_DAYS,
  MEMBER_STATUS_HINT,
  type BusinessFolder,
  type BusinessRole,
  type Member,
  type MemberStatus,
} from "@/lib/business/types";
import { InviteDialog } from "./invite-dialog";
import { MemberAvatar, MemberCard, MemberTable } from "./member-table";
import { MemberStatusPill } from "./member-status";
import { RoleBadge } from "./role-badge";
import { RoleBoundaryNote, RoleSelector } from "./role-selector";
import { cn } from "@/lib/utils";

/**
 * Members.
 *
 * Four surfaces in one route: the list, the invite flow, the change-role dialog
 * and the remove confirmation. They are kept together because they are one
 * conversation — "who is on my team and what can they do" — and splitting them
 * across routes would mean losing the list every time you adjust somebody.
 */

type StatusFilter = MemberStatus | "all";

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "invited", label: "Invited" },
  { key: "suspended", label: "Suspended" },
  { key: "expired", label: "Expired" },
  { key: "failed", label: "Failed" },
];

export function MembersView({
  members,
  viewerRole,
  viewerId: _viewerId,
  folders,
}: {
  members: Member[];
  viewerRole: BusinessRole;
  viewerId: string | null;
  folders: BusinessFolder[];
}) {
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Member | null>(null);
  const [roleTarget, setRoleTarget] = React.useState<Member | null>(null);
  const [removeTarget, setRemoveTarget] = React.useState<Member | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<Member | null>(null);
  const [pendingAction, setPendingAction] = React.useState(false);

  const canInvite = can(viewerRole, "members.invite");
  const canRemove = can(viewerRole, "members.remove");
  const canChangeRole = can(viewerRole, "members.changeRole");
  const canSeeInvitations = canInvite;

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members.filter((member) => {
      if (status !== "all" && member.status !== status) return false;
      if (!needle) return true;
      return (
        (member.name ?? "").toLowerCase().includes(needle) ||
        member.email.toLowerCase().includes(needle)
      );
    });
  }, [members, search, status]);

  const counts = React.useMemo(() => {
    const map: Record<string, number> = { all: members.length };
    for (const member of members) {
      map[member.status] = (map[member.status] ?? 0) + 1;
    }
    return map;
  }, [members]);

  const staleInvitations = members.filter(
    (member) => member.status === "expired" || member.status === "failed",
  ).length;

  const filteredBySearch = search.trim().length > 0 || status !== "all";

  /** Every write reports honestly: nothing was saved. */
  const reportUnbacked = async (title: string) => {
    setPendingAction(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setPendingAction(false);
    toast({ tone: "error", title, description: BUSINESS_NOT_CONNECTED });
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Members"
        description="Everyone with access to this organization, and everyone who's been invited."
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

      {/* A member-role viewer sees the list but not the controls. Saying so
          up front is better than a page of disabled buttons. */}
      {!canInvite && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-[var(--brand-border)] bg-white px-3.5 py-2.5">
          <ShieldAlert
            className="mt-px h-3.5 w-3.5 shrink-0 text-[#96610B]"
            strokeWidth={2.1}
            aria-hidden="true"
          />
          <p className="text-[11.5px] leading-relaxed text-text-muted">
            <span className="font-semibold text-ink">Read-only view.</span> Owners and admins manage
            invitations and roles. You can see who&rsquo;s on the team and what they can do.
          </p>
        </div>
      )}

      {/* Stale invitations need action, so they get a banner above the table. */}
      {canSeeInvitations && staleInvitations > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#F6E2BC] bg-[#FEF7EA] px-3.5 py-2.5">
          <Mail className="h-3.5 w-3.5 shrink-0 text-[#96610B]" strokeWidth={2.1} aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-[#7A5209]">
            <span className="font-semibold">
              {staleInvitations} {staleInvitations === 1 ? "invitation" : "invitations"}
            </span>{" "}
            {staleInvitations === 1 ? "has" : "have"} expired or couldn&rsquo;t be delivered. Send a
            fresh one from the row menu.
          </p>
          <button
            type="button"
            onClick={() => setStatus("expired")}
            className="shrink-0 rounded-lg border border-[#E6CE9C] bg-white px-2 py-1 text-[11px] font-semibold text-[#7A5209] transition-colors hover:bg-[#FDF3E2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Show them
          </button>
        </div>
      )}

      {/* Controls */}
      {members.length > 0 && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-[300px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle"
              strokeWidth={2.1}
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email…"
              aria-label="Search members"
              className="h-9 w-full rounded-lg border border-[var(--brand-border)] bg-white pl-8 pr-8 text-[12.5px] text-ink placeholder:text-text-subtle transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.14)] [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-text-subtle hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Status filter as tabs. Only statuses that actually occur get a tab —
              an empty "Suspended" tab would suggest people are suspended when
              none are. */}
          <div
            role="tablist"
            aria-label="Filter by status"
            className="flex shrink-0 gap-0.5 overflow-x-auto rounded-lg border border-[var(--brand-border)] bg-white p-0.5"
          >
            {STATUS_TABS.map((tab) => {
              const count = counts[tab.key] ?? 0;
              if (tab.key !== "all" && count === 0) return null;
              const active = status === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatus(tab.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11.5px] font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active
                      ? "bg-[var(--brand-surface-muted)] text-ink"
                      : "text-text-muted hover:bg-[var(--brand-surface-muted)]/60 hover:text-ink",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "tabular-nums text-[10px]",
                      active ? "text-text-muted" : "text-text-subtle",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Table or empty */}
      {members.length === 0 ? (
        <div className="rounded-xl border border-[var(--brand-border)] bg-white">
          <EmptyState
            className="min-h-[320px] justify-center sm:min-h-[380px]"
            variant="first-use"
            icon={Users}
            title="It's just you so far."
            description={
              canInvite
                ? "Invite a teammate and this organization becomes shared: folders everybody can reach, and one place to see who has access."
                : "Nobody else has joined yet. An owner or admin can invite teammates."
            }
            action={
              canInvite ? (
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <UserPlus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                  Invite your first member
                </button>
              ) : undefined
            }
            footnote={`Invitations expire after ${INVITATION_EXPIRY_DAYS} days if they aren't accepted.`}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--brand-border)] bg-white">
          <EmptyState
            className="min-h-[280px] justify-center"
            variant="collection"
            icon={SearchX}
            title="No members match"
            description="Nobody here matches that search or status. Clearing them brings the full list back."
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop + tablet table */}
          <div className="hidden md:block">
            <MemberTable
              members={filtered}
              actorRole={viewerRole}
              onSelect={(member) => setSelected(member)}
              onChangeRole={(member) => {
                if (!canChangeRole) return;
                setRoleTarget(member);
              }}
              onResend={() => reportUnbacked("Invitation wasn't resent")}
              onRevoke={(member) => setRevokeTarget(member)}
              onRemove={(member) => {
                if (!canRemove) return;
                setRemoveTarget(member);
              }}
            />
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {filtered.map((member) => (
              <MemberCard key={member.id} member={member} onOpen={(m) => setSelected(m)} />
            ))}
          </div>
        </>
      )}

      {filteredBySearch && filtered.length > 0 && (
        <p className="mt-2 text-[11px] text-text-subtle" aria-live="polite">
          Showing {filtered.length} of {members.length} members
        </p>
      )}

      {/* Invite */}
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        actorRole={viewerRole}
        folders={folders}
      />

      {/* Details */}
      <MemberDetailsDialog
        member={selected}
        onClose={() => setSelected(null)}
        actorRole={viewerRole}
        onChangeRole={(member) => {
          setSelected(null);
          setRoleTarget(member);
        }}
        onRemove={(member) => {
          setSelected(null);
          setRemoveTarget(member);
        }}
      />

      {/* Change role */}
      <ChangeRoleDialog
        member={roleTarget}
        actorRole={viewerRole}
        pending={pendingAction}
        onClose={() => setRoleTarget(null)}
        onConfirm={() => {
          setRoleTarget(null);
          reportUnbacked("Role wasn't changed");
        }}
      />

      {/* Remove */}
      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          setRemoveTarget(null);
          reportUnbacked("Member wasn't removed");
        }}
        title={`Remove ${removeTarget?.name ?? removeTarget?.email ?? "this member"}?`}
        confirmLabel="Remove member"
        destructive
        requireTyping={removeTarget?.email}
      >
        They lose access to every shared folder in this organization immediately. Their personal
        files are untouched — those were never part of the organization.{" "}
        <strong className="font-semibold text-ink">This can&rsquo;t be undone</strong> without a new
        invitation.
      </ConfirmDialog>

      {/* Revoke invitation */}
      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => {
          setRevokeTarget(null);
          reportUnbacked("Invitation wasn't revoked");
        }}
        title="Revoke this invitation?"
        confirmLabel="Revoke invitation"
        destructive
      >
        The link in {revokeTarget?.email}&rsquo;s invitation email stops working immediately. If they
        haven&rsquo;t accepted yet, they won&rsquo;t be able to. You can invite them again later.
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Details dialog                                                     */
/* ------------------------------------------------------------------ */

function MemberDetailsDialog({
  member,
  onClose,
  actorRole,
  onChangeRole,
  onRemove,
}: {
  member: Member | null;
  onClose: () => void;
  actorRole: BusinessRole;
  onChangeRole: (member: Member) => void;
  onRemove: (member: Member) => void;
}) {
  const open = member !== null;
  if (!member) {
    return (
      <ConfirmDialog open={false} onClose={onClose} onConfirm={onClose} title="" confirmLabel="">
        <span />
      </ConfirmDialog>
    );
  }

  const changeBlocker = roleChangeBlocker({
    actorRole,
    targetRole: member.role,
    nextRole: "admin",
    isSelf: member.isViewer,
  });
  const removeBlocker = removalBlocker({
    actorRole,
    targetRole: member.role,
    isSelf: member.isViewer,
    isLastOwner: member.isLastOwner,
  });

  return (
    <Dialog open={open} onClose={onClose} title={member.name ?? member.email} size="md">
      <div className="flex items-start gap-3">
        <MemberAvatar member={member} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[14px] font-bold tracking-[-0.02em] text-ink">
              {member.name ?? member.email.split("@")[0]}
            </span>
            {member.isViewer && (
              <span className="rounded bg-[var(--brand-surface-muted)] px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-text-subtle">
                You
              </span>
            )}
          </p>
          <p className="truncate text-[11.5px] text-text-muted">{member.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <RoleBadge role={member.role} size="md" />
            <MemberStatusPill status={member.status} />
          </div>
        </div>
      </div>

      <dl className="mt-4 divide-y divide-[var(--brand-border-soft)] rounded-xl border border-[var(--brand-border)]">
        <DetailRow label="Status detail" value={MEMBER_STATUS_HINT[member.status]} />
        {member.joinedAt && (
          <DetailRow label="Joined" value={`${formatDate(member.joinedAt)} (${formatRelative(member.joinedAt)})`} />
        )}
        {member.invitedAt && !member.joinedAt && (
          <DetailRow
            label="Invited"
            value={`${formatDate(member.invitedAt)} (${formatRelative(member.invitedAt)})`}
          />
        )}
        {member.invitationExpiresAt && (
          <DetailRow label="Invitation expires" value={formatDate(member.invitationExpiresAt)} />
        )}
        <DetailRow
          label="Last active"
          value={member.lastActiveAt ? formatRelative(member.lastActiveAt) : "Never signed in"}
        />
        <DetailRow label="Role allows" value={roleDefinition(member.role).summary} />
      </dl>

      {changeBlocker && removeBlocker && (
        <p className="mt-3 text-[10.5px] leading-relaxed text-text-subtle">
          {changeBlocker} {removeBlocker}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(changeBlocker)}
          onClick={() => onChangeRole(member)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45"
        >
          Change role
        </button>
        <button
          type="button"
          disabled={Boolean(removeBlocker)}
          onClick={() => onRemove(member)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5B4B4] bg-white px-3 text-[12px] font-semibold text-[#C93B2B] transition-colors hover:bg-[#FDF3F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6455D] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Remove
        </button>
      </div>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="w-[132px] shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-text">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Change role dialog                                                 */
/* ------------------------------------------------------------------ */

function ChangeRoleDialog({
  member,
  actorRole,
  pending,
  onClose,
  onConfirm,
}: {
  member: Member | null;
  actorRole: BusinessRole;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [next, setNext] = React.useState<BusinessRole>("member");

  React.useEffect(() => {
    if (member) setNext(member.role === "admin" ? "member" : "admin");
  }, [member]);

  const open = member !== null;
  const isDowngrade =
    member !== null && next === "member" && (member.role === "admin" || member.role === "owner");
  const blocker =
    member === null
      ? null
      : roleChangeBlocker({
          actorRole,
          targetRole: member.role,
          nextRole: next,
          isSelf: member.isViewer,
        });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Change ${member?.name ?? "role"}'s role`}
      description="The change takes effect immediately. Their access updates on their next action."
      footer={
        member && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Boolean(blocker) || pending || member.role === next}
              onClick={onConfirm}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[12px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50",
                isDowngrade
                  ? "bg-[#D6455D] hover:bg-[#BF344B] focus-visible:ring-[#D6455D]"
                  : "bg-primary hover:bg-primary-hover focus-visible:ring-primary",
              )}
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} aria-hidden="true" />}
              {isDowngrade ? "Reduce access" : "Update role"}
            </button>
          </div>
        )
      }
    >
      {member && (
        <>
          <div className="flex items-center gap-2.5 rounded-xl bg-[var(--brand-canvas)] px-3 py-2.5">
            <MemberAvatar member={member} />
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold text-ink">
                {member.name ?? member.email}
              </p>
              <p className="text-[10.5px] text-text-subtle">
                Currently {roleDefinition(member.role).name}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <RoleSelector
              value={next}
              onChange={setNext}
              actorRole={actorRole}
              excludeRoles={["owner"]}
              name="change-role"
            />
          </div>

          {isDowngrade ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-[#F6E2BC] bg-[#FEF7EA] px-2.5 py-2 text-[10.5px] leading-relaxed text-[#7A5209]">
              <ShieldAlert className="mt-px h-3 w-3 shrink-0" strokeWidth={2.1} aria-hidden="true" />
              <span>
                Going from {roleDefinition(member.role).name} to {roleDefinition(next).name} removes
                access. They keep everything they can already see — the restriction applies to what
                they can change next.
              </span>
            </p>
          ) : (
            <div className="mt-3">
              <RoleBoundaryNote>
                {roleDefinition(next).detail}
              </RoleBoundaryNote>
            </div>
          )}

          {blocker && (
            <p role="alert" className="mt-2 text-[11px] font-medium text-[#C93B2B]">
              {blocker}
            </p>
          )}
        </>
      )}
    </Dialog>
  );
}
