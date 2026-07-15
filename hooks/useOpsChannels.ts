'use client';

/**
 * W2.2 — multi-room realtime subscription for the ops center (§3-B).
 *
 * Generalizes useTourRoomChannel's transport-1 to N rooms: the channel
 * directory (/api/admin/tour-ops/channels) hands over every room's secret
 * Broadcast topic and this hook subscribes to all of them — supabase-js
 * multiplexes every topic over one WebSocket. Messages, locations, and
 * captions stream per room with zero polling; the REST aggregate poll is
 * demoted to a reconnect backup (W2.3) driven by the `connection` output.
 *
 * The customer hook's contract is untouched — its pure helpers
 * (mergeRoomMessages, applyLocationFrame) are reused here so the dedupe and
 * out-of-order semantics stay identical on the ops side.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  applyLocationFrame,
  mergeRoomMessages,
  type RoomCaption,
  type RoomLocation,
  type RoomMessage,
} from '@/hooks/useTourRoomChannel';

export interface OpsChannelDescriptor {
  roomId: string;
  bookingId: string;
  topic: string;
  status?: string | null;
}

export interface OpsSosSnapshot {
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OpsRoomStream {
  messages: RoomMessage[];
  locations: Record<string, RoomLocation>;
  latestCaption: RoomCaption | null;
  /** Newest SOS seen on the live stream — tracked incrementally so consumers
   *  never rescan the full history to find it (perf). */
  latestSos: OpsSosSnapshot | null;
}

export type OpsConnection = 'connecting' | 'realtime' | 'degraded' | 'offline';

const EMPTY_STREAM: OpsRoomStream = { messages: [], locations: {}, latestCaption: null, latestSos: null };

// Cap live history per room so an 8-hour shift can't grow the stream (and every
// O(n) derivation over it) without bound. 200 comfortably covers the drawer's
// 80-message feed and the 2-hour attention window.
const MAX_MESSAGES_PER_ROOM = 200;

function sosFromMessage(message: RoomMessage): OpsSosSnapshot | null {
  if ((message.metadata as { kind?: string } | undefined)?.kind !== 'sos') return null;
  return { metadata: (message.metadata as Record<string, unknown>) ?? {}, created_at: message.created_at };
}

const readCursorKey = (roomId: string) => `tour_ops_read:${roomId}`;

function readCursor(roomId: string): string {
  try {
    return window.localStorage.getItem(readCursorKey(roomId)) ?? '';
  } catch {
    return '';
  }
}

function writeCursor(roomId: string, cursor: string): void {
  try {
    window.localStorage.setItem(readCursorKey(roomId), cursor);
  } catch {
    /* unread badges just reset next session */
  }
}

/**
 * Pure: messages newer than the read cursor that ops needs to look at —
 * admin's own sends never count as unread.
 */
export function countUnread(messages: RoomMessage[], cursor: string): number {
  let count = 0;
  for (const message of messages) {
    if (message._local) continue;
    if (message.sender_role === 'admin') continue;
    if (!cursor || message.created_at > cursor) count += 1;
  }
  return count;
}

export interface UseOpsChannels {
  /** Per-room live streams, keyed by roomId. */
  streams: Record<string, OpsRoomStream>;
  /** realtime = every topic subscribed; degraded = some topics down (W2.3 backup poll territory). */
  connection: OpsConnection;
  /** Unread message count per roomId (persisted read cursor, localStorage). */
  unread: Record<string, number>;
  /** Newest SOS seen live per roomId (incremental — no history scan). */
  liveSos: Record<string, OpsSosSnapshot>;
  /** Mark a room read up to its latest received message. */
  markRead: (roomId: string) => void;
  /** Seed/merge REST-fetched messages (initial aggregate, backup poll) into a room's stream. */
  ingestMessages: (roomId: string, messages: RoomMessage[]) => void;
}

export interface UseOpsChannelsOptions {
  /**
   * Fired on a room lifecycle broadcast (status change → the topic HMAC
   * rotates, §R-23): the caller should refetch the channel directory.
   */
  onRoomEvent?: () => void;
}

