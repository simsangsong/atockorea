/**
 * Server-side Realtime Broadcast for Tour Mode rooms (§B D-1, §O-7, T0.7).
 *
 * API routes never open a WebSocket: after writing to the DB they POST the
 * event to Supabase Realtime's HTTP broadcast endpoint with the service-role
 * key, and subscribed clients (anon key, receive-only) get it on the room
 * channel. This keeps writes on the existing authenticated API path and works
 * within serverless function lifetimes.
 *
 * Channel names include a per-room secret so a leaked roomId alone cannot be
 * used to eavesdrop (R-23): tour-room:{roomId}:{channelSecret8}. The secret is
 * derived (HMAC) rather than stored, and rotates when the room closes because
 * the room status is part of the derivation input.
 */

import { createHmac } from 'node:crypto';

export type RoomBroadcastEvent =
  | 'message'        // new chat/system message row
  | 'caption'        // live interpretation caption (ephemeral, T2.7)
  | 'location'       // participant location ping rebroadcast (T3.1)
  | 'participant'    // participant joined / updated
  | 'room'           // room status change (closed, etc.)
  | 'reaction'       // Kakao-grade: emoji reaction added/removed on a message
  | 'read'           // read-cursor advanced by a participant (read receipts)
  | 'typing';        // ephemeral typing ping (not persisted)

function channelSigningSecret(): string {
  return (
    process.env.TOUR_ROOM_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'atoc-tour-room-dev-secret'
  );
}

/**
 * Derive the 8-char channel secret for a room. Deriving from (roomId, status)
 * means closing a room rotates its channel name without any stored state.
 */
export function roomChannelSecret(roomId: string, roomStatus: string): string {
  return createHmac('sha256', channelSigningSecret())
    .update(`tour-room-channel:${roomId}:${roomStatus}`)
    .digest('hex')
    .slice(0, 8);
}

/** Full Broadcast topic for a room. Returned to clients only by the join API. */
export function roomChannelTopic(roomId: string, roomStatus = 'active'): string {
  return `tour-room:${roomId}:${roomChannelSecret(roomId, roomStatus)}`;
}

export interface BroadcastResult {
  ok: boolean;
  status?: number;
  error?: string;
}

interface BroadcastMessage {
  topic: string;
  event: RoomBroadcastEvent;
  payload: Record<string, unknown>;
}

async function postBroadcast(messages: BroadcastMessage[]): Promise<BroadcastResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, error: 'Supabase broadcast env is not configured' };
  }

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map((m) => ({
          topic: m.topic,
          event: m.event,
          payload: m.payload,
          private: false, // receive-only public channel; the topic secret is the gate (R-23)
        })),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: text.slice(0, 500) };
    }
    return { ok: true, status: res.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Fire-and-forget broadcast to one room. Delivery is best-effort by design:
 * the DB row is the source of truth and clients recover gaps via the `after`
 * cursor (SSE fallback / visibilitychange resync, §O-6), so a broadcast
 * failure must never fail the API request that already committed the write.
 */
export async function broadcastToRoom(
  room: { id: string; status?: string | null },
  event: RoomBroadcastEvent,
  payload: Record<string, unknown>,
): Promise<BroadcastResult> {
  const topic = roomChannelTopic(room.id, room.status ?? 'active');
  const result = await postBroadcast([{ topic, event, payload }]);
  if (!result.ok) {
    console.warn(`[tour-room] broadcast failed for room ${room.id} (${event}):`, result.error ?? result.status);
  }
  return result;
}

/** Fan-out variant used by the guide console / ops broadcast (D-3, T6.1). */
export async function broadcastToRooms(
  rooms: Array<{ id: string; status?: string | null }>,
  event: RoomBroadcastEvent,
  payload: Record<string, unknown>,
): Promise<BroadcastResult> {
  if (rooms.length === 0) return { ok: true };
  const result = await postBroadcast(
    rooms.map((room) => ({
      topic: roomChannelTopic(room.id, room.status ?? 'active'),
      event,
      payload,
    })),
  );
  if (!result.ok) {
    console.warn(`[tour-room] fan-out broadcast failed (${event}, ${rooms.length} rooms):`, result.error ?? result.status);
  }
  return result;
}
