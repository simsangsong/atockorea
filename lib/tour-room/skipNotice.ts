/**
 * A6 — skip-reason guest capsule (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 *
 * When the operator skips a stop (MUTATE) the reason was recorded but never
 * shown to the party — the guest just saw the stop vanish. This renders the
 * 5-locale zero-LLM capsule: "{stop} is skipped today — {reason}". Stop names
 * interpolate from the stop's own name_i18n (proper nouns are never machine-
 * translated); the reason comes from the §C-3 whitelist.
 */

import type { DayPlanStop } from '@/lib/tour-room/dayPlan';
import { humanizePoiKey } from '@/lib/tour-room/dayPlan';
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

export type SkipReason = 'closed' | 'weather' | 'crowd' | 'guest_request' | 'time';

const REASON_LABEL: Record<SkipReason, Record<RoomLocale, string>> = {
  closed: {
    en: 'it is closed today',
    ko: '오늘 휴무예요',
    ja: '本日休業のため',
    es: 'hoy está cerrado',
    zh: '今日休息',
  },
  weather: {
    en: 'because of the weather',
    ko: '날씨 때문이에요',
    ja: '天候のため',
    es: 'por el clima',
    zh: '因天气原因',
  },
  crowd: {
    en: 'it is too crowded right now',
    ko: '지금 너무 혼잡해요',
    ja: '現在大変混雑しているため',
    es: 'está demasiado lleno ahora',
    zh: '现在过于拥挤',
  },
  guest_request: {
    en: 'at your party’s request',
    ko: '일행 요청에 따라 변경했어요',
    ja: 'お客様のご要望により',
    es: 'a petición de su grupo',
    zh: '应贵团要求',
  },
  time: {
    en: 'to keep today’s timing on track',
    ko: '오늘 일정 시간을 맞추기 위해서예요',
    ja: '本日のスケジュール調整のため',
    es: 'para mantener el horario del día',
    zh: '为保证今日行程时间',
  },
};

const CAPSULE: Record<RoomLocale, string> = {
  en: '🔄 Plan update: {stop} is skipped today — {reason}. The rest of the schedule has been adjusted.',
  ko: '🔄 일정 변경: 오늘 {stop}은(는) 건너뜁니다 — {reason}. 나머지 일정은 조정되었어요.',
  ja: '🔄 予定変更：本日{stop}はスキップします — {reason}。残りの日程は調整済みです。',
  es: '🔄 Cambio de plan: hoy se omite {stop} — {reason}. El resto del itinerario se ha ajustado.',
  zh: '🔄 行程变更：今日跳过{stop} — {reason}。其余行程已作调整。',
};

function isSkipReason(value: unknown): value is SkipReason {
  return typeof value === 'string' && value in REASON_LABEL;
}

function stopName(stop: DayPlanStop, locale: RoomLocale): string {
  const names = stop.name_i18n;
  const localized = names?.[locale] ?? names?.en;
  if (typeof localized === 'string' && localized.trim()) return localized.trim();
  if (typeof stop.poi_key === 'string' && stop.poi_key) return humanizePoiKey(stop.poi_key);
  return '';
}

export interface NewlySkippedStop {
  stop: DayPlanStop;
  reason: SkipReason;
}

/**
 * Identity ladder for diffing: id → poi_key → English/first name (a free-text
 * stop has neither id nor poi_key — without the name fallback such a stop
 * would re-announce on EVERY staff write; pressure-test fix 2026-07-22).
 */
function stopIdentity(stop: DayPlanStop): string {
  if (stop.id) return `id:${stop.id}`;
  if (stop.poi_key) return `poi:${stop.poi_key}`;
  const names = stop.name_i18n;
  const name =
    (typeof names?.en === 'string' && names.en.trim()) ||
    Object.values(names ?? {}).find((v) => typeof v === 'string' && v.trim());
  return name ? `name:${String(name).trim()}` : '';
}

/**
 * Stops that BECAME skipped in this write (previous status ≠ skipped, next =
 * skipped with a whitelisted reason).
 */
export function newlySkippedStops(
  previous: DayPlanStop[] | null | undefined,
  next: DayPlanStop[] | null | undefined,
): NewlySkippedStop[] {
  if (!Array.isArray(next)) return [];
  const prevByKey = new Map<string, DayPlanStop>();
  for (const stop of previous ?? []) {
    const key = stopIdentity(stop);
    if (key) prevByKey.set(key, stop);
  }
  const result: NewlySkippedStop[] = [];
  for (const stop of next) {
    if (stop?.status !== 'skipped' || !isSkipReason(stop.skip_reason)) continue;
    const key = stopIdentity(stop);
    const before = key ? prevByKey.get(key) : undefined;
    if (before?.status === 'skipped') continue; // already skipped — no re-announce
    // An identity-less skipped stop can't be diffed — announcing it every
    // write is worse than staying silent, so skip it.
    if (!key) continue;
    result.push({ stop, reason: stop.skip_reason });
  }
  return result;
}

/** The 5-locale capsule for ONE newly skipped stop. */
export function renderSkipCapsule(skipped: NewlySkippedStop): {
  source_locale: string;
  source_text: string;
  translations: Record<string, string>;
} {
  const translations: Record<string, string> = {};
  for (const locale of ROOM_LOCALES) {
    translations[locale] = CAPSULE[locale]
      .replaceAll('{stop}', stopName(skipped.stop, locale))
      .replaceAll('{reason}', REASON_LABEL[skipped.reason][locale]);
  }
  return { source_locale: 'en', source_text: translations.en, translations };
}
