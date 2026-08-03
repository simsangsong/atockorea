/**
 * T6.3/T6.5 — meeting-notice & free-time countdown logic (pure).
 *
 * The banner derives everything from the message's KST wall-clock target and
 * the current time, so returning from a locked screen "resyncs" for free
 * (AC) — there is no client-side ticking state to drift.
 */

import { kstStartOfDayMs } from '@/lib/tour-room/time';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

export interface NoticeState {
  kind: 'meeting_notice' | 'free_time_timer';
  messageId: string;
  point: string | null;
  /** T2-2 — per-locale translated place name (the operator typed it in Korean). */
  pointI18n: Record<string, string> | null;
  /** T2-1 — optional gather-point pin (a foreign guest taps → native map). */
  lat: number | null;
  lng: number | null;
  /** ms epoch of the KST wall-clock target; null = untimed notice. */
  targetMs: number | null;
  remainingMs: number | null;
  cancelled: boolean;
  /** Threshold warnings that are now active (10min / 5min, T6.5). */
  warn10: boolean;
  warn5: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** The midpoint between two occurrences of the same wall clock. */
const HALF_DAY_MS = DAY_MS / 2;

/**
 * KST wall clock → epoch ms for a tour date. Exported since SG-1a so the
 * now-card adapter parses schedule times through the SAME implementation the
 * notice ladder uses — a second copy of this arithmetic is how clocks drift.
 * Strict `HH:MM` only; callers with looser input (schedules hand-typed as
 * `9:00`) normalize before calling.
 *
 * ## `referenceMs` — the tour day does not end at midnight
 *
 * Without it, `00:30` on a tour dated the 3rd means 00:30 on the 3rd: the very
 * beginning of the day. A guide who announces a 00:30 meeting at 23:00 that
 * night therefore produces a target 22½ hours in the PAST, `activeNotice`
 * expires it on arrival, and the guests' countdown never appears. Nothing
 * errors — the guide sees a sent notice, the guests see nothing, and neither is
 * told. Reproduced on a guest's screen by `scripts/qa-midnight-meeting.ts`.
 *
 * Given a reference instant this resolves to the NEAREST occurrence of the
 * clock instead: the same day, or the next one when the reference is more than
 * twelve hours past it.
 *
 * 🔴 Nearest, deliberately, rather than a "before 04:00 means tomorrow" cutoff.
 * A sunrise tour that meets at 03:30 ON the tour date is a real thing here, and
 * a fixed cutoff would move it a day. Nearest-occurrence cannot: it only moves
 * a clock that no reading could place near the reference.
 *
 * 🔴 And the reference must be the notice's CREATION, never `now`. Resolving
 * against `now` would make one notice mean different instants as the evening
 * passes; creation is fixed, so the answer is fixed.
 *
 * The backdate guard survives untouched. Rolling forward requires the naive
 * target to be >12h before creation, which no plausible near-future meeting
 * ever is; a typo announcing this morning's 09:00 at 14:00 is 5h back, stays
 * on the tour date, and is still refused as backdated.
 */
export function wallClockToMs(tourDate: string, hhmm: string, referenceMs?: number): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const onTourDate = kstStartOfDayMs(tourDate) + (Number(match[1]) * 60 + Number(match[2])) * 60 * 1000;
  if (referenceMs === undefined || !Number.isFinite(referenceMs)) return onTourDate;
  return referenceMs - onTourDate > HALF_DAY_MS ? onTourDate + DAY_MS : onTourDate;
}

/**
 * The active notice for the room: the newest meeting_notice / free_time_timer
 * message wins (a later cancel or extension supersedes earlier timers).
 * Expired notices (past target + 15min) return null.
 */
/**
 * SG-1c — the "+15" is POLICY, and policy is one constant. The notice
 * expiry, the E2 "waits until" line, and the wait-ended firing window all
 * read this value; if they ever read different numbers, the app shows a
 * promise it does not keep. Pickup's "+10" exists only as request-phrased
 * copy (F-4: a private pickup has nowhere to depart to), never as a fired
 * capsule — which is why it is a separate constant, not a parameter.
 */
