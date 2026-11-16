"use client";

import * as React from "react";
import { Globe, Loader2, Search, Users, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { BUSINESS_NOT_CONNECTED } from "@/lib/business/repository";
import {
  FOLDER_ACCESS_DESCRIPTION,
  FOLDER_ACCESS_LABEL,
  type BusinessFolder,
  type FolderAccess,
  type Member,
} from "@/lib/business/types";
import { MemberAvatar } from "./member-table";
import { cn } from "@/lib/utils";

/**
 * Folder permissions dialog.
 *
 * Two halves, because folder access has two mechanisms and conflating them is
 * how shared drives leak:
 *
 *   1. **Organization-wide** — is this folder visible to everyone, and at what
 *      level by default. One switch and one selector.
 *   2. **Per-member overrides** — specific people at a different level than the
 *      default.
 *
 * The dialog works on a draft and saves on confirm, so an admin can adjust
 * several people without each click firing a request. Pending changes are
 * counted on the save button, so it's obvious when there's something to save.
 */
export function FolderAccessDialog({
  folder,
  members,
  onClose,
}: {
  folder: BusinessFolder | null;
  members: Member[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [openToOrg, setOpenToOrg] = React.useState(true);
  const [defaultAccess, setDefaultAccess] = React.useState<FolderAccess>("viewer");
  const [grants, setGrants] = React.useState<Record<string, FolderAccess>>({});
  const [search, setSearch] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!folder) return;
    setOpenToOrg(folder.openToOrganization);
    setDefaultAccess(folder.defaultAccess);
    setGrants(Object.fromEntries(folder.access.map((entry) => [entry.memberId, entry.access])));
    setSearch("");
    setPending(false);
  }, [folder]);

  if (!folder) return <Dialog open={false} onClose={onClose} title="Folder access" />;

  /**
   * Count real differences against the saved state, not the size of the draft.
   * Counting draft entries reported a fresh dialog as "3 unsaved changes" on any
   * folder that already had overrides, which taught people to ignore the counter.
   */
  const original = React.useMemo(
    () => Object.fromEntries(folder.access.map((entry) => [entry.memberId, entry.access])),
    [folder],
  );

  const grantChanges = React.useMemo(() => {
    const ids = new Set([...Object.keys(original), ...Object.keys(grants)]);
    let count = 0;
    for (const id of ids) {
      if (original[id] !== grants[id]) count += 1;
    }
    return count;
  }, [original, grants]);

  const changes =
    (folder.openToOrganization !== openToOrg ? 1 : 0) +
    (folder.defaultAccess !== defaultAccess ? 1 : 0) +
    grantChanges;

  const activeMembers = members.filter((member) => member.status === "active");
  const needle = search.trim().toLowerCase();
  const visible = needle
    ? activeMembers.filter(
        (member) =>
          (member.name ?? "").toLowerCase().includes(needle) ||
          member.email.toLowerCase().includes(needle),
      )
    : activeMembers;

  const setGrant = (memberId: string, access: FolderAccess) =>
    setGrants((current) => ({ ...current, [memberId]: access }));

  const removeGrant = (memberId: string) =>
    setGrants((current) => {
      const next = { ...current };
      delete next[memberId];
      return next;
    });

  const save = async () => {
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 550));
    setPending(false);
    toast({
      tone: "error",
      title: "Access wasn't changed",
      description: BUSINESS_NOT_CONNECTED,
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Access to “${folder.name}”`}
      description="Who can open this folder, and what they can do inside it."
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10.5px] text-text-subtle" aria-live="polite">
            {changes === 0 ? "No changes" : `${changes} unsaved ${changes === 1 ? "change" : "changes"}`}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={changes === 0 || pending}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} aria-hidden="true" />}
              Save access
            </button>
          </div>
        </div>
      }
    >
      {/* Organization-wide */}
      <section className="rounded-xl border border-[var(--brand-border)] p-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Globe className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={openToOrg}
                onChange={(event) => setOpenToOrg(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-primary)]"
              />
              <span>
                <span className="block text-[12.5px] font-semibold text-ink">
                  Open to everyone in the organization
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-text-muted">
                  {openToOrg
                    ? "Every active member can reach this folder at the level below."
                    : "Only the people listed further down can reach this folder."}
                </span>
              </span>
            </label>

            {openToOrg && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(Object.keys(FOLDER_ACCESS_LABEL) as FolderAccess[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDefaultAccess(level)}
                    aria-pressed={defaultAccess === level}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      defaultAccess === level
                        ? "border-primary bg-primary-soft text-primary-ink"
                        : "border-[var(--brand-border)] bg-white text-text-muted hover:bg-[var(--brand-surface-muted)] hover:text-ink",
                    )}
                  >
                    {FOLDER_ACCESS_LABEL[level]}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-text-subtle">
              {FOLDER_ACCESS_DESCRIPTION[defaultAccess]}
            </p>
          </div>
        </div>
      </section>

      {/* Per-member */}
      <section className="mt-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
            <Users className="h-3 w-3 text-text-subtle" strokeWidth={2.1} aria-hidden="true" />
            Individual access
          </h3>
          <span className="text-[10.5px] text-text-subtle">
            {Object.keys(grants).length} {Object.keys(grants).length === 1 ? "person" : "people"}
          </span>
        </div>

        {activeMembers.length === 0 ? (
          <p className="rounded-lg bg-[var(--brand-canvas)] px-3 py-3 text-[11.5px] leading-relaxed text-text-muted">
            Nobody has accepted an invitation yet. Once teammates join, you can give them access to
            specific folders here.
          </p>
        ) : (
          <>
            {/* Search, once there are enough people to need it. */}
            {activeMembers.length > 6 && (
              <div className="relative mb-1.5">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle"
                  strokeWidth={2.1}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a member…"
                  aria-label="Find a member to grant access"
                  className="h-8 w-full rounded-lg border border-[var(--brand-border)] bg-white pl-8 pr-8 text-[11.5px] text-ink placeholder:text-text-subtle focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.14)] [&::-webkit-search-cancel-button]:hidden"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear member search"
                    className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-text-subtle hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <X className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            <ul className="max-h-[240px] space-y-1 overflow-y-auto pr-0.5">
              {visible.map((member) => {
                const grant = grants[member.id];
                return (
                  <li
                    key={member.id}
                    className="flex items-center gap-2 rounded-lg border border-[var(--brand-border-soft)] px-2 py-1.5"
                  >
                    <MemberAvatar member={member} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-medium text-ink">
                        {member.name ?? member.email}
                      </span>
                      <span className="block truncate text-[10px] text-text-subtle">
                        {member.email}
                      </span>
                    </span>

                    {grant ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <select
                          value={grant}
                          onChange={(event) => setGrant(member.id, event.target.value as FolderAccess)}
                          aria-label={`Access level for ${member.name ?? member.email}`}
                          className="h-7 rounded-md border border-[var(--brand-border-strong)] bg-white px-1 text-[10.5px] font-medium text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-[rgba(49,120,251,0.16)]"
                        >
                          {(Object.keys(FOLDER_ACCESS_LABEL) as FolderAccess[]).map((level) => (
                            <option key={level} value={level}>
                              {FOLDER_ACCESS_LABEL[level]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeGrant(member.id)}
                          aria-label={`Remove individual access for ${member.name ?? member.email}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-[#FDF3F2] hover:text-[#C93B2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <X className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setGrant(member.id, "viewer")}
                        className="shrink-0 rounded-md border border-[var(--brand-border)] bg-white px-2 py-1 text-[10.5px] font-semibold text-text-muted transition-colors hover:border-[var(--brand-border-strong)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Give access
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {visible.length === 0 && (
              <p className="rounded-lg bg-[var(--brand-canvas)] px-3 py-2.5 text-[11px] text-text-muted">
                No member matches “{search}”.
              </p>
            )}
          </>
        )}
      </section>
    </Dialog>
  );
}
