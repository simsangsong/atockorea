/**
 * §11.C C2 — approach preview (1 km geofence), pure + client-safe.
 *
 * A guest crossing 1 km of a scheduled POI gets a LIGHT preview card ("coming
 * up: Seongsan — about 900 m ahead") with the same resolved POI content and
 * video the arrival card uses. This is explicitly NOT an arrival:
 *
 *   - the operator's manual [도착] tap stays the primary path (§12 Q2 — iOS
 *     Safari cannot watch position in the background, so this only fires while
 *     the guest has the map tab open with sharing ON);
 *   - approach carries no meeting time, no rally, no facility pins — it is a
 *     "what's coming" teaser, and the arrival card remains the operational one;
 *   - the server suppresses the preview once the stop's arrival already fired.
 *
 * The stepper mirrors lib/tour-room/spotWatcher (nearest target wins, exit
 * hysteresis, 120 s cooldown, accuracy filter) with two deliberate deltas:
 *   - NO dwell requirement — a bus that merely passes within 1 km must still
 *     preview the stop it is driving toward;
 *   - fire-once-per-POI-PER-DAY instead of once-per-visit, so leaving and
 *     re-entering the ring never re-posts the same preview.
 */

import { haversineM, isAccurateEnough, type GeoSample } from '@/lib/tour-room/geo';
import { formatDistance } from '@/lib/tour-room/eta';
import { kstToday } from '@/lib/tour-room/time';
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';
import type { SpotArrivalContent } from '@/lib/tour-room/spotContent';
import type { ArrivalVideoCardMeta } from '@/lib/tour-room/poiVideos';

/** Preview ring: crossing inbound fires the card (§11.C C2). */
export const APPROACH_RADIUS_M = 1000;
/** Hysteresis: the ring state resets only past this outer bound. */
export const APPROACH_EXIT_RADIUS_M = 1500;
/** Minimum gap between two approach fires (any POI). */
export const APPROACH_COOLDOWN_MS = 120_000;
/** Server-side slack on the client-reported position (20 % of the ring). */
export const APPROACH_SERVER_RADIUS_M = 1200;

/** A scheduled stop worth previewing (poi_key is the server's content key). */
export interface ApproachTarget {
  poi_key: string;
  latitude: number;
  longitude: number;
}

export interface ApproachState {
  /** poi_key → inside the ring right now (post-hysteresis). */
  inside: Record<string, boolean>;
  /** poi_key → KST day (YYYY-MM-DD) the preview already fired on. */
  firedOn: Record<string, string>;
  lastFiredAtMs: number | null;
}

export const INITIAL_APPROACH_STATE: ApproachState = {
  inside: {},
  firedOn: {},
  lastFiredAtMs: null,
};

export interface ApproachStep {
  state: ApproachState;
  /** Set exactly when this sample should POST an approach preview. */
  approach: { poiKey: string; distanceM: number } | null;
}

export interface ApproachStepOptions {
  radiusM?: number;
  exitRadiusM?: number;
  cooldownMs?: number;
  maxAccuracyM?: number;
  /** KST day key; defaults to the sample's own KST date. */
  dayKey?: string;
}

/**
 * Advance the approach state machine with one geo sample.
 *
 * Only the nearest target is evaluated (same overlapping-radii rule as
 * §O-8): in a dense cluster the guest should preview the stop they are
 * actually closest to, not all of them at once.
 */