export const RALLY_GRACE_MS = 15 * 60 * 1000;
export const PICKUP_GRACE_MS = 10 * 60 * 1000;
/** How long past T+GRACE the departed crossing may still fire (SG-D6). */
export const RALLY_FIRE_WINDOW_MS = 10 * 60 * 1000;

/** E2 — the instant the wait ends; null for untimed/absent notices. */
export function policyWaitUntilMs(
  notice: Pick<NoticeState, 'targetMs'> | null | undefined,
): number | null {
  if (!notice || notice.targetMs === null) return null;
  return notice.targetMs + RALLY_GRACE_MS;
}

/**
 * The one scan both derivations share: newest message that IS a notice.
 * A0 — an arrival bundle WITH a meeting time is a meeting notice (the
 * countdown + rally ladder run unchanged off its metadata). A bundle
 * without one (짧은 포토스톱) is not a notice and never clears an active
 * timer, so skip it entirely.
 */
function latestNoticeMessage(
  messages: readonly RoomMessage[],
): { message: RoomMessage; kind: NoticeState['kind'] } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    let kind = message.metadata?.kind;
    if (kind === 'arrival_bundle') {
      if (typeof message.metadata?.meeting_time !== 'string' || !message.metadata.meeting_time) continue;
      kind = 'meeting_notice';
    }
    if (kind !== 'meeting_notice' && kind !== 'free_time_timer') continue;
    return { message, kind: kind as NoticeState['kind'] };
  }
  return null;
}

function noticeTargetMs(message: RoomMessage, tourDate: string): number | null {
  const hhmm =
    (message.metadata?.until_time as string | undefined) ??
    (message.metadata?.meeting_time as string | undefined) ??
    null;
  // The notice's own creation is the reference, so a meeting announced late at
  // night for 00:30 lands after midnight instead of at the start of the day.
  return hhmm ? wallClockToMs(tourDate, hhmm, Date.parse(message.created_at)) : null;
}

export interface RallyResolutionState {
  noticeId: string;
  targetMs: number;
  /** 'window' is the only phase a departed crossing may POST in. */
  phase: 'pending' | 'window' | 'closed';
}

/**
 * SG-D6 — the FIRING derivation, deliberately separate from activeNotice:
 * activeNotice returns null the instant `targetMs + GRACE` passes, which is
 * exactly when the wait-ended crossing must still know the noticeId — on
 * top of it the firing window has width zero (the v1.1 audit's P0). This
 * reads the raw latest notice (same kind set, same bundle promotion),
 * ignores UI expiry, and adds the backdate guard: a notice CREATED after
 * its own target (a staff typo announcing a past time) never fires — the
 * server re-derives all of this independently and refuses too, but the
 * client should not even ask.
 */
export function rallyResolution(
  messages: readonly RoomMessage[],
  tourDate: string | null | undefined,
  nowMs = Date.now(),
): RallyResolutionState | null {
  if (!tourDate) return null;
  const latest = latestNoticeMessage(messages);
  if (!latest) return null;
  if (latest.message.metadata?.cancelled === true) return null;
  const targetMs = noticeTargetMs(latest.message, tourDate);
  if (targetMs === null) return null;
  const createdMs = new Date(latest.message.created_at).getTime();
  if (!Number.isFinite(createdMs) || createdMs >= targetMs) return null;
  const past = nowMs - targetMs;
  const phase: RallyResolutionState['phase'] =
    past < RALLY_GRACE_MS ? 'pending' : past <= RALLY_GRACE_MS + RALLY_FIRE_WINDOW_MS ? 'window' : 'closed';
  return { noticeId: latest.message.id, targetMs, phase };
}

