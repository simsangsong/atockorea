/**
 * W0.3 — tour_room_events helpers (smart-guide private-mode plan P-D5/P-D6).
 *
 * The append-only event log all 8 primitives write to. Two rules:
 *   - user-visible events ALSO insert a tour_room_messages capsule (the feed
 *     stays the human-facing plane); this table is for recompute/audit.
 *   - stage events (ESCALATE) pass a subjectKey — the partial unique index
 *     (room_id, subject_key, type) makes concurrent threshold-crossers race
 *     safely: exactly one caller gets inserted=true and fans out.
 */

import type { RoomDbClient } from '@/lib/tour-room/access';

export type RoomEventActorRole = 'customer' | 'guide' | 'driver' | 'admin' | 'system';

export interface RoomEventInput {
  roomId: string;
  bookingId?: string | null;
  type: string;
  actorRole: RoomEventActorRole;
  actorParticipantId?: string | null;
  /** Idempotency scope (e.g. `rally:{rallyId}:overdue`). Omit for plain log events. */
  subjectKey?: string | null;
  payload?: Record<string, unknown>;
}

export interface RoomEventRow {
  id: string;
  room_id: string;
  booking_id: string | null;
  type: string;
  actor_role: RoomEventActorRole;
  actor_participant_id: string | null;
  subject_key: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface RecordRoomEventResult {
  /** false = the (room, subject, type) side-effect already ran — do nothing. */
  inserted: boolean;
  event: RoomEventRow | null;
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === '23505') return true;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.includes('duplicate key');
}

export async function recordRoomEvent(
  supabase: RoomDbClient,
  input: RoomEventInput,
): Promise<RecordRoomEventResult> {
  const { data, error } = await supabase
    .from('tour_room_events')
    .insert({
      room_id: input.roomId,
      booking_id: input.bookingId ?? null,
      type: input.type,
      actor_role: input.actorRole,
      actor_participant_id: input.actorParticipantId ?? null,
      subject_key: input.subjectKey ?? null,
      payload: input.payload ?? {},
    })
    .select()
    .single();

  if (error) {
    if (isUniqueViolation(error)) return { inserted: false, event: null };
    throw Object.assign(new Error(`tour_room_events insert failed: ${String((error as { message?: unknown }).message ?? error)}`), {
      cause: error,
    });
  }
  return { inserted: true, event: data as RoomEventRow };
}

export interface ListRoomEventsOptions {
  types?: string[];
  /** Only events created after this ISO timestamp. */
  after?: string;
  limit?: number;
}

export async function listRoomEvents(
  supabase: RoomDbClient,
  roomId: string,
  options: ListRoomEventsOptions = {},
): Promise<RoomEventRow[]> {
  let query = supabase
    .from('tour_room_events')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(options.limit ?? 200);
  if (options.types?.length) query = query.in('type', options.types);
  if (options.after) query = query.gt('created_at', options.after);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as RoomEventRow[];
}
