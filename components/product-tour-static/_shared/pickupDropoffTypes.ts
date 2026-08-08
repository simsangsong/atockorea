/**
 * Authoring-side shape for the optional `pickup_dropoff` block on
 * `tour_product_full_page_v1` bundles (bus tours, future shuttle products).
 *
 * East Signature / Jeju Grand / Southwest Hallasan do NOT carry this block —
 * the timeline section renders the pickup/drop-off cards only when
 * `pickup_dropoff` is present on the VM.
 */

export type PickupDropoffPointType =
  | "hotel"
  | "airport"
  | "shopping"
  | "market"
  | "station"
  | string;

export type PickupDropoffPoint = {
  order: number;
  time?: string;
  name: string;
  type?: PickupDropoffPointType;
  note?: string;
  lat?: number;
  lng?: number;
  /** Short landmark or floor/gate description shown on map card */
  locationDetail?: string;
  /** Absolute URL to a photo of the meeting point */
  photo?: string;
};

export type PickupDropoffSection = {
  pickupType?: string;
  dropoffType?: string;
  departure: PickupDropoffPoint[];
  return: PickupDropoffPoint[];
  notes?: string[];
};

/**
 * Cruise rows carry descriptive `time` values ("Confirmed at booking (≈30 min
 * after ship docking)") instead of clock times. Layout slots sized for "08:30"
 * must check this before rendering — a sentence in a `flex-shrink-0` time slot
 * crushes the sibling column into vertical per-letter wrapping.
 *
 * Compact windows like "09:00–10:00" (hotel-pickup rows store the whole window
 * in one field) still fit the tight slots, so ranges count as clock-like. The
 * separator class covers the dashes/tildes the ten locales actually use.
 */
export function isClockTime(time: string | null | undefined): time is string {
  return (
    !!time &&
    /^\s*[~≈]?\s*\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?\s*(?:[–—\-~〜～]\s*\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?\s*)?$/i.test(
      time,
    )
  );
}

/**
 * Return window from `pickup_dropoff.notes`, locale-agnostic. The old copies
 * of this helper required the English word "around", so every non-EN locale
 * silently fell through to a fabricated fallback time. Digits survive
 * translation — so match any HH:MM–HH:MM range (locale dashes included) and
 * pick the one starting latest in the day: notes on hotel-pickup products
 * also contain the MORNING pickup window ("09:00–10:00 사이"), and the return
 * window of a day tour is always the later of the two.
 */
export function inferReturnBand(notes: string[] | string | undefined): string | null {
  if (!notes?.length) return null;
  const joined = Array.isArray(notes) ? notes.join(" ") : String(notes);
  const rx = /(\d{1,2}):(\d{2})\s*[–—\-~〜～]\s*(\d{1,2}:\d{2})/g;
  let best: string | null = null;
  let bestStart = -1;
  for (const m of joined.matchAll(rx)) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) continue;
    const start = h * 60 + min;
    if (start > bestStart) {
      bestStart = start;
      best = `${m[1]}:${m[2]}–${m[3]}`;
    }
  }
  return best;
}
