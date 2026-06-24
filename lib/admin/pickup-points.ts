/**
 * Pickup-point row mapping + validation for the admin tours routes (W3.7 / AR-3).
 *
 * The POST swallowed pickup insert errors (returned 201 as if saved), and the
 * PATCH deleted all existing pickups before inserting the new ones with no
 * validation — a malformed/failed insert wiped every pickup for the tour. This
 * validates the shape up-front (before any destructive delete) so callers can
 * reject bad input safely and restore on failure.
 */
export interface PickupPointRow {
  tour_id: string | number;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  pickup_time: string | null;
  image_url: string | null;
}

export type MapPickupResult =
  | { ok: true; rows: PickupPointRow[] }
  | { ok: false; error: string };

function toCoord(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function mapPickupPoints(raw: unknown, tourId: string | number): MapPickupResult {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'pickup_points must be an array' };
  }
  const rows: PickupPointRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const pp = (raw[i] ?? {}) as Record<string, unknown>;
    const name = typeof pp.name === 'string' ? pp.name.trim() : '';
    if (!name) {
      return { ok: false, error: `pickup_points[${i}] is missing a name` };
    }
    rows.push({
      tour_id: tourId,
      name,
      address: pp.address != null ? String(pp.address) : '',
      lat: toCoord(pp.lat),
      lng: toCoord(pp.lng),
      pickup_time: pp.pickup_time ? String(pp.pickup_time) : null,
      image_url:
        pp.image_url && String(pp.image_url).trim() ? String(pp.image_url).trim() : null,
    });
  }
  return { ok: true, rows };
}
