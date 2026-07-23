import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { lookupRowCache, writeRowCache } from '../row-cache'
import { fingerprintRow } from '../fingerprint'

const TENANT = '71a4560e-29f6-4b25-9722-8b8f284f6e1d'

function booking(name: string): ParsedBooking {
  return {
    sourcePlatform: 'klook',
    leadName: name,
    partySize: 2,
    confidenceScore: 0.9,
    issues: [],
  } as unknown as ParsedBooking
}

// supabase stub whose select().eq().in() resolves to { data, error }, and whose
// upsert() records the rows it received.
function stub(opts: {
  selectResult?: { data: unknown; error: unknown }
  onUpsert?: (rows: unknown) => void
}): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: async () => opts.selectResult ?? { data: [], error: null },
        }),
      }),
      upsert: async (rows: unknown) => {
        opts.onUpsert?.(rows)
        return { error: null }
      },
    }),
  } as unknown as SupabaseClient
}

describe('lookupRowCache (§45 / Sprint 27.G)', () => {
  it('no-ops on empty input without a DB call', async () => {
    let called = false
    const supabase = { from: () => { called = true; return {} } } as unknown as SupabaseClient
    const r = await lookupRowCache(supabase, TENANT, [])
    expect(r).toEqual({ hits: [], misses: [], hitCount: 0 })
    expect(called).toBe(false)
  })

  it('restores cached blocks as hits and passes misses through', async () => {
    const cachedBlock = 'klook / Alex Rivera / 2'
    const missBlock = 'gyg / Jordan Bennett / 3'
    const supabase = stub({
      selectResult: {
        data: [{ row_hash: fingerprintRow(TENANT, cachedBlock), parsed: [booking('Alex Rivera')] }],
        error: null,
      },
    })
    const r = await lookupRowCache(supabase, TENANT, [cachedBlock, missBlock])
    expect(r.hitCount).toBe(1)
    expect(r.hits.map(b => b.leadName)).toEqual(['Alex Rivera'])
    expect(r.misses).toEqual([missBlock])
  })

  it('accepts a single object (not array) in parsed jsonb', async () => {
    const blk = 'klook / Solo / 1'
    const supabase = stub({
      selectResult: { data: [{ row_hash: fingerprintRow(TENANT, blk), parsed: booking('Solo') }], error: null },
    })
    const r = await lookupRowCache(supabase, TENANT, [blk])
    expect(r.hitCount).toBe(1)
    expect(r.hits).toHaveLength(1)
  })

  it('treats a DB error as all-misses (funnel degrades to a normal L3 pass)', async () => {
    const blk = 'klook / X / 1'
    const supabase = stub({ selectResult: { data: null, error: { message: 'relation absent' } } })
    const r = await lookupRowCache(supabase, TENANT, [blk])
    expect(r).toEqual({ hits: [], misses: [blk], hitCount: 0 })
  })
})

describe('writeRowCache (§45 / Sprint 27.G)', () => {
  it('upserts row_hash → parsed for blocks with bookings', async () => {
    let received: Array<Record<string, unknown>> = []
    const supabase = stub({ onUpsert: rows => { received = rows as Array<Record<string, unknown>> } })
    const blk = 'klook / Alex / 2'
    await writeRowCache(supabase, TENANT, [{ block: blk, bookings: [booking('Alex')] }], 'haiku-4-5')
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({
      row_hash: fingerprintRow(TENANT, blk),
      tenant_id: TENANT,
      model_used: 'haiku-4-5',
    })
  })

  it('skips entries with no bookings or empty block (no DB call)', async () => {
    let called = false
    const supabase = stub({ onUpsert: () => { called = true } })
    await writeRowCache(supabase, TENANT, [{ block: '', bookings: [booking('X')] }, { block: 'b', bookings: [] }], null)
    expect(called).toBe(false)
  })
})
