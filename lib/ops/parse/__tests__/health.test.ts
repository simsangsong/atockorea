import type { SupabaseClient } from '@supabase/supabase-js'
import { getLearningHealth, EMBEDDING_MODE, ENCRYPTION_MODE } from '../health'

// Builds a supabase stub whose .from().select().eq().maybeSingle() resolves
// to the given { data, error }.
function stubSupabase(result: { data: unknown; error: unknown }): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => result,
  }
  return { from: () => chain } as unknown as SupabaseClient
}

describe('getLearningHealth (§45.9 — Sprint 27.D)', () => {
  it('computes percentages and corpus mix from the health view row', async () => {
    const supabase = stubSupabase({
      data: {
        total_observations: 123,
        embedded_count: 0,
        encrypted_raw_count: 0,
        encrypted_parsed_count: 0,
        haiku_count: 4,
        sonnet_count: 0,
        human_correction_count: 119,
        adapter_count: 0,
        human_verified_count: 119,
        last_observed_at: '2026-05-20T00:00:00Z',
      },
      error: null,
    })

    const h = await getLearningHealth(supabase, 'tenant-1')
    expect(h).not.toBeNull()
    // Prod reality: downgrade policy → 0% embedded, 0% encrypted.
    expect(h!.embeddedPct).toBe(0)
    expect(h!.encryptedPct).toBe(0)
    expect(h!.totalObservations).toBe(123)
    expect(h!.corpus).toEqual({ haiku: 4, sonnet: 0, humanCorrection: 119, adapter: 0 })
    expect(h!.embeddingMode).toBe(EMBEDDING_MODE)
    expect(h!.encryptionMode).toBe(ENCRYPTION_MODE)
  })

  it('rounds non-zero percentages and reports the stricter encrypted count', async () => {
    const supabase = stubSupabase({
      data: {
        total_observations: 8,
        embedded_count: 2, // 25%
        encrypted_raw_count: 3,
        encrypted_parsed_count: 1, // stricter → 1/8 = 13% (rounded)
        haiku_count: 8,
        sonnet_count: 0,
        human_correction_count: 0,
        adapter_count: 0,
        human_verified_count: 0,
        last_observed_at: null,
      },
      error: null,
    })

    const h = await getLearningHealth(supabase, 'tenant-1')
    expect(h!.embeddedPct).toBe(25)
    expect(h!.encryptedCount).toBe(1)
    expect(h!.encryptedPct).toBe(13)
  })

  it('treats an empty tenant (no observations) as 0% without dividing by zero', async () => {
    const supabase = stubSupabase({ data: null, error: null })
    const h = await getLearningHealth(supabase, 'empty-tenant')
    expect(h).not.toBeNull()
    expect(h!.totalObservations).toBe(0)
    expect(h!.embeddedPct).toBe(0)
    expect(h!.encryptedPct).toBe(0)
  })

  it('returns null when the view is absent (migration unapplied) or errors', async () => {
    const supabase = stubSupabase({
      data: null,
      error: { message: 'relation "parse_learning_health" does not exist' },
    })
    expect(await getLearningHealth(supabase, 'tenant-1')).toBeNull()
  })
})
