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
 */
export function isClockTime(time: string | null | undefined): time is string {
  return !!time && /^\s*[~≈]?\s*\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?\s*$/i.test(time);
}
