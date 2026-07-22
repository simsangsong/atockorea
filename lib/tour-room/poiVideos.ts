/**
 * POI arrival videos — client-safe shapes + locale pick (video W3 / join-tour J4).
 *
 * A produced POI video (Ken Burns + TTS narration + burned subtitles, one MP4
 * per language) serves inside the arrival card once an admin approves it
 * (VP-D10: everything lands as pending_review; only approved rows reach a
 * guest). Videos exist in en/zh-Hant/ja/es (VP-D3); the metadata keys them by
 * ROOM locale (zh-Hant → zh) and Korean viewers fall back to English — the
 * subtitles are burned in, so a wrong-language fallback is still watchable.
 *
 * Plan: docs/video-automation/VIDEO_PRODUCTION_MASTER_PLAN_2026-07-21.md §D W3,
 *       docs/join-tour-ticketless-rich-itinerary-master-plan-2026-07-22.md §C J4.
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** Rides in message metadata as `video_card` on arrival_bundle / spot_arrival. */
export interface ArrivalVideoCardMeta {
  poster_url: string | null;
  duration_seconds: number | null;
  /** Room-locale → public MP4 URL ('ko' never has an entry; render falls back). */
  urls: Partial<Record<RoomLocale, string>>;
}

/** Video pipeline language → room locale ('zh-Hant' → 'zh'; ko has no video). */
export const VIDEO_LANGUAGE_TO_ROOM_LOCALE: Record<string, RoomLocale> = {
  en: 'en',
  'zh-Hant': 'zh',
  ja: 'ja',
  es: 'es',
};

/** The viewer's video URL: their locale, else English, else any language. */
export function pickVideoUrl(meta: ArrivalVideoCardMeta, locale: RoomLocale): string | null {
  return meta.urls[locale] ?? meta.urls.en ?? Object.values(meta.urls).find(Boolean) ?? null;
}

export function isVideoCardMeta(value: unknown): value is ArrivalVideoCardMeta {
  if (!value || typeof value !== 'object') return false;
  const meta = value as ArrivalVideoCardMeta;
  return Boolean(meta.urls && typeof meta.urls === 'object' && Object.values(meta.urls).some(Boolean));
}

/** mm:ss badge for the poster overlay ("1:04"). */
export function formatVideoDuration(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
