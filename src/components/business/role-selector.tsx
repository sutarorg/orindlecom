"use client";

import * as React from "react";
import { Check, Info } from "lucide-react";
import { ROLES, canAssignRole, roleDefinition } from "@/lib/business/roles";
import { ROLE_RANK, type BusinessRole } from "@/lib/business/types";
import { cn } from "@/lib/utils";

/**
 * Role selector.
 *
 * Two presentations of the same decision:
 *
 *  - `radio` — a full list with a description per role. Used in the invite
 *    modal and the change-role dialog, where the choice is the point of the
 *    screen and getting it wrong has consequences.
 *  - `compact` — a segmented control for a table row, where the role is already
 *    visible and only needs adjusting.
 *
 * Roles the viewer cannot assign are shown but disabled, with the reason in the
 * description. Hiding them would leave a person wondering why "Owner" isn't
 * offered; showing a disabled option that explains itself answers the question
 * before it's asked.
 */
export function RoleSelector({
  value,
  onChange,
  actorRole,
  variant = "radio",
  excludeRoles = [],
  name = "role",
  className,
}: {
  value: BusinessRole;
  onChange: (role: BusinessRole) => void;
  /** The role of the person making the choice. Bounds what's assignable. */
  actorRole: BusinessRole;
  variant?: "radio" | "compact";
  /** Roles that make no sense in this context, e.g. the member's current role. */
  excludeRoles?: BusinessRole[];
  name?: string;
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <CompactRoleSelector
        value={value}
        onChange={onChange}
        actorRole={actorRole}
        excludeRoles={excludeRoles}
        className={className}
      />
    );
  }

  const options = ROLES.filter((role) => !excludeRoles.includes(role.id)).sort(
    (a, b) => ROLE_RANK[b.id] - ROLE_RANK[a.id],
  );

  return (
    <div className={cn("space-y-1.5", className)} role="radiogroup" aria-label="Role">
      {options.map((role) => {
        const assignable = canAssignRole(actorRole, role.id);
        const selected = value === role.id;
        return (
          <label
            key={role.id}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition-colors",
              selected
                ? "border-primary bg-primary-soft/50 ring-1 ring-primary/25"
                : "border-[var(--brand-border)] hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-canvas)]",
              !assignable && "cursor-not-allowed opacity-60 hover:border-[var(--brand-border)] hover:bg-transparent",
            )}
          >
            <input
              type="radio"
              name={name}
              value={role.id}
              checked={selected}
              disabled={!assignable}
              onChange={() => onChange(role.id)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--brand-primary)]"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-semibold text-ink">{role.name}</span>
                {selected && (
                  <Check className="h-3 w-3 text-primary" strokeWidth={3} aria-hidden="true" />
                )}
                {!assignable && (
                  <span className="rounded bg-[var(--brand-surface-muted)] px-1 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.04em] text-text-subtle">
                    Not assignable
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-text-muted">
                {assignable ? role.summary : `Only an owner can assign ${role.name.toLowerCase()}.`}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function CompactRoleSelector({
  value,
  onChange,
  actorRole,
  excludeRoles,
  className,
}: {
  value: BusinessRole;
  onChange: (role: BusinessRole) => void;
  actorRole: BusinessRole;
  excludeRoles: BusinessRole[];
  className?: string;
}) {
  const options = ROLES.filter((role) => !excludeRoles.includes(role.id)).sort(
    (a, b) => ROLE_RANK[b.id] - ROLE_RANK[a.id],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Role"
      className={cn("inline-flex rounded-lg border border-[var(--brand-border)] bg-white p-0.5", className)}
    >
      {options.map((role) => {
        const assignable = canAssignRole(actorRole, role.id);
        const selected = value === role.id;
        return (
          <button
            key={role.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!assignable}
            onClick={() => onChange(role.id)}
            title={assignable ? roleDefinition(role.id).summary : `Only an owner can assign ${role.name.toLowerCase()}`}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selected
                ? "bg-primary text-white shadow-[0_1px_2px_rgba(23,29,58,0.12)]"
                : "text-text-muted hover:bg-[var(--brand-surface-muted)] hover:text-ink",
              !assignable && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-text-muted",
            )}
          >
            {role.name}
          </button>
        );
      })}
    </div>
  );
}

/** Explanatory note used wherever a role boundary needs stating inline. */
export function RoleBoundaryNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-[var(--brand-canvas)] px-2.5 py-2 text-[10.5px] leading-relaxed text-text-muted">
      <Info className="mt-px h-3 w-3 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
