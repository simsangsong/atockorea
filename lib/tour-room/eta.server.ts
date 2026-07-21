/**
 * A2 — server-side next-leg estimate (matrix + match_pois lookups).
 *
 * Kept out of eta.ts (client-imported) so no Supabase surface reaches the
 * browser bundle — same split as facilityPins/facilityPins.server. Best-effort:
 * every failure degrades to null and the caller simply omits the ETA line.
 */

import { daypartOf, mergeMeasured, syntheticLeg, type LegEstimate } from '@/lib/tour-room/eta';

/** Minimal client shape — routes pass createServerClient() directly. */
export interface EtaDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface NextLegArgs {
  /** Where the vehicle is NOW (parking pin) — preferred origin. */
  fromCoords?: { lat: number; lng: number } | null;
  /** Current stop's poi_key — origin fallback + the matrix from_key. */
  fromPoiKey?: string | null;
  /** Next stop's poi_key (coords resolved from match_pois). */
  toPoiKey: string;
  /** Departure moment for the daypart band (defaults to now). */
  atIso?: string;
}

async function poiCoords(
  supabase: EtaDbClient,
  poiKey: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const { data } = await supabase
      .from('match_pois')
      .select('lat, lng')
      .eq('poi_key', poiKey)
      .maybeSingle();
    const row = data as { lat?: number | null; lng?: number | null } | null;
    return typeof row?.lat === 'number' && typeof row?.lng === 'number'
      ? { lat: row.lat, lng: row.lng }
      : null;
  } catch {
    return null;
  }
}

/**
 * Ladder: measured matrix minutes (from_key→to_key at the daypart) over the
 * synthetic haversine estimate; distance always synthetic (matrix stores no
 * metres). Null when the destination has no coordinates.
 */
export async function estimateNextLeg(
  supabase: EtaDbClient,
  args: NextLegArgs,
): Promise<LegEstimate | null> {
  try {
    const to = await poiCoords(supabase, args.toPoiKey);
    if (!to) return null;

    const from =
      args.fromCoords ?? (args.fromPoiKey ? await poiCoords(supabase, args.fromPoiKey) : null);
    if (!from) return null;

    const synthetic = syntheticLeg(from, to);

    let measured: number | null = null;
    if (args.fromPoiKey) {
      try {
        const { data } = await supabase
          .from('poi_travel_matrix')
          .select('minutes_p50')
          .eq('from_key', args.fromPoiKey)
          .eq('to_key', args.toPoiKey)
          .eq('daypart', daypartOf(args.atIso ?? new Date()))
          .maybeSingle();
        const row = data as { minutes_p50?: number | string | null } | null;
        measured = row?.minutes_p50 != null ? Number(row.minutes_p50) : null;
      } catch {
        measured = null;
      }
    }

    return mergeMeasured(synthetic, measured);
  } catch {
    return null;
  }
}
