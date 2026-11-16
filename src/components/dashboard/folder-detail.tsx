"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, FolderOpen, Home } from "lucide-react";
import { FileManager } from "./file-manager";
import { DashboardActions } from "./dashboard-header-actions";
import { PageHeader } from "./page-header";
import type { DriveItem } from "@/lib/drive/types";

/**
 * A single folder.
 *
 * The breadcrumb trail is built from the ancestors the repository returned —
 * not from string splitting on a path, because there is no path. Each crumb is
 * a real link so the back button and middle-click behave as expected.
 */
export function FolderDetail({
  folder,
  ancestors,
  items,
}: {
  folder: DriveItem;
  ancestors: Array<{ id: string; name: string }>;
  items: DriveItem[];
}) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <nav aria-label="Folder path" className="mb-2.5">
        <ol className="flex flex-wrap items-center gap-1 text-[11.5px]">
          <li>
            <Link
              href="/dashboard/files"
              className="flex items-center gap-1 rounded px-1 py-0.5 font-medium text-text-muted transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Home className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              My Files
            </Link>
          </li>
          {ancestors.map((ancestor) => (
            <li key={ancestor.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-text-subtle" strokeWidth={2.2} aria-hidden="true" />
              <Link
                href={`/dashboard/folders/${ancestor.id}`}
                className="inline-flex min-h-[28px] max-w-[140px] items-center truncate rounded px-1 py-0.5 font-medium text-text-muted transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {ancestor.name}
              </Link>
            </li>
          ))}
          <li className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-text-subtle" strokeWidth={2.2} aria-hidden="true" />
            <span aria-current="page" className="max-w-[180px] truncate px-1 font-semibold text-ink">
              {folder.name}
            </span>
          </li>
        </ol>
      </nav>

      <PageHeader
        title={folder.name}
        description={`${items.length} ${items.length === 1 ? "item" : "items"} in this folder`}
        action={<DashboardActions />}
        className="mb-4"
      />

      <FileManager
        items={items}
        showUploadZone
        searchPlaceholder={`Search in ${folder.name}…`}
        empty={{
          variant: "collection",
          icon: FolderOpen,
          title: "This folder is empty.",
          description: "Add files here, or move existing ones in from My Files.",
          action: <DashboardActions showFolder />,
          footnote: "Only folders and files that live directly here are listed.",
        }}
      />
    </div>
  );
}