export function useOpsChannels(channels: OpsChannelDescriptor[], options?: UseOpsChannelsOptions): UseOpsChannels {
  const [streams, setStreams] = useState<Record<string, OpsRoomStream>>({});
  const [connection, setConnection] = useState<OpsConnection>('connecting');
  // Read cursors are plain state seeded from localStorage per room; bumping
  // them re-derives `unread` without re-reading storage on every message.
  const [cursors, setCursors] = useState<Record<string, string>>({});

  // Resubscribe only when the topic set actually changes, not on every render
  // with a fresh array identity.
  const topicsKey = channels.map((channel) => channel.topic).sort().join('|');
  const channelsRef = useRef(channels);
  const onRoomEventRef = useRef(options?.onRoomEvent);
  useEffect(() => {
    channelsRef.current = channels;
    onRoomEventRef.current = options?.onRoomEvent;
  });

  const updateStream = useCallback((roomId: string, update: (stream: OpsRoomStream) => OpsRoomStream) => {
    setStreams((prev) => ({ ...prev, [roomId]: update(prev[roomId] ?? EMPTY_STREAM) }));
  }, []);

  const ingestMessages = useCallback(
    (roomId: string, messages: RoomMessage[]) => {
      if (messages.length === 0) return;
      updateStream(roomId, (stream) => {
        const merged = mergeRoomMessages(stream.messages, messages);
        // Track the newest SOS incrementally from the incoming batch so
        // consumers don't rescan history (perf); the cap can't drop it because
        // latestSos is kept out-of-band.
        let latestSos = stream.latestSos;
        for (const message of messages) {
          const sos = sosFromMessage(message);
          if (sos && (!latestSos || sos.created_at > latestSos.created_at)) latestSos = sos;
        }
        return {
          ...stream,
          messages: merged.length > MAX_MESSAGES_PER_ROOM ? merged.slice(-MAX_MESSAGES_PER_ROOM) : merged,
          latestSos,
        };
      });
    },
    [updateStream],
  );

  useEffect(() => {
    const list = channelsRef.current;
    // Date change / room set change: drop streams and cursors for rooms no
    // longer in scope so their unread/SOS badges can't linger as ghosts, and
    // memory can't grow across a long multi-date shift.
    const liveRoomIds = new Set(list.map((d) => d.roomId));
    setStreams((prev) => {
      const next: Record<string, OpsRoomStream> = {};
      let changed = false;
      for (const [roomId, stream] of Object.entries(prev)) {
        if (liveRoomIds.has(roomId)) next[roomId] = stream;
        else changed = true;
      }
      return changed ? next : prev;
    });
    // Seed read cursors once per room from storage so `unread` never does a
    // synchronous localStorage read inside its per-message memo.
    setCursors((prev) => {
      let next = prev;
      for (const roomId of liveRoomIds) {
        if (!(roomId in next)) {
          if (next === prev) next = { ...prev };
          next[roomId] = readCursor(roomId);
        }
      }
      return next;
    });

    const applyIdleState = () => setConnection(list.length === 0 ? 'connecting' : 'offline');
    if (list.length === 0 || !supabase) {
      applyIdleState();
      return;
    }
    const client = supabase;
    let disposed = false;

    const states = new Map<string, 'pending' | 'up' | 'down'>(list.map((d) => [d.topic, 'pending']));
    const recomputeConnection = () => {
      const values = [...states.values()];
      if (values.every((state) => state === 'up')) setConnection('realtime');
      else if (values.every((state) => state === 'down')) setConnection('offline');
      else if (values.some((state) => state === 'down')) setConnection('degraded');
      else setConnection('connecting');
    };

    const subscriptions = list.map((descriptor) => {
      const channel = client.channel(descriptor.topic, { config: { broadcast: { self: true } } });
      channel.on('broadcast', { event: 'message' }, (frame) => {
        const message = (frame.payload as { message?: RoomMessage })?.message;
        if (message) ingestMessages(descriptor.roomId, [message]);
      });
      channel.on('broadcast', { event: 'location' }, (frame) => {
        const location = (frame.payload as { location?: RoomLocation })?.location;
        if (location?.participant_id) {
          updateStream(descriptor.roomId, (stream) => ({
            ...stream,
            locations: applyLocationFrame(stream.locations, location),
          }));
        }
      });
      channel.on('broadcast', { event: 'room' }, () => {
        onRoomEventRef.current?.();
      });
      channel.on('broadcast', { event: 'caption' }, (frame) => {
        const caption = (frame.payload as { caption?: RoomCaption })?.caption;
        if (caption) {
          updateStream(descriptor.roomId, (stream) => ({
            ...stream,
            latestCaption:
              stream.latestCaption && stream.latestCaption.seq > caption.seq ? stream.latestCaption : caption,
          }));
        }
      });
      channel.subscribe((status) => {
        if (disposed) return; // ignore the async CLOSED that removeChannel fires post-teardown
        if (status === 'SUBSCRIBED') states.set(descriptor.topic, 'up');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          states.set(descriptor.topic, 'down');
        }
        recomputeConnection();
      });
      return channel;
    });

    return () => {
      disposed = true;
      for (const channel of subscriptions) client.removeChannel(channel);
    };
  }, [topicsKey, ingestMessages, updateStream]);

  const streamsRef = useRef(streams);
  useEffect(() => {
    streamsRef.current = streams;
  });

  const markRead = useCallback((roomId: string) => {
    const messages = streamsRef.current[roomId]?.messages ?? [];
    const latest = messages.length > 0 ? messages[messages.length - 1].created_at : new Date().toISOString();
    writeCursor(roomId, latest);
    setCursors((prev) => ({ ...prev, [roomId]: latest }));
  }, []);

  const unread = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [roomId, stream] of Object.entries(streams)) {
      // Cursors are pre-seeded on subscribe; fall back to '' (all unread) only
      // for a room whose seeding hasn't landed yet — never a sync storage read.
      out[roomId] = countUnread(stream.messages, cursors[roomId] ?? '');
    }
    return out;
  }, [streams, cursors]);

  // Newest SOS per room, derived from the incrementally-tracked latestSos so
  // this never scans message history.
  const liveSos = useMemo(() => {
    const out: Record<string, OpsSosSnapshot> = {};
    for (const [roomId, stream] of Object.entries(streams)) {
      if (stream.latestSos) out[roomId] = stream.latestSos;
    }
    return out;
  }, [streams]);

  return useMemo(
    () => ({ streams, connection, unread, liveSos, markRead, ingestMessages }),
    [streams, connection, unread, liveSos, markRead, ingestMessages],
  );
}
