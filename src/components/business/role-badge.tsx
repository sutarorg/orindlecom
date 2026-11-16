import { ShieldCheck, Shield, UserRound } from "lucide-react";
import { roleName } from "@/lib/business/roles";
import type { BusinessRole } from "@/lib/business/types";
import { cn } from "@/lib/utils";

/**
 * Role badge.
 *
 * Three roles need to be distinguishable at a glance in a table without
 * becoming a traffic light. Owner is the only one that reads as special, because
 * it is the only one that can't be granted by an admin — the other two differ in
 * scope, not in prestige, so they get quieter treatment.
 */
const STYLES: Record<BusinessRole, { className: string; icon: typeof Shield }> = {
  owner: {
    className: "bg-[#F3EEFE] text-[#6B3FC4] border-[#E2D7FB]",
    icon: ShieldCheck,
  },
  admin: {
    className: "bg-primary-soft text-[#1E56C9] border-[#CFE0FF]",
    icon: Shield,
  },
  member: {
    className: "bg-[var(--brand-surface-muted)] text-text-muted border-[var(--brand-border)]",
    icon: UserRound,
  },
};

export function RoleBadge({
  role,
  size = "sm",
  className,
}: {
  role: BusinessRole;
  size?: "sm" | "md";
  className?: string;
}) {
  const style = STYLES[role];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        style.className,
        className,
      )}
    >
      <Icon
        className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"}
        strokeWidth={2.3}
        aria-hidden="true"
      />
      {roleName(role)}
    </span>
  );
}
