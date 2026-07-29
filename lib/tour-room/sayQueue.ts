/**
 * SG-6 — the say queue resolver (발화 대기열, 제로베이스 설계의 중심 장치).
 *
 * The driver's screen always holds 2–4 things WORTH SAYING right now, and
 * every one of them fires through a path that already exists — the arrival
 * sheet, a pre-translated quick-reply preset, the return-time sheet, the
 * morning briefing. This module adds ZERO send paths (SG-D11): it is pure
 * ranking over state the cockpit already holds. X15's arrival prompt
 * ("an OFFER, never a send") generalized.
 *
 * 🔴 fired detection is TYPE-derived, never subject-derived: the existing
 * fire paths write no subjects at all (브리핑=type only, 도착=manual_arrival,
 * 복귀=signal payload — 2차 감사 #10), so the server derives today's fired
 * set from event TYPES and ships it in the snapshot; the cockpit merges its
 * own optimistic fires on top. And "arrived" is judged from DURABLE sources
 * (latestArrival / manual_arrival events), not the volatile geofence state —
 * a driver who never opted into location sharing still gets a live queue
 * (2차 감사 #11).
 *
 * NO AUTO-FIRE in v1 (N-5): a required item past its deadline only reports
 * `say_expired` — the data the owner asked for before deciding v1.5.
 */
import type { NoticeState } from '@/lib/tour-room/notices';
import { scheduleTargetMs } from '@/lib/tour-room/nowCard';

export type SayItemKind = 'arrival_bundle' | 'preset' | 'return_time' | 'briefing';

export interface SayItem {
  /** Dedup identity — mirrors the server's fired-set vocabulary. */
  subject: string;
  kind: SayItemKind;
  /** For kind 'preset' — an EXISTING DRIVER_QUICK_REPLIES key, never new. */
  presetKey?: string;
  urgency: 'required' | 'suggested';
  /** Display-only deadline; v1 never auto-fires (N-5). */
  deadlineMs?: number;
  spotTitle?: string;
  poiKey?: string | null;
}

export interface SayQueueInput {
  nowMs: number;
  tourDate: string | null;
  schedule: Array<{ title?: unknown; name?: unknown; time?: unknown; poi_key?: unknown }>;
  notice: NoticeState | null;
  /** Volatile geofence hit — an unsent arrival OFFER only. */
  geofenceArrival: { spotId: string; title: string; poiKey?: string | null } | null;
  /** When the last arrival was ANNOUNCED (durable: messages/events). */
  lastArrivalAtMs: number | null;
  lastArrivalPoiKey?: string | null;
  /** When the last return timer went out — the return ask re-appears per
   *  STOP (a stop-A timer must not silence stop B's ask). */
  lastTimerAtMs?: number | null;
  /** Server-derived + optimistic: 'briefing' | 'arrival:{poiKey}' | 'return:{poiKey|day}' | dismissed subjects. */
  firedSubjects: ReadonlySet<string>;
}

const MAX_ITEMS = 4;
const BRIEFING_WINDOW_END_MIN = 11 * 60; // suggest the morning briefing until 11:00 KST
const REST_STOP_AFTER_MS = 90 * 60 * 1000;
const DEPARTING_SOON_WINDOW_MS = 10 * 60 * 1000;

const itemTitle = (item: SayQueueInput['schedule'][number]): string =>
  String(item.title ?? item.name ?? '').trim();

