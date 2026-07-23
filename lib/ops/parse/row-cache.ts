// Phase 27 / Sprint 27.G — parse_row_cache (per-block L0 partial cache).
//
// The full-paste L0 cache (`parse_cache`, funnel.ts) only fires when an entire
// paste re-imports byte-identical. Mixed pastes where only some rows changed
// still pay full L3/L4 cost for the unchanged rows. This module wires the
// pre-existing `parse_row_cache` table (`fingerprintRow`, fingerprint.ts:13):
// each ambiguous block bound for the LLM is hashed; a block a prior import
// already resolved via L3/L4 is restored at $0 and removed from the LLM input.
//
// Behavior-neutral: a hit returns the exact ParsedBooking the LLM produced
// last time (same staleness contract as `parse_cache`; entries age out with the
// same eviction policy). Only LLM-resolved blocks are cached — deterministic
// (L1/L2/L2.5) rows are cheap to re-derive every run, so caching them is moot.
//
// Every operation is best-effort: any error (table absent, RLS, network) makes
// lookup treat all blocks as misses and write a no-op, so the funnel always
// degrades to a normal L3/L4 pass.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { fingerprintRow } from './fingerprint'

export interface RowCacheLookup {
  /** Bookings restored from cache (flattened across all hit blocks). */
  hits: ParsedBooking[]
  /** Blocks with no cache entry — proceed to L3/L4. */
  misses: string[]
  /** Number of blocks that hit (for metrics; ≠ hits.length if a block had >1). */
  hitCount: number
}

/**
 * Look up each block's row hash in `parse_row_cache`. Hits are restored and
 * removed from the returned `misses`; misses pass through unchanged.
 */
export async function lookupRowCache(
  supabase: SupabaseClient,
  tenantId: string,
  blocks: string[],
): Promise<RowCacheLookup> {
  if (blocks.length === 0) return { hits: [], misses: [], hitCount: 0 }
  try {
    // hash each block once; dedupe for the IN query (identical blocks share a hash)
    const hashByBlock = new Map<string, string>()
    for (const b of blocks) if (!hashByBlock.has(b)) hashByBlock.set(b, fingerprintRow(tenantId, b))
    const uniqueHashes = Array.from(new Set(hashByBlock.values()))

    const { data, error } = await supabase
      .from('ops_parse_row_cache')
      .select('row_hash, parsed')
      .eq('tenant_id', tenantId)
      .in('row_hash', uniqueHashes)

    if (error || !data) return { hits: [], misses: blocks, hitCount: 0 }

    const parsedByHash = new Map<string, ParsedBooking[]>()
    for (const row of data as Array<{ row_hash: string; parsed: unknown }>) {
      parsedByHash.set(row.row_hash, normalizeParsed(row.parsed))
    }

    const hits: ParsedBooking[] = []
    const misses: string[] = []
    let hitCount = 0
    for (const block of blocks) {
      const cached = parsedByHash.get(hashByBlock.get(block)!)
      if (cached && cached.length > 0) {
        hits.push(...cached)
        hitCount++
      } else {
        misses.push(block)
      }
    }
    return { hits, misses, hitCount }
  } catch {
    return { hits: [], misses: blocks, hitCount: 0 }
  }
}

export interface RowCacheEntry {
  block: string
  bookings: ParsedBooking[]
}

/**
 * Persist LLM-resolved blocks for next time. Upserts `row_hash → parsed[]`.
 * Best-effort; empty/booking-less entries are skipped.
 */
export async function writeRowCache(
  supabase: SupabaseClient,
  tenantId: string,
  entries: RowCacheEntry[],
  modelUsed: string | null,
): Promise<void> {
  const rows = entries
    .filter(e => e.block && e.bookings.length > 0)
    .map(e => ({
      row_hash: fingerprintRow(tenantId, e.block),
      tenant_id: tenantId,
      parsed: e.bookings as unknown as object[],
      model_used: modelUsed,
    }))
  if (rows.length === 0) return
  try {
    await supabase.from('ops_parse_row_cache').upsert(rows, { onConflict: 'row_hash' })
  } catch {
    // best-effort
  }
}

/** Coerce the stored jsonb into a ParsedBooking array (one block may hold >1). */
function normalizeParsed(parsed: unknown): ParsedBooking[] {
  if (Array.isArray(parsed)) return parsed as ParsedBooking[]
  if (parsed && typeof parsed === 'object') return [parsed as ParsedBooking]
  return []
}
