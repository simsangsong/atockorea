/**
 * §11.C C1/C3 — "where is my ride?" (vehicle location + arrival ETA).
 *
 * The room already relays every participant position (T3.1 location route +
 * useGeoWatcher) and the map tab already draws them. What was missing is the
 * guest-facing READING of that stream: which of those markers is the VEHICLE,
 * how stale it is, and how long until it reaches the meeting point.
 *
 * This module is the pure half of that answer — role pick, freshness bands,
 * ETA delegation (never a second ETA implementation: syntheticLeg stays the
 * single source), the KST pickup window, and the 5-locale copy. No DB and no
 * browser API, so the customer card computes an instant ETA with zero network
 * and the server route reuses the exact same selection rule.
 */

import { formatDistance, syntheticLeg, type LegEstimate } from '@/lib/tour-room/eta';
import { kstStartOfDayMs } from '@/lib/tour-room/time';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

/**
 * Roles whose live position IS the vehicle, best first. A driver is riding
 * with the van by definition; a guide is the fallback because small groups
 * are usually guide-driven (the cockpit is shared for exactly that reason).
 */
export const VEHICLE_ROLES = ['driver', 'guide'] as const;
export type VehicleRole = (typeof VEHICLE_ROLES)[number];

/**
 * Structurally minimal position — satisfied by both the broadcast frame
 * (hooks/useTourRoomChannel RoomLocation) and a tour_room_locations row.
 */
export interface VehicleLocationLike {
  participant_id?: string;
  role?: string | null;
  latitude: number;
  longitude: number;
  recorded_at?: string | null;
  display_name?: string | null;
}

export interface LatLngPoint {
  lat: number;
  lng: number;
}

function roleRank(role: unknown): number {
  const index = (VEHICLE_ROLES as readonly string[]).indexOf(typeof role === 'string' ? role : '');
  return index < 0 ? Number.POSITIVE_INFINITY : index;
}

