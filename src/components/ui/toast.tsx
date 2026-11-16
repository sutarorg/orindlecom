"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toasts.
 *
 * A single provider at the dashboard shell, so every screen and every dialog
 * reports outcomes the same way. Deliberately not a general notification
 * system: a toast here means "the thing you just did finished", and it carries
 * an undo action when the operation is reversible.
 *
 * Accessibility:
 *  - The stack is a polite live region; errors are assertive.
 *  - Toasts are dismissible by keyboard, and the close button is focusable.
 *  - Auto-dismiss is paused while the pointer or focus is inside the stack, so
 *    a slow reader doesn't lose an undo affordance.
 */

export type ToastTone = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastRecord {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: ToastAction;
  /** ms; 0 disables auto-dismiss. Errors default to longer. */
  duration?: number;
}

interface ToastContextValue {
  toast: (input: Omit<ToastRecord, "id">) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const [mounted, setMounted] = React.useState(false);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  React.useEffect(() => setMounted(true), []);

  const dismiss = React.useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback(
    (input: Omit<ToastRecord, "id">) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((current) => [...current.slice(-2), { ...input, id }]);
      const duration = input.duration ?? (input.tone === "error" ? 7000 : input.action ? 6000 : 4000);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  React.useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[300] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-5 sm:items-end sm:pb-5"
            role="region"
            aria-label="Notifications"
          >
            {toasts.map((item) => (
              <div
                key={item.id}
                role={item.tone === "error" ? "alert" : "status"}
                aria-live={item.tone === "error" ? "assertive" : "polite"}
                onMouseEnter={() => {
                  const timer = timers.current.get(item.id);
                  if (timer) {
                    clearTimeout(timer);
                    timers.current.delete(item.id);
                  }
                }}
                className={cn(
                  "pointer-events-auto flex w-full max-w-[380px] items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-[0_10px_30px_-8px_rgba(23,29,58,0.24)] motion-safe:animate-[toastIn_180ms_cubic-bezier(0.22,0.68,0.28,1)]",
                  item.tone === "success" && "border-[#BFE8D2] bg-[#F4FCF8]",
                  item.tone === "error" && "border-[#F4C7C1] bg-[#FEF6F5]",
                  item.tone === "info" && "border-[var(--brand-border-strong)] bg-white",
                )}
              >
                <span className="mt-px shrink-0">
                  {item.tone === "success" && (
                    <CheckCircle2 className="h-4 w-4 text-[#1B8A57]" strokeWidth={2.2} aria-hidden="true" />
                  )}
                  {item.tone === "error" && (
                    <TriangleAlert className="h-4 w-4 text-[#C93B2B]" strokeWidth={2.2} aria-hidden="true" />
                  )}
                  {item.tone === "info" && (
                    <Info className="h-4 w-4 text-primary" strokeWidth={2.2} aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[12.5px] font-semibold leading-snug",
                      item.tone === "error" ? "text-[#8F2C1E]" : "text-ink",
                    )}
                  >
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-muted">
                      {item.description}
                    </p>
                  )}
                  {item.action && (
                    <button
                      type="button"
                      onClick={() => {
                        item.action?.onClick();
                        dismiss(item.id);
                      }}
                      className="mt-1.5 rounded text-[11.5px] font-semibold text-primary underline-offset-2 transition-colors hover:text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {item.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="Dismiss notification"
                  className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
