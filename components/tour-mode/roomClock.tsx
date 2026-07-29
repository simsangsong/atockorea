'use client';

/**
 * SG-0c — one clock for the whole room (SG-D4, 제로베이스 §H "시계는 하나").
 *
 * Every countdown in the room used to read the DEVICE clock, which is the
 * one clock nobody controls: a guest whose phone drifts five minutes fires
 * the rally ladder five minutes wrong, and "내 시계로는 안 늦었어요" becomes
 * an argument the app cannot win. The snapshot now carries the server's
 * `server_now_ms`; this provider turns it into an offset once per load and
 * hands every consumer the same corrected `() => number`.
 *
 * The offset deliberately includes network/render latency (a second or two
 * of "behind" is noise next to minutes of device skew) and is computed in a
 * lazy ref, not at render — computing it during SSR would bake the server's
 * own time into HTML and re-derive a different offset on the client.
 *
 * Consumers outside a provider (tests, storybook-style mounts, ops surfaces)
 * fall back to the device clock — exactly the behavior they had before.
 */
import { createContext, useContext, useRef, type ReactNode } from 'react';

type NowFn = () => number;

const RoomClockContext = createContext<NowFn>(() => Date.now());

export function RoomClockProvider({
  serverNowMs,
  children,
}: {
  /** Stamped by buildRoomSnapshot; absent on old cached payloads. */
  serverNowMs?: number | null;
  children: ReactNode;
}) {
  // One offset per mount, captured the first time the provider renders on
  // the client with a usable stamp. A ref (not memo) so a re-render with the
  // same snapshot never re-anchors the clock mid-tick.
  const nowFnRef = useRef<NowFn | null>(null);
  if (nowFnRef.current === null) {
    if (typeof serverNowMs === 'number' && Number.isFinite(serverNowMs)) {
      const offset = serverNowMs - Date.now();
      nowFnRef.current = () => Date.now() + offset;
    } else {
      nowFnRef.current = () => Date.now();
    }
  }
  return (
    <RoomClockContext.Provider value={nowFnRef.current}>{children}</RoomClockContext.Provider>
  );
}

/** The room's corrected clock; device clock when no provider is mounted. */
export function useRoomClock(): NowFn {
  return useContext(RoomClockContext);
}
