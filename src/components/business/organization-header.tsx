"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Copy, Check, Users } from "lucide-react";
import { Menu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import type { Organization } from "@/lib/business/types";
import { roleDefinition } from "@/lib/business/roles";
import { RoleBadge } from "./role-badge";
import { cn } from "@/lib/utils";

/**
 * Organization header.
 *
 * The identity block for the workspace: who this team is, what plan it's on, and
 * what the viewer's role is. Reused on the overview, storage and settings pages
 * so those three screens can't drift into describing the organization three
 * different ways.
 *
 * The role badge lives here rather than in the topbar because it answers a
 * question people ask while looking at permissions — "what am I allowed to do?"
 * — not one they ask while browsing files.
 */
export function OrganizationHeader({
  organization,
  compact = false,
  className,
}: {
  organization: Organization;
  compact?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);

  const copyId = async () => {
    // Only claim a copy when the clipboard actually accepted it.
    try {
      await navigator.clipboard.writeText(organization.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({
        tone: "error",
        title: "Couldn't copy",
        description: "Your browser blocked clipboard access. The ID is shown in full above.",
      });
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--brand-border)] bg-white",
        compact ? "px-3.5 py-2.5" : "px-4 py-3.5",
        className,
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#8B5CF6,#3178FB)] font-bold text-white",
          compact ? "h-9 w-9 text-[12px]" : "h-11 w-11 text-[14px]",
        )}
        aria-hidden="true"
      >
        {organization.initials}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2
            className={cn(
              "truncate font-extrabold tracking-[-0.03em] text-ink",
              compact ? "text-[14px]" : "text-[17px]",
            )}
          >
            {organization.name}
          </h2>
          <RoleBadge role={organization.viewerRole} />
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-muted">
          <span>{organization.planName} plan</span>
          <span aria-hidden="true" className="text-text-subtle">·</span>
          <span className="flex items-center gap-1">
            <Users className="h-2.5 w-2.5 text-text-subtle" strokeWidth={2.4} aria-hidden="true" />
            {roleDefinition(organization.viewerRole).summary.split(".")[0]}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={copyId}
          className="flex h-7 items-center gap-1 rounded-md border border-[var(--brand-border)] bg-white px-1.5 text-[10.5px] font-medium text-text-muted transition-colors hover:border-[var(--brand-border-strong)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Copy organization ID"
        >
          {copied ? (
            <Check className="h-3 w-3 text-[#1B8A57]" strokeWidth={2.6} aria-hidden="true" />
          ) : (
            <Copy className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{copied ? "Copied" : "ID"}</span>
        </button>

        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Organization actions"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--brand-border)] bg-white text-text-subtle transition-colors hover:border-[var(--brand-border-strong)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchor={triggerRef.current}
        label="Organization actions"
        width={210}
        items={[
          {
            key: "switch",
            label: "Back to my files",
            icon: Building2,
            onSelect: () => {
              setOpen(false);
              router.push("/dashboard");
            },
          },
          {
            key: "settings",
            label: "Organization settings",
            icon: Users,
            onSelect: () => {
              setOpen(false);
              router.push("/business/settings");
            },
          },
          {
            key: "contact",
            label: "Contact support",
            onSelect: () => {
              setOpen(false);
              router.push("/contact");
            },
          },
        ]}
      />
    </div>
  );
}