export function activeNotice(
  messages: RoomMessage[],
  tourDate: string | null | undefined,
  nowMs = Date.now(),
): NoticeState | null {
  if (!tourDate) return null;
  const latest = latestNoticeMessage(messages);
  if (!latest) return null;
  {
    const { message, kind } = latest;

    const cancelled = message.metadata?.cancelled === true;
    const point = (message.metadata?.meeting_point as string | null | undefined) ?? null;
    const pointI18n = (message.metadata?.meeting_point_i18n as Record<string, string> | null | undefined) ?? null;
    const lat = typeof message.metadata?.meeting_lat === 'number' ? (message.metadata.meeting_lat as number) : null;
    const lng = typeof message.metadata?.meeting_lng === 'number' ? (message.metadata.meeting_lng as number) : null;
    const targetMs = noticeTargetMs(message, tourDate);

    if (cancelled) {
      // A cancel banner stays up briefly, then the room is notice-free.
      const createdMs = new Date(message.created_at).getTime();
      if (nowMs - createdMs > 10 * 60 * 1000) return null;
      return {
        kind: kind as NoticeState['kind'],
        messageId: message.id,
        point,
        pointI18n,
        lat,
        lng,
        targetMs: null,
        remainingMs: null,
        cancelled: true,
        warn10: false,
        warn5: false,
      };
    }

    if (targetMs !== null && nowMs > targetMs + RALLY_GRACE_MS) return null; // long past — expire
    const remainingMs = targetMs === null ? null : Math.max(0, targetMs - nowMs);
    return {
      kind: kind as NoticeState['kind'],
      messageId: message.id,
      point,
      pointI18n,
      lat,
      lng,
      targetMs,
      remainingMs,
      cancelled: false,
      warn10: remainingMs !== null && remainingMs <= 10 * 60 * 1000 && remainingMs > 0,
      warn5: remainingMs !== null && remainingMs <= 5 * 60 * 1000 && remainingMs > 0,
    };
  }
  return null;
}

/**
 * W2.3 / P-D6 — the rally ESCALATE ladder as a pure time-derived function
 * (§C-3): set → remind(T-10) → due(T0..T+5) → overdue(T+5..T+10) →
 * contact(T+10..expiry). No cron, no stored stage — clients derive the stage
 * every tick and fire idempotent events only when a threshold is crossed
 * (the server's UNIQUE(room, subject_key, type) dedupes the fan-out).
 */
export type RallyStage = 'set' | 'remind' | 'due' | 'overdue' | 'contact';

export function rallyStage(notice: NoticeState | null, nowMs = Date.now()): RallyStage | null {
  if (!notice || notice.cancelled || notice.targetMs === null) return null;
  const past = nowMs - notice.targetMs;
  if (past < -10 * 60 * 1000) return 'set';
  if (past < 0) return 'remind';
  if (past <= 5 * 60 * 1000) return 'due';
  if (past <= 10 * 60 * 1000) return 'overdue';
  return 'contact';
}

/**
 * Banner presentation ladder (user decision 2026-07-22): the countdown must
 * NOT sit on screen for the whole free time. Before T-10 the banner is hidden
 * (the meeting time lives in the arrival card in chat); T-10 and T-5 fire
 * one-shot nudges and the banner appears WITHOUT a ticking number ('quiet');
 * from T-3 the live countdown capsule takes over ('countdown').
 * Cancelled and untimed notices render quiet (nothing to count down).
 */
export type NoticeBannerMode = 'hidden' | 'quiet' | 'countdown';

export function noticeBannerMode(notice: NoticeState | null): NoticeBannerMode {
  if (!notice) return 'hidden';
  if (notice.cancelled || notice.remainingMs === null) return 'quiet';
  if (notice.remainingMs > 10 * 60 * 1000) return 'hidden';
  if (notice.remainingMs > 3 * 60 * 1000) return 'quiet';
  return 'countdown';
}

/** "12:34" countdown text; "0:59" under a minute; "00:00" when due. */
export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Locale-formatted wall-clock time for the banner (AC: 로케일별 시간 포맷). */
export function formatTargetTime(targetMs: number, locale: string): string {
  const tag =
    {
      en: 'en-US',
      ko: 'ko-KR',
      ja: 'ja-JP',
      es: 'es-ES',
      zh: 'zh-CN',
      'zh-TW': 'zh-TW',
      fr: 'fr-FR',
      de: 'de-DE',
      ru: 'ru-RU',
      it: 'it-IT',
    }[locale] ?? 'en-US';
  return new Intl.DateTimeFormat(tag, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(
    new Date(targetMs),
  );
}