export function sayQueue(input: SayQueueInput): SayItem[] {
  const out: SayItem[] = [];
  const fired = input.firedSubjects;
  const push = (item: SayItem) => {
    if (out.length >= MAX_ITEMS) return;
    if (fired.has(item.subject)) return;
    if (out.some((existing) => existing.subject === item.subject)) return;
    out.push(item);
  };

  // ── required ────────────────────────────────────────────────────────────
  // ① A geofence hit whose arrival guidance has not gone out.
  if (input.geofenceArrival) {
    const poiKey = input.geofenceArrival.poiKey ?? input.geofenceArrival.spotId;
    push({
      subject: `arrival:${poiKey}`,
      kind: 'arrival_bundle',
      urgency: 'required',
      deadlineMs: input.nowMs + 3 * 60 * 1000,
      spotTitle: input.geofenceArrival.title,
      poiKey,
    });
  }
  // ② Arrived (durably) with NO live timer — the guests have no clock.
  const timerLive =
    input.notice !== null &&
    !input.notice.cancelled &&
    input.notice.targetMs !== null &&
    input.notice.targetMs > input.nowMs;
  const timerCoversArrival =
    input.lastTimerAtMs != null &&
    input.lastArrivalAtMs !== null &&
    input.lastTimerAtMs >= input.lastArrivalAtMs;
  if (input.lastArrivalAtMs !== null && !timerLive && !timerCoversArrival) {
    push({
      subject: `return:${input.lastArrivalPoiKey ?? 'current'}`,
      kind: 'return_time',
      urgency: 'required',
      deadlineMs: input.lastArrivalAtMs + 5 * 60 * 1000,
    });
  }
  // ③ The morning briefing, until it stops being morning.
  const kstMinutes = Math.floor(((input.nowMs + 9 * 3600_000) % 86_400_000) / 60_000);
  if (kstMinutes < BRIEFING_WINDOW_END_MIN) {
    push({ subject: 'briefing', kind: 'briefing', urgency: 'required' });
  }

  // ── suggested — schedule-leg presets, all EXISTING keys ─────────────────
  if (input.tourDate) {
    const legs = input.schedule
      .map((item) => ({
        title: itemTitle(item),
        targetMs: scheduleTargetMs(
          input.tourDate,
          typeof item.time === 'string' ? item.time.slice(0, 5) : null,
        ),
        poiKey: typeof item.poi_key === 'string' ? item.poi_key : null,
      }))
      .filter((leg) => leg.title);
    const next = legs.find((leg) => leg.targetMs !== null && leg.targetMs > input.nowMs);
    if (next?.targetMs != null && next.targetMs - input.nowMs <= DEPARTING_SOON_WINDOW_MS) {
      push({
        subject: `preset:departing_soon:${next.poiKey ?? next.title}`,
        kind: 'preset',
        presetKey: 'departing_soon',
        urgency: 'suggested',
        spotTitle: next.title,
      });
    }
    const last = legs[legs.length - 1];
    if (
      last?.targetMs != null &&
      last.targetMs > input.nowMs &&
      last.targetMs - input.nowMs <= 30 * 60 * 1000
    ) {
      push({
        subject: 'preset:check_belongings',
        kind: 'preset',
        presetKey: 'check_belongings',
        urgency: 'suggested',
      });
    }
  }
  // Freshly departed (arrival announced, then a timer set and passed? no —
  // simply: an arrival exists and we are within 5 minutes of leaving it):
  if (
    input.lastArrivalAtMs !== null &&
    timerLive &&
    input.notice?.targetMs != null &&
    input.notice.targetMs - input.nowMs <= 5 * 60 * 1000
  ) {
    push({ subject: 'preset:seatbelt_check', kind: 'preset', presetKey: 'seatbelt_check', urgency: 'suggested' });
  }
  // A long dry stretch with no stop — offer a rest.
  if (input.lastArrivalAtMs !== null && input.nowMs - input.lastArrivalAtMs >= REST_STOP_AFTER_MS) {
    push({ subject: 'preset:rest_stop', kind: 'preset', presetKey: 'rest_stop', urgency: 'suggested' });
  }

  return out;
}

/**
 * The fired half of the dedupe, derived from what the room ALREADY records:
 * today's messages (arrival capsules carry poi_key; a timer message means a
 * return time went out; briefing cards mean the briefing went out). The
 * dismissed/expired half comes from the event ledger via the snapshot —
 * the cockpit unions the two and adds its own optimistic fires.
 */
export function firedSubjectsFromMessages(
  messages: ReadonlyArray<{ created_at: string; metadata?: Record<string, unknown> | null }>,
  dayStartMs: number,
): { fired: Set<string>; lastTimerAtMs: number | null } {
  const fired = new Set<string>();
  let lastTimerAtMs: number | null = null;
  for (const message of messages) {
    const at = new Date(message.created_at).getTime();
    if (!Number.isFinite(at) || at < dayStartMs) continue;
    const kind = message.metadata?.kind;
    if (kind === 'arrival_bundle' || kind === 'spot_arrival') {
      const poi = message.metadata?.poi_key;
      const title = message.metadata?.spot_title;
      if (typeof poi === 'string' && poi) fired.add(`arrival:${poi}`);
      else if (typeof title === 'string' && title) fired.add(`arrival:${title}`);
    } else if (kind === 'free_time_timer' && message.metadata?.cancelled !== true) {
      lastTimerAtMs = Math.max(lastTimerAtMs ?? 0, at);
    } else if (typeof kind === 'string' && kind.startsWith('briefing_')) {
      fired.add('briefing');
    }
  }
  return { fired, lastTimerAtMs };
}
