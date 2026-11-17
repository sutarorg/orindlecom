"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Folder, Loader2, Mail, Send } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/drive/client";
import { can } from "@/lib/business/roles";
import {
  FOLDER_ACCESS_DESCRIPTION,
  FOLDER_ACCESS_LABEL,
  INVITATION_EXPIRY_DAYS,
  type BusinessFolder,
  type BusinessRole,
  type FolderAccess,
  type Member,
} from "@/lib/business/types";
import { RoleBoundaryNote, RoleSelector } from "./role-selector";
import { cn } from "@/lib/utils";

/**
 * Invitation modal.
 *
 * The role is chosen here by an Owner or Admin and persisted on the invitation
 * via `POST /api/organizations/:id/members`.
 */
export function InviteDialog({
  open,
  onClose,
  organizationId = "workspace",
  actorRole,
  folders,
  defaultFolderId,
}: {
  open: boolean;
  onClose: () => void;
  organizationId?: string;
  actorRole: BusinessRole;
  folders: BusinessFolder[];
  defaultFolderId?: string | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Exclude<BusinessRole, "owner">>("member");
  const [folderId, setFolderId] = React.useState<string>("");
  const [access, setAccess] = React.useState<FolderAccess>("commenter");
  const [error, setError] = React.useState<string | undefined>();
  const [pending, setPending] = React.useState(false);
  const emailId = React.useId();
  const folderId$ = React.useId();

  React.useEffect(() => {
    if (open) {
      setEmail("");
      setRole("member");
      setFolderId(defaultFolderId ?? "");
      setAccess("commenter");
      setError(undefined);
      setPending(false);
    }
  }, [open, defaultFolderId]);

  const canAttachFolder = can(actorRole, "folders.manageAccess") && folders.length > 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) return setError("Enter an email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      return setError("Enter an email address we can send to.");
    }

    setError(undefined);
    setPending(true);

    const result = await api.post<{ member: Member }>(
      `/api/organizations/${encodeURIComponent(organizationId)}/members`,
      {
        email: trimmed,
        role,
        folderId: folderId || null,
        folderAccess: folderId ? access : undefined,
      },
    );

    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    toast({
      tone: "success",
      title: `Invited ${trimmed}`,
      description: `Invitation sent as ${role}. Expires in ${INVITATION_EXPIRY_DAYS} days.`,
    });
    onClose();
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite a member"
      description="They'll get an email with a link to join. You choose their role now — they can't change it."
      size="md"
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor={emailId} className="mb-1.5 block text-[12px] font-semibold text-ink">
          Email address
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle"
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(undefined);
            }}
            placeholder="teammate@company.com"
            autoComplete="email"
            data-autofocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${emailId}-error` : `${emailId}-hint`}
            className={cn(
              "h-9 w-full rounded-lg border bg-white pl-8 pr-2.5 text-[12.5px] text-ink placeholder:text-text-subtle",
              "focus:outline-none focus:ring-[3px]",
              error
                ? "border-[#D6455D] focus:border-[#D6455D] focus:ring-[rgba(214,69,93,0.16)]"
                : "border-[var(--brand-border-strong)] focus:border-primary focus:ring-[rgba(49,120,251,0.16)]",
            )}
          />
        </div>
        {error ? (
          <p id={`${emailId}-error`} role="alert" className="mt-1.5 text-[11px] font-medium text-[#C93B2B]">
            {error}
          </p>
        ) : (
          <p id={`${emailId}-hint`} className="mt-1.5 text-[10.5px] text-text-subtle">
            One address at a time. Invitations expire after {INVITATION_EXPIRY_DAYS} days.
          </p>
        )}

        <div className="mt-4">
          <p className="mb-1.5 text-[12px] font-semibold text-ink">Role</p>
          <RoleSelector
            value={role}
            onChange={(next) => setRole(next as Exclude<BusinessRole, "owner">)}
            actorRole={actorRole}
            excludeRoles={["owner"]}
            name="invite-role"
          />
        </div>

        {canAttachFolder && (
          <div className="mt-4 rounded-xl border border-[var(--brand-border)] p-2.5">
            <label
              htmlFor={folderId$}
              className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-ink"
            >
              <Folder className="h-3 w-3 text-text-subtle" strokeWidth={2.1} aria-hidden="true" />
              Folder access
              <span className="font-normal text-text-subtle">(optional)</span>
            </label>
            <div className="flex gap-1.5">
              <select
                id={folderId$}
                value={folderId}
                onChange={(event) => setFolderId(event.target.value)}
                className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--brand-border-strong)] bg-white px-1.5 text-[11.5px] text-ink focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]"
              >
                <option value="">No folder — team default applies</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              {folderId && (
                <select
                  value={access}
                  onChange={(event) => setAccess(event.target.value as FolderAccess)}
                  aria-label="Folder access level"
                  className="h-8 rounded-lg border border-[var(--brand-border-strong)] bg-white px-1.5 text-[11.5px] font-medium text-ink focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]"
                >
                  {(Object.keys(FOLDER_ACCESS_LABEL) as FolderAccess[]).map((level) => (
                    <option key={level} value={level}>
                      {FOLDER_ACCESS_LABEL[level]}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-text-subtle">
              {folderId
                ? FOLDER_ACCESS_DESCRIPTION[access]
                : "Leave empty and they get the team's default access on shared folders."}
            </p>
          </div>
        )}

        <div className="mt-3">
          <RoleBoundaryNote>
            Invitations can be sent as Admin or Member, never as Owner. Ownership is transferred from
            Members or Settings, and only by the current owner.
          </RoleBoundaryNote>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} aria-hidden="true" />
            ) : (
              <Send className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
            )}
            {pending ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
