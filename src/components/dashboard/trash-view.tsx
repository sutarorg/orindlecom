"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/drive/client";
import { formatBytes } from "@/lib/drive/format";
import { TRASH_RETENTION, type DriveItem } from "@/lib/drive/types";
import { FileManager } from "./file-manager";

/**
 * Trash.
 *
 * The retention rule is read from `TRASH_RETENTION` (30 days, approved).
 * Both "Empty Trash" (`DELETE /api/trash`) and "Restore all"
 * (`POST /api/trash/restore`) call the real backend routes and refresh the
 * page on success.
 */
export function TrashView({ items }: { items: DriveItem[] }) {
  const [confirmEmpty, setConfirmEmpty] = React.useState(false);
  const [emptying, setEmptying] = React.useState(false);
  const [restoringAll, setRestoringAll] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const totalSize = items.reduce((sum, item) => sum + (item.size ?? 0), 0);

  const emptyTrash = async () => {
    setConfirmEmpty(false);
    setEmptying(true);
    const result = await api.delete<{ emptied: boolean }>("/api/trash");
    setEmptying(false);

    if (!result.ok) {
      toast({
        tone: "error",
        title: "Trash wasn't emptied",
        description: result.message,
      });
      return;
    }

    toast({
      tone: "success",
      title: "Trash emptied",
      description: "Deleted items were permanently removed and space was freed.",
    });
    router.refresh();
  };

  const restoreAll = async () => {
    if (items.length === 0) return;
    setRestoringAll(true);
    const result = await api.post<{ restored: number }>("/api/trash/restore", {
      ids: items.map((item) => item.id),
    });
    setRestoringAll(false);

    if (!result.ok) {
      toast({
        tone: "error",
        title: "Nothing was restored",
        description: result.message,
      });
      return;
    }

    toast({
      tone: "success",
      title: `Restored ${result.data.restored} ${result.data.restored === 1 ? "item" : "items"}`,
      description: "Everything is back where it came from.",
    });
    router.refresh();
  };

  return (
    <>
      <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-[var(--brand-border)] bg-white px-3.5 py-3">
        <Info className="mt-px h-4 w-4 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
        <div className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-text-muted">
          <p>
            Items in Trash are deleted automatically after{" "}
            <strong className="font-semibold text-ink">{TRASH_RETENTION.label}</strong>. Restore them
            before then and they go back where they were.
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            disabled={emptying}
            onClick={() => setConfirmEmpty(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#C93B2B] transition-colors hover:bg-[#FDF3F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            {emptying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden="true" />
            )}
            Empty Trash
          </button>
        )}
      </div>

      <FileManager
        items={items}
        mode="trash"
        showFilters={false}
        searchPlaceholder="Search trash…"
        toolbarTrailing={
          items.length > 0 ? (
            <button
              type="button"
              disabled={restoringAll}
              onClick={() => void restoreAll()}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-white px-2.5 text-[12px] font-medium text-text transition-colors hover:border-[var(--brand-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              {restoringAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-text-subtle" strokeWidth={2} aria-hidden="true" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Restore all</span>
            </button>
          ) : undefined
        }
        empty={{
          variant: "collection",
          icon: Trash2,
          title: "Trash is empty.",
          description: `Nothing has been deleted. When you delete a file it waits here for ${TRASH_RETENTION.label} before it's removed for good.`,
          footnote: "Files you delete from Trash can't be recovered.",
        }}
      />

      <ConfirmDialog
        open={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        onConfirm={() => void emptyTrash()}
        title="Empty Trash permanently?"
        confirmLabel="Empty Trash"
        destructive
        requireTyping="EMPTY"
      >
        This permanently deletes {items.length} {items.length === 1 ? "item" : "items"}
        {totalSize > 0 && ` (${formatBytes(totalSize)})`} and frees the space immediately.{" "}
        <strong className="font-semibold text-ink">It cannot be undone.</strong>
      </ConfirmDialog>
    </>
  );
}
