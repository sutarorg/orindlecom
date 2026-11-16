"use client";

import * as React from "react";
import { Activity, Search, SearchX, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { BUSINESS_EVENT_LABEL, type BusinessActivityEvent, type BusinessEventKind } from "@/lib/business/types";
import { ActivityTimeline } from "./activity-timeline";
import { cn } from "@/lib/utils";

/**
 * Activity log.
 *
 * Filterable by event family rather than by generated timestamp buckets — the
 * things people come here for are "who was removed" and "what changed access",
 * not "what happened on the 14th".
 *
 * Search matches the actor and the target, which covers both readings of "find
 * the thing where Priya..." without needing a separate field.
 */

const FAMILIES: Array<{ key: string; label: string; kinds: BusinessEventKind[] }> = [
  { key: "all", label: "Everything", kinds: [] },
  { key: "members", label: "Members", kinds: ["member.invited", "member.joined", "member.removed", "member.roleChanged"] },
  { key: "invitations", label: "Invitations", kinds: ["invitation.resent", "invitation.revoked"] },
  { key: "folders", label: "Folders", kinds: ["folder.created", "folder.accessChanged", "folder.deleted"] },
  { key: "files", label: "Files", kinds: ["file.uploaded", "file.deleted"] },
  { key: "workspace", label: "Workspace", kinds: ["settings.changed"] },
];

export function ActivityView({
  events,
  canFilter,
}: {
  events: BusinessActivityEvent[];
  canFilter: boolean;
}) {
  const [family, setFamily] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const familyKinds = FAMILIES.find((entry) => entry.key === family)?.kinds ?? [];
  const needle = search.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    return events.filter((event) => {
      if (familyKinds.length > 0 && !familyKinds.includes(event.kind)) return false;
      if (!needle) return true;
      return (
        (event.actorName ?? "").toLowerCase().includes(needle) ||
        (event.actorEmail ?? "").toLowerCase().includes(needle) ||
        event.targetName.toLowerCase().includes(needle) ||
        BUSINESS_EVENT_LABEL[event.kind].toLowerCase().includes(needle)
      );
    });
  }, [events, familyKinds, needle]);

  const counts = React.useMemo(() => {
    const map: Record<string, number> = { all: events.length };
    for (const entry of FAMILIES) {
      if (entry.kinds.length === 0) continue;
      map[entry.key] = events.filter((event) => entry.kinds.includes(event.kind)).length;
    }
    return map;
  }, [events]);

  const isFiltered = family !== "all" || search.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Activity"
        description="Everything that's changed in this organization, newest first."
        className="mb-4"
      />

      {events.length === 0 ? (
        <div className="rounded-xl border border-[var(--brand-border)] bg-white">
          <EmptyState
            className="min-h-[320px] justify-center sm:min-h-[380px]"
            variant="first-use"
            icon={Activity}
            title="Nothing has happened yet."
            description="Inviting a member, creating a shared folder, changing access — every one of those lands here with who did it and when. Nothing is backfilled."
            footnote="This log starts at the organization's first event. It isn't reconstructed after the fact."
          />
        </div>
      ) : (
        <>
          {canFilter && (
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-[280px]">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle"
                  strokeWidth={2.1}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search people or resources…"
                  aria-label="Search activity"
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

              <div
                role="tablist"
                aria-label="Filter by event type"
                className="flex shrink-0 gap-0.5 overflow-x-auto rounded-lg border border-[var(--brand-border)] bg-white p-0.5"
              >
                {FAMILIES.map((entry) => {
                  const count = counts[entry.key] ?? 0;
                  if (entry.key !== "all" && count === 0) return null;
                  const active = family === entry.key;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFamily(entry.key)}
                      className={cn(
                        "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11.5px] font-semibold transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        active
                          ? "bg-[var(--brand-surface-muted)] text-ink"
                          : "text-text-muted hover:bg-[var(--brand-surface-muted)]/60 hover:text-ink",
                      )}
                    >
                      {entry.label}
                      <span className="tabular-nums text-[10px] text-text-subtle">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-[var(--brand-border)] bg-white">
              <EmptyState
                className="min-h-[280px] justify-center"
                variant="collection"
                icon={SearchX}
                title="No activity matches"
                description="Nothing in the log matches that search or filter. The full history is still there."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setFamily("all");
                      setSearch("");
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
              <ActivityTimeline events={filtered} />
              {isFiltered && (
                <p className="mt-2 text-[11px] text-text-subtle" aria-live="polite">
                  Showing {filtered.length} of {events.length} events
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
