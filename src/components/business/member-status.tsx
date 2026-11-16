import { CheckCircle2, Clock, MailX, AlertTriangle, PauseCircle } from "lucide-react";
import { MEMBER_STATUS_HINT, MEMBER_STATUS_LABEL, type MemberStatus } from "@/lib/business/types";
import { cn } from "@/lib/utils";

/**
 * Member status pill.
 *
 * Status is the second thing anyone looks at after the name, because "invited"
 * and "active" are operationally different: one needs a nudge, the other
 * doesn't. Each carries its own colour so the table can be scanned without
 * reading a single word.
 */
const STYLES: Record<
  MemberStatus,
  { className: string; dot: string; icon: typeof Clock }
> = {
  active: {
    className: "text-[#1B8A57] bg-[#F1FBF6] border-[#CBEBD9]",
    dot: "bg-[#34C77B]",
    icon: CheckCircle2,
  },
  invited: {
    className: "text-[#1E56C9] bg-primary-soft border-[#CFE0FF]",
    dot: "bg-primary",
    icon: Clock,
  },
  expired: {
    className: "text-[#96610B] bg-[#FEF7EA] border-[#F6E2BC]",
    dot: "bg-[#F9A53B]",
    icon: AlertTriangle,
  },
  failed: {
    className: "text-[#C93B2B] bg-[#FDF3F2] border-[#F3D2CD]",
    dot: "bg-[#E0533D]",
    icon: MailX,
  },
  suspended: {
    className: "text-text-muted bg-[var(--brand-surface-muted)] border-[var(--brand-border)]",
    dot: "bg-text-subtle",
    icon: PauseCircle,
  },
};

export function MemberStatusPill({
  status,
  showHint = false,
}: {
  status: MemberStatus;
  showHint?: boolean;
}) {
  const style = STYLES[status];
  const Icon = style.icon;
  return (
    <span className="inline-flex items-center gap-1" title={showHint ? MEMBER_STATUS_HINT[status] : undefined}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
          style.className,
        )}
      >
        <Icon className="h-2.5 w-2.5" strokeWidth={2.4} aria-hidden="true" />
        {MEMBER_STATUS_LABEL[status]}
      </span>
    </span>
  );
}

/** A bare dot for dense rows where the pill would be too loud. */
export function MemberStatusDot({ status }: { status: MemberStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={MEMBER_STATUS_HINT[status]}>
      <span className={cn("h-1.5 w-1.5 rounded-full", STYLES[status].dot)} aria-hidden="true" />
      <span className="text-[11.5px] text-text">{MEMBER_STATUS_LABEL[status]}</span>
    </span>
  );
}
