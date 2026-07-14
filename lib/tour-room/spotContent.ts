/**
 * T4.3 — spot-event content layer + zero-LLM event templates.
 *
 * Templates (§M-2 ①): arrival / audio / meeting-notice phrasing is a fixed,
 * pre-translated 5-locale constant — handling a geofence arrival makes ZERO
 * LLM calls. Spot names, times, and meeting points interpolate verbatim
 * (proper nouns are never machine-translated).
 *
 * Content (D-5) resolves in three tiers, best first:
 *   1. tour_guide_spots.content jsonb — { [locale]: TourStopDrawerStop-like }
 *      (admin-curated, T4.2);
 *   2. data/poi_kb entry via tour_guide_spots.poi_key (fact sheet fallback);
 *   3. null — the arrival card renders the plain template message only.
 */

import poiKnowledgeBase from '@/data/poi_kb/poi_knowledge_base_v1.29.json';
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

/** TourStopDrawerStop-compatible subset the arrival card renders (T4.5). */
export interface SpotArrivalContent {
  name?: string;
  description?: string;
  image?: string;
  images?: string[];
  highlights?: string[];
  visitBasics?: { hours?: string; closed?: string; admission?: string; walking?: string };
  convenience?: { restroom?: string; parking?: string };
  smartNotes?: { photo?: string; facilities?: string; tip?: string };
}

export type SpotEventKind =
  | 'arrived'
  | 'arrived_audio'
  | 'audio_played'
  | 'meeting_notice'
  | 'meeting_notice_timed'
  | 'free_time'
  | 'free_time_cancelled'
  | 'onboard_ack';

/** {spot}/{time}/{point} interpolate verbatim. */
const TEMPLATES: Record<SpotEventKind, Record<RoomLocale, string>> = {
  arrived: {
    en: 'You have arrived near {spot}.',
    ko: '{spot} 근처에 도착했어요.',
    ja: '{spot}の近くに到着しました。',
    es: 'Has llegado cerca de {spot}.',
    zh: '您已到达{spot}附近。',
  },
  arrived_audio: {
    en: 'You have arrived near {spot}. Tap the audio guide button to play the guide.',
    ko: '{spot} 근처에 도착했어요. 오디오 가이드 버튼을 눌러 설명을 들어보세요.',
    ja: '{spot}の近くに到着しました。オーディオガイドボタンで解説を再生できます。',
    es: 'Has llegado cerca de {spot}. Toca el botón de audioguía para escucharla.',
    zh: '您已到达{spot}附近。点击语音导览按钮即可收听讲解。',
  },
  audio_played: {
    en: 'Audio guide started for {spot}.',
    ko: '{spot} 오디오 가이드를 시작했어요.',
    ja: '{spot}のオーディオガイドを開始しました。',
    es: 'Audioguía iniciada para {spot}.',
    zh: '已开始播放{spot}的语音导览。',
  },
  meeting_notice: {
    en: 'Please gather at {point}.',
    ko: '{point}에서 모여주세요.',
    ja: '{point}にお集まりください。',
    es: 'Por favor, reúnanse en {point}.',
    zh: '请在{point}集合。',
  },
  meeting_notice_timed: {
    en: 'Meeting time is {time}. Please gather at {point}.',
    ko: '집합 시간은 {time}입니다. {point}에서 모여주세요.',
    ja: '集合時間は{time}です。{point}にお集まりください。',
    es: 'La hora de reunión es {time}. Por favor, reúnanse en {point}.',
    zh: '集合时间为{time}。请在{point}集合。',
  },
  free_time: {
    en: 'Free time until {time} — please be back at {point} by then.',
    ko: '{time}까지 자유시간이에요 — 시간에 맞춰 {point}(으)로 돌아와 주세요.',
    ja: '{time}まで自由時間です — 時間までに{point}へお戻りください。',
    es: 'Tiempo libre hasta las {time} — vuelve a {point} para entonces.',
    zh: '自由活动至{time} — 请届时回到{point}。',
  },
  free_time_cancelled: {
    en: 'Free time has ended — please gather at {point} now.',
    ko: '자유시간이 종료됐어요 — 지금 {point}(으)로 모여주세요.',
    ja: '自由時間は終了しました — 今すぐ{point}にお集まりください。',
    es: 'El tiempo libre ha terminado — reúnanse en {point} ahora.',
    zh: '自由活动结束 — 请立即在{point}集合。',
  },
  onboard_ack: {
    en: "I'm on the bus. 🚌",
    ko: '버스에 탑승했어요. 🚌',
    ja: 'バスに乗りました。🚌',
    es: 'Ya estoy en el bus. 🚌',
    zh: '我已上车。🚌',
  },
};

