"use client";

import * as React from "react";

/**
 * Bridges the topbar search field to whichever list is on screen.
 *
 * The topbar lives in the shell, above the page, so it has no way to reach the
 * file manager's internal filter state. Rather than lifting every list's
 * search into a global store (which would mean the shell knowing about sort,
 * filters and pagination too), the mounted manager registers its setter here
 * and the topbar dispatches into it.
 *
 * When nothing is registered the topbar hides the field entirely, so there is
 * never an input that swallows keystrokes and does nothing.
 */
interface SearchBridge {
  register: (setter: ((value: string) => void) | null) => void;
  setValue: (value: string) => void;
  active: boolean;
}

const SearchBridgeContext = React.createContext<SearchBridge | null>(null);

export function SearchBridgeProvider({ children }: { children: React.ReactNode }) {
  const setterRef = React.useRef<((value: string) => void) | null>(null);
  const [active, setActive] = React.useState(false);

  const bridge = React.useMemo<SearchBridge>(
    () => ({
      register: (setter) => {
        setterRef.current = setter;
        setActive(setter !== null);
      },
      setValue: (value) => setterRef.current?.(value),
      active,
    }),
    [active],
  );

  return <SearchBridgeContext.Provider value={bridge}>{children}</SearchBridgeContext.Provider>;
}

export function useSearchBridge(): SearchBridge {
  const bridge = React.useContext(SearchBridgeContext);
  if (!bridge) throw new Error("useSearchBridge must be used inside SearchBridgeProvider");
  return bridge;
}

/** Called by a list to claim the topbar field while it is mounted. */
export function useRegisterSearch(setter: (value: string) => void) {
  const { register } = useSearchBridge();

  // The setter from React state is stable; re-registering on every render would
  // thrash the `active` flag.
  React.useEffect(() => {
    register(setter);
    return () => register(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
