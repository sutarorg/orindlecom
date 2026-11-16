import {
  CloudUpload,
  Folder,
  Clock,
  Grid2x2,
  Home,
  List,
  Search,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { CloudGlyph } from "@/components/brand/logo";
import { FolderGlyph } from "@/components/brand/plan-icon";
import { cn } from "@/lib/utils";

/**
 * Hero product mockup.
 *
 * A decorative, non-interactive rendering of the Orindle library surface.
 * Every dimension is expressed in `cqw` (percent of the panel's own width) so the
 * whole composition scales losslessly from 320px to 640px wide, exactly as it
 * appears at 504 × 277 in the design reference.
 *
 * Content policy: folders only, no files, no people, no timestamps. This is an
 * illustrative empty library, not fake customer data.
 */

const NAV_ITEMS = [
  { label: "Home", icon: Home, active: true },
  { label: "My Files", icon: Folder },
  { label: "Shared", icon: Share2 },
  { label: "Recent", icon: Clock },
  { label: "Trash", icon: Trash2 },
];

const FOLDERS = [
  { name: "Documents", from: "#7FB2FA", to: "#3B7DE8" },
  { name: "Photos", from: "#8CE3BE", to: "#38BD8B" },
  { name: "Projects", from: "#FFC078", to: "#FB8F3D" },
  { name: "Designs", from: "#BCA6FD", to: "#8B5CF6" },
];

export function ProductMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative w-full [container-type:inline-size]",
        className,
      )}
      aria-hidden="true"
    >
      {/* Floating decorative tiles that break the panel silhouette */}
      <span
        className="absolute z-0 rounded-[0.9cqw] bg-[#8CB8FB]/90"
        style={{ width: "4.3cqw", height: "4.3cqw", top: "16%", left: "-2%", rotate: "22deg" }}
      />
      <span
        className="absolute z-0 rounded-[0.9cqw] bg-[#A8C8FD]/70"
        style={{ width: "3.2cqw", height: "3.2cqw", top: "-4%", right: "12%", rotate: "-14deg" }}
      />

      <div
        className="relative z-10 overflow-hidden rounded-[3.6cqw] border border-white/90 bg-white/[0.94] shadow-[0_2.5cqw_6cqw_-2cqw_rgba(30,40,90,0.30)] backdrop-blur-[2px]"
        style={{ aspectRatio: "504 / 277", rotate: "-2.2deg" }}
      >
        {/* inner hairline */}
        <span className="pointer-events-none absolute inset-0 rounded-[3.6cqw] ring-1 ring-inset ring-[rgba(23,29,58,0.055)]" />

        <div className="flex h-full">
          {/* ---------------- sidebar ---------------- */}
          <aside
            className="flex shrink-0 flex-col justify-between border-r border-[rgba(23,29,58,0.055)]"
            style={{ width: "23%", padding: "3.4cqw 2.4cqw 2.6cqw" }}
          >
            <div>
              {/* brand row */}
              <div className="flex items-center" style={{ gap: "1.2cqw" }}>
                <CloudGlyph className="text-primary" style={{ width: "4.2cqw", height: "auto" }} />
                <span
                  className="font-bold tracking-[-0.02em] text-ink"
                  style={{ fontSize: "clamp(10px, 2.2cqw, 22px)" }}
                >
                  Orindle
                </span>
              </div>

              {/* nav */}
              <ul className="mt-[3.2cqw]" style={{ display: "grid", gap: "0.55cqw" }}>
                {NAV_ITEMS.map(({ label, icon: Icon, active }) => (
                  <li key={label}>
                    <div
                      className={cn(
                        "flex items-center rounded-[1.2cqw]",
                        active ? "bg-primary-soft" : "bg-transparent",
                      )}
                      style={{ height: "5.9cqw", padding: "0 1.4cqw", gap: "1.6cqw" }}
                    >
                      <Icon
                        className={active ? "text-primary" : "text-text-subtle"}
                        style={{ width: "3.1cqw", height: "3.1cqw" }}
                        strokeWidth={1.8}
                      />
                      <span
                        className={cn(
                          "font-medium leading-none",
                          active ? "text-primary" : "text-text",
                        )}
                        style={{ fontSize: "clamp(9px, 2.05cqw, 22px)" }}
                      >
                        {label}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* storage card */}
            <div
              className="mock-storage rounded-[1.6cqw] bg-surface-muted"
              style={{ padding: "1.8cqw 1.8cqw 2cqw" }}
            >
              <p
                className="font-semibold leading-none text-ink"
                style={{ fontSize: "clamp(8px, 1.7cqw, 22px)" }}
              >
                Storage
              </p>
              <div
                className="overflow-hidden rounded-full bg-[#E3E8F5]"
                style={{ height: "0.62cqw", marginTop: "1.5cqw" }}
              >
                <div className="h-full w-[24%] rounded-full bg-primary" />
              </div>
              <p
                className="leading-none text-text-subtle"
                style={{ fontSize: "clamp(8px, 1.55cqw, 22px)", marginTop: "1.2cqw" }}
              >
                2.4 GB / 10 GB
              </p>
            </div>
          </aside>

          {/* ---------------- main ---------------- */}
          <div
            className="flex min-w-0 flex-1 flex-col"
            style={{ padding: "2.6cqw 2.6cqw 2.8cqw 2.8cqw" }}
          >
            {/* toolbar */}
            <div className="flex items-center" style={{ gap: "1.6cqw" }}>
              {/* search */}
              <div
                className="flex items-center rounded-[1.5cqw] border border-[#EEF1F7] bg-white"
                style={{ height: "4.4cqw", flex: "1 1 auto", padding: "0 1.5cqw", gap: "1.1cqw" }}
              >
                <Search
                  className="shrink-0 text-text-subtle"
                  style={{ width: "2.5cqw", height: "2.5cqw" }}
                  strokeWidth={2}
                />
                <span
                  className="truncate text-text-subtle"
                  style={{ fontSize: "clamp(9px, 1.9cqw, 22px)" }}
                >
                  Search files…
                </span>
              </div>

              {/* view toggle */}
              <div
                className="flex items-center text-text-subtle"
                style={{ gap: "1.3cqw" }}
              >
                <Grid2x2 style={{ width: "2.6cqw", height: "2.6cqw" }} strokeWidth={1.9} />
                <List style={{ width: "2.6cqw", height: "2.6cqw" }} strokeWidth={1.9} />
              </div>

              {/* segmented group */}
              <div
                className="flex items-center rounded-[1.4cqw] bg-surface-muted"
                style={{ height: "4.4cqw", padding: "0.5cqw", gap: "0.4cqw" }}
              >
                <span
                  className="flex items-center justify-center rounded-[1cqw] bg-white shadow-[0_0.15cqw_0.4cqw_rgba(23,29,58,0.10)]"
                  style={{ width: "3.2cqw", height: "3.4cqw" }}
                >
                  <List
                    className="text-ink"
                    style={{ width: "2.2cqw", height: "2.2cqw" }}
                    strokeWidth={2}
                  />
                </span>
                <span
                  className="flex items-center justify-center"
                  style={{ width: "3.2cqw", height: "3.4cqw" }}
                >
                  <Grid2x2
                    className="text-text-subtle"
                    style={{ width: "2.2cqw", height: "2.2cqw" }}
                    strokeWidth={2}
                  />
                </span>
              </div>

              {/* avatar */}
              <span
                className="flex shrink-0 items-center justify-center rounded-full bg-[#F06FA8] font-semibold text-white"
                style={{ width: "4.2cqw", height: "4.2cqw", fontSize: "clamp(9px, 1.9cqw, 22px)" }}
              >
                S
              </span>
            </div>

            {/* title row */}
            <div
              className="flex items-end justify-between"
              style={{ marginTop: "3.2cqw" }}
            >
              <h3
                className="font-bold tracking-[-0.02em] text-ink"
                style={{ fontSize: "clamp(10px, 4cqw, 22px)", lineHeight: 1 }}
              >
                My Files
              </h3>
              <div
                className="flex items-center rounded-[1.4cqw] bg-primary text-white"
                style={{ height: "4.9cqw", padding: "0 1.7cqw", gap: "0.9cqw" }}
              >
                <Upload style={{ width: "2.4cqw", height: "2.4cqw" }} strokeWidth={2.2} />
                <span className="font-semibold leading-none" style={{ fontSize: "clamp(9px, 1.9cqw, 22px)" }}>
                  Upload
                </span>
              </div>
            </div>

            {/* folder grid */}
            <div
              className="grid grid-cols-4"
              style={{ gap: "1.9cqw", marginTop: "2.6cqw" }}
            >
              {FOLDERS.map((folder) => (
                <div
                  key={folder.name}
                  className="flex flex-col items-center justify-center rounded-[1.9cqw] border border-[#F1F4FA] bg-[#FBFCFE]"
                  style={{ paddingTop: "1.6cqw", paddingBottom: "1.4cqw", gap: "0.9cqw" }}
                >
                  <FolderGlyph
                    from={folder.from}
                    to={folder.to}
                    className="h-auto"
                    // 8.6% of panel width
                  />
                  <span
                    className="font-medium leading-none text-text"
                    style={{ fontSize: "clamp(9px, 1.85cqw, 22px)" }}
                  >
                    {folder.name}
                  </span>
                </div>
              ))}
            </div>

            {/* drop zone */}
            <div
              className="mt-auto flex flex-col items-center justify-center rounded-[2.4cqw] border border-dashed border-[#D8DEEB]"
              style={{ marginTop: "2.4cqw", paddingBlock: "3.4cqw" }}
            >
              <CloudUpload
                className="text-primary"
                style={{ width: "5.2cqw", height: "5.2cqw" }}
                strokeWidth={1.6}
              />
              <p
                className="font-semibold leading-none text-ink"
                style={{ fontSize: "clamp(9px, 2cqw, 22px)", marginTop: "1.2cqw" }}
              >
                Drag &amp; drop files here
              </p>
              <p
                className="leading-none text-text-subtle"
                style={{ fontSize: "clamp(8px, 1.65cqw, 22px)", marginTop: "0.9cqw" }}
              >
                or browse from your device
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