export interface SpotEventParams {
  spot?: string;
  time?: string;
  point?: string;
}

function interpolate(template: string, params: SpotEventParams): string {
  return template
    .replaceAll('{spot}', params.spot ?? '')
    .replaceAll('{time}', params.time ?? '')
    .replaceAll('{point}', params.point ?? '');
}

export function renderSpotEventText(kind: SpotEventKind, locale: RoomLocale, params: SpotEventParams): string {
  return interpolate(TEMPLATES[kind][locale], params);
}

/** All-locale translations bundle for a message row — zero LLM calls. */
export function renderSpotEventTranslations(
  kind: SpotEventKind,
  params: SpotEventParams,
): { source_locale: string; source_text: string; translations: Record<string, string> } {
  const translations: Record<string, string> = {};
  for (const locale of ROOM_LOCALES) {
    translations[locale] = renderSpotEventText(kind, locale, params);
  }
  return { source_locale: 'en', source_text: translations.en, translations };
}

// ---------------------------------------------------------------------------
// Content resolution (3 tiers).
// ---------------------------------------------------------------------------

interface PoiKbEntry {
  visitBasics?: SpotArrivalContent['visitBasics'];
  convenience?: SpotArrivalContent['convenience'];
  smartNotes?: SpotArrivalContent['smartNotes'];
  [key: string]: unknown;
}

function poiKbEntry(poiKey: string | null | undefined): PoiKbEntry | null {
  if (!poiKey) return null;
  const entry = (poiKnowledgeBase as Record<string, unknown>)[poiKey];
  if (!entry || typeof entry !== 'object' || poiKey === '_metadata') return null;
  return entry as PoiKbEntry;
}

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && Object.keys(value as object).length > 0;
}

export interface SpotContentSource {
  title: string;
  content?: unknown;
  poi_key?: string | null;
}

/**
 * Resolve the richest available content for a spot in `locale`.
 * Returns { content, tier } — tier is exported for tests/telemetry.
 */
export function resolveSpotContent(
  spot: SpotContentSource,
  locale: RoomLocale,
): { content: SpotArrivalContent | null; tier: 'curated' | 'poi_kb' | 'none' } {
  // Tier 1 — admin-curated content jsonb (locale key, en fallback).
  if (isNonEmptyObject(spot.content)) {
    const byLocale = spot.content as Record<string, unknown>;
    const candidate = byLocale[locale] ?? byLocale.en;
    if (isNonEmptyObject(candidate)) {
      return { content: { name: spot.title, ...(candidate as SpotArrivalContent) }, tier: 'curated' };
    }
  }

  // Tier 2 — poi_kb fact sheet.
  const kb = poiKbEntry(spot.poi_key);
  if (kb && (isNonEmptyObject(kb.visitBasics) || isNonEmptyObject(kb.convenience) || isNonEmptyObject(kb.smartNotes))) {
    return {
      content: {
        name: spot.title,
        visitBasics: kb.visitBasics,
        convenience: kb.convenience,
        smartNotes: kb.smartNotes,
      },
      tier: 'poi_kb',
    };
  }

  // Tier 3 — template message only.
  return { content: null, tier: 'none' };
}
