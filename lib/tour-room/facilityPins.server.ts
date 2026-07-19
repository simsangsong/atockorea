/**
 * Server-only facility-pins fetch (W2.1).
 *
 * Kept out of lib/tour-room/facilityPins.ts (which the chat client imports) so
 * no Supabase code reaches the browser bundle. The arrival routes call this to
 * ride the current spot's active pins in the message metadata, so the client
 * Tier0 answer can attach a scoped map card with zero network.
 *
 * Verification gate (F-D, §H — "검수분만 노출"): only pins a human has reviewed
 * (`is_verified=true`) reach a guest. Auto-collected pins (Kakao restrooms,
 * Google restaurants) land as `is_verified=false` and stay invisible until the
 * admin approves them in the /admin/facility-pins review queue. This keeps the
 * customer card trustworthy; the tour-mode flag is OFF, so no live regression.
 */

import { facilityPinFromRow, type FacilityPin } from '@/lib/tour-room/facilityPins';

/** Minimal client shape — routes pass createServerClient() directly. */
export interface FacilityDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

/** Active, human-verified restroom/photo/restaurant pins for a POI, best-effort (never throws). */
export async function fetchArrivalFacilityPins(
  supabase: FacilityDbClient,
  poiKey: string | null | undefined,
): Promise<FacilityPin[]> {
  if (!poiKey) return [];
  try {
    const { data } = await supabase
      .from('poi_facility_pins')
      .select('kind, lat, lng, name, name_i18n, photo_url, distance_m, rating, review_count, sort_order')
      .eq('poi_key', poiKey)
      .eq('is_active', true)
      .eq('is_verified', true)
      .order('sort_order', { ascending: true });
    return Array.isArray(data)
      ? data.map((row) => facilityPinFromRow(row as Record<string, unknown>))
      : [];
  } catch {
    return [];
  }
}
