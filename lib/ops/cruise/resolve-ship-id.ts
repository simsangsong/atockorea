// Cruise ship resolution — free-text ship name → cruise_ships.id
//
// Layered lookup (same logic that the L1 step of match-port-call.ts uses,
// extracted here so the parse backstop can resolve ships without committing
// to a port-call match yet):
//
//   1. exact canonical_name (case-insensitive) — confidence 1.0
//   2. exact alias_normalized hit (alias table)  — confidence 0.95
//   3. partial-substring on alias_normalized     — confidence 0.75
//
// The tenant filter accepts the tenant's rows AND globally-scoped (tenant=null)
// rows. cruise_ship_aliases is global (no tenant_id column) so step 2 always
// runs against the shared alias table.

import type { SupabaseClient } from '@supabase/supabase-js'

export type ShipMatchMethod = 'exact_canonical' | 'alias_normalized' | 'partial_substring'

export interface ResolvedShip {
  id: string
  canonical_name: string
  method: ShipMatchMethod
  confidence: number
}

/**
 * Normalize a ship name for alias lookup. Mirrors the index expression on
 * cruise_ship_aliases.alias_normalized — keep these in sync.
 */
export function normalizeShipName(s: string): string {
  return s.toLowerCase().replace(/[\s\-·,()\.]/g, '')
}

const GLOBAL_TENANT_SENTINEL = '00000000-0000-0000-0000-000000000000'

export async function resolveCruiseShipId(
  supabase: SupabaseClient,
  shipText: string,
  tenantId: string,
): Promise<ResolvedShip | null> {
  if (!shipText) return null
  const trimmed = shipText.trim()
  if (!trimmed) return null
  const norm = normalizeShipName(trimmed)
  if (!norm) return null

  // 1) Exact canonical_name (case-insensitive) — accept tenant's row OR global.
  {
    const tenant = tenantId || GLOBAL_TENANT_SENTINEL
    const { data } = await supabase
      .from('ops_cruise_ships')
      .select('id, canonical_name')
      .or(`tenant_id.eq.${tenant},tenant_id.is.null`)
      .ilike('canonical_name', trimmed)
      .limit(1)
      .maybeSingle()
    if (data) {
      return {
        id: data.id as string,
        canonical_name: data.canonical_name as string,
        method: 'exact_canonical',
        confidence: 1.0,
      }
    }
  }

  // 2) Alias normalized exact match.
  {
    const { data } = await supabase
      .from('ops_cruise_ship_aliases')
      .select('cruise_ship_id, ops_cruise_ships(canonical_name)')
      .eq('alias_normalized', norm)
      .limit(1)
      .maybeSingle()
    if (data) {
      const ship = (data as { cruise_ship_id: string; cruise_ships?: { canonical_name: string } | { canonical_name: string }[] })
      const shipRow = Array.isArray(ship.cruise_ships) ? ship.cruise_ships[0] : ship.cruise_ships
      return {
        id: ship.cruise_ship_id,
        canonical_name: shipRow?.canonical_name ?? trimmed,
        method: 'alias_normalized',
        confidence: 0.95,
      }
    }
  }

  // 3) Partial-substring fallback. The alias table is small (≈ ships × ~3
  //    variants) so scanning up to 2000 rows is cheap. Require at least 6
  //    char overlap to avoid catching generic words like "Spirit" or "Sun".
  {
    const { data: all } = await supabase
      .from('ops_cruise_ship_aliases')
      .select('cruise_ship_id, alias_normalized, ops_cruise_ships(canonical_name)')
      .limit(2000)
    if (all) {
      for (const a of all as Array<{
        cruise_ship_id: string
        alias_normalized: string
        cruise_ships?: { canonical_name: string } | { canonical_name: string }[]
      }>) {
        const an = a.alias_normalized
        if (an.length >= 6 && (norm.includes(an) || an.includes(norm))) {
          const shipRow = Array.isArray(a.cruise_ships) ? a.cruise_ships[0] : a.cruise_ships
          return {
            id: a.cruise_ship_id,
            canonical_name: shipRow?.canonical_name ?? trimmed,
            method: 'partial_substring',
            confidence: 0.75,
          }
        }
      }
    }
  }

  return null
}
