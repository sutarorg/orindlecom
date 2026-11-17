"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/drive/client";
import { formatBytes } from "@/lib/drive/format";
import { UPLOAD_LIMITS, type UploadStatus, type UploadTask } from "@/lib/drive/types";
import { cn } from "@/lib/utils";

/**
 * Upload manager.
 *
 * Implements the browser half of Orindle's signed direct-to-R2 pipeline:
 *   1. POST /api/uploads/prepare — validates name, reserves quota in Postgres,
 *      and returns either a single presigned PUT URL or multipart part URLs.
 *   2. Direct browser -> R2 XHR PUT(s) with real byte-level upload progress.
 *   3. POST /api/uploads/:taskId/complete — verifies object size via HeadObject
 *      and commits the file metadata and storage accounting.
 *
 * There is no artificial per-file size limit — only the account's available
 * storage quota applies (enforced transactionally on the server).
 */

interface UploadContextValue {
  tasks: UploadTask[];
  addFiles: (files: File[], parentId?: string | null) => void;
  /**
   * Upload a picked directory, recreating its folder structure.
   *
   * Asynchronous because it creates the folders first — there is nothing to upload
   * into until they exist.
   */
  addFolder: (files: File[], parentId?: string | null) => Promise<void>;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  dismiss: (id: string) => void;
  /** Aggregate for the header button. */
  activeCount: number;
}

interface InternalTask extends UploadTask {
  parentId: string | null;
  serverTaskId?: string;
}

interface PrepareResponse {
  taskId: string;
  fileId: string;
  multipart: boolean;
  uploadUrl?: string;
  uploadId?: string;
  partUrls?: { partNumber: number; url: string }[];
  partSize?: number;
  expiresAt: string;
}

const MULTIPART_CONCURRENCY = 3;

const UploadContext = React.createContext<UploadContextValue | null>(null);

export function useUploadManager() {
  const context = React.useContext(UploadContext);
  if (!context) throw new Error("useUploadManager must be used inside <UploadManagerProvider>");
  return context;
}

let counter = 0;

function putWithProgress(
  url: string,
  body: Blob,
  contentType: string | null,
  onProgress: (loaded: number) => void,
  registerXhr: (xhr: XMLHttpRequest) => void,
): Promise<{ etag: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    registerXhr(xhr);

    xhr.open("PUT", url, true);
    if (contentType) {
      xhr.setRequestHeader("Content-Type", contentType);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const rawEtag = xhr.getResponseHeader("ETag") ?? xhr.getResponseHeader("etag") ?? "";
        resolve({ etag: rawEtag.replace(/^"|"$/g, "") });
      } else {
        reject(new Error(`Storage rejected the upload (${xhr.status}).`));
      }
    };

    /*
     * `onerror` fires with `status === 0` for any failure the browser refuses to
     * describe — a blocked request, a CORS preflight rejection, DNS failure, or a
     * dropped connection all land here identically. The old message said "network
     * error" for all of them, which sent people to check their wifi when the usual
     * cause is CSP or the bucket's CORS policy rejecting the origin.
     *
     * The message now names the origin being uploaded from, because that is the value
     * that has to appear in the bucket's CORS `AllowedOrigins` and in the page's
     * `connect-src`. A browser cannot tell us which of the two rejected it, so the
     * text says what to check rather than guessing.
     */
    xhr.onerror = () =>
      reject(
        new Error(
          `Couldn't upload to storage from ${window.location.origin}. ` +
            "The request was blocked or the connection dropped — check the bucket's CORS policy and this site's connect-src allow this origin.",
        ),
      );
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));

    xhr.send(body);
  });
}

