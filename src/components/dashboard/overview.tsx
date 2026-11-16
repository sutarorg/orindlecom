"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Database,
  Folder,
  Star,
  Upload,
} from "lucide-react";
import { useUploadManager } from "./upload-manager";
import { DashboardActions } from "./dashboard-header-actions";
import { EmptyLibraryArt } from "./empty-art";
import { FileTypeIcon } from "./file-icon";
import { formatBytes, formatPercent, formatRelative } from "@/lib/drive/format";
import type { ActivityEvent, DriveItem, StorageUsage } from "@/lib/drive/types";


/**
 * Overview.
 *
 * The rule the spec is emphatic about: no invented activity. Every section
 * below is conditional on the backend having actually returned records, and the
 * empty case is designed first — because on a fresh account it is the only case
 * that will ever be seen.
 */
export function Overview({
  firstName,
  usage,
  recent,
  activity,
  starred,
}: {
  firstName: string;
  usage: StorageUsage;
  recent: DriveItem[];
  activity: ActivityEvent[];
  starred: DriveItem[];
}) {
  const isEmptyLibrary = usage.fileCount === 0 && usage.folderCount === 0;

  // A greeting built from a placeholder identity reads as broken ("Welcome
  // back, Your account."), so an unnamed viewer gets the name-free version.
  const named = firstName !== "Your account" && Boolean(firstName);
  const greeting = isEmptyLibrary
    ? named
      ? `Welcome, ${firstName}.`
      : "Welcome to Orindle."
    : named
      ? `Welcome back, ${firstName}.`
      : "Welcome back.";

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-6">
      {/* Greeting + primary action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[20px] font-extrabold leading-tight tracking-[-0.035em] text-ink sm:text-[24px]">
            {greeting}
          </h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
            {isEmptyLibrary
              ? "Your library is ready. It just needs something in it."
              : "Here's where your storage stands today."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DashboardActions showFolder={false} />
        </div>
      </div>

      {/* First-use: one clear invitation, no dashboard furniture around it. */}
      {isEmptyLibrary ? (
        <FirstUse />
      ) : (
        <PopulatedOverview usage={usage} recent={recent} activity={activity} starred={starred} />
      )}

      {/* Storage summary — always present, because it answers the question
          every storage product is asked and it is derived from real figures. */}
      <StorageSummary usage={usage} />
    </div>
  );
}

function FirstUse() {
  const { addFiles } = useUploadManager();
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <section
      aria-labelledby="first-use-title"
      className="mt-5 overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) addFiles(files);
          event.target.value = "";
        }}
      />
      <div className="flex flex-col items-center px-6 py-12 text-center sm:py-16">
        <EmptyLibraryArt className="max-w-[260px]" />
        <h2
          id="first-use-title"
          className="mt-6 text-[19px] font-extrabold tracking-[-0.03em] text-ink sm:text-[22px]"
        >
          Your files start here.
        </h2>
        <p className="mt-2 max-w-[380px] text-[13px] leading-relaxed text-text-muted">
          Upload your first file to make Orindle your home for digital storage.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Upload className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          Upload files
        </button>
        <p className="mt-3 text-[11.5px] text-text-subtle">
          Or drag files anywhere on this page.
        </p>
      </div>
    </section>
  );
}

