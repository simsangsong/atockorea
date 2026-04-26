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
};

export type PickupDropoffSection = {
  pickupType?: string;
  dropoffType?: string;
  departure: PickupDropoffPoint[];
  return: PickupDropoffPoint[];
  notes?: string[];
};
