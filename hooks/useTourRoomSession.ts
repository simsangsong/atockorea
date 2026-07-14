'use client';

/**
 * T1.4 — client session for a tour room (master plan §D/§E).
 *
 * Owns the join lifecycle against POST /api/tour-rooms/[bookingId]/join:
 *   - device_key: a client-generated uuid persisted in localStorage; it is the
 *     participant identity key (§O-4 — two "John"s never merge, a rename never
 *     forks a participant);
 *   - room session: the signed x-tour-room-auth value from /join, kept in
 *     localStorage per booking so a browser restart or app switch re-enters
 *     with zero friction (§O-1 ④) — restore() simply re-joins with the stored
 *     session as the credential, which also re-issues the secret channel topic
 *     (only ever handed out by /join, R-23);
 *   - join credentials: invite token (?rt=), guest email match, or the
 *     logged-in cookie session — whichever the caller passes through.
 */

import { useCallback, useRef, useState } from 'react';

const DEVICE_KEY_STORAGE = 'tour_mode_device_key';
const sessionStorageKey = (bookingId: string) => `tour_mode_room_session:${bookingId}`;

export function getOrCreateDeviceKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY_STORAGE);
    if (existing) return existing;
    const fresh = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
    window.localStorage.setItem(DEVICE_KEY_STORAGE, fresh);
    return fresh;
  } catch {
    return '';
  }
}

export function readStoredRoomSession(bookingId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(sessionStorageKey(bookingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { session?: string };
    return typeof parsed.session === 'string' ? parsed.session : null;
  } catch {
    return null;
  }
}

function storeRoomSession(bookingId: string, session: string): void {
  try {
    window.localStorage.setItem(sessionStorageKey(bookingId), JSON.stringify({ session, savedAt: Date.now() }));
  } catch {
    /* private mode etc. — re-entry just needs the link again */
  }
}

export function clearStoredRoomSession(bookingId: string): void {
  try {
    window.localStorage.removeItem(sessionStorageKey(bookingId));
  } catch {
    /* noop */
  }
}

export interface JoinCredentials {
  token?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  displayName?: string | null;
  locale?: string | null;
  ttsCapable?: boolean;
}

export interface TourRoomJoinResult {
  room: { id: string; status: string; [key: string]: unknown };
  lifecycle: 'lobby' | 'live' | 'ended';
  participant: { id: string; role: string; display_name: string; locale: string; [key: string]: unknown };
  session: string;
  channel: { topic: string };
  snapshot: Record<string, unknown>;
}

export type TourRoomSessionState =
  | { status: 'idle' }
  | { status: 'joining' }
  | { status: 'joined'; data: TourRoomJoinResult }
  | { status: 'error'; httpStatus: number | null; error: string };

export interface UseTourRoomSession {
  state: TourRoomSessionState;
  /** Join with explicit credentials (token / guest match / cookie session). */
  join: (credentials?: JoinCredentials) => Promise<TourRoomJoinResult | null>;
  /** Re-enter using the stored room session; resolves null when none stored. */
  restore: () => Promise<TourRoomJoinResult | null>;
  /** The signed header value for follow-up API calls (x-tour-room-auth). */
  roomSession: string | null;
  deviceKey: string;
}

export function useTourRoomSession(bookingId: string | null | undefined): UseTourRoomSession {
  const [state, setState] = useState<TourRoomSessionState>({ status: 'idle' });
  const [roomSession, setRoomSession] = useState<string | null>(() =>
    typeof window !== 'undefined' && bookingId ? readStoredRoomSession(bookingId) : null,
  );
  const [deviceKey] = useState<string>(() => (typeof window !== 'undefined' ? getOrCreateDeviceKey() : ''));
  const inflight = useRef<Promise<TourRoomJoinResult | null> | null>(null);

  const doJoin = useCallback(
    async (credentials: JoinCredentials, sessionHeader: string | null): Promise<TourRoomJoinResult | null> => {
      if (!bookingId || !deviceKey) return null;
      setState({ status: 'joining' });
      try {
        const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionHeader ? { 'x-tour-room-auth': sessionHeader } : {}),
          },
          body: JSON.stringify({
            deviceKey,
            token: credentials.token || undefined,
            contactEmail: credentials.contactEmail || undefined,
            contactName: credentials.contactName || undefined,
            displayName: credentials.displayName || undefined,
            locale: credentials.locale || undefined,
            ...(typeof credentials.ttsCapable === 'boolean' ? { ttsCapable: credentials.ttsCapable } : {}),
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (sessionHeader && (res.status === 401 || res.status === 403)) {
            clearStoredRoomSession(bookingId); // stale/expired session — next attempt needs real creds
          }
          setState({ status: 'error', httpStatus: res.status, error: body.error || `join_failed_${res.status}` });
          return null;
        }
        const data = (await res.json()) as TourRoomJoinResult;
        storeRoomSession(bookingId, data.session);
        setRoomSession(data.session);
        setState({ status: 'joined', data });
        return data;
      } catch (error) {
        setState({
          status: 'error',
          httpStatus: null,
          error: error instanceof Error ? error.message : 'network_error',
        });
        return null;
      }
    },
    [bookingId, deviceKey],
  );

  const join = useCallback(
    (credentials: JoinCredentials = {}) => {
      const run = doJoin(credentials, bookingId ? readStoredRoomSession(bookingId) : null);
      inflight.current = run;
      return run;
    },
    [bookingId, doJoin],
  );

  const restore = useCallback(async () => {
    if (!bookingId) return null;
    const stored = readStoredRoomSession(bookingId);
    if (!stored) return null;
    return doJoin({}, stored);
  }, [bookingId, doJoin]);

  return { state, join, restore, roomSession, deviceKey };
}
