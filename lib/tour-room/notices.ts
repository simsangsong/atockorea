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
  /** ms epoch of the KST wall-clock target; null = untimed notice. */
  targetMs: number | null;
  remainingMs: number | null;
  cancelled: boolean;
  /** Threshold warnings that are now active (10min / 5min, T6.5). */
  warn10: boolean;
  warn5: boolean;
}

function wallClockToMs(tourDate: string, hhmm: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  return kstStartOfDayMs(tourDate) + (Number(match[1]) * 60 + Number(match[2])) * 60 * 1000;
}

/**
 * The active notice for the room: the newest meeting_notice / free_time_timer
 * message wins (a later cancel or extension supersedes earlier timers).
 * Expired notices (past target + 15min) return null.
 */
export function activeNotice(
  messages: RoomMessage[],
  tourDate: string | null | undefined,
  nowMs = Date.now(),
): NoticeState | null {
  if (!tourDate) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const kind = message.metadata?.kind;
    if (kind !== 'meeting_notice' && kind !== 'free_time_timer') continue;

    const cancelled = message.metadata?.cancelled === true;
    const point = (message.metadata?.meeting_point as string | null | undefined) ?? null;
    const hhmm =
      (message.metadata?.until_time as string | undefined) ??
      (message.metadata?.meeting_time as string | undefined) ??
      null;
    const targetMs = hhmm ? wallClockToMs(tourDate, hhmm) : null;

    if (cancelled) {
      // A cancel banner stays up briefly, then the room is notice-free.
      const createdMs = new Date(message.created_at).getTime();
      if (nowMs - createdMs > 10 * 60 * 1000) return null;
      return {
        kind: kind as NoticeState['kind'],
        messageId: message.id,
        point,
        targetMs: null,
        remainingMs: null,
        cancelled: true,
        warn10: false,
        warn5: false,
      };
    }

    if (targetMs !== null && nowMs > targetMs + 15 * 60 * 1000) return null; // long past — expire
    const remainingMs = targetMs === null ? null : Math.max(0, targetMs - nowMs);
    return {
      kind: kind as NoticeState['kind'],
      messageId: message.id,
      point,
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

/** "12:34" countdown text; "0:59" under a minute; "00:00" when due. */
export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Locale-formatted wall-clock time for the banner (AC: 로케일별 시간 포맷). */
export function formatTargetTime(targetMs: number, locale: string): string {
  const tag = { en: 'en-US', ko: 'ko-KR', ja: 'ja-JP', es: 'es-ES', zh: 'zh-CN' }[locale] ?? 'en-US';
  return new Intl.DateTimeFormat(tag, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(
    new Date(targetMs),
  );
}
