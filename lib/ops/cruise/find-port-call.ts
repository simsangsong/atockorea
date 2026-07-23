// Cruise port-call lookup — (shipId, tourDate) → scheduled voyage row.
//
// Companion to resolve-ship-id.ts. Where that resolves a fuzzy ship name to
// the fleet master, this attaches a booking to a specific voyage so we can
// surface arrival_at / terminal_info / port assignment in admin UI and
// alert detectors.
//
// Tiebreak: when multiple port_calls match same ship same day (rare —
// short-hop routes like Busan AM + Jeju PM), we return the earliest by
// arrival_at AND set `multiple: true` so callers can flag for review.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface PortCallMatch {
  port_call_id: string
  port_canonical_id: string
  arrival_at: string
  departure_at: string | null
  terminal_info: string | null
  /** true when more than one port_call matched (ambiguous — needs operator review) */
  multiple: boolean
}

/**
 * Find the scheduled cruise_port_call for a given ship on a given KST date.
 * Returns null when no row matches; sets `multiple: true` when ambiguous.
 */
export async function findPortCallByShipDate(
  supabase: SupabaseClient,
  shipId: string,
  tourDate: string,  // 'YYYY-MM-DD' (KST date)
): Promise<PortCallMatch | null> {
  if (!shipId || !tourDate) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tourDate)) return null

  const startKst = `${tourDate}T00:00:00+09:00`
  const endKst = `${tourDate}T23:59:59+09:00`

  const { data: calls } = await supabase
    .from('ops_cruise_port_calls')
    .select('id, port_canonical_id, arrival_at, departure_at, terminal_info')
    .eq('cruise_ship_id', shipId)
    .gte('arrival_at', startKst)
    .lte('arrival_at', endKst)
    .order('arrival_at', { ascending: true })

  if (!calls || calls.length === 0) return null

  const picked = calls[0]
  return {
    port_call_id: picked.id as string,
    port_canonical_id: picked.port_canonical_id as string,
    arrival_at: picked.arrival_at as string,
    departure_at: picked.departure_at as string | null,
    terminal_info: picked.terminal_info as string | null,
    multiple: calls.length > 1,
  }
}
