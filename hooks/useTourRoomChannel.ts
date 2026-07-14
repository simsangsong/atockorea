'use client';

/**
 * T1.5 — realtime message channel for a tour room (§B D-1, §O-6).
 *
 * Transport ladder:
 *   1. Supabase Realtime Broadcast on the secret room topic (receive-only,
 *      anon key) — the server rebroadcasts every committed write (§O-7);
 *   2. SSE fallback (/events, native EventSource auto-reconnect) when the
 *      Realtime subscription errors or times out — old browsers, blocked
 *      WebSockets (R-3);
 *   3. `visibilitychange` REST resync via the snapshot API — broadcasts missed
 *      while the phone was locked are recovered from the `after` cursor
 *      (§O-6: unlock ⇒ backlog restored).
 *
 * Loss prevention (R-5): messages dedupe by id across all three sources;
 * sends are optimistic with a localStorage-backed unsent queue that flushes
 * on the next successful connection or an explicit retry.
 *
 * Manual acceptance scenario (AC): airplane-mode the device mid-chat, send
 * twice (both queue as failed), disable airplane mode → retryFailed() → both
 * deliver exactly once; locked-screen broadcasts appear on unlock.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { QuickReplyPreset } from '@/lib/tour-room/quickReplies';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export interface RoomMessage {
  id: string;
  room_id?: string;
  sender_role: string;
  input_kind?: string;
  source_text: string;
  source_locale?: string | null;
  translations?: Record<string, string>;
  metadata?: Record<string, unknown>;
  created_at: string;
  /** Client-only: set while an optimistic send is in flight or failed. */
  _local?: 'sending' | 'failed';
}

export type RoomConnection = 'connecting' | 'realtime' | 'sse' | 'offline';

