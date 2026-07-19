/**
 * Server-only facility-pins fetch (W2.1).
 *
 * Kept out of lib/tour-room/facilityPins.ts (which the chat client imports) so
 * no Supabase code reaches the browser bundle. The arrival routes call this to
 * ride the current spot's active pins in the message metadata, so the client
 * Tier0 answer can attach a scoped map card with zero network.
 */

import { facilityPinFromRow, type FacilityPin } from '@/lib/tour-room/facilityPins';

/** Minimal client shape — routes pass createServerClient() directly. */
export interface FacilityDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

/** Active restroom/photo pins for a POI, best-effort (never throws). */
export async function fetchArrivalFacilityPins(
  supabase: FacilityDbClient,
  poiKey: string | null | undefined,
): Promise<FacilityPin[]> {
  if (!poiKey) return [];
  try {
    const { data } = await supabase
      .from('poi_facility_pins')
      .select('kind, lat, lng, name, name_i18n, photo_url, distance_m')
      .eq('poi_key', poiKey)
      .eq('is_active', true);
    return Array.isArray(data)
      ? data.map((row) => facilityPinFromRow(row as Record<string, unknown>))
      : [];
  } catch {
    return [];
  }
}