export function UploadManagerProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = React.useState<InternalTask[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  // Track active XHR handles & cancelled task IDs so cancel aborts in-flight bytes immediately.
  const xhrsRef = React.useRef<Map<string, Set<XMLHttpRequest>>>(new Map());
  const cancelledRef = React.useRef<Set<string>>(new Set());

  const updateTask = React.useCallback((id: string, patch: Partial<InternalTask>) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }, []);

  const runUpload = React.useCallback(
    async (task: InternalTask) => {
      const localId = task.id;
      cancelledRef.current.delete(localId);
      const activeXhrs = new Set<XMLHttpRequest>();
      xhrsRef.current.set(localId, activeXhrs);

      let serverTaskId: string | undefined;

      try {
        updateTask(localId, {
          status: "preparing",
          progress: 0,
          transferred: 0,
          error: undefined,
        });

        const mimeType = task.file.type || "application/octet-stream";
        const prepared = await api.post<PrepareResponse>("/api/uploads/prepare", {
          name: task.file.name,
          size: task.file.size,
          mimeType,
          parentId: task.parentId,
        });

        if (cancelledRef.current.has(localId)) return;

        if (!prepared.ok) {
          updateTask(localId, {
            status: "failed",
            error: prepared.message,
          });
          return;
        }

        const prep = prepared.data;
        serverTaskId = prep.taskId;
        updateTask(localId, {
          status: "uploading",
          serverTaskId: prep.taskId,
          multipart: prep.multipart,
        });

        let completedParts: { partNumber: number; etag: string }[] | undefined;

        if (!prep.multipart) {
          if (!prep.uploadUrl) {
            throw new Error("The server did not return an upload URL.");
          }

          await putWithProgress(
            prep.uploadUrl,
            task.file,
            mimeType,
            (loaded) => {
              const pct = task.file.size > 0 ? Math.min(99, (loaded / task.file.size) * 100) : 0;
              updateTask(localId, { progress: pct, transferred: loaded });
            },
            (xhr) => activeXhrs.add(xhr),
          );
        } else {
          const partUrls = prep.partUrls ?? [];
          const partSize = prep.partSize ?? 8 * 1024 * 1024;
          if (!partUrls.length) {
            throw new Error("The server did not return multipart upload URLs.");
          }

          const partLoaded = new Map<number, number>();
          const partsResult: { partNumber: number; etag: string }[] = [];
          let cursor = 0;

          const reportAggregate = () => {
            let totalLoaded = 0;
            for (const bytes of partLoaded.values()) totalLoaded += bytes;
            const pct = task.file.size > 0 ? Math.min(99, (totalLoaded / task.file.size) * 100) : 0;
            updateTask(localId, { progress: pct, transferred: Math.min(totalLoaded, task.file.size) });
          };

          const worker = async () => {
            while (cursor < partUrls.length) {
              if (cancelledRef.current.has(localId)) {
                throw new DOMException("Upload cancelled", "AbortError");
              }
              const idx = cursor++;
              const { partNumber, url } = partUrls[idx];
              const start = (partNumber - 1) * partSize;
              const end = Math.min(start + partSize, task.file.size);
              const slice = task.file.slice(start, end);

              const { etag } = await putWithProgress(
                url,
                slice,
                null,
                (loaded) => {
                  partLoaded.set(partNumber, loaded);
                  reportAggregate();
                },
                (xhr) => activeXhrs.add(xhr),
              );

              partLoaded.set(partNumber, slice.size);
              reportAggregate();
              partsResult.push({ partNumber, etag });
            }
          };

          await Promise.all(
            Array.from({ length: Math.min(MULTIPART_CONCURRENCY, partUrls.length) }, () => worker()),
          );

          completedParts = partsResult.sort((a, b) => a.partNumber - b.partNumber);
        }

        if (cancelledRef.current.has(localId)) return;

        updateTask(localId, {
          status: "finalising",
          progress: 99,
          transferred: task.file.size,
        });

        const completed = await api.post(`/api/uploads/${encodeURIComponent(prep.taskId)}/complete`, {
          parts: completedParts,
        });

        if (cancelledRef.current.has(localId)) return;

        if (!completed.ok) {
          updateTask(localId, {
            status: "failed",
            error: completed.message,
          });
          return;
        }

        updateTask(localId, {
          status: "complete",
          progress: 100,
          transferred: task.file.size,
        });
        router.refresh();
      } catch (err) {
        if (
          cancelledRef.current.has(localId) ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          if (serverTaskId) {
            void api.delete(`/api/uploads/${encodeURIComponent(serverTaskId)}/cancel`);
          }
          updateTask(localId, { status: "cancelled" as UploadStatus });
          return;
        }

        if (serverTaskId) {
          void api.delete(`/api/uploads/${encodeURIComponent(serverTaskId)}/cancel`);
        }

        const message =
          err instanceof Error && err.message
            ? err.message
            : "The upload couldn't finish. Nothing was saved.";
        updateTask(localId, {
          status: "failed",
          error: message,
        });
      } finally {
        xhrsRef.current.delete(localId);
      }
    },
    [router, updateTask],
  );

  const addFiles = React.useCallback(
    (files: File[], parentId: string | null = null) => {
      const accepted: InternalTask[] = [];
      const rejected: string[] = [];

      for (const file of files) {
        if (UPLOAD_LIMITS.maxFileSize !== null && file.size > UPLOAD_LIMITS.maxFileSize) {
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
          parentId,
          status: "preparing",
          progress: 0,
          transferred: 0,
          startedAt: new Date().toISOString(),
          multipart: file.size >= UPLOAD_LIMITS.multipartThreshold,
        });
      }

      if (accepted.length) {
        setTasks((current) => [...current, ...accepted]);
        for (const task of accepted) {
          void runUpload(task);
        }
      }

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
    },
    [runUpload, toast],
  );

  /**
   * Recreate the folder tree a directory upload arrived as, then upload into it.
   *
   * A browser hands a picked directory over as a flat file list whose entries each
   * carry a `webkitRelativePath` like `Holiday/2024/beach.jpg`. Creating one folder
   * for the root and dumping every file inside would lose that structure, which is
   * the whole point of uploading a folder. So the path segments are turned into
   * folders depth-first — each folder is created once, under its real parent — and
   * the files then land where they belong.
   *
   * Folders are created through the same endpoint the New folder button uses, so
   * name validation is identical and a bad segment fails the same way. A failure
   * part-way through reports how many landed rather than claiming success.
   */
  const addFolder = React.useCallback(
    async (files: File[], parentId: string | null = null) => {
      const withPaths = files.filter((file) => {
        const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
        return Boolean(path && path.includes("/"));
      });

      if (withPaths.length === 0) {
        // No relative paths: a browser that ignored `webkitdirectory` gave us plain
        // files. Uploading them is the closest honest behaviour.
        addFiles(files, parentId);
        return;
      }

      // Segment list per folder path, so each folder is created exactly once.
      const folders = new Map<string, { id: string | null; parentId: string | null }>();
      const failures: string[] = [];

      const ensureFolder = async (segments: string[]): Promise<string | null> => {
        let parent: string | null = parentId;
        let key = "";

        for (const segment of segments) {
          key = key ? `${key}/${segment}` : segment;
          const existing = folders.get(key);
          if (existing) {
            parent = existing.id;
            continue;
          }

          const result = await api.post<{ id: string }>("/api/folders", {
            name: segment,
            parentId: parent,
          });

          if (!result.ok) {
            failures.push(`${segment} — ${result.message}`);
            return null;
          }

          folders.set(key, { id: result.data.id, parentId: parent });
          parent = result.data.id;
        }

        return parent;
      };

      const byTarget = new Map<string | null, File[]>();

      for (const file of withPaths) {
        const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
        const segments = relative.split("/").filter(Boolean);
        // Drop the file name itself; the rest is the folder path.
        const folderSegments = segments.slice(0, -1);

        const target = await ensureFolder(folderSegments);
        if (target === null) continue;

        byTarget.set(target, [...(byTarget.get(target) ?? []), file]);
      }

      for (const [target, group] of byTarget) addFiles(group, target);

      if (failures.length > 0) {
        toast({
          tone: "error",
          title: "Some folders weren't created",
          description: `${failures.slice(0, 2).join(" · ")}${failures.length > 2 ? ` · and ${failures.length - 2} more` : ""}`,
        });
      }
    },
    [addFiles, toast],
  );


  const cancel = React.useCallback((id: string) => {
    cancelledRef.current.add(id);
    const activeXhrs = xhrsRef.current.get(id);
    if (activeXhrs) {
      for (const xhr of activeXhrs) xhr.abort();
      xhrsRef.current.delete(id);
    }

    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task;
        if (task.serverTaskId) {
          void api.delete(`/api/uploads/${encodeURIComponent(task.serverTaskId)}/cancel`);
        }
        if (
          task.status === "uploading" ||
          task.status === "preparing" ||
          task.status === "queued"
        ) {
          return { ...task, status: "cancelled" };
        }
        return task;
      }),
    );
  }, []);

  const retry = React.useCallback(
    (id: string) => {
      const target = tasks.find((task) => task.id === id);
      if (!target) return;
      void runUpload(target);
    },
    [runUpload, tasks],
  );

  const dismiss = React.useCallback((id: string) => {
    setTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  const activeCount = tasks.filter(
    (task) =>
      task.status === "uploading" || task.status === "finalising" || task.status === "preparing",
  ).length;

  const value = React.useMemo(
    () => ({ tasks, addFiles, addFolder, cancel, retry, dismiss, activeCount }),
    [tasks, addFiles, addFolder, cancel, retry, dismiss, activeCount],
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

/* ------------------------------------------------------------------ */
/*  Tray                                                               */
/* ------------------------------------------------------------------ */

export function UploadTray() {
  const { tasks, cancel, retry, dismiss, activeCount } = useUploadManager();
  const [open, setOpen] = React.useState(true);

  if (tasks.length === 0) return null;

  const failed = tasks.filter((task) => task.status === "failed").length;
  const done = tasks.filter((task) => task.status === "complete").length;

  return (
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
                    {(task.status === "uploading" ||
                      task.status === "preparing" ||
                      task.status === "finalising") && (
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
                            : task.status === "preparing"
                              ? "Preparing upload…"
                              : task.status === "finalising"
                                ? "Verifying upload…"
                                : `${formatBytes(task.transferred)} of ${formatBytes(task.file.size)}${
                                    task.multipart ? " · multipart" : ""
                                  }`}
                    </p>

                    {(task.status === "uploading" ||
                      task.status === "preparing" ||
                      task.status === "finalising") && (
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
