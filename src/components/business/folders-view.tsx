"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FolderLock,
  FolderPlus,
  Globe,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/dashboard/page-header";
import { api } from "@/lib/drive/client";
import { formatBytes, formatRelative } from "@/lib/drive/format";
import { can } from "@/lib/business/roles";
import { FOLDER_ACCESS_LABEL, type BusinessFolder, type BusinessRole, type Member } from "@/lib/business/types";
import { FolderAccessDialog } from "./folder-access-dialog";
import { cn } from "@/lib/utils";

export function FoldersView({
  organizationId = "workspace",
  folders,
  members,
  viewerRole,
}: {
  organizationId?: string;
  folders: BusinessFolder[];
  members: Member[];
  viewerRole: BusinessRole;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [accessTarget, setAccessTarget] = React.useState<BusinessFolder | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<BusinessFolder | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<BusinessFolder | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [context, setContext] = React.useState<{ folder: BusinessFolder; anchor: HTMLElement } | null>(
    null,
  );

  const canCreate = can(viewerRole, "folders.create");
  const canManage = can(viewerRole, "folders.manageAccess");
  const canDelete = can(viewerRole, "folders.delete");
  const baseUrl = `/api/organizations/${encodeURIComponent(organizationId)}/folders`;

  const handleCreate = async (name: string) => {
    const result = await api.post<{ folder: BusinessFolder }>(baseUrl, { name });
    if (!result.ok) {
      toast({ tone: "error", title: "Folder wasn't created", description: result.message });
      return false;
    }
    toast({ tone: "success", title: "Shared folder created", description: `“${name}” is ready.` });
    setCreateOpen(false);
    router.refresh();
    return true;
  };

  const handleRename = async (folder: BusinessFolder, name: string) => {
    const result = await api.patch<{ folder: BusinessFolder }>(
      `${baseUrl}/${encodeURIComponent(folder.id)}`,
      { name },
    );
    if (!result.ok) {
      toast({ tone: "error", title: "Folder wasn't renamed", description: result.message });
      return false;
    }
    toast({ tone: "success", title: "Folder renamed", description: `Renamed to “${name}”.` });
    setRenameTarget(null);
    router.refresh();
    return true;
  };

  const handleDelete = async (folder: BusinessFolder) => {
    setDeleteTarget(null);
    const result = await api.delete(`${baseUrl}/${encodeURIComponent(folder.id)}`);
    if (!result.ok) {
      toast({ tone: "error", title: "Folder wasn't deleted", description: result.message });
      return;
    }
    toast({ tone: "success", title: "Folder deleted", description: `“${folder.name}” was removed.` });
    router.refresh();
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Shared folders"
        description="Folders the team can reach. Access is set per folder, so a whole project can live in one place."
        action={
          canCreate ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <FolderPlus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
              New shared folder
            </button>
          ) : undefined
        }
        className="mb-4"
      />

      {folders.length === 0 ? (
        <div className="rounded-xl border border-[var(--brand-border)] bg-white">
          <EmptyState
            className="min-h-[320px] justify-center sm:min-h-[380px]"
            variant="first-use"
            icon={FolderLock}
            title="No shared folders yet."
            description={
              canCreate
                ? "A shared folder is where the team's work lives: everyone you choose can reach it, and you set what they can do. It isn't a copy — it's one folder with one set of rules."
                : "An owner or admin can create shared folders. Once they do, the ones you have access to appear here."
            }
            action={
              canCreate ? (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <FolderPlus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                  Create a shared folder
                </button>
              ) : undefined
            }
            footnote="Deleting a folder later doesn't delete the files people have already downloaded."
          />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {folders.map((folder) => (
            <li key={folder.id}>
              <FolderCard
                folder={folder}
                canManage={canManage}
                onOpenAccess={() => setAccessTarget(folder)}
                onOpenMenu={(anchor) => setContext({ folder, anchor })}
              />
            </li>
          ))}
        </ul>
      )}

      <Menu
        open={context !== null}
        onClose={() => setContext(null)}
        anchor={context?.anchor ?? null}
        label={context ? `Actions for ${context.folder.name}` : "Folder actions"}
        width={218}
        items={
          context
            ? [
                {
                  key: "access",
                  label: "Manage access",
                  icon: Settings2,
                  disabled: !canManage || !context.folder.canManage,
                  onSelect: () => {
                    setAccessTarget(context.folder);
                    setContext(null);
                  },
                },
                {
                  key: "rename",
                  label: "Rename",
                  icon: Pencil,
                  disabled: !canManage,
                  onSelect: () => {
                    setRenameTarget(context.folder);
                    setContext(null);
                  },
                },
                {
                  key: "delete",
                  label: "Delete folder",
                  icon: Trash2,
                  destructive: true,
                  separatorBefore: true,
                  disabled: !canDelete,
                  onSelect: () => {
                    setDeleteTarget(context.folder);
                    setContext(null);
                  },
                },
              ]
            : []
        }
      />

      <FolderAccessDialog
        organizationId={organizationId}
        folder={accessTarget}
        members={members}
        onClose={() => setAccessTarget(null)}
      />

      <NameFolderDialog
        folder={renameTarget}
        mode="rename"
        onClose={() => setRenameTarget(null)}
        onSubmit={async (name) => {
          if (renameTarget) await handleRename(renameTarget, name);
        }}
      />

      <NameFolderDialog
        folder={null}
        mode="create"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (name) => {
          await handleCreate(name);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void handleDelete(deleteTarget);
        }}
        title={`Delete “${deleteTarget?.name ?? ""}”?`}
        confirmLabel="Delete folder"
        destructive
        requireTyping={deleteTarget?.name}
      >
        Every file inside is removed for everyone in the organization.{" "}
        <strong className="font-semibold text-ink">This can&rsquo;t be undone.</strong> Type the folder
        name to confirm.
      </ConfirmDialog>
    </div>
  );
}

