/**
 * U0.4 — display formatting for bubble timestamps and date-separator pills
 * (plan §F-4/§F-5). Rendering is per-viewer-locale; the CLOCK is the
 * device's local time (standard messenger behaviour — travellers on tour in
 * Korea are on KST anyway), while day BOUNDARIES come from messageGroups'
 * kstDayKey. Tests pass an explicit timeZone for determinism.
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** RoomLocale → BCP47 tag for Intl. */
export const LOCALE_TAG: Record<RoomLocale, string> = {
  en: 'en-US',
  ko: 'ko-KR',
  ja: 'ja-JP',
  es: 'es-ES',
  zh: 'zh-CN',
};

const TODAY_LABEL: Record<RoomLocale, string> = {
  en: 'Today',
  ko: '오늘',
  ja: '今日',
  es: 'Hoy',
  zh: '今天',
};

/**
 * Short bubble-side time, e.g. ko "오후 2:35", en "2:35 PM", ja "14:35".
 * hour12 follows each locale's convention via Intl defaults.
 */
export function formatBubbleTime(iso: string, locale: RoomLocale, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
      hour: 'numeric',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return '';
  }
}

/**
 * Date-separator pill label, e.g. ko "7월 15일 화요일", en "Tuesday, July 15".
 * Shows a localized "Today" for the current KST day (`todayDayKey` comes from
 * the caller so this stays pure).
 */
export function formatDateSeparator(
  iso: string,
  locale: RoomLocale,
  options?: { dayKey?: string; todayDayKey?: string },
): string {
  if (options?.dayKey && options?.todayDayKey && options.dayKey === options.todayDayKey) {
    return TODAY_LABEL[locale];
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      timeZone: 'Asia/Seoul',
    }).format(date);
  } catch {
    return '';
  }
}
