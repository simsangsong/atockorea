/**
 * U0.3 — feed item builder: turns a flat message list into what a messenger
 * actually renders (plan §F-1).
 *
 *  - Date separators at KST day boundaries (§D-9: tour-day logic is Seoul).
 *  - Consecutive-sender grouping: same sender_role within GROUP_WINDOW_MS,
 *    uninterrupted by system messages or a day change. The group start shows
 *    avatar+name (incoming), the group end shows the timestamp and the
 *    bubble tail.
 *
 * Pure function — the ChatFeed render pass stays dumb.
 */

import type { RoomMessage } from '@/hooks/useTourRoomChannel';

export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface DateSeparatorItem {
  type: 'date';
  key: string;
  /** KST calendar day, e.g. "2026-07-15". */
  dayKey: string;
  /** ISO timestamp of the first message of that day (for label formatting). */
  at: string;
}

export interface MessageFeedItem {
  type: 'message';
  key: string;
  message: RoomMessage;
  /** sender_role === 'system' (rendered as a centered capsule / card). */
  system: boolean;
  mine: boolean;
  /** First bubble of its group — incoming groups show avatar + name here. */
  groupStart: boolean;
  /** Last bubble of its group — shows the timestamp and the bubble tail. */
  groupEnd: boolean;
}

export type FeedItem = DateSeparatorItem | MessageFeedItem;

const KST_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** KST calendar-day key ("YYYY-MM-DD") for an ISO timestamp. */
export function kstDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'invalid';
  return KST_DAY.format(date);
}

function sameGroup(prev: RoomMessage, next: RoomMessage): boolean {
  if (prev.sender_role !== next.sender_role) return false;
  if (prev.sender_role === 'system' || next.sender_role === 'system') return false;
  const prevMs = new Date(prev.created_at).getTime();
  const nextMs = new Date(next.created_at).getTime();
  if (Number.isNaN(prevMs) || Number.isNaN(nextMs)) return false;
  if (Math.abs(nextMs - prevMs) > GROUP_WINDOW_MS) return false;
  return kstDayKey(prev.created_at) === kstDayKey(next.created_at);
}

/**
 * Build the render list. `messages` is the already-windowed slice, oldest
 * first (the feed is append-only). `showDates` exists because the windowed
 * slice's first day is ambiguous when older messages are hidden — callers
 * still get the separator, which doubles as the "load earlier" anchor.
 */
export function buildFeedItems(messages: RoomMessage[], viewerRole: string): FeedItem[] {
  const items: FeedItem[] = [];
  let previous: RoomMessage | null = null;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const dayKey = kstDayKey(message.created_at);

    if (!previous || kstDayKey(previous.created_at) !== dayKey) {
      items.push({ type: 'date', key: `date-${dayKey}-${message.id}`, dayKey, at: message.created_at });
    }

    const system = message.sender_role === 'system';
    const next = messages[i + 1] ?? null;
    const groupStart = !previous || !sameGroup(previous, message);
    const groupEnd = !next || !sameGroup(message, next);

    items.push({
      type: 'message',
      key: message.id,
      message,
      system,
      mine: !system && message.sender_role === viewerRole,
      groupStart: system ? true : groupStart,
      groupEnd: system ? true : groupEnd,
    });

    previous = message;
  }

  return items;
}
