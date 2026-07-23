// Phase 0-ter — Learning recorder + auto-promotion
// Master plan §7

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { maskLine, type DictEntry } from './mask'
import { embedText, toPgVector } from './embedding'

export interface RecordObservationInput {
  tenantId: string
  rawLine: string
  parsed: ParsedBooking
  resolvedBy: 'haiku' | 'sonnet' | 'human_correction' | 'adapter'
  dict: DictEntry[]
}

/**
 * Persist one LLM/adapter result as a parse_observations row. PII is masked
 * before storage; the masked + templated string are kept for analytics.
 *
 * PRIVACY BOUNDARY (Phase 27 / Sprint 27.D — §45.9): maskLine() is THE privacy
 * boundary — no raw PII is ever stored. The at-rest encryption promise is
 * withdrawn: `raw_line_encrypted` / `parsed_encrypted` stay NULL by policy
 * (the columns are retained nullable/reserved for an optional future opt-in,
 * not wired). Do not re-introduce a "encryption lands later" TODO here.
 *
 * EMBEDDING (§45.9): mining is template-hash-only; embedText() is an opt-in
 * that returns null without VOYAGE_API_KEY (prod default), so `embedding`
 * stays NULL and the hnsw index is unused. Kept callable for cheap re-enable.
 *
 * Best-effort: errors are swallowed so a single failed observation never
 * blocks the user-facing import response.
 */
export async function recordObservation(
  supabase: SupabaseClient,
  input: RecordObservationInput,
): Promise<void> {
  try {
    const { masked, template, templateHash } = maskLine(input.rawLine, input.dict)

    // Opt-in only (§45.9): null without VOYAGE_API_KEY. Always masked, never
    // raw — keeps any future API provider PII-free.
    const emb = await embedText(masked)

    const parsedMasked = {
      sourcePlatform: input.parsed.sourcePlatform,
      partySize: input.parsed.partySize,
      tourDate: input.parsed.tourDate ?? null,
      productName: input.parsed.productName ?? null,
      pickupPointNormalized: input.parsed.pickupPointNormalized ?? null,
      pickupTime: input.parsed.pickupTime ?? null,
      language: input.parsed.language ?? null,
      confidenceScore: input.parsed.confidenceScore,
      issues: input.parsed.issues,
    }

    await supabase.from('ops_parse_observations').insert({
      tenant_id: input.tenantId,
      raw_line_masked: masked,
      raw_line_template: template,
      template_hash: templateHash,
      embedding: emb ? toPgVector(emb.vector) : null,
      resolved_by: input.resolvedBy,
      parsed_masked: parsedMasked,
      llm_confidence: input.parsed.confidenceScore,
    })
  } catch {
    // best-effort
  }
}

export interface PickupQueueProposal {
  tenantId: string
  rawValue: string
  proposedCanonicalId: string
  proposedBy: 'haiku' | 'sonnet' | 'geo_proximity' | 'heuristic'
  confidence: number
}

/**
 * Upsert a proposal into pickup_learning_queue. New rows start at
 * occurrence_count=1; subsequent identical (raw_value, tenant) increment
 * occurrence_count and update last_seen_at. Loop 1 sweeps run separately
 * (auto_promote_pickup_learning RPC).
 */
export async function queuePickupProposal(
  supabase: SupabaseClient,
  p: PickupQueueProposal,
): Promise<void> {
  try {
    // We can't increment via upsert in one statement; use an RPC-less pattern:
    // INSERT … ON CONFLICT UPDATE SET occurrence_count = occurrence_count + 1.
    // postgrest-js doesn't expose ON CONFLICT UPDATE EXPRESSION, so we use rpc
    // or a two-step. Two-step is simpler.
    const normalizedKey = p.rawValue.trim().toLowerCase()
    const { data: existing } = await supabase
      .from('ops_pickup_learning_queue')
      .select('id, occurrence_count, status')
      .eq('tenant_id', p.tenantId)
      .filter('raw_value', 'ilike', escapeIlike(normalizedKey))
      .limit(1)
      .maybeSingle()

    if (existing && existing.status === 'pending') {
      await supabase
        .from('ops_pickup_learning_queue')
        .update({
          occurrence_count: (existing.occurrence_count as number) + 1,
          last_seen_at: new Date().toISOString(),
          // Keep the latest confidence (a high-conf re-sight reinforces).
          confidence: p.confidence,
        })
        .eq('id', existing.id)
      return
    }

    if (existing) {
      // Already approved / rejected / auto_approved — don't re-queue.
      return
    }

    await supabase.from('ops_pickup_learning_queue').insert({
      tenant_id: p.tenantId,
      raw_value: p.rawValue,
      proposed_canonical_id: p.proposedCanonicalId,
      proposed_by: p.proposedBy,
      confidence: p.confidence,
    })
  } catch {
    // best-effort
  }
}

function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&')
}

/**
 * Convenience for callers that already know an LLM extracted a canonical-id
 * proposal alongside the raw text. If the parser also resolves through
 * canonicalizePickup() but originally saw a different raw token, that token
 * is the queue key.
 */
export async function runAutoPromote(
  supabase: SupabaseClient,
  tenantId: string | null,
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('auto_promote_pickup_learning', {
      p_tenant_id: tenantId,
    })
    if (error) return 0
    return typeof data === 'number' ? data : 0
  } catch {
    return 0
  }
}
