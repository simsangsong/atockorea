// Phase 27 §45 (speed) — in-process per-tenant dictionary cache.
//
// loadDictForTenant is 2 Supabase round-trips on every import; a warm server
// instance re-imports the same tenant repeatedly. A 60s TTL cache eliminates the
// redundant fetch. These tests pin: cache hit within TTL, { fresh } bypass,
// clearDictCache invalidation, and per-tenant isolation.

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadDictForTenant, clearDictCache } from '../dictionary'

function makeSupabase(locs: unknown[], aliases: unknown[]) {
  let fromCalls = 0
  function chainFor(data: unknown[]) {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (resolve: (v: { data: unknown[] }) => void) => resolve({ data }),
    }
    return chain
  }
  const sb = {
    from(table: string) {
      fromCalls++
      return chainFor(table === 'ops_pickup_locations' ? locs : aliases)
    },
    get fromCalls() {
      return fromCalls
    },
  }
  return sb as typeof sb & SupabaseClient
}

const LOCS = [{ id: 'l1', canonical_name: 'Lotte City Hotel', display_name_ko: null, address: null }]

describe('loadDictForTenant cache', () => {
  beforeEach(() => clearDictCache())

  it('serves a second load within TTL from cache (no extra queries)', async () => {
    const sb = makeSupabase(LOCS, [])
    await loadDictForTenant(sb, 'T1')
    await loadDictForTenant(sb, 'T1')
    expect(sb.fromCalls).toBe(2) // only the first load queried (locations + aliases)
  })

  it('{ fresh: true } bypasses the cache', async () => {
    const sb = makeSupabase(LOCS, [])
    await loadDictForTenant(sb, 'T1')
    await loadDictForTenant(sb, 'T1', { fresh: true })
    expect(sb.fromCalls).toBe(4)
  })

  it('clearDictCache(tenant) forces a reload', async () => {
    const sb = makeSupabase(LOCS, [])
    await loadDictForTenant(sb, 'T1')
    clearDictCache('T1')
    await loadDictForTenant(sb, 'T1')
    expect(sb.fromCalls).toBe(4)
  })

  it('caches tenants independently', async () => {
    const sb = makeSupabase(LOCS, [])
    await loadDictForTenant(sb, 'T1')
    await loadDictForTenant(sb, 'T2')
    expect(sb.fromCalls).toBe(4)
  })

  it('returns the canonical rows correctly through the cache', async () => {
    const sb = makeSupabase(LOCS, [])
    const a = await loadDictForTenant(sb, 'T1')
    const b = await loadDictForTenant(sb, 'T1')
    expect(a).toBe(b) // same cached reference
    expect(a[0].canonical).toBe('Lotte City Hotel')
  })
})
