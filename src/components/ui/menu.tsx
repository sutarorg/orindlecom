"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Dropdown / context menu.
 *
 * A menu in this product is always a list of actions on something, so the
 * component commits to that model rather than being a generic popover:
 *
 *  - Renders in a portal so it is never clipped by a scrolling file list.
 *  - Positions itself against the trigger, flipping when it would overflow the
 *    viewport, and clamps on narrow screens.
 *  - Arrow keys move, Home/End jump, Escape closes, Tab closes and lets focus
 *    continue naturally (a menu is not a focus trap).
 *  - Clicking outside closes; scrolling the page closes it, so a menu never
 *    floats away from its anchor.
 */

export interface MenuItem {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  onSelect: () => void;
  /** Renders in the destructive colour. */
  destructive?: boolean;
  disabled?: boolean;
  /** Secondary line under the label, for context the label cannot carry. */
  description?: string;
  /** Right-aligned hint, e.g. a keyboard shortcut. */
  shortcut?: string;
  /** Draw a hairline above this item. */
  separatorBefore?: boolean;
}

export function Menu({
  open,
  onClose,
  anchor,
  items,
  align = "end",
  width = 208,
  label = "Actions",
}: {
  open: boolean;
  onClose: () => void;
  /** The element to position against. */
  anchor: HTMLElement | null;
  items: MenuItem[];
  align?: "start" | "end";
  width?: number;
  label?: string;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Position after mount so the panel has a measurable height for the flip.
  React.useLayoutEffect(() => {
    if (!open || !anchor || !panelRef.current) return;

    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const height = panelRef.current?.offsetHeight ?? 0;
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let top = rect.bottom + 6;
      // Flip above when there isn't room below and there is room above.
      if (top + height > vh - margin && rect.top - height - 6 > margin) {
        top = rect.top - height - 6;
      }
      top = Math.max(margin, Math.min(top, vh - height - margin));

      let left = align === "end" ? rect.right - width : rect.left;
      left = Math.max(margin, Math.min(left, vw - width - margin));

      setPosition({ top, left });
    };

    place();

    const onScrollOrResize = () => onClose();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, anchor, align, width, onClose]);

  React.useEffect(() => {
    if (!open) return;

    const items_ = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
      );

    const raf = requestAnimationFrame(() => items_()[0]?.focus());

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const all = items_();
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        anchor?.focus();
        return;
      }
      if (event.key === "Tab") {
        onClose();
        return;
      }
      if (all.length === 0) return;
      const index = all.indexOf(document.activeElement as HTMLElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        all[(index + 1) % all.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        all[(index - 1 + all.length) % all.length]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        all[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        all[all.length - 1]?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, anchor]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label={label}
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width,
        // Don't flash at the wrong place on the first frame.
        visibility: position ? "visible" : "hidden",
      }}
      className="fixed z-[250] overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white py-1 shadow-[0_10px_30px_-6px_rgba(23,29,58,0.2),0_2px_6px_rgba(23,29,58,0.06)] motion-safe:animate-[menuIn_110ms_ease-out]"
    >
      {items.map((item) => (
        <React.Fragment key={item.key}>
          {item.separatorBefore && (
            <div aria-hidden="true" className="my-1 h-px bg-[var(--brand-border-soft)]" />
          )}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-medium transition-colors",
              "focus:outline-none disabled:pointer-events-none disabled:opacity-40",
              item.destructive
                ? "text-[#C93B2B] hover:bg-[#FDF3F2] focus:bg-[#FDF3F2]"
                : "text-text hover:bg-[var(--brand-surface-muted)] focus:bg-[var(--brand-surface-muted)]",
            )}
          >
            {item.icon && (
              <item.icon
                className={cn("h-3.5 w-3.5 shrink-0", item.destructive ? "" : "text-text-subtle")}
                strokeWidth={2}
                aria-hidden
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{item.label}</span>
              {item.description && (
                <span className="block truncate text-[10.5px] font-normal text-text-subtle">
                  {item.description}
                </span>
              )}
            </span>
            {item.shortcut && (
              <span className="shrink-0 font-mono text-[10.5px] text-text-subtle">
                {item.shortcut}
              </span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>,
    document.body,
  );
}
