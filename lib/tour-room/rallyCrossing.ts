/**
 * SG-2b-α — the server side of the rally crossings, as PURE helpers the
 * signals route wires up. The 2차 감사's P0 lives and dies here: the server
 * trusts NOTHING the client said. A crossing arrives with a noticeId and the
 * server re-derives everything — that the id is a real notice message in
 * THIS room, what its target actually is, that it was created BEFORE its own
 * target (a staff typo announcing a past time must not become an instant
 * departure capsule), and that nothing newer has superseded it (extension,
 * cancel, or the next stop's bundle). Today's rally_overdue mints arbitrary
 * strings as event subjects; these types do not inherit that.
 */
import type { RoomDbClient } from '@/lib/tour-room/access';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import { RALLY_FIRE_WINDOW_MS, RALLY_GRACE_MS, wallClockToMs } from '@/lib/tour-room/notices';
import { scheduleTargetMs } from '@/lib/tour-room/nowCard';
import { resolveDaySchedule } from '@/lib/tour-room/dayPlan';

export const RALLY_CROSSING_TYPES = [
  'rally_remind',
  'rally_departed',
  'rally_all_aboard',
  'rally_extended',
] as const;
export type RallyCrossingType = (typeof RALLY_CROSSING_TYPES)[number];

export const isRallyCrossingType = (value: unknown): value is RallyCrossingType =>
  (RALLY_CROSSING_TYPES as readonly string[]).includes(value as string);

/** Clock-jitter slack on the ≥GRACE requirement (two corrected clocks). */
export const RALLY_PAST_SLACK_MS = 30_000;
/** How late past the window a departed crossing is still honored. */
export const RALLY_LATE_SLACK_MS = 60_000;

type NoticeRow = Pick<RoomMessage, 'id' | 'created_at' | 'metadata'>;

const NOTICE_KINDS = ['meeting_notice', 'free_time_timer', 'arrival_bundle'];

/** The promotion rule activeNotice uses, shared so the two can never split. */
function isNoticeRow(row: NoticeRow): boolean {
  const kind = row.metadata?.kind;
  if (kind === 'arrival_bundle') {
    return typeof row.metadata?.meeting_time === 'string' && Boolean(row.metadata.meeting_time);
  }
  return kind === 'meeting_notice' || kind === 'free_time_timer';
}

export type LoadedRallyNotice =
  | {
      ok: true;
      targetMs: number;
      createdMs: number;
      createdAtIso: string;
      meetingPoint: string | null;
    }
  | { ok: false; status: number; error: string };

/** Step ①–③ of the ladder: real notice, real target, created before it. */
export async function loadRallyNotice(
  supabase: RoomDbClient,
  roomId: string,
  tourDate: string | null | undefined,
  noticeId: string,
): Promise<LoadedRallyNotice> {
  if (!tourDate) return { ok: false, status: 422, error: 'tour_date_missing' };
  const { data } = await supabase
    .from('tour_room_messages')
    .select('id, created_at, metadata')
    .eq('id', noticeId)
    .eq('room_id', roomId)
    .maybeSingle();
  const row = data as NoticeRow | null;
  if (!row || !isNoticeRow(row)) return { ok: false, status: 404, error: 'notice_not_found' };
  if (row.metadata?.cancelled === true) return { ok: false, status: 409, error: 'notice_cancelled' };
  const hhmm =
    (row.metadata?.until_time as string | undefined) ??
    (row.metadata?.meeting_time as string | undefined) ??
    null;
  const targetMs = hhmm ? wallClockToMs(tourDate, hhmm) : null;
  if (targetMs === null) return { ok: false, status: 422, error: 'notice_untimed' };
  const createdMs = new Date(row.created_at).getTime();
  if (!Number.isFinite(createdMs) || createdMs >= targetMs) {
    // Backdated: the notice was created AFTER its own target. Firing off a
    // typo is exactly the P0 this guard exists for.
    return { ok: false, status: 422, error: 'notice_backdated' };
  }
  return {
    ok: true,
    targetMs,
    createdMs,
    createdAtIso: row.created_at,
    meetingPoint: (row.metadata?.meeting_point as string | null | undefined) ?? null,
  };
}

/** Step ④: anything newer that IS a notice (cancel included) supersedes. */
export async function rallyNoticeSuperseded(
  supabase: RoomDbClient,
  roomId: string,
  createdAtIso: string,
  noticeId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('tour_room_messages')
    .select('id, created_at, metadata')
    .eq('room_id', roomId)
    .gt('created_at', createdAtIso)
    .in('metadata->>kind', NOTICE_KINDS)
    .order('created_at', { ascending: true })
    .limit(20);
  const rows = (data as NoticeRow[] | null) ?? [];
  return rows.some((row) => row.id !== noticeId && (isNoticeRow(row) || row.metadata?.cancelled === true));
}

export interface RejoinStop {
  name: string;
  time: string | null;
  targetMs: number | null;
  poiKey: string | null;
}

/**
 * The rejoin destination is SERVER-resolved (2차 감사 #26 — a client-supplied
 * destination is a spoofing surface): the first schedule stop whose wall
 * clock lies after the missed target. None → the card ships its
 * no-destination variant (coordinator call only).
 */
export async function resolveRejoinStop(
  supabase: RoomDbClient,
  bookingId: string,
  tourDate: string | null,
  afterMs: number,
  /**
   * 🔴 Without it `resolveDaySchedule` skips stage ②.5 (the product page's
   * translated itinerary) and falls back to `tours.schedule`, whose stops carry
   * NO `poi_key`. This function returns `poiKey` and the rejoin capsule uses it
   * for the navigation deep link — so the one card a guest opens when they have
   * been left behind was the card most likely to have no coordinates. Measured
   * live on 2026-07-29 across the same resolver: 0 → 124 stops with a poi_key.
   */
  tourId: string | null,
): Promise<RejoinStop | null> {
  try {
    const resolved = await resolveDaySchedule(supabase, { bookingId, tourDate, tourId });
    for (const item of resolved.schedule) {
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!title) continue;
      const time = typeof item.time === 'string' ? item.time.trim() : null;
      const targetMs = scheduleTargetMs(tourDate, time);
      if (targetMs !== null && targetMs <= afterMs) continue;
      return {
        name: title,
        time,
        targetMs,
        poiKey: typeof item.poi_key === 'string' && item.poi_key ? item.poi_key : null,
      };
    }
  } catch {
    // schedule resolution is best-effort; the capsule degrades gracefully
  }
  return null;
}

/** Departed-phase check, manual declarations only need the target passed. */
export function departedPhaseAllowed(nowMs: number, targetMs: number, manual: boolean): boolean {
  const past = nowMs - targetMs;
  if (manual) return past >= 0;
  return past >= RALLY_GRACE_MS - RALLY_PAST_SLACK_MS &&
    past <= RALLY_GRACE_MS + RALLY_FIRE_WINDOW_MS + RALLY_LATE_SLACK_MS;
}
