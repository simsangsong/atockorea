/**
 * A2 — next-stop distance + ETA (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 *
 * The travel-matrix flywheel has been LEARNING poi→poi drive minutes weekly
 * (manual_arrival gaps) but nothing ever read it — this module is the missing
 * consumer. Estimate ladder, best first:
 *   ① poi_travel_matrix minutes_p50 for (from, to, daypart) — measured;
 *   ② synthetic: haversine × 1.55 road factor at 40 km/h — the same fallback
 *     constant the flywheel migration documents for unseen pairs.
 *
 * Pure and client-safe; the server lookup lives in eta.server.ts.
 */

import { haversineM } from '@/lib/tour-room/geo';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** Road distance ≈ great-circle × this (Korean coastal/rural road factor). */
export const ROAD_FACTOR = 1.55;
/** Synthetic average speed (km/h) — Jeju/Busan tour-van pace incl. lights. */
export const SYNTHETIC_KMH = 40;

export type Daypart = 'am' | 'midday' | 'pm' | 'evening';

/** KST daypart bands — mirrors the flywheel writer's classification. */
export function daypartOf(dateIso: string | Date, timeZone = 'Asia/Seoul'): Daypart {
  const date = typeof dateIso === 'string' ? new Date(dateIso) : dateIso;
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone }).format(date),
  );
  if (hour < 11) return 'am';
  if (hour < 14) return 'midday';
  if (hour < 18) return 'pm';
  return 'evening';
}

export interface LegEstimate {
  distanceM: number;
  minutes: number;
  source: 'measured' | 'synthetic';
}

/** Synthetic ETA from coordinates alone (ladder ②). */
export function syntheticLeg(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): LegEstimate {
  const distanceM = haversineM(
    { latitude: from.lat, longitude: from.lng },
    { latitude: to.lat, longitude: to.lng },
  );
  const roadKm = (distanceM / 1000) * ROAD_FACTOR;
  const minutes = Math.max(1, Math.round((roadKm / SYNTHETIC_KMH) * 60));
  return { distanceM: Math.round(distanceM), minutes, source: 'synthetic' };
}

/** Prefer a measured matrix row; keep the synthetic distance for display. */
export function mergeMeasured(synthetic: LegEstimate, measuredMinutes: number | null): LegEstimate {
  if (typeof measuredMinutes === 'number' && Number.isFinite(measuredMinutes) && measuredMinutes > 0) {
    return { ...synthetic, minutes: Math.round(measuredMinutes), source: 'measured' };
  }
  return synthetic;
}

/** "12 km" under 10 → one decimal ("8.4 km"); metres under 1 km. */
export function formatDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM / 10) * 10} m`;
  const km = distanceM / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

const NEXT_LEG_LINE: Record<RoomLocale, string> = {
  en: 'Next: {title} — {dist}, about {min} min.',
  ko: '다음 이동: {title} — {dist}, 약 {min}분.',
  ja: '次の移動：{title} — {dist}、約{min}分。',
  es: 'Siguiente: {title} — {dist}, unos {min} min.',
  zh: '下一站：{title} — {dist}，约{min}分钟。',
};

/** The bundle's tail line, per locale ({title} interpolates verbatim). */
export function renderNextLegLine(
  locale: RoomLocale,
  args: { title: string; distanceM: number; minutes: number },
): string {
  return NEXT_LEG_LINE[locale]
    .replaceAll('{title}', args.title)
    .replaceAll('{dist}', formatDistance(args.distanceM))
    .replaceAll('{min}', String(args.minutes));
}

/** Metadata shape ridden on the arrival bundle (client card footer). */
export interface NextLegMeta {
  title: string;
  poi_key: string | null;
  distance_m: number;
  minutes: number;
  source: 'measured' | 'synthetic';
}
