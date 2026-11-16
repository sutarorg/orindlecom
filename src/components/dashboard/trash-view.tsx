"use client";

import * as React from "react";
import { Info, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { NOT_CONNECTED_MESSAGE } from "@/lib/drive/repository";
import { TRASH_RETENTION, type DriveItem } from "@/lib/drive/types";
import { FileManager } from "./file-manager";

/**
 * Trash.
 *
 * The retention rule is read from `TRASH_RETENTION`, never hard-coded here, so
 * changing the policy is a one-line config edit rather than a hunt through
 * copy. The banner states the rule plainly and marks it as provisional while
 * `approved` is false — a product rule that hasn't been signed off should say
 * so in the interface, not just in a doc.
 */
export function TrashView({ items }: { items: DriveItem[] }) {
  const [confirmEmpty, setConfirmEmpty] = React.useState(false);
  const { toast } = useToast();

  const totalSize = items.reduce((sum, item) => sum + (item.size ?? 0), 0);

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
          {!TRASH_RETENTION.approved && (
            <p className="mt-1 text-text-subtle">
              This retention window is provisional and may change before launch.
            </p>
          )}
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmEmpty(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#C93B2B] transition-colors hover:bg-[#FDF3F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden="true" />
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
              onClick={() =>
                toast({
                  tone: "error",
                  title: "Nothing was restored",
                  description: NOT_CONNECTED_MESSAGE,
                })
              }
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-white px-2.5 text-[12px] font-medium text-text transition-colors hover:border-[var(--brand-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <RotateCcw className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
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
        onConfirm={() => {
          setConfirmEmpty(false);
          toast({
            tone: "error",
            title: "Trash wasn't emptied",
            description: NOT_CONNECTED_MESSAGE,
          });
        }}
        title="Empty Trash permanently?"
        confirmLabel="Empty Trash"
        requireTyping="EMPTY"
      >
        This permanently deletes {items.length} {items.length === 1 ? "item" : "items"}
        {totalSize > 0 && ` (${(totalSize / 1000 ** 2).toFixed(1)} MB)`} and frees the space
        immediately. <strong className="font-semibold text-ink">It cannot be undone.</strong>
      </ConfirmDialog>
    </>
  );
}
