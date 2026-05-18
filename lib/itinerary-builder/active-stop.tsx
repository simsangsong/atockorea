"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * V2 redesign Phase 4 — bi-directional map ↔ timeline sync.
 *
 * Tracks which POI is "active" right now (hovered or just clicked), so
 * the map and timeline can highlight the same stop simultaneously.
 *
 * `source` tag prevents feedback loops (V-R5 mitigation): when the map
 * sets active for a hovered pin, the timeline's mouseenter handler may
 * re-fire (the auto-scroll into view triggers a hover on a different
 * card under the cursor, etc.). We ignore re-triggers from the OTHER
 * surface for `IGNORE_MS` after a setActive call.
 *
 * The ref-based ignore window is kept OUTSIDE React state to avoid
 * re-render cascades. Source is also exposed so consumers can choose
 * to react differently to "this stop became active because the user
 * hovered the map" vs "...because they clicked a timeline card."
 */

type ActiveSource = "map" | "timeline";

interface ActiveStopValue {
  /** Currently active POI key, or null when nothing is hovered/selected. */
  activeKey: string | null;
  /** Which surface initiated the current active state. */
  activeSource: ActiveSource | null;
  /** Set the active POI from a specific source. No-op during the
   *  cross-surface ignore window. */
  setActive: (key: string | null, source: ActiveSource) => void;
  /** Convenience — clears active state regardless of source. */
  clearActive: () => void;
}

const ActiveStopContext = createContext<ActiveStopValue | null>(null);

const IGNORE_MS = 100;

export function ActiveStopProvider({ children }: { children: React.ReactNode }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<ActiveSource | null>(null);
  // Tracks the timestamp of the LAST setActive call and which source did
  // it. Re-triggers from the OTHER source within IGNORE_MS are dropped.
  const lastWriteRef = useRef<{ source: ActiveSource | null; ts: number }>({
    source: null,
    ts: 0,
  });

  const setActive = useCallback((key: string | null, source: ActiveSource) => {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const last = lastWriteRef.current;
    // If a different source wrote recently, treat this call as the
    // ricochet event and ignore it.
    if (
      last.source &&
      last.source !== source &&
      now - last.ts < IGNORE_MS
    ) {
      return;
    }
    lastWriteRef.current = { source, ts: now };
    setActiveKey(key);
    setActiveSource(key == null ? null : source);
  }, []);

  const clearActive = useCallback(() => {
    setActiveKey(null);
    setActiveSource(null);
    lastWriteRef.current = { source: null, ts: 0 };
  }, []);

  const value = useMemo<ActiveStopValue>(
    () => ({ activeKey, activeSource, setActive, clearActive }),
    [activeKey, activeSource, setActive, clearActive]
  );

  return (
    <ActiveStopContext.Provider value={value}>{children}</ActiveStopContext.Provider>
  );
}

/**
 * Consume the active-stop state. Returns no-op handlers when called
 * outside an `<ActiveStopProvider>` — this lets surface components stay
 * standalone-renderable (e.g. for storybook/tests) without crashing.
 */
export function useActiveStop(): ActiveStopValue {
  const ctx = useContext(ActiveStopContext);
  if (ctx) return ctx;
  return {
    activeKey: null,
    activeSource: null,
    setActive: () => {},
    clearActive: () => {},
  };
}