function FolderCard({
  folder,
  canManage,
  onOpenAccess,
  onOpenMenu,
}: {
  folder: BusinessFolder;
  canManage: boolean;
  onOpenAccess: () => void;
  onOpenMenu: (anchor: HTMLElement) => void;
}) {
  const overrideCount = folder.access.length;
  const totalPeople = folder.openToOrganization ? "Everyone" : `${overrideCount}`;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white transition-colors hover:border-[var(--brand-border-strong)]">
      <div className="flex items-start gap-2.5 p-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-primary"
          aria-hidden="true"
        >
          <FolderLock className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{folder.name}</p>
          <p className="mt-0.5 text-[10.5px] text-text-subtle">
            {folder.itemCount} {folder.itemCount === 1 ? "item" : "items"} · {formatBytes(folder.size)}
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => onOpenMenu(event.currentTarget)}
          aria-haspopup="menu"
          aria-label={`Actions for ${folder.name}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-auto border-t border-[var(--brand-border-soft)] px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {folder.openToOrganization ? (
            <Globe className="h-3 w-3 shrink-0 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Lock className="h-3 w-3 shrink-0 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          )}
          <p className="min-w-0 flex-1 truncate text-[11px] text-text">
            <span className="font-medium">{totalPeople}</span>
            {folder.openToOrganization && (
              <>
                {" · "}
                <span className="text-text-muted">{FOLDER_ACCESS_LABEL[folder.defaultAccess]}</span>
              </>
            )}
            {!folder.openToOrganization && overrideCount > 0 && " with access"}
          </p>
          {overrideCount > 0 && folder.openToOrganization && (
            <span className="shrink-0 rounded bg-[var(--brand-surface-muted)] px-1.5 py-0.5 text-[9.5px] font-semibold text-text-muted">
              +{overrideCount}
            </span>
          )}
        </div>

        {overrideCount > 0 && (
          <div className="mt-1.5 flex items-center gap-1">
            {folder.access.slice(0, 4).map((entry) => (
              <span
                key={entry.memberId}
                title={`${entry.name} · ${FOLDER_ACCESS_LABEL[entry.access]}`}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8B5CF6,#3178FB)] text-[8px] font-bold text-white ring-1 ring-white"
              >
                {entry.name.slice(0, 2).toUpperCase()}
              </span>
            ))}
            {overrideCount > 4 && (
              <span className="text-[9.5px] font-medium text-text-subtle">+{overrideCount - 4}</span>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] text-text-subtle">
            {folder.createdByName} · {formatRelative(folder.modifiedAt)}
          </span>
          <button
            type="button"
            onClick={onOpenAccess}
            disabled={!canManage || !folder.canManage}
            className={cn(
              "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              canManage && folder.canManage
                ? "border-[var(--brand-border)] bg-white text-text hover:border-[var(--brand-border-strong)] hover:text-ink"
                : "cursor-not-allowed border-transparent text-text-subtle",
            )}
          >
            <span className="flex items-center gap-1">
              <Users className="h-2.5 w-2.5" strokeWidth={2.4} aria-hidden="true" />
              Access
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function NameFolderDialog({
  folder,
  mode,
  open,
  onClose,
  onSubmit,
}: {
  folder: BusinessFolder | null;
  mode: "create" | "rename";
  open?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
}) {
  const isOpen = mode === "create" ? Boolean(open) : folder !== null;
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setName(mode === "rename" ? (folder?.name ?? "") : "");
      setError(undefined);
      setPending(false);
    }
  }, [isOpen, folder, mode]);

  const validate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter a folder name.";
    if (/[\\/:*?"<>|]/.test(trimmed)) return `A folder name can't contain \\ / : * ? " < > |`;
    if (trimmed.startsWith(".")) return "A folder name can't start with a dot.";
    if (trimmed.length > 120) return "Keep the name under 120 characters.";
    return undefined;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = validate(name);
    if (message) return setError(message);
    setPending(true);
    await onSubmit(name.trim());
    setPending(false);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={mode === "create" ? "New shared folder" : "Rename folder"}
      description={
        mode === "create"
          ? "Uses your team's default folder access. You can adjust per-member access right after."
          : "Renaming doesn't change who has access."
      }
      size="sm"
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="folder-name" className="mb-1.5 block text-[12px] font-semibold text-ink">
          Folder name
        </label>
        <input
          id="folder-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(undefined);
          }}
          data-autofocus
          placeholder="e.g. Client work"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "folder-name-error" : undefined}
          className={cn(
            "h-9 w-full rounded-lg border bg-white px-2.5 text-[12.5px] text-ink placeholder:text-text-subtle",
            "focus:outline-none focus:ring-[3px]",
            error
              ? "border-[#D6455D] focus:border-[#D6455D] focus:ring-[rgba(214,69,93,0.16)]"
              : "border-[var(--brand-border-strong)] focus:border-primary focus:ring-[rgba(49,120,251,0.16)]",
          )}
        />
        {error && (
          <p id="folder-name-error" role="alert" className="mt-1.5 text-[11px] font-medium text-[#C93B2B]">
            {error}
          </p>
        )}
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
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} aria-hidden="true" />}
            {mode === "create" ? "Create folder" : "Save name"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