function PopulatedOverview({
  usage,
  recent,
  activity,
  starred,
}: {
  usage: StorageUsage;
  recent: DriveItem[];
  activity: ActivityEvent[];
  starred: DriveItem[];
}) {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {recent.length > 0 && (
          <section aria-labelledby="recent-heading" className="rounded-2xl border border-[var(--brand-border)] bg-white">
            <SectionHead id="recent-heading" title="Recently opened" href="/dashboard/recent" icon={Clock} />
            <ul className="divide-y divide-[var(--brand-border-soft)]">
              {recent.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <Link
                    href="/dashboard/recent"
                    className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <FileTypeIcon category={item.category} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-ink">{item.name}</span>
                      <span className="text-[10.5px] text-text-subtle">
                        {formatBytes(item.size)} · {formatRelative(item.openedAt)}
                      </span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-subtle" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {activity.length > 0 && (
          <section aria-labelledby="activity-heading" className="rounded-2xl border border-[var(--brand-border)] bg-white">
            <SectionHead id="activity-heading" title="Recent activity" icon={Clock} />
            <ul className="divide-y divide-[var(--brand-border-soft)]">
              {activity.slice(0, 6).map((event) => (
                <li key={event.id} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                  <p className="min-w-0 flex-1 text-[12px] text-text">
                    <span className="font-medium text-ink">{event.actor}</span> {describe(event.kind)}{" "}
                    <span className="font-medium text-ink">{event.itemName}</span>
                  </p>
                  <span className="shrink-0 text-[10.5px] text-text-subtle">{formatRelative(event.at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recent.length === 0 && activity.length === 0 && (
          <section className="rounded-2xl border border-[var(--brand-border)] bg-white px-5 py-8 text-center">
            <p className="text-[13px] font-semibold text-ink">Nothing opened yet</p>
            <p className="mx-auto mt-1 max-w-[320px] text-[12px] leading-relaxed text-text-muted">
              Files you open will show up here. Recently opened and recent activity only appear once
              there&apos;s something to report.
            </p>
            <Link
              href="/dashboard/files"
              className="mt-3 inline-flex items-center gap-1 rounded text-[12px] font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Go to My Files
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </section>
        )}
      </div>

      <div className="space-y-4">
        <QuickLinks starredCount={starred.length} usage={usage} />
      </div>
    </div>
  );
}

function QuickLinks({ starredCount, usage }: { starredCount: number; usage: StorageUsage }) {
  const links = [
    { href: "/dashboard/files", label: "My Files", icon: Folder, hint: "Everything you've stored" },
    { href: "/dashboard/recent", label: "Recent", icon: Clock, hint: "Pick up where you left off" },
    {
      href: "/dashboard/starred",
      label: "Starred",
      icon: Star,
      hint: starredCount > 0 ? `${starredCount} marked` : "Nothing marked yet",
    },
    {
      href: "/dashboard/storage",
      label: "Storage",
      icon: Database,
      hint: `${formatBytes(usage.used)} of ${formatBytes(usage.total)}`,
    },
  ];

  return (
    <section aria-label="Quick links" className="rounded-2xl border border-[var(--brand-border)] bg-white p-3">
      <ul className="space-y-0.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-surface-muted)] text-text-muted">
                <link.icon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-ink">{link.label}</span>
                <span className="block truncate text-[10.5px] text-text-subtle">{link.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StorageSummary({ usage }: { usage: StorageUsage }) {
  const pct = usage.total > 0 ? Math.min(100, (usage.used / usage.total) * 100) : 0;
  const tone = pct >= 100 ? "full" : pct >= 80 ? "high" : "normal";
  const fill = tone === "full" ? "#E0533D" : tone === "high" ? "#F9A53B" : "var(--brand-primary)";

  return (
    <section
      aria-labelledby="storage-summary-heading"
      className="mt-4 rounded-2xl border border-[var(--brand-border)] bg-white p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="storage-summary-heading" className="text-[13px] font-bold tracking-[-0.02em] text-ink">
          Storage
        </h2>
        <Link
          href="/dashboard/storage"
          className="inline-flex min-h-6 items-center gap-1 rounded text-[11.5px] font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Manage
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      <div
        className="mt-3 overflow-hidden rounded-full bg-[#E9ECF4]"
        style={{ height: 8 }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`${formatBytes(usage.used)} of ${formatBytes(usage.total)} used`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-[var(--brand-ease-out)]"
          style={{ width: `${pct}%`, backgroundColor: fill }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[11.5px]">
        {/* Spacing via `gap` rather than text spaces: the space between two
            semibold spans on this typeface closes up to nearly nothing. */}
        <p className="flex flex-wrap items-baseline gap-x-1 tabular-nums text-text">
          <span className="font-semibold text-ink">{formatBytes(usage.used)}</span>
          <span>of</span>
          <span className="font-semibold text-ink">{formatBytes(usage.total)}</span>
          <span>used</span>
          <span className="ml-0.5 text-text-subtle">({formatPercent(usage.used, usage.total)})</span>
        </p>
        <p className="text-text-subtle">
          {formatBytes(Math.max(0, usage.total - usage.used))} available
        </p>
      </div>

      {!usage.authoritative && (
        <p className="mt-2 text-[10.5px] leading-relaxed text-text-subtle">
          These figures are the plan allowance only — usage is confirmed once storage is connected.
        </p>
      )}
    </section>
  );
}

function SectionHead({
  id,
  title,
  href,
  icon: Icon,
}: {
  id: string;
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--brand-border-soft)] px-4 py-2.5">
      <h2 id={id} className="flex items-center gap-1.5 text-[12px] font-bold tracking-[-0.02em] text-ink">
        <Icon className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden />
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="inline-flex min-h-6 items-center gap-0.5 rounded text-[11px] font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          See all
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function describe(kind: ActivityEvent["kind"]) {
  switch (kind) {
    case "upload":
      return "uploaded";
    case "rename":
      return "renamed";
    case "move":
      return "moved";
    case "share":
      return "shared";
    case "restore":
      return "restored";
    case "delete":
      return "deleted";
    case "star":
      return "starred";
  }
}


