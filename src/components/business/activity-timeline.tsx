"use client";

import * as React from "react";
import {
  Activity,
  FolderPlus,
  FolderX,
  Mail,
  MailX,
  Settings2,
  ShieldCheck,
  Upload,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { formatDate, formatRelative } from "@/lib/drive/format";
import {
  BUSINESS_EVENT_LABEL,
  type BusinessActivityEvent,
  type BusinessEventKind,
} from "@/lib/business/types";
import { cn } from "@/lib/utils";

/**
 * Activity timeline.
 *
 * Grouped by day, because "what happened today" is the question people actually
 * bring to an audit log — a flat list sorted by timestamp makes them do that
 * grouping themselves.
 *
 * Every row states the actor, the verb, and the object in one sentence, so it
 * can be read aloud and still make sense. Icons and colour are reinforcement,
 * never the only carrier of meaning.
 */

const ICONS: Record<BusinessEventKind, typeof Activity> = {
  "member.invited": UserPlus,
  "member.joined": UserPlus,
  "member.removed": UserMinus,
  "member.roleChanged": ShieldCheck,
  "invitation.resent": Mail,
  "invitation.revoked": MailX,
  "folder.created": FolderPlus,
  "folder.accessChanged": ShieldCheck,
  "folder.deleted": FolderX,
  "file.uploaded": Upload,
  "file.deleted": FolderX,
  "settings.changed": Settings2,
};

/** Tone per event family: growth, neutral change, or loss. */
function tone(kind: BusinessEventKind): "positive" | "neutral" | "negative" {
  if (kind === "member.joined" || kind === "member.invited" || kind === "file.uploaded" || kind === "folder.created") {
    return "positive";
  }
  if (kind === "member.removed" || kind === "folder.deleted" || kind === "file.deleted" || kind === "invitation.revoked" || kind === "member.roleChanged") {
    return "negative";
  }
  return "neutral";
}

const TONE_CLASS = {
  positive: "bg-[#F1FBF6] text-[#1B8A57] ring-[#CBEBD9]",
  neutral: "bg-primary-soft text-primary ring-[#CFE0FF]",
  negative: "bg-[#FDF3F2] text-[#C93B2B] ring-[#F3D2CD]",
} as const;

export function ActivityTimeline({ events }: { events: BusinessActivityEvent[] }) {
  const groups = React.useMemo(() => groupByDay(events), [events]);

  return (
    <ol className="space-y-5">
      {groups.map((group) => (
        <li key={group.key}>
          <h3 className="sticky top-[60px] z-[1] -mx-1 mb-1.5 bg-[var(--brand-canvas)] px-1 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
            {group.label}
          </h3>
          <ul className="overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white">
            {group.events.map((event, index) => {
              const Icon = ICONS[event.kind];
              return (
                <li
                  key={event.id}
                  className={cn(
                    "flex items-start gap-2.5 px-3.5 py-2.5",
                    index > 0 && "border-t border-[var(--brand-border-soft)]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1",
                      TONE_CLASS[tone(event.kind)],
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="h-3 w-3" strokeWidth={2.2} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-relaxed text-text">
                      <span className="font-semibold text-ink">
                        {event.actorName ?? "Orindle"}
                      </span>{" "}
                      <span className="text-text-muted">
                        {BUSINESS_EVENT_LABEL[event.kind].toLowerCase()}
                      </span>{" "}
                      <span className="font-medium text-ink">{event.targetName}</span>
                      {event.detail && (
                        <span className="text-text-muted"> — {event.detail}</span>
                      )}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10.5px] text-text-subtle">
                      <time dateTime={event.at} title={formatDate(event.at)}>
                        {formatRelative(event.at)}
                      </time>
                      {event.actorEmail && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{event.actorEmail}</span>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function groupByDay(events: BusinessActivityEvent[]) {
  const groups: Array<{ key: string; label: string; events: BusinessActivityEvent[] }> = [];
  const now = new Date();

  for (const event of events) {
    const date = new Date(event.at);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
    const label = dayLabel(date, now);

    const existing = groups.find((group) => group.key === key);
    if (existing) existing.events.push(event);
    else groups.push({ key, label, events: [event] });
  }

  return groups;
}

/**
 * Day headings in UTC, matching the rest of the product's date formatting —
 * `toLocaleDateString` would disagree between server and client and produce a
 * hydration mismatch on the one screen that is pure timestamps.
 */
function dayLabel(date: Date, now: Date): string {
  const day = (d: Date) =>
    `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  const yesterday = new Date(now.getTime() - 86_400_000);

  if (day(date) === day(now)) return "Today";
  if (day(date) === day(yesterday)) return "Yesterday";
  return formatDate(date.toISOString());
}
