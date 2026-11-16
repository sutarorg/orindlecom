import {
  CloudUpload,
  Folder,
  FolderPlus,
  Grid2x2,
  List,
  Search,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { CloudGlyph } from "@/components/brand/logo";
import { FolderGlyph } from "@/components/brand/plan-icon";
import { StorageMeter } from "./storage-meter";

/**
 * Honest product preview.
 *
 * A real, renderable view of an *empty* Orindle library — the state a new
 * account actually starts in. It is not a fake file list, and no invented
 * people, timestamps or sizes appear anywhere. The storage meter reads 0 B of
 * 10 GB, which is what a genuinely new free account shows.
 *
 * Rendered at an intrinsic 620 × 400 design size and scaled by container query
 * units, so the chrome stays legible from 320px to 720px.
 */
export function EmptyLibraryPreview({
  className,
  title = "Your library",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={className}
      style={{ containerType: "inline-size" }}
      role="img"
      aria-label="Preview of an empty Orindle library: an empty document list, with a prompt to drag files in or create a folder."
    >
      <div className="overflow-hidden rounded-[16px] border border-[var(--brand-border)] bg-white shadow-[var(--brand-shadow-xl)]">
        {/* window chrome */}
        <div className="flex items-center gap-[1.6cqw] border-b border-[var(--brand-border-soft)] bg-[var(--brand-surface-muted)] px-[2.4cqw] py-[1.6cqw]">
          <span className="h-[1.5cqw] w-[1.5cqw] rounded-full bg-[#E7EAF3]" />
          <span className="h-[1.5cqw] w-[1.5cqw] rounded-full bg-[#E7EAF3]" />
          <span className="h-[1.5cqw] w-[1.5cqw] rounded-full bg-[#E7EAF3]" />
        </div>

        <div className="flex">
          {/* sidebar */}
          <aside className="hidden w-[21%] shrink-0 flex-col justify-between border-r border-[var(--brand-border-soft)] px-[2cqw] py-[2.4cqw] sm:flex">
            <div>
              <div className="flex items-center gap-[1.1cqw]">
                <CloudGlyph className="text-primary" style={{ width: "3.6cqw", height: "auto" }} />
                <span
                  className="font-bold tracking-[-0.02em] text-ink"
                  style={{ fontSize: "clamp(9px, 1.9cqw, 16px)" }}
                >
                  Orindle
                </span>
              </div>
              <ul className="mt-[2.6cqw] space-y-[0.5cqw]">
                {[
                  { label: "Home", Icon: Folder, active: true },
                  { label: "My Files", Icon: Folder },
                  { label: "Shared", Icon: Share2 },
                  { label: "Trash", Icon: Trash2 },
                ].map(({ label, Icon, active }) => (
                  <li key={label}>
                    <div
                      className={`flex items-center rounded-[1cqw] ${
                        active ? "bg-primary-soft" : ""
                      }`}
                      style={{ height: "5cqw", padding: "0 1.2cqw", gap: "1.4cqw" }}
                    >
                      <Icon
                        className={active ? "text-primary" : "text-text-subtle"}
                        style={{ width: "2.6cqw", height: "2.6cqw" }}
                        strokeWidth={1.9}
                      />
                      <span
                        className={`font-medium leading-none ${
                          active ? "text-primary" : "text-text"
                        }`}
                        style={{ fontSize: "clamp(9px, 1.8cqw, 16px)" }}
                      >
                        {label}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <StorageMeter used={0} total={10 * 1000 ** 3} compact />
          </aside>

          {/* main */}
          <div className="min-w-0 flex-1 px-[2.6cqw] py-[2.4cqw]">
            {/* toolbar */}
            <div className="flex items-center gap-[1.4cqw]">
              <div
                className="flex flex-1 items-center rounded-[1.2cqw] border border-[var(--brand-border-soft)] bg-white"
                style={{ height: "4cqw", padding: "0 1.3cqw", gap: "1cqw" }}
              >
                <Search
                  className="shrink-0 text-text-subtle"
                  style={{ width: "2.2cqw", height: "2.2cqw" }}
                  strokeWidth={2}
                />
                <span className="truncate text-text-subtle" style={{ fontSize: "clamp(8px, 1.7cqw, 15px)" }}>
                  Search your files…
                </span>
              </div>
              <div
                className="flex items-center rounded-[1.2cqw] bg-[var(--brand-surface-muted)]"
                style={{ height: "4cqw", padding: "0.4cqw", gap: "0.3cqw" }}
              >
                <span
                  className="flex items-center justify-center rounded-[0.8cqw] bg-white shadow-[var(--brand-shadow-xs)]"
                  style={{ width: "3cqw", height: "3.2cqw" }}
                >
                  <Grid2x2 className="text-ink" style={{ width: "2cqw", height: "2cqw" }} strokeWidth={2} />
                </span>
                <span className="flex items-center justify-center" style={{ width: "3cqw", height: "3.2cqw" }}>
                  <List
                    className="text-text-subtle"
                    style={{ width: "2cqw", height: "2cqw" }}
                    strokeWidth={2}
                  />
                </span>
              </div>
              <div
                className="flex items-center rounded-[1.2cqw] bg-primary text-white"
                style={{ height: "4cqw", padding: "0 1.4cqw", gap: "0.8cqw" }}
              >
                <Upload style={{ width: "2.1cqw", height: "2.1cqw" }} strokeWidth={2.2} />
                <span className="font-semibold leading-none" style={{ fontSize: "clamp(8px, 1.7cqw, 15px)" }}>
                  Upload
                </span>
              </div>
            </div>

            <div className="mt-[2.4cqw] flex items-baseline justify-between">
              <h3
                className="font-bold tracking-[-0.025em] text-ink"
                style={{ fontSize: "clamp(13px, 2.9cqw, 24px)" }}
              >
                {title}
              </h3>
              <span className="text-text-subtle" style={{ fontSize: "clamp(8px, 1.6cqw, 14px)" }}>
                0 items
              </span>
            </div>

            {/* genuine empty state */}
            <div
              className="mt-[2cqw] flex flex-col items-center justify-center rounded-[1.8cqw] border border-dashed border-[var(--brand-border-strong)] bg-[var(--brand-canvas)]"
              style={{ paddingBlock: "5.2cqw", paddingInline: "3cqw" }}
            >
              <span
                className="flex items-center justify-center rounded-full bg-primary-soft"
                style={{ width: "8cqw", height: "8cqw" }}
              >
                <CloudUpload
                  className="text-primary"
                  style={{ width: "4cqw", height: "4cqw" }}
                  strokeWidth={1.6}
                />
              </span>
              <p
                className="font-semibold leading-none text-ink"
                style={{ fontSize: "clamp(11px, 2cqw, 18px)", marginTop: "2.4cqw" }}
              >
                Nothing here yet
              </p>
              <p
                className="text-center leading-[1.5] text-text-muted"
                style={{ fontSize: "clamp(8px, 1.65cqw, 13px)", marginTop: "1cqw", maxWidth: "34cqw" }}
              >
                Drag files into this window, or create a folder to get your library started.
              </p>
              <div className="flex items-center" style={{ gap: "1.2cqw", marginTop: "2.4cqw" }}>
                <span
                  className="flex items-center rounded-full bg-primary font-semibold text-white"
                  style={{ height: "3.4cqw", padding: "0 1.8cqw", gap: "0.7cqw", fontSize: "clamp(8px, 1.6cqw, 14px)" }}
                >
                  <Upload style={{ width: "1.8cqw", height: "1.8cqw" }} strokeWidth={2.3} />
                  Upload files
                </span>
                <span
                  className="flex items-center rounded-full border border-[var(--brand-border-strong)] bg-white font-semibold text-ink"
                  style={{ height: "3.4cqw", padding: "0 1.8cqw", gap: "0.7cqw", fontSize: "clamp(8px, 1.6cqw, 14px)" }}
                >
                  <FolderPlus style={{ width: "1.8cqw", height: "1.8cqw" }} strokeWidth={2.1} />
                  New folder
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Folder tiles reused by the feature illustrations. */
export const PREVIEW_FOLDERS = [
  { name: "Documents", from: "#7FB2FA", to: "#3B7DE8" },
  { name: "Photos", from: "#8CE3BE", to: "#38BD8B" },
  { name: "Projects", from: "#FFC078", to: "#FB8F3D" },
  { name: "Designs", from: "#BCA6FD", to: "#8B5CF6" },
] as const;

export function FolderTile({ from, to, name }: { from: string; to: string; name: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--brand-border-soft)] bg-[var(--brand-canvas)] px-2 py-2.5">
      <FolderGlyph from={from} to={to} className="h-8 w-9" />
      <span className="text-[11px] font-medium leading-none text-text">{name}</span>
    </div>
  );
}
