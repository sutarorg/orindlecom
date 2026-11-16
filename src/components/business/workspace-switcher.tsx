"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, ChevronsUpDown, User } from "lucide-react";
import { Menu } from "@/components/ui/menu";
import { cn } from "@/lib/utils";

/**
 * Workspace switcher.
 *
 * The single most important element in a two-context product: at any moment the
 * person must know whether they are looking at their own files or their team's.
 * So it sits above the navigation, always visible, and states the active
 * workspace in words rather than leaving it to be inferred from the nav items
 * below it.
 *
 * Exactly two workspaces exist because exactly two exist in the product. A list
 * of organizations the viewer doesn't belong to would be a lie, and a search box
 * for choosing between two things would be worse than the two things.
 */
export function WorkspaceSwitcher({
  collapsed,
  organization,
  viewerRole,
}: {
  collapsed: boolean;
  organization: { name: string; shortName: string; initials: string } | null;
  viewerRole: "owner" | "admin" | "member" | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);

  const inBusiness =
    pathname === "/dashboard/business" || pathname.startsWith("/dashboard/business/");

  const orgName = organization?.shortName ?? "Your organization";
  const initials = organization?.initials ?? "OR";

  const active = inBusiness
    ? { label: orgName, sub: viewerRole ? capitalize(viewerRole) : "Organization" }
    : { label: "Personal", sub: "Your own files" };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Workspace: ${active.label}. Switch workspace.`}
        className={cn(
          "flex w-full items-center rounded-xl border border-[var(--brand-border)] bg-white text-left transition-colors",
          "hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-canvas)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          collapsed ? "h-9 w-9 justify-center" : "h-11 gap-2 px-2",
        )}
      >
        {inBusiness ? (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#8B5CF6,#3178FB)] text-[10.5px] font-bold text-white"
            aria-hidden="true"
          >
            {initials}
          </span>
        ) : (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
            aria-hidden="true"
          >
            <User className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
        )}

        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold leading-tight text-ink">
                {active.label}
              </span>
              <span className="block truncate text-[10px] leading-tight text-text-subtle">
                {active.sub}
              </span>
            </span>
            <ChevronsUpDown
              className="h-3.5 w-3.5 shrink-0 text-text-subtle"
              strokeWidth={2}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchor={triggerRef.current}
        label="Switch workspace"
        width={236}
        align="start"
        items={[
          {
            key: "personal",
            label: "Personal",
            icon: User,
            shortcut: inBusiness ? undefined : "Current",
            onSelect: () => {
              setOpen(false);
              router.push("/dashboard");
            },
          },
          {
            key: "business",
            label: orgName,
            icon: Building2,
            shortcut: inBusiness ? "Current" : undefined,
            onSelect: () => {
              setOpen(false);
              router.push("/dashboard/business");
            },
          },
        ]}
      />
    </>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