export function stepApproach(
  state: ApproachState,
  sample: GeoSample,
  targets: ApproachTarget[],
  options?: ApproachStepOptions,
): ApproachStep {
  if (targets.length === 0) return { state, approach: null };
  if (!isAccurateEnough(sample, options?.maxAccuracyM)) return { state, approach: null };

  const radiusM = options?.radiusM ?? APPROACH_RADIUS_M;
  const exitM = options?.exitRadiusM ?? APPROACH_EXIT_RADIUS_M;
  const cooldownMs = options?.cooldownMs ?? APPROACH_COOLDOWN_MS;
  const dayKey = options?.dayKey ?? kstToday(sample.timestampMs);

  let nearest: ApproachTarget | null = null;
  let nearestDistance = Infinity;
  for (const target of targets) {
    const distance = haversineM(sample, target);
    if (distance < nearestDistance) {
      nearest = target;
      nearestDistance = distance;
    }
  }
  if (!nearest) return { state, approach: null };

  const inside: Record<string, boolean> = { ...state.inside };

  // Non-nearest targets past the exit ring drop their inside flag, so a later
  // re-approach is judged from a clean slate (the day guard still holds).
  for (const target of targets) {
    if (target.poi_key === nearest.poi_key) continue;
    if (inside[target.poi_key] && haversineM(sample, target) > exitM) {
      inside[target.poi_key] = false;
    }
  }

  if (nearestDistance <= radiusM) inside[nearest.poi_key] = true;
  else if (nearestDistance > exitM) inside[nearest.poi_key] = false;
  // between radius and exit: hysteresis band — hold whatever we were.

  const alreadyFired = state.firedOn[nearest.poi_key] === dayKey;
  const coolingDown =
    state.lastFiredAtMs !== null && sample.timestampMs - state.lastFiredAtMs < cooldownMs;
  const fires = Boolean(inside[nearest.poi_key]) && !alreadyFired && !coolingDown;

  return {
    state: {
      inside,
      // Cooldown-suppressed previews stay unfired so a later sample emits them.
      firedOn: fires ? { ...state.firedOn, [nearest.poi_key]: dayKey } : state.firedOn,
      lastFiredAtMs: fires ? sample.timestampMs : state.lastFiredAtMs,
    },
    approach: fires ? { poiKey: nearest.poi_key, distanceM: nearestDistance } : null,
  };
}

/** The preview line, per locale ({spot}/{dist} interpolate verbatim). */
const APPROACH_LINE: Record<RoomLocale, string> = {
  en: 'Coming up: {spot} — about {dist} ahead.',
  ko: '곧 도착: {spot} — 약 {dist} 앞이에요.',
  ja: 'まもなく到着：{spot} — 約{dist}先です。',
  es: 'Próxima parada: {spot} — a unos {dist}.',
  zh: '即将到达：{spot} — 前方约{dist}。',
};

/** Card chrome for the preview (badge + map link), 5 locales, zero-LLM. */
export const APPROACH_COPY: Record<RoomLocale, { badge: string; map: string; preview: string }> = {
  en: { badge: 'Coming up', map: 'Map', preview: 'A quick look before we get there' },
  ko: { badge: '곧 도착', map: '지도', preview: '도착 전 미리 보기' },
  ja: { badge: 'まもなく到着', map: '地図', preview: '到着前のプレビュー' },
  es: { badge: 'Próxima parada', map: 'Mapa', preview: 'Un vistazo antes de llegar' },
  zh: { badge: '即将到达', map: '地图', preview: '到达前先看一眼' },
};

export interface ApproachTextArgs {
  spotTitle: string;
  distanceM: number;
}

/** One locale's preview line. */
export function composeApproachText(locale: RoomLocale, args: ApproachTextArgs): string {
  return APPROACH_LINE[locale]
    .replaceAll('{spot}', args.spotTitle)
    .replaceAll('{dist}', formatDistance(args.distanceM));
}

/** All room locales at once — the message row's translations column. */
export function composeApproachTranslations(args: ApproachTextArgs): {
  source_locale: string;
  source_text: string;
  translations: Record<string, string>;
} {
  const translations: Record<string, string> = {};
  for (const locale of ROOM_LOCALES) translations[locale] = composeApproachText(locale, args);
  return { source_locale: 'en', source_text: translations.en, translations };
}

/**
 * The `metadata` contract of an `approach_card` message row.
 *
 * Deliberately separate from ArrivalBundleMeta: an approach has no meeting
 * time, no follow/ticket policy and no facility pins, and conflating the two
 * would let a preview render as an operational arrival.
 */
export interface ApproachCardMeta {
  kind: 'approach_card';
  spot_title: string;
  poi_key: string | null;
  content?: SpotArrivalContent;
  content_tier?: string;
  video_card?: ArrivalVideoCardMeta | null;
  /** Reported distance at the moment the ring was crossed. */
  distance_m: number;
  /** POI coordinates (match_pois) for the card's map deep link. */
  poi_lat?: number | null;
  poi_lng?: number | null;
  triggered_by_role?: string;
  [key: string]: unknown;
}
