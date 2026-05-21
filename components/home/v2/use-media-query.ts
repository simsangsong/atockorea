"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query without a synchronous setState-in-effect
 * (satisfies `react-hooks/set-state-in-effect`).
 *
 * Uses `useSyncExternalStore` so React reads `mq.matches` directly instead of
 * mirroring it into component state inside an effect. `getServerSnapshot`
 * returns `false`, which preserves the previous `useState(false)` first-render
 * behavior — SSR / first hydration render reports "no match", then the real
 * value applies once subscribed. (The home matcher consumers are mounted
 * `ssr: false`, so no server HTML is produced for them either way.)
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
