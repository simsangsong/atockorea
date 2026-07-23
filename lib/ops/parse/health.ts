// Phase 27 / Sprint 27.D — Learning-loop health (§45.9)
// Surfaces the wire-or-downgrade outcome: embedding (template-only) and
// encryption (withdrawn) are both DOWNGRADED, so `embeddedPct`/`encryptedPct`
// are expected to read ~0 by design — the metric exists to make that policy
// visible and to detect drift (e.g. an unexpected provider re-enable).

import type { SupabaseClient } from '@supabase/supabase-js'

/** Static policy state pinned by Sprint 27.D (§45.9). */
export const EMBEDDING_MODE = 'template-only' as const
export const ENCRYPTION_MODE = 'withdrawn' as const

export interface LearningHealth {
  totalObservations: number
  embeddedCount: number
  embeddedPct: number // 0–100, rounded
  encryptedCount: number
  encryptedPct: number // 0–100, rounded
  corpus: {
    haiku: number
    sonnet: number
    humanCorrection: number
    adapter: number
  }
  humanVerifiedCount: number
  lastObservedAt: string | null
  /** Pinned downgrade policy — see §45.9. */
  embeddingMode: typeof EMBEDDING_MODE
  encryptionMode: typeof ENCRYPTION_MODE
}

interface HealthRow {
  total_observations: number | null
  embedded_count: number | null
  encrypted_raw_count: number | null
  encrypted_parsed_count: number | null
  haiku_count: number | null
  sonnet_count: number | null
  human_correction_count: number | null
  adapter_count: number | null
  human_verified_count: number | null
  last_observed_at: string | null
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 100)
}

/**
 * Read per-tenant learning-loop health from the `parse_learning_health` view.
 * Returns null if the view is absent (migration unapplied) or on any error —
 * the admin surface treats null as "health unavailable" rather than failing.
 */
export async function getLearningHealth(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<LearningHealth | null> {
  try {
    const { data, error } = await supabase
      .from('ops_parse_learning_health')
      .select(
        'total_observations, embedded_count, encrypted_raw_count, encrypted_parsed_count, haiku_count, sonnet_count, human_correction_count, adapter_count, human_verified_count, last_observed_at',
      )
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) return null

    const row = (data ?? {}) as Partial<HealthRow>
    const total = row.total_observations ?? 0
    const embedded = row.embedded_count ?? 0
    // A row is "encrypted" only if both halves are present; report the stricter
    // of the two counts so a partial wiring never reads as fully encrypted.
    const encrypted = Math.min(
      row.encrypted_raw_count ?? 0,
      row.encrypted_parsed_count ?? 0,
    )

    return {
      totalObservations: total,
      embeddedCount: embedded,
      embeddedPct: pct(embedded, total),
      encryptedCount: encrypted,
      encryptedPct: pct(encrypted, total),
      corpus: {
        haiku: row.haiku_count ?? 0,
        sonnet: row.sonnet_count ?? 0,
        humanCorrection: row.human_correction_count ?? 0,
        adapter: row.adapter_count ?? 0,
      },
      humanVerifiedCount: row.human_verified_count ?? 0,
      lastObservedAt: row.last_observed_at ?? null,
      embeddingMode: EMBEDDING_MODE,
      encryptionMode: ENCRYPTION_MODE,
    }
  } catch {
    return null
  }
}
