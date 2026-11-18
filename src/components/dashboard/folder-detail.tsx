"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, FolderOpen, Home } from "lucide-react";
import { FileManager } from "./file-manager";
import { DashboardActions } from "./dashboard-header-actions";
import { PageHeader } from "./page-header";
import { folderHrefFromIds, type FolderCrumb } from "@/lib/drive/folder-path";
import type { DriveItem } from "@/lib/drive/types";

/**
 * A single folder.
 *
 * The breadcrumb is the folder's real ancestry, root first, and every crumb links to
 * its own canonical address — `My Files > Projects > Website > Design` is four
 * cumulative URLs, not four bare ids. Each one is a real link, so the back button and
 * middle-click behave as expected.
 *
 * `ancestors` arrives already resolved (id and name per level) and includes the folder
 * itself as the last entry; that is what makes a cumulative URL buildable without the
 * component knowing anything about the tree.
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
  /*
   * The chain including this folder, so a crumb's href can be the chain up to and
   * including that crumb. A trailing entry equal to this folder is dropped so the
   * trail does not render the page title twice.
   */
  const trail: FolderCrumb[] =
    ancestors.length > 0 && ancestors[ancestors.length - 1].id === folder.id
      ? ancestors
      : [...ancestors, { id: folder.id, name: folder.name }];

  const crumbs = trail.slice(0, -1);

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
          {crumbs.map((crumb, index) => (
            <li key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-text-subtle" strokeWidth={2.2} aria-hidden="true" />
              <Link
                /*
                 * The cumulative address of this level, not this level's id.
                 *
                 * `/dashboard/folders/${crumb.id}` still resolves — the catch-all route
                 * accepts it and redirects to the canonical form — but it is not the
                 * address a link should publish: two folders with the same name in
                 * different branches would produce identical one-id URLs, and nothing
                 * about the hierarchy would be visible in the href.
                 */
                href={folderHrefFromIds(trail.slice(0, index + 1).map((entry) => entry.id))}
                className="inline-flex min-h-[28px] max-w-[140px] items-center truncate rounded px-1 py-0.5 font-medium text-text-muted transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {/*
                  A crumb whose name could not be resolved still works as a link —
                  the id came from the path column, so the destination is known even
                  when the label is not. "Untitled folder" says that honestly; a
                  blank crumb would look like a rendering bug and a uuid would leak
                  the database into the breadcrumb.
                */}
                {crumb.name || "Untitled folder"}
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
        /*
         * "items" is every entry the listing returned, which is exactly what is
         * rendered below it — subfolders included. It said "files" once and counted
         * only files, while the grid beneath showed folders too.
         */
        description={`${items.length} ${items.length === 1 ? "item" : "items"} in this folder`}
        action={<DashboardActions parentId={folder.id} />}
        className="mb-4"
      />

      {/*
        * `parentId` is what makes the drop zone and the toolbar's upload actions
        * target *this* folder. Without it `FileManager` defaulted to the account root,
        * so the zone said "goes into the folder you're viewing" and delivered files to
        * the top of the drive — the single most misleading behaviour in this page.
        */}
      <FileManager
        items={items}
        parentId={folder.id}
        showUploadZone
        searchPlaceholder={`Search in ${folder.name}…`}
        empty={{
          variant: "collection",
          icon: FolderOpen,
          title: "This folder is empty.",
          description: "Add files here, or move existing ones in from My Files.",
          action: <DashboardActions showFolder parentId={folder.id} />,
          footnote: "Only folders and files that live directly here are listed.",
        }}
      />
    </div>
  );
}
