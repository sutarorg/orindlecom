"use client";

import * as React from "react";
import { Check, Info, Lock, Minus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { ROLES, can } from "@/lib/business/roles";
import { ROLE_RANK, type BusinessRole, type Capability } from "@/lib/business/types";
import { RoleBadge } from "./role-badge";
import { cn } from "@/lib/utils";

/**
 * Roles and permissions.
 *
 * One matrix, because the question this page answers is comparative: "what is
 * the difference between an admin and a member". Three prose cards would make
 * that comparison the reader's job.
 *
 * Every cell is a real capability check against the same `roles.ts` that the
 * selectors and guards use — this table cannot drift from the enforcement
 * because it is not a copy of it.
 */

interface CapabilityGroup {
  label: string;
  description: string;
  items: Array<{ capability: Capability; label: string; note?: string }>;
}

const GROUPS: CapabilityGroup[] = [
  {
    label: "Members",
    description: "Who is on the team, and what they're allowed to change about it.",
    items: [
      { capability: "members.view", label: "See everyone on the team" },
      { capability: "members.invite", label: "Invite new members" },
      { capability: "members.changeRole", label: "Change someone's role", note: "Up to their own role" },
      { capability: "members.remove", label: "Remove members", note: "Below their own role only" },
      { capability: "members.transferOwnership", label: "Transfer ownership", note: "Owner only, by design" },
    ],
  },
  {
    label: "Shared folders",
    description: "What happens inside a folder the organization can reach.",
    items: [
      { capability: "folders.create", label: "Create folders" },
      { capability: "folders.manageAccess", label: "Change who can reach a folder" },
      { capability: "folders.delete", label: "Delete a folder and everything in it" },
    ],
  },
  {
    label: "Workspace",
    description: "The organization itself — its name, its plan, its existence.",
    items: [
      { capability: "storage.view", label: "See team storage" },
      { capability: "activity.view", label: "See the activity log" },
      { capability: "org.edit", label: "Edit organization settings" },
      { capability: "billing.manage", label: "Manage billing and the plan" },
      { capability: "org.delete", label: "Delete the organization" },
    ],
  },
];

export function PermissionsView({
  viewerRole,
  memberCounts,
}: {
  viewerRole: BusinessRole;
  memberCounts: Record<BusinessRole, number>;
}) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Roles & permissions"
        description="Three roles, one ladder. What each one can do is fixed — it isn't a per-folder setting."
        className="mb-4"
      />

      {/* Role cards — the summary, before the matrix */}
      <ul className="mb-4 grid gap-3 md:grid-cols-3">
        {[...ROLES].sort((a, b) => ROLE_RANK[b.id] - ROLE_RANK[a.id]).map((role) => {
          const count = memberCounts[role.id] ?? 0;
          const isViewer = role.id === viewerRole;
          return (
            <li
              key={role.id}
              className={cn(
                "rounded-2xl border bg-white p-3.5",
                isViewer ? "border-primary ring-1 ring-primary/20" : "border-[var(--brand-border)]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <RoleBadge role={role.id} size="md" />
                {isViewer && (
                  <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.05em] text-primary">
                    Your role
                  </span>
                )}
              </div>
              <p className="mt-2 text-[12px] font-medium leading-relaxed text-text">{role.summary}</p>
              <p className="mt-1.5 text-[10.5px] text-text-subtle">
                {count} {count === 1 ? "person" : "people"}
                {role.id === "owner" && count === 1 ? " · exactly one" : ""}
              </p>
            </li>
          );
        })}
      </ul>

      {/* The matrix */}
      <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
        <div className="border-b border-[var(--brand-border-soft)] px-4 py-3">
          <h2 className="text-[13px] font-bold tracking-[-0.02em] text-ink">What each role can do</h2>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Every row is enforced by the backend. Nothing here is advisory.
          </p>
        </div>

        <div className="overflow-x-auto [contain:paint]">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <caption className="sr-only">Capabilities by role</caption>
            <thead>
              <tr className="bg-[var(--brand-canvas)]">
                <th scope="col" className="py-2 pl-4 pr-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-text-subtle">
                  Capability
                </th>
                {[...ROLES].sort((a, b) => ROLE_RANK[b.id] - ROLE_RANK[a.id]).map((role) => (
                  <th
                    key={role.id}
                    scope="col"
                    className="w-[92px] py-2 px-2 text-center text-[10px] font-semibold uppercase tracking-[0.07em] text-text-subtle"
                  >
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) => (
                <React.Fragment key={group.label}>
                  <tr className="border-t border-[var(--brand-border)]">
                    <th
                      scope="colgroup"
                      colSpan={4}
                      className="bg-[var(--brand-surface-muted)]/60 px-4 py-1.5 text-left"
                    >
                      <span className="text-[11px] font-bold text-ink">{group.label}</span>
                      <span className="ml-1.5 text-[10.5px] font-normal text-text-subtle">
                        {group.description}
                      </span>
                    </th>
                  </tr>
                  {group.items.map((item) => (
                    <tr
                      key={item.capability}
                      className="border-t border-[var(--brand-border-soft)] transition-colors hover:bg-[var(--brand-surface-muted)]/40"
                    >
                      <th scope="row" className="py-2 pl-4 pr-2 text-left font-normal">
                        <span className="block text-[11.5px] text-text">{item.label}</span>
                        {item.note && (
                          <span className="block text-[10px] text-text-subtle">{item.note}</span>
                        )}
                      </th>
                      {[...ROLES].sort((a, b) => ROLE_RANK[b.id] - ROLE_RANK[a.id]).map((role) => {
                        const allowed = can(role.id, item.capability);
                        return (
                          <td key={role.id} className="px-2 py-2 text-center">
                            <span className="inline-flex items-center justify-center">
                              {allowed ? (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F1FBF6] text-[#1B8A57]">
                                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                                </span>
                              ) : (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-surface-muted)] text-text-subtle">
                                  <Minus className="h-3 w-3" strokeWidth={2.6} aria-hidden="true" />
                                </span>
                              )}
                              <span className="sr-only">
                                {allowed ? "Allowed" : "Not allowed"} for {role.name}
                              </span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Boundaries — the rules that aren't visible in the matrix */}
      <section className="mt-4 rounded-2xl border border-[var(--brand-border)] bg-white">
        <div className="border-b border-[var(--brand-border-soft)] px-4 py-3">
          <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink">
            <Lock className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
            Access boundaries
          </h2>
        </div>
        <ul className="divide-y divide-[var(--brand-border-soft)]">
          {[
            {
              title: "Exactly one owner, always",
              body: "Ownership isn't granted alongside another role — it's transferred. Handing it over makes you an admin in the same moment, so the organization is never ownerless or double-owned.",
            },
            {
              title: "Nobody can promote past their own role",
              body: "An admin can't create another owner, and a member can't change anyone's role at all. Without this, roles would be a suggestion rather than a boundary.",
            },
            {
              title: "You can't change your own role",
              body: "Self-promotion is impossible by construction. Only somebody above you can move you, which makes every privilege escalation a two-person event.",
            },
            {
              title: "Removal doesn't touch personal files",
              body: "Removing somebody from the organization revokes their access to shared folders. Anything in their own workspace stays theirs.",
            },
            {
              title: "Folder access is per folder",
              body: "A member might reach one folder and not another. Access is set on each folder rather than inherited from a team-wide policy.",
            },
          ].map((boundary) => (
            <li key={boundary.title} className="px-4 py-3">
              <p className="flex items-start gap-1.5 text-[12px] font-semibold text-ink">
                <ShieldCheck
                  className="mt-px h-3.5 w-3.5 shrink-0 text-primary"
                  strokeWidth={2.1}
                  aria-hidden="true"
                />
                {boundary.title}
              </p>
              <p className="mt-1 max-w-[640px] pl-5 text-[11.5px] leading-relaxed text-text-muted">
                {boundary.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-text-subtle">
        <Info className="mt-px h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
        Roles are not configurable yet. A custom-role builder needs a permission store the backend
        already reads, and shipping a builder before that would produce roles that look real and
        enforce nothing.
      </p>
    </div>
  );
}