/** Pure merge: dedupe by id (server wins over optimistic), sort by created_at. */
export function mergeRoomMessages(existing: RoomMessage[], incoming: RoomMessage[]): RoomMessage[] {
  if (incoming.length === 0) return existing;
  const byId = new Map<string, RoomMessage>();
  for (const message of existing) byId.set(message.id, message);
  for (const message of incoming) {
    if (!message?.id) continue;
    const current = byId.get(message.id);
    // A server copy (no _local) replaces an optimistic one; never the reverse.
    if (!current || !message._local) byId.set(message.id, message);
  }
  return [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

/** Latest server-side cursor in a list (ignores optimistic entries). */
export function latestCursor(messages: RoomMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (!messages[i]._local) return messages[i].created_at;
  }
  return null;
}

const unsentKey = (bookingId: string) => `tour_mode_unsent:${bookingId}`;

/** A queued outbound send: free text or a quick-reply preset key (§M-2 ②). */
export type QueuedSend = { text?: string; presetKey?: string };

function readUnsentQueue(bookingId: string): QueuedSend[] {
  try {
    const raw = window.localStorage.getItem(unsentKey(bookingId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<string | QueuedSend>;
    // Backward-compat: early builds queued plain strings.
    return parsed.map((entry) => (typeof entry === 'string' ? { text: entry } : entry));
  } catch {
    return [];
  }
}

function writeUnsentQueue(bookingId: string, queue: QueuedSend[]): void {
  try {
    if (queue.length === 0) window.localStorage.removeItem(unsentKey(bookingId));
    else window.localStorage.setItem(unsentKey(bookingId), JSON.stringify(queue));
  } catch {
    /* noop */
  }
}

export interface UseTourRoomChannelOptions {
  bookingId: string;
  /** Secret Broadcast topic from /join (null until joined). */
  channelTopic: string | null;
  /** Signed room session from /join — REST resync header + SSE `rs` query. */
  roomSession: string | null;
  initialMessages?: RoomMessage[];
}

export interface UseTourRoomChannel {
  messages: RoomMessage[];
  connection: RoomConnection;
  /** Send a text message (optimistic; queues on failure). */
  sendText: (text: string) => Promise<boolean>;
  /** Send a pre-translated quick reply — zero server-side LLM calls (§M-2 ②). */
  sendPreset: (preset: QuickReplyPreset, viewerLocale: RoomLocale) => Promise<boolean>;
  /** Re-send everything in the failed/unsent queue. */
  retryFailed: () => Promise<void>;
  failedCount: number;
}

export function useTourRoomChannel(options: UseTourRoomChannelOptions): UseTourRoomChannel {
  const { bookingId, channelTopic, roomSession } = options;
  const [messages, setMessages] = useState<RoomMessage[]>(options.initialMessages ?? []);
  const [connection, setConnection] = useState<RoomConnection>('connecting');
  const [failedCount, setFailedCount] = useState(0);

  const cursorRef = useRef<string | null>(latestCursor(options.initialMessages ?? []));
  const sseRef = useRef<EventSource | null>(null);
  const sendingRef = useRef(false);

  const addMessages = useCallback((incoming: RoomMessage[]) => {
    setMessages((prev) => {
      const next = mergeRoomMessages(prev, incoming);
      const cursor = latestCursor(next);
      if (cursor) cursorRef.current = cursor;
      return next;
    });
  }, []);

  // --- transport 2: SSE fallback -------------------------------------------
  const startSse = useCallback(() => {
    if (!roomSession || sseRef.current) return;
    const params = new URLSearchParams();
    if (cursorRef.current) params.set('after', cursorRef.current);
    params.set('rs', roomSession);
    const source = new EventSource(`/api/tour-rooms/${encodeURIComponent(bookingId)}/events?${params}`);
    sseRef.current = source;
    source.addEventListener('message', (event) => {
      try {
        addMessages([JSON.parse((event as MessageEvent).data) as RoomMessage]);
      } catch {
        /* skip malformed frame */
      }
    });
    source.addEventListener('open', () => setConnection('sse'));
    source.addEventListener('error', () => {
      // EventSource reconnects natively; flag the gap for the user meanwhile.
      setConnection((prev) => (prev === 'sse' ? 'offline' : prev));
    });
  }, [addMessages, bookingId, roomSession]);

  // --- transport 1: Realtime Broadcast --------------------------------------
  useEffect(() => {
    if (!channelTopic || !supabase) {
      if (channelTopic) startSse(); // no realtime client at all → straight to SSE
      return;
    }
    const client = supabase;
    const channel = client.channel(channelTopic, { config: { broadcast: { self: true } } });
    channel.on('broadcast', { event: 'message' }, (frame) => {
      const message = (frame.payload as { message?: RoomMessage })?.message;
      if (message) addMessages([message]);
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnection('realtime');
        if (sseRef.current) {
          sseRef.current.close(); // realtime recovered — drop the fallback
          sseRef.current = null;
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        startSse(); // R-3: degrade rather than go silent
      }
    });

    return () => {
      client.removeChannel(channel);
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [addMessages, channelTopic, startSse]);

  // --- transport 3: visibility resync (§O-6) --------------------------------
  useEffect(() => {
    if (!roomSession) return;
    const resync = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/api/tour-mode/room/${encodeURIComponent(bookingId)}/snapshot`, {
          headers: { 'x-tour-room-auth': roomSession },
        });
        if (!res.ok) return;
        const snapshot = (await res.json()) as { messages?: RoomMessage[] };
        if (snapshot.messages) addMessages(snapshot.messages);
      } catch {
        /* still offline — next visibility change tries again */
      }
    };
    document.addEventListener('visibilitychange', resync);
    return () => document.removeEventListener('visibilitychange', resync);
  }, [addMessages, bookingId, roomSession]);

  // --- sending ---------------------------------------------------------------
  const postSend = useCallback(
    async (payload: QueuedSend): Promise<RoomMessage | null> => {
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(roomSession ? { 'x-tour-room-auth': roomSession } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { message?: RoomMessage };
      return json.message ?? null;
    },
    [bookingId, roomSession],
  );

  const sendOptimistic = useCallback(
    async (payload: QueuedSend, optimistic: RoomMessage): Promise<boolean> => {
      setMessages((prev) => mergeRoomMessages(prev, [optimistic]));
      try {
        const delivered = await postSend(payload);
        if (delivered) {
          setMessages((prev) => mergeRoomMessages(prev.filter((m) => m.id !== optimistic.id), [delivered]));
          return true;
        }
        throw new Error('send_failed');
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, _local: 'failed' as const } : m)),
        );
        const queue = readUnsentQueue(bookingId);
        queue.push(payload);
        writeUnsentQueue(bookingId, queue);
        setFailedCount(queue.length);
        return false;
      }
    },
    [bookingId, postSend],
  );

  const makeOptimistic = (sourceText: string, extra?: Partial<RoomMessage>): RoomMessage => ({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender_role: 'customer',
    source_text: sourceText,
    created_at: new Date().toISOString(),
    _local: 'sending',
    ...extra,
  });

  const sendText = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      return sendOptimistic({ text: trimmed }, makeOptimistic(trimmed));
    },
    [sendOptimistic],
  );

  const sendPreset = useCallback(
    async (preset: QuickReplyPreset, viewerLocale: RoomLocale): Promise<boolean> => {
      return sendOptimistic(
        { presetKey: preset.key },
        makeOptimistic(preset.text[viewerLocale] ?? preset.text.en, {
          translations: { ...preset.text },
          metadata: { kind: 'quick_reply', preset_key: preset.key },
        }),
      );
    },
    [sendOptimistic],
  );

  const retryFailed = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
      let queue = readUnsentQueue(bookingId);
      while (queue.length > 0) {
        const delivered = await postSend(queue[0]);
        if (!delivered) break; // still failing — keep the rest queued
        addMessages([delivered]);
        queue = queue.slice(1);
        writeUnsentQueue(bookingId, queue);
      }
      setFailedCount(queue.length);
      if (queue.length === 0) {
        setMessages((prev) => prev.filter((m) => m._local !== 'failed'));
      }
    } finally {
      sendingRef.current = false;
    }
  }, [addMessages, bookingId, postSend]);

  return useMemo(
    () => ({ messages, connection, sendText, sendPreset, retryFailed, failedCount }),
    [messages, connection, sendText, sendPreset, retryFailed, failedCount],
  );
}
