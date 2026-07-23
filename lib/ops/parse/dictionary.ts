// Phase 0-bis — Compact pickup dictionary loader for L3/L4 prompts
// Master plan §6.3 — top-N canonicals + aliases formatted for prompt cache.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface DictRow {
  id: string
  canonical: string
  display_ko: string | null
  aliases: string[]
  normalizedSet: Set<string>  // for fast contains-check (alias_normalized form)
}

const MAX_CANONICALS = 100
const MAX_ALIASES_PER = 8

// Phase 27 §45 (speed) — in-process per-tenant dictionary cache. The dict load is
// 2 Supabase round-trips on EVERY import; within a warm server instance the same
// tenant re-imports repeatedly, so a short TTL eliminates the redundant fetch.
// Safe to serve slightly stale: this dict only feeds the LLM PROMPT block + the
// learning-queue dedup check — pickup CORRECTNESS comes from canonicalizeAllPickups,
// which queries the DB directly, never this cache. Worst case of staleness is the
// LLM prompt missing a just-added alias for ≤ TTL (a duplicate queuePickupProposal
// is deduped by its upsert). DictRow is treated read-only downstream, so sharing
// the cached array across imports is safe.
const DICT_TTL_MS = 60_000
const dictCache = new Map<string, { rows: DictRow[]; at: number }>()

/** Drop the cached dict for a tenant (or all tenants). Call after a manual
 *  pickup-dictionary edit if a fresher prompt is wanted before the TTL lapses. */
export function clearDictCache(tenantId?: string): void {
  if (tenantId) dictCache.delete(tenantId)
  else dictCache.clear()
}

/**
 * Load the tenant's active pickup dictionary as a list of canonical entries
 * with all their known aliases. Used by both prompt construction and the
 * learning-loop queue check (to skip raw values already in the dict).
 *
 * Served from a 60s in-process cache unless `opts.fresh` forces a reload.
 */
export async function loadDictForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  opts?: { fresh?: boolean },
): Promise<DictRow[]> {
  if (!opts?.fresh) {
    const hit = dictCache.get(tenantId)
    if (hit && Date.now() - hit.at < DICT_TTL_MS) return hit.rows
  }
  const rows = await loadDictUncached(supabase, tenantId)
  dictCache.set(tenantId, { rows, at: Date.now() })
  return rows
}

async function loadDictUncached(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<DictRow[]> {
  const { data: locs } = await supabase
    .from('ops_pickup_locations')
    .select('id, canonical_name, display_name_ko, address')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('canonical_name', { ascending: true })
    .limit(MAX_CANONICALS)

  if (!locs || locs.length === 0) return []

  const ids = locs.map(l => l.id as string)
  const { data: aliasRows } = await supabase
    .from('ops_pickup_aliases')
    .select('pickup_location_id, alias, alias_normalized')
    .in('pickup_location_id', ids)
    .order('created_at', { ascending: true })

  const aliasByLocId = new Map<string, Array<{ alias: string; normalized: string }>>()
  for (const a of (aliasRows ?? []) as Array<{ pickup_location_id: string; alias: string; alias_normalized: string }>) {
    if (!aliasByLocId.has(a.pickup_location_id)) {
      aliasByLocId.set(a.pickup_location_id, [])
    }
    aliasByLocId.get(a.pickup_location_id)!.push({ alias: a.alias, normalized: a.alias_normalized })
  }

  return locs.map(l => {
    const all = aliasByLocId.get(l.id as string) ?? []
    const normalizedSet = new Set<string>()
    for (const a of all) normalizedSet.add(a.normalized)
    // Also index the canonical name itself in the normalized form.
    normalizedSet.add(normalizeForLookup(l.canonical_name as string))
    return {
      id: l.id as string,
      canonical: l.canonical_name as string,
      display_ko: (l.display_name_ko as string | null) ?? null,
      aliases: all.slice(0, MAX_ALIASES_PER).map(a => a.alias),
      normalizedSet,
    }
  })
}

/**
 * Format the tenant's pickup dictionary as a compact text block for inclusion
 * in the LLM system prompt cache. Top-N canonicals + ≤ N aliases each.
 */
export function formatDictBlock(rows: DictRow[]): string {
  if (rows.length === 0) return 'DICTIONARY: (empty — operator has not registered any canonical pickups yet)'
  const lines = rows.map(r => {
    const aliasStr = r.aliases.length > 0 ? ` | aliases: ${r.aliases.join(', ')}` : ''
    const koStr = r.display_ko ? ` (${r.display_ko})` : ''
    return `- ${r.canonical}${koStr}${aliasStr}`
  })
  return `DICTIONARY (canonical pickups for this tenant; prefer mapping pickupPointRaw to the canonical name on the left):\n${lines.join('\n')}`
}

/**
 * Convenience: load + format in one call (kept for back-compat with funnel callers).
 */
export async function compactDictForPrompt(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<string> {
  const rows = await loadDictForTenant(supabase, tenantId)
  return formatDictBlock(rows)
}

/** Mirrors the SQL `alias_normalized` generated column expression. */
export function normalizeForLookup(raw: string): string {
  return raw.toLowerCase().replace(/[\s\-·,()\.]/g, '')
}