function recordedMs(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function validPoint(point: Partial<LatLngPoint> | null | undefined): LatLngPoint | null {
  if (!point) return null;
  const { lat, lng } = point;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * The one position the guest means by "the vehicle": driver over guide, and
 * within a role the freshest `recorded_at`. Accepts the by-participant map the
 * channel keeps as well as a plain row array.
 */
export function pickVehicleLocation<T extends VehicleLocationLike>(
  locations: readonly T[] | Record<string, T> | null | undefined,
): T | null {
  if (!locations) return null;
  const rows = Array.isArray(locations) ? locations : Object.values(locations as Record<string, T>);
  let best: T | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  let bestAt = -1;
  for (const row of rows) {
    if (!row || !validPoint({ lat: row.latitude, lng: row.longitude })) continue;
    const rank = roleRank(row.role);
    if (!Number.isFinite(rank)) continue;
    const at = recordedMs(row.recorded_at);
    if (rank < bestRank || (rank === bestRank && at > bestAt)) {
      best = row;
      bestRank = rank;
      bestAt = at;
    }
  }
  return best;
}

/** A ping this recent is "live" — the watcher publishes every 15s (§O-5). */
export const VEHICLE_LIVE_MS = 120_000;
/** Beyond this the position is too old to hang an arrival promise on. */
export const VEHICLE_RECENT_MS = 10 * 60_000;
/**
 * Beyond this the marker stops meaning anything at all. tour_room_locations
 * keeps ONE row per participant until an explicit stop, so yesterday's ping
 * survives into today's lobby — without this ceiling a guest would open the
 * room to "Position 4320 min ago" and read a driver who is sharing nothing as
 * if they were. One hour also absorbs the legitimate mid-tour gaps (the
 * watcher is foreground-only, so it pauses whenever the driver switches to a
 * navigation app), so nothing live is ever hidden by it.
 */
export const VEHICLE_MAX_AGE_MS = 60 * 60_000;

export type VehicleFreshnessState = 'live' | 'recent' | 'stale' | 'expired';

export interface VehicleFreshness {
  ageMs: number;
  state: VehicleFreshnessState;
}

/**
 * How much to trust the marker. Two gates, in order of severity: `stale` shows
 * "{n} min ago" instead of an ETA rather than promising an arrival computed
 * from a position the van left long ago; `expired` means the card should not
 * render at all (a leftover row from an earlier day is not a vehicle).
 */
export function vehicleFreshness(
  recordedAtIso: string | null | undefined,
  nowMs = Date.now(),
): VehicleFreshness {
  const at = recordedMs(recordedAtIso);
  if (!at) return { ageMs: Number.POSITIVE_INFINITY, state: 'expired' };
  const ageMs = Math.max(0, nowMs - at);
  if (ageMs <= VEHICLE_LIVE_MS) return { ageMs, state: 'live' };
  if (ageMs <= VEHICLE_RECENT_MS) return { ageMs, state: 'recent' };
  if (ageMs <= VEHICLE_MAX_AGE_MS) return { ageMs, state: 'stale' };
  return { ageMs, state: 'expired' };
}

/**
 * Instant client-side estimate — delegates to the ONE synthetic model
 * (haversine × road factor at the tour-van pace). Null-safe on both ends so
 * a missing pickup coordinate simply hides the ETA line.
 */
export function vehicleEtaFrom(
  from: Partial<LatLngPoint> | null | undefined,
  to: Partial<LatLngPoint> | null | undefined,
): LegEstimate | null {
  const origin = validPoint(from);
  const destination = validPoint(to);
  if (!origin || !destination) return null;
  return syntheticLeg(origin, destination);
}

/** How early the "coming to pick you up" emphasis appears. */
export const PICKUP_WINDOW_BEFORE_MS = 60 * 60 * 1000;
/** …and how long past the scheduled pickup it stays (late vans exist). */
export const PICKUP_WINDOW_AFTER_MS = 30 * 60 * 1000;

/**
 * Is now inside the morning pickup window for this booking? KST-anchored via
 * the room's existing day helper — the same reason roomLifecycle is KST: a
 * 09:00 pickup must read as "today" from 00:00 KST, not from UTC midnight.
 */
export function isPickupWindow(
  nowMs: number,
  tourDateIso: string | null | undefined,
  pickupTimeHhmm: string | null | undefined,
): boolean {
  if (typeof tourDateIso !== 'string' || !tourDateIso) return false;
  const clock = typeof pickupTimeHhmm === 'string' ? pickupTimeHhmm.trim().match(/^(\d{1,2}):(\d{2})/) : null;
  if (!clock) return false;
  const hours = Number(clock[1]);
  const minutes = Number(clock[2]);
  if (hours > 23 || minutes > 59) return false;
  let dayStartMs: number;
  try {
    dayStartMs = kstStartOfDayMs(tourDateIso);
  } catch {
    return false;
  }
  const pickupMs = dayStartMs + (hours * 60 + minutes) * 60_000;
  return nowMs >= pickupMs - PICKUP_WINDOW_BEFORE_MS && nowMs <= pickupMs + PICKUP_WINDOW_AFTER_MS;
}

export interface VehicleEtaCopy {
  title: string;
  button: string;
  /** '{min}' + '{dist}' */
  eta: string;
  /** '{n}' minutes since the last ping */
  age: string;
  justNow: string;
  notSharing: string;
  pickupWindow: string;
}

/** Static 5-locale strings, zero LLM — the card renders from the snapshot. */
const COPY: Record<RoomLocale, VehicleEtaCopy> = {
  en: {
    title: 'Driver location',
    button: 'See vehicle',
    eta: 'About {min} min · {dist}',
    age: 'Position {n} min ago',
    justNow: 'Position just now',
    notSharing: 'Location not shared yet',
    pickupWindow: 'On the way to pick you up',
  },
  ko: {
    title: '기사님 위치',
    button: '차량 위치 보기',
    eta: '약 {min}분 · {dist}',
    age: '{n}분 전 위치',
    justNow: '방금 위치',
    notSharing: '아직 위치 공유 전이에요',
    pickupWindow: '픽업하러 이동 중이에요',
  },
  ja: {
    title: 'ドライバーの現在地',
    button: '車両の位置を見る',
    eta: '約{min}分 · {dist}',
    age: '{n}分前の位置',
    justNow: 'たった今の位置',
    notSharing: 'まだ位置は共有されていません',
    pickupWindow: 'お迎えに向かっています',
  },
  es: {
    title: 'Ubicación del conductor',
    button: 'Ver el vehículo',
    eta: 'Unos {min} min · {dist}',
    age: 'Ubicación de hace {n} min',
    justNow: 'Ubicación de ahora mismo',
    notSharing: 'Aún no comparte su ubicación',
    pickupWindow: 'En camino para recogerte',
  },
  zh: {
    title: '司机位置',
    button: '查看车辆位置',
    eta: '约{min}分钟 · {dist}',
    age: '{n}分钟前的位置',
    justNow: '刚刚的位置',
    notSharing: '尚未共享位置',
    pickupWindow: '正在前往接您',
  },
};

export function vehicleEtaCopy(locale: RoomLocale): VehicleEtaCopy {
  return COPY[locale] ?? COPY.en;
}

/** "약 23분 · 12 km" — distance formatting stays the shared eta.ts helper. */
export function renderVehicleEtaLine(
  locale: RoomLocale,
  args: { minutes: number; distanceM: number },
): string {
  return vehicleEtaCopy(locale)
    .eta.replaceAll('{min}', String(Math.max(1, Math.round(args.minutes))))
    .replaceAll('{dist}', formatDistance(args.distanceM));
}

/** "{n}분 전 위치" — sub-minute collapses to "방금", unknown to the opt-out line. */
export function renderVehicleAgeLine(locale: RoomLocale, ageMs: number): string {
  const copy = vehicleEtaCopy(locale);
  if (!Number.isFinite(ageMs)) return copy.notSharing;
  if (ageMs < 60_000) return copy.justNow;
  return copy.age.replaceAll('{n}', String(Math.floor(ageMs / 60_000)));
}
