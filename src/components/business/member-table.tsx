"use client";

import * as React from "react";
import {
  ChevronRight,
  Clock,
  MoreHorizontal,
  RefreshCw,
  Send,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import { Menu } from "@/components/ui/menu";
import { RoleBadge } from "./role-badge";
import { MemberStatusPill } from "./member-status";
import { formatRelative } from "@/lib/drive/format";
import { MEMBER_STATUS_HINT, type BusinessRole, type Member } from "@/lib/business/types";
import { cn } from "@/lib/utils";

/**
 * Member table.
 *
 * A table, not a card grid, because the questions asked of this screen are
 * comparative: who is an admin, who hasn't accepted, who was last active.
 * Comparisons need columns.
 *
 * Below 768px it becomes a list of member cards (see `MemberCard`), because five
 * columns of small text on a phone is a desktop layout squeezed until it leaks.
 *
 * The row action menu is hosted once for the table rather than once per row — a
 * portal per member would be absurd at team scale — with the anchor held in state.
 */
export function MemberTable({
  members,
  actorRole: _actorRole,
  onChangeRole,
  onResend,
  onRevoke,
  onRemove,
  onSelect,
}: {
  members: Member[];
  actorRole: BusinessRole;
  onChangeRole: (member: Member) => void;
  onResend: (member: Member) => void;
  onRevoke: (member: Member) => void;
  onRemove: (member: Member) => void;
  onSelect: (member: Member) => void;
}) {
  const [context, setContext] = React.useState<{ member: Member; anchor: HTMLElement } | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Organization members and their roles. {members.length} shown.
          </caption>
          <thead>
            <tr className="bg-[var(--brand-canvas)]">
              <Th className="pl-4">Member</Th>
              <Th className="hidden w-[120px] sm:table-cell">Status</Th>
              <Th className="w-[132px]">Role</Th>
              <Th className="hidden w-[132px] lg:table-cell">Last active</Th>
              <Th className="w-[52px] pr-4 text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.id}
                className={cn(
                  "group border-t border-[var(--brand-border-soft)] transition-colors hover:bg-[var(--brand-surface-muted)]/60",
                  member.status !== "active" && "bg-[var(--brand-canvas)]/40",
                )}
              >
                {/* Member */}
                <td className="px-2 py-2 pl-4">
                  <button
                    type="button"
                    onClick={() => onSelect(member)}
                    className="flex min-w-0 items-center gap-2.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <MemberAvatar member={member} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[12.5px] font-semibold text-ink">
                          {member.name ?? member.email.split("@")[0]}
                        </span>
                        {member.isViewer && (
                          <span className="shrink-0 rounded bg-[var(--brand-surface-muted)] px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-text-subtle">
                            You
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[10.5px] text-text-subtle">{member.email}</span>
                        {/* Status is hidden as a column on small screens but must
                            never be hidden as information. */}
                        <span className="sm:hidden">
                          <MemberStatusPill status={member.status} showHint />
                        </span>
                      </span>
                    </span>
                  </button>
                </td>

                {/* Status */}
                <td className="hidden px-2 py-2 sm:table-cell">
                  <MemberStatusPill status={member.status} showHint />
                </td>

                {/* Role */}
                <td className="px-2 py-2">
                  <RoleBadge role={member.role} />
                </td>

                {/* Last active */}
                <td className="hidden px-2 py-2 text-[11.5px] text-text-muted lg:table-cell">
                  {member.lastActiveAt ? (
                    formatRelative(member.lastActiveAt)
                  ) : (
                    <span className="text-text-subtle">Never</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-2 py-2 pr-4 text-right">
                  <button
                    type="button"
                    onClick={(event) => setContext({ member, anchor: event.currentTarget })}
                    aria-haspopup="menu"
                    aria-expanded={context?.member.id === member.id}
                    aria-label={`Actions for ${member.name ?? member.email}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <MoreHorizontal className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Menu
        open={context !== null}
        onClose={() => setContext(null)}
        anchor={context?.anchor ?? null}
        label={context ? `Actions for ${context.member.name ?? context.member.email}` : "Member actions"}
        width={226}
        items={
          context
            ? [
                {
                  key: "details",
                  label: "View details",
                  icon: ChevronRight,
                  onSelect: () => {
                    onSelect(context.member);
                    setContext(null);
                  },
                },
                ...(context.member.status === "active"
                  ? [
                      {
                        key: "role",
                        label: "Change role",
                        icon: UserCog,
                        onSelect: () => {
                          onChangeRole(context.member);
                          setContext(null);
                        },
                      },
                    ]
                  : [
                      {
                        key: "resend",
                        label:
                          context.member.status === "expired"
                            ? "Send a new invitation"
                            : "Resend invitation",
                        icon: context.member.status === "expired" ? RefreshCw : Send,
                        onSelect: () => {
                          onResend(context.member);
                          setContext(null);
                        },
                      },
                      {
                        key: "revoke",
                        label: "Revoke invitation",
                        icon: X,
                        onSelect: () => {
                          onRevoke(context.member);
                          setContext(null);
                        },
                      },
                    ]),
                {
                  key: "remove",
                  label: "Remove from organization",
                  icon: Trash2,
                  destructive: true,
                  separatorBefore: true,
                  onSelect: () => {
                    onRemove(context.member);
                    setContext(null);
                  },
                },
              ]
            : []
        }
      />
    </>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "py-2 pr-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-text-subtle",
        className,
      )}
    >
      {children}
    </th>
  );
}

/**
 * Avatar.
 *
 * Initials when a name exists; a mail glyph for a pending invitation, because
 * "P" for priya@… is a guess and pending rows should look pending.
 */
export function MemberAvatar({ member, size = "md" }: { member: Member; size?: "sm" | "md" }) {
  const dimension = size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]";

  if (member.status !== "active" || !member.name) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-dashed",
          member.status === "failed"
            ? "border-[#E5B4B4] bg-[#FDF3F2] text-[#C93B2B]"
            : "border-[#CFDAF0] bg-[var(--brand-canvas)] text-text-subtle",
          dimension,
        )}
        aria-hidden="true"
      >
        {member.status === "expired" || member.status === "failed" ? (
          <Clock className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <Send className="h-3 w-3" strokeWidth={2} />
        )}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8B5CF6,#3178FB)] font-bold text-white",
        dimension,
      )}
      aria-hidden="true"
    >
      {initialsOf(member.name)}
    </span>
  );
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Mobile presentation: one card per member. */
export function MemberCard({
  member,
  onOpen,
}: {
  member: Member;
  onOpen: (member: Member, anchor: HTMLElement) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-white p-3">
      <div className="flex items-start gap-2.5">
        <MemberAvatar member={member} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-ink">
              {member.name ?? member.email.split("@")[0]}
            </span>
            {member.isViewer && (
              <span className="shrink-0 rounded bg-[var(--brand-surface-muted)] px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-text-subtle">
                You
              </span>
            )}
          </p>
          <p className="truncate text-[11px] text-text-subtle">{member.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <RoleBadge role={member.role} />
            <MemberStatusPill status={member.status} />
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-text-subtle">
            {MEMBER_STATUS_HINT[member.status]}
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => onOpen(member, event.currentTarget)}
          aria-label={`Actions for ${member.name ?? member.email}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--brand-border)] text-text-subtle transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
