/**
 * Facility pins — per-attraction restroom / photo-spot map pins.
 * (Track: docs/tour-room-facility-pins-master-plan-2026-07-19.md, W0.2)
 *
 * Pure, isomorphic helpers shared by the concierge Tier0 answer (attaching a
 * scoped map card) and the admin editor. One source of truth for pin selection
 * (kind filter · distance sort · cap) and the multi-marker Static Maps path,
 * so serving and tests can never drift.
 *
 * The Static path is built for the `/api/maps/static` proxy (server attaches the
 * key; browser referrer restrictions don't apply) — NOT the public JS key — and
 * omits center/zoom so Static Maps auto-fits the viewport to exactly these pins.
 * That auto-fit is what scopes the card to the current attraction only.
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';

export type FacilityKind = 'restroom' | 'photo';

export interface FacilityPin {
  kind: FacilityKind;
  lat: number;
  lng: number;
  /** Neutral/default label (e.g. "Main gate restroom"). */
  name: string | null;
  /** Optional per-locale label; falls back to `name`, then a kind default. */
  nameI18n?: Partial<Record<RoomLocale, string>> | null;
  /** Phase 2 photo-thumbnail pin (optional). */
  photoUrl?: string | null;
  /** Metres from the attraction centre — used for the nearest-first sort. */
  distanceM?: number | null;
}

/** F-D7 — at most this many pins per kind on one card (marker clarity + cost). */
export const FACILITY_PIN_CAP = 3;

/**
 * Map a poi_facility_pins DB row to the compact FacilityPin ridden in the
 * arrival metadata / served to the concierge. Pure — the server route supplies
 * the row so this file never imports supabase (keeps it client-safe).
 */
export function facilityPinFromRow(row: Record<string, unknown>): FacilityPin {
  const nameI18n = row.name_i18n;
  return {
    kind: row.kind === 'photo' ? 'photo' : 'restroom',
    lat: Number(row.lat),
    lng: Number(row.lng),
    name: typeof row.name === 'string' ? row.name : null,
    nameI18n: nameI18n && typeof nameI18n === 'object' ? (nameI18n as FacilityPin['nameI18n']) : null,
    photoUrl: typeof row.photo_url === 'string' ? row.photo_url : null,
    distanceM: typeof row.distance_m === 'number' ? row.distance_m : null,
  };
}

/** Marker colours by kind (Static Maps `color:0xRRGGBB`). */
const KIND_COLOR: Record<FacilityKind, string> = {
  restroom: '0x2563eb', // blue
  photo: '0xdb2777', // pink
};

/** Default label when a pin has neither a localized nor a neutral name. */
const KIND_DEFAULT_LABEL: Record<FacilityKind, Record<RoomLocale, string>> = {
  restroom: { en: 'Restroom', ko: '화장실', zh: '洗手间', ja: 'トイレ', es: 'Baño' },
  photo: { en: 'Photo spot', ko: '포토스팟', zh: '拍照点', ja: '写真スポット', es: 'Foto' },
};

function isFiniteCoord(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/**
 * Filter to one kind, drop invalid coords, sort nearest-first (pins without a
 * distance sink to the end but keep their relative order), and cap.
 */
export function selectFacilityPins(
  pins: FacilityPin[],
  kind: FacilityKind,
  cap: number = FACILITY_PIN_CAP,
): FacilityPin[] {
  return pins
    .filter((p) => p.kind === kind && isFiniteCoord(p.lat, p.lng))
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const da = a.p.distanceM ?? Number.POSITIVE_INFINITY;
      const db = b.p.distanceM ?? Number.POSITIVE_INFINITY;
      return da === db ? a.i - b.i : da - db;
    })
    .slice(0, Math.max(0, cap))
    .map(({ p }) => p);
}

/** Localized display label for a pin's list row (falls back gracefully). */
export function pinLabel(pin: FacilityPin, locale: RoomLocale): string {
  return (
    pin.nameI18n?.[locale]?.trim() ||
    pin.name?.trim() ||
    KIND_DEFAULT_LABEL[pin.kind][locale]
  );
}

/**
 * Guest-facing label (F-D3 A안). Auto-collected restroom names are Korean
 * (e.g. "천지연폭포 공중화장실") — useless to a foreign guest, who just needs
 * "there's a restroom, X away". So for restrooms without a curated per-locale
 * name we show the localized kind label ("Restroom" / "トイレ" / …). Photo spots
 * are always curated with their own name, so they keep it. The raw Korean name
 * still lives in `name` for the admin editor (pinLabel).
 */
export function guestPinLabel(pin: FacilityPin, locale: RoomLocale): string {
  const curated = pin.nameI18n?.[locale]?.trim();
  if (curated) return curated;
  if (pin.kind === 'restroom') return KIND_DEFAULT_LABEL.restroom[locale];
  return pin.name?.trim() || KIND_DEFAULT_LABEL[pin.kind][locale];
}

/** Native-maps directions target for tapping a pin's row. */
export function pinDirectionsUrl(pin: FacilityPin): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${pin.lat.toFixed(6)},${pin.lng.toFixed(6)}`;
}

export interface StaticMapPathOptions {
  width?: number;
  height?: number;
  scale?: 1 | 2;
}

/**
 * Multi-marker Static Maps query string (leading `?`, NO api key) for the
 * `/api/maps/static` proxy. Each pin gets its own numbered marker (1..N) so the
 * numbers line up with the name list rendered below the map. No center/zoom →
 * the API auto-fits to the markers (scopes to just this attraction's pins).
 * Returns '' when there are no valid pins (caller renders a text fallback).
 */
export function facilityStaticMapPath(pins: FacilityPin[], opts: StaticMapPathOptions = {}): string {
  const valid = pins.filter((p) => isFiniteCoord(p.lat, p.lng));
  if (valid.length === 0) return '';

  const { width = 320, height = 160, scale = 2 } = opts;
  const params = new URLSearchParams();
  params.set('size', `${width}x${height}`);
  params.set('scale', String(scale));

  valid.forEach((pin, i) => {
    const color = KIND_COLOR[pin.kind];
    const label = String(i + 1); // Static Maps labels: single digit/letter
    const coord = `${pin.lat.toFixed(6)},${pin.lng.toFixed(6)}`;
    // One marker declaration per pin so each carries its own label.
    params.append('markers', `color:${color}|label:${label}|${coord}`);
  });

  return `?${params.toString()}`;
}
