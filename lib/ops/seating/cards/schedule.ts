/**
 * C-16 card ③ — today's schedule preview (`briefing_schedule`).
 *
 * Built from the 4-stage resolver (lib/tour-room/dayPlan.ts resolveDaySchedule)
 * and NOTHING else. Two consequences, both deliberate:
 *   - no schedule resolved → `composeSchedule` returns null and the card is
 *     simply not sent. An empty "here is today's plan" card is worse than
 *     silence, and an invented plan is worse than both;
 *   - stop TITLES are printed verbatim from the resolver (they are proper
 *     nouns, and translating them at send time would mean an LLM call). Only
 *     the chrome — header, count, footnote — is 5-locale.
 *
 * Pre-translated 5-locale constants, zero LLM at send time.
 */

import { capsuleFrom, type ComposedBriefingCard } from '@/lib/ops/seating/cards/types';
import type { ScheduleItemLike } from '@/lib/tour-room/concierge';
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

/** One row of the preview (already ordered by the resolver). */
export interface BriefingScheduleStop {
  /** "HH:MM" KST, or null when the source carries no times. */
  time: string | null;
  title: string;
  poi_key?: string | null;
}

/** The `metadata` contract of a `briefing_schedule` message row. */
export interface BriefingScheduleMeta {
  kind: 'briefing_schedule';
  stops: BriefingScheduleStop[];
  /** Which resolver stage produced this ('day_plan' | 'booking_itinerary' | 'tour_schedule'). */
  source: string;
  tour_date?: string | null;
  [key: string]: unknown;
}

/** Cap: the preview is a glance, the Schedule tab is the full document. */
export const MAX_PREVIEW_STOPS = 12;

const HEADER: Record<RoomLocale, string> = {
  en: "Today's plan 🗓",
  ko: '오늘 일정 🗓',
  ja: '本日の予定 🗓',
  es: 'El plan de hoy 🗓',
  zh: '今日行程 🗓',
};

const FOOTER: Record<RoomLocale, string> = {
  en: 'Times shift with traffic — the app always shows the live version in the Schedule tab.',
  ko: '교통 상황에 따라 시간은 달라질 수 있어요 — 최신 일정은 항상 일정 탭에서 확인하실 수 있습니다.',
  ja: '交通状況で時間は前後します — 最新の予定は常にスケジュールタブでご確認いただけます。',
  es: 'Los horarios cambian con el tráfico: la versión en vivo está siempre en la pestaña de itinerario.',
  zh: '时间会随路况调整 — 最新行程随时可在行程标签页查看。',
};

const MORE: Record<RoomLocale, string> = {
  en: '…and {n} more in the Schedule tab',
  ko: '…외 {n}곳은 일정 탭에서 확인해 주세요',
  ja: '…ほか{n}か所はスケジュールタブでご確認ください',
  es: '…y {n} más en la pestaña de itinerario',
  zh: '…另有{n}处，请见行程标签页',
};

/** Card chrome — the 5-locale labels the guest component renders. */
export const SCHEDULE_COPY: Record<RoomLocale, { title: string; stopCount: string; noTime: string; footnote: string }> = {
  en: { title: "Today's plan", stopCount: '{n} stops', noTime: 'Time to be confirmed', footnote: FOOTER.en },
  ko: { title: '오늘 일정', stopCount: '{n}곳', noTime: '시간 미정', footnote: FOOTER.ko },
  ja: { title: '本日の予定', stopCount: '{n}か所', noTime: '時間未定', footnote: FOOTER.ja },
  es: { title: 'El plan de hoy', stopCount: '{n} paradas', noTime: 'Hora por confirmar', footnote: FOOTER.es },
  zh: { title: '今日行程', stopCount: '{n}处', noTime: '时间待定', footnote: FOOTER.zh },
};

/** Resolver output → the preview rows (titles kept verbatim, empties dropped). */
export function scheduleStopsFrom(schedule: readonly ScheduleItemLike[] | null | undefined): BriefingScheduleStop[] {
  if (!Array.isArray(schedule)) return [];
  const stops: BriefingScheduleStop[] = [];
  for (const item of schedule) {
    if (!item || typeof item !== 'object') continue;
    const title =
      (typeof item.title === 'string' && item.title.trim()) ||
      (typeof item.name === 'string' && item.name.trim()) ||
      '';
    if (!title) continue;
    const raw = typeof item.time === 'string' ? item.time.slice(0, 5) : '';
    stops.push({
      time: /^\d{2}:\d{2}$/.test(raw) ? raw : null,
      title: title.slice(0, 120),
      poi_key: typeof item.poi_key === 'string' && item.poi_key ? item.poi_key : null,
    });
  }
  return stops;
}

export function composeScheduleTranslations(stops: readonly BriefingScheduleStop[]): Record<RoomLocale, string> {
  const shown = stops.slice(0, MAX_PREVIEW_STOPS);
  const rest = stops.length - shown.length;
  const out = {} as Record<RoomLocale, string>;
  for (const locale of ROOM_LOCALES) {
    const lines = [HEADER[locale]];
    for (const stop of shown) {
      lines.push(stop.time ? `${stop.time} · ${stop.title}` : `· ${stop.title}`);
    }
    if (rest > 0) lines.push(MORE[locale].replaceAll('{n}', String(rest)));
    lines.push(FOOTER[locale]);
    out[locale] = lines.join('\n');
  }
  return out;
}

export interface ComposeScheduleArgs {
  schedule: readonly ScheduleItemLike[] | null | undefined;
  source: string;
  tourDate?: string | null;
}

/** null = no schedule resolved → the card is not sent (the honest fallback). */
export function composeSchedule(args: ComposeScheduleArgs): ComposedBriefingCard | null {
  const stops = scheduleStopsFrom(args.schedule);
  if (stops.length === 0) return null;
  const meta: BriefingScheduleMeta = {
    kind: 'briefing_schedule',
    stops: stops.slice(0, MAX_PREVIEW_STOPS),
    source: args.source,
    tour_date: args.tourDate ?? null,
  };
  return capsuleFrom(composeScheduleTranslations(stops), meta as unknown as Record<string, unknown>);
}
