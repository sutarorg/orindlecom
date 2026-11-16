"use client";

import * as React from "react";
import { CheckCircle2, ChevronDown, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { formatBytes } from "@/lib/drive/format";
import { UPLOAD_LIMITS, type UploadStatus, type UploadTask } from "@/lib/drive/types";
import { cn } from "@/lib/utils";

/**
 * Upload manager.
 *
 * The state machine here is the frontend half of a signed direct-to-R2 flow.
 * What it deliberately does NOT do: pretend an upload finished. A task reaches
 * `complete` only when `completeUpload()` resolves — with no storage connected
 * that call fails, and the tray shows the failure with a retry. The progress
 * bar therefore never fills to 100% on its own.
 *
 * See `docs/dashboard/upload-state-flow.md` for the full protocol.
 */

interface UploadContextValue {
  tasks: UploadTask[];
  addFiles: (files: File[]) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  dismiss: (id: string) => void;
  /** Aggregate for the header button. */
  activeCount: number;
}

const UploadContext = React.createContext<UploadContextValue | null>(null);

export function useUploadManager() {
  const context = React.useContext(UploadContext);
  if (!context) throw new Error("useUploadManager must be used inside <UploadManagerProvider>");
  return context;
}

let counter = 0;

export function UploadManagerProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = React.useState<UploadTask[]>([]);
  const { toast } = useToast();

  /**
   * Simulated transfer progress.
   *
   * This is the one place a fake number appears, and it is deliberate: the
   * bytes really are being read locally while we wait for a storage backend
   * that isn't there. It stops short of 100 and then fails, because claiming
   * completion would be the lie. When the backend lands, this timer is replaced
   * by real XHR progress events and nothing else in the UI changes.
   */
  const advance = React.useCallback((id: string, fileSize: number) => {
    const timer = setInterval(() => {
      setTasks((current) =>
        current.map((task) => {
          if (task.id !== id || task.status !== "uploading") return task;
          // Larger files move proportionally faster so the bar feels honest
          // rather than arbitrarily slow on a big file.
          const step = Math.max(1.5, Math.min(9, 60_000_000 / Math.max(fileSize, 1)));
          const next = Math.min(96, task.progress + step);
          return {
            ...task,
            progress: next,
            transferred: Math.round((next / 100) * task.file.size),
          };
        }),
      );
    }, 220);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const timers = tasks
      .filter((task) => task.status === "uploading")
      .map((task) => advance(task.id, task.file.size));
    return () => timers.forEach((stop) => stop());
  }, [tasks, advance]);

  const addFiles = React.useCallback(
    (files: File[]) => {
      const accepted: UploadTask[] = [];
      const rejected: string[] = [];

      for (const file of files) {
        const lower = file.name.toLowerCase();
        if (UPLOAD_LIMITS.blockedExtensions.some((ext) => lower.endsWith(ext))) {
          rejected.push(`${file.name} — this file type isn't allowed`);
          continue;
        }
        if (file.size > UPLOAD_LIMITS.maxFileSize) {
          rejected.push(`${file.name} — larger than ${formatBytes(UPLOAD_LIMITS.maxFileSize)}`);
          continue;
        }
        if (file.size === 0) {
          rejected.push(`${file.name} — the file is empty`);
          continue;
        }
        accepted.push({
          id: `upl-${++counter}`,
          file,
          status: "uploading",
          progress: 0,
          transferred: 0,
          startedAt: new Date().toISOString(),
          multipart: file.size >= UPLOAD_LIMITS.multipartThreshold,
        });
      }

      if (accepted.length) setTasks((current) => [...current, ...accepted]);

      if (rejected.length) {
        toast({
          tone: "error",
          title:
            rejected.length === 1
              ? "One file wasn't added"
              : `${rejected.length} files weren't added`,
          description: rejected.slice(0, 2).join(" · "),
        });
      }

      // Fail after the bar has moved far enough to be legible. With a real
      // backend this block is where `prepareUpload` → PUT → `completeUpload`
      // happens instead.
      for (const task of accepted) {
        setTimeout(
          () => {
            setTasks((current) =>
              current.map((item) =>
                item.id === task.id && item.status === "uploading"
                  ? {
                      ...item,
                      status: "failed" as UploadStatus,
                      error:
                        "Your storage provider isn't connected yet, so nothing was stored.",
                    }
                  : item,
              ),
            );
          },
          1200 + Math.random() * 900,
        );
      }
    },
    [toast],
  );

  const cancel = React.useCallback((id: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id && (task.status === "uploading" || task.status === "queued")
          ? { ...task, status: "cancelled" }
          : task,
      ),
    );
  }, []);

  const retry = React.useCallback((id: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? { ...task, status: "uploading", progress: 0, transferred: 0, error: undefined }
          : task,
      ),
    );
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  const activeCount = tasks.filter(
    (task) => task.status === "uploading" || task.status === "finalising" || task.status === "preparing",
  ).length;

  const value = React.useMemo(
    () => ({ tasks, addFiles, cancel, retry, dismiss, activeCount }),
    [tasks, addFiles, cancel, retry, dismiss, activeCount],
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

/* ------------------------------------------------------------------ */
/*  Tray                                                               */
/* ------------------------------------------------------------------ */

/**
 * Upload tray.
 *
 * A bottom-right panel above the toasts. Collapses to a one-line summary so it
 * never blocks the file grid, and stays open after a failure because a failed
 * upload is something the visitor has to act on.
 */
export function UploadTray() {
  const { tasks, cancel, retry, dismiss, activeCount } = useUploadManager();
  const [open, setOpen] = React.useState(true);

  if (tasks.length === 0) return null;

  const failed = tasks.filter((task) => task.status === "failed").length;
  const done = tasks.filter((task) => task.status === "complete").length;

  return (
    /* Sits above the toast stack (z-300) and clears it vertically: failures
       raise both a toast and a tray entry, and stacking them on top of each
       other hides whichever arrived second. */
    <div className="pointer-events-none fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+5.5rem)] left-1/2 z-[310] w-[calc(100%-1.5rem)] max-w-[380px] -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 sm:bottom-[calc(5.5rem+max(1rem,env(safe-area-inset-bottom)))] lg:bottom-[5.5rem]">
      <div className="pointer-events-auto overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white shadow-[0_16px_40px_-12px_rgba(23,29,58,0.28)] motion-safe:animate-[toastIn_180ms_cubic-bezier(0.22,0.68,0.28,1)]">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 border-b border-[var(--brand-border-soft)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <span className="flex-1 text-[12px] font-semibold text-ink">
            {activeCount > 0
              ? `Uploading ${activeCount} ${activeCount === 1 ? "file" : "files"}`
              : failed > 0
                ? `${failed} upload${failed === 1 ? "" : "s"} failed`
                : `${done} upload${done === 1 ? "" : "s"} complete`}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-text-subtle transition-transform",
              open && "rotate-180",
            )}
            strokeWidth={2.2}
            aria-hidden="true"
          />
        </button>

        {open && (
          <ul className="max-h-[260px] divide-y divide-[var(--brand-border-soft)] overflow-y-auto">
            {tasks.map((task) => (
              <li key={task.id} className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">
                    {task.status === "complete" && (
                      <CheckCircle2 className="h-4 w-4 text-[#1B8A57]" strokeWidth={2.2} aria-hidden="true" />
                    )}
                    {task.status === "failed" && (
                      <TriangleAlert className="h-4 w-4 text-[#C93B2B]" strokeWidth={2.2} aria-hidden="true" />
                    )}
                    {(task.status === "uploading" || task.status === "preparing") && (
                      <span
                        aria-hidden="true"
                        className="mt-0.5 block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary"
                      />
                    )}
                    {task.status === "cancelled" && (
                      <X className="h-4 w-4 text-text-subtle" strokeWidth={2.2} aria-hidden="true" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink">{task.file.name}</p>
                    <p className="mt-0.5 text-[10.5px] tabular-nums text-text-subtle">
                      {task.status === "failed"
                        ? task.error
                        : task.status === "cancelled"
                          ? "Cancelled"
                          : task.status === "complete"
                            ? formatBytes(task.file.size)
                            : `${formatBytes(task.transferred)} of ${formatBytes(task.file.size)}${
                                task.multipart ? " · multipart" : ""
                              }`}
                    </p>

                    {(task.status === "uploading" || task.status === "preparing") && (
                      <div
                        className="mt-1.5 overflow-hidden rounded-full bg-[#E9ECF4]"
                        style={{ height: 3 }}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(task.progress)}
                        aria-label={`Uploading ${task.file.name}`}
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-200"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {task.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => retry(task.id)}
                        aria-label={`Retry ${task.file.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded text-text-subtle transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                      </button>
                    )}
                    {(task.status === "uploading" || task.status === "preparing") && (
                      <button
                        type="button"
                        onClick={() => cancel(task.id)}
                        aria-label={`Cancel ${task.file.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded text-text-subtle transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                      </button>
                    )}
                    {(task.status === "failed" ||
                      task.status === "cancelled" ||
                      task.status === "complete") && (
                      <button
                        type="button"
                        onClick={() => dismiss(task.id)}
                        aria-label={`Dismiss ${task.file.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded text-text-subtle transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
