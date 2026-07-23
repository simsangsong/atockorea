// Phase 27 §45 Sprint 27.B-lite — failure intelligence unit tests.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { buildFinalLeftoverFailures, buildPartialFailureRecords, recordParseFailures } from '../failures'
import { buildInputContext, splitBlocks } from '../normalize'

function booking(leadName: string): ParsedBooking {
  return {
    sourcePlatform: 'manual',
    externalBookingId: 'X',
    leadName,
    partySize: 1,
    confidenceScore: 0.7,
    issues: [],
  }
}

describe('buildFinalLeftoverFailures', () => {
  // Three blocks: A is attributed to an LLM booking; B is unparsed WITH signals;
  // C is unparsed with NO signals (genuinely-absent header).
  const blockA = 'John Smith\njohn@example.com\n+1 202 555 0101'
  const blockB = 'Jane Doe\njane@example.com\n+886 912 345 678'
  const blockC = '5월 10일 제주 일반투어 안내'
  const ctx = buildInputContext([blockA, blockB, blockC].join('\n\n'))
  const leftoverBlocks = splitBlocks(ctx.normalized)

  it('logs only blocks no LLM booking was attributed to', () => {
    const records = buildFinalLeftoverFailures({
      leftoverBlocks,
      llmBookings: [booking('John Smith')], // attributes block A only
      ctx,
    })
    expect(records.length).toBe(2) // B and C
    expect(records.every(r => r.layer === 'final_leftover')).toBe(true)
    expect(records.every(r => r.failedField === null && r.reason === 'unparsed_block')).toBe(true)
    expect(records.every(r => r.shape === ctx.shape)).toBe(true)
  })

  it('masks PII in the stored excerpt (no raw email / phone)', () => {
    const records = buildFinalLeftoverFailures({ leftoverBlocks, llmBookings: [booking('John Smith')], ctx })
    const masked = records.map(r => r.rawLineMasked).join('\n')
    expect(masked).not.toContain('@')
    expect(masked).not.toContain('886')
    expect(masked).toContain('{{EMAIL}}')
    expect(masked).toContain('{{PHONE}}')
  })

  it('sets source_signal_present from the 27.0 signals (read, not recomputed)', () => {
    const records = buildFinalLeftoverFailures({ leftoverBlocks, llmBookings: [booking('John Smith')], ctx })
    const withEmailPhone = records.find(r => r.rawLineMasked.includes('Jane Doe'))
    const headerOnly = records.find(r => r.rawLineMasked.includes('일반투어'))
    expect(withEmailPhone?.sourceSignalPresent).toBe(true) // email + phone present
    expect(headerOnly?.sourceSignalPresent).toBe(false) // genuinely absent → not for L3
  })

  it('returns [] when every block is attributed', () => {
    const records = buildFinalLeftoverFailures({
      leftoverBlocks,
      llmBookings: [booking('John Smith'), booking('Jane Doe'), booking('일반투어 안내')],
      ctx,
    })
    expect(records).toEqual([])
  })

  it('returns [] for empty leftover', () => {
    expect(buildFinalLeftoverFailures({ leftoverBlocks: [], llmBookings: [], ctx })).toEqual([])
  })
})

describe('buildPartialFailureRecords (Sprint 27.A)', () => {
  it('emits one masked record per still-missing field, signal-present', () => {
    const records = buildPartialFailureRecords({
      partials: [
        { block: 'Jane Doe\njane@example.com', fields: ['phone', 'ship'], reason: 'enrichment_incomplete' },
        { block: 'Bob\n+1 202 555 0101', fields: ['email'], reason: 'over_enrichment_cap' },
      ],
      shape: 'mixed',
    })
    expect(records.length).toBe(3) // 2 + 1
    expect(records.every(r => r.layer === 'partial' && r.sourceSignalPresent === true)).toBe(true)
    expect(records.map(r => r.failedField).sort()).toEqual(['email', 'phone', 'ship'])
    // masked excerpt is PII-free
    expect(records.find(r => r.failedField === 'email')?.rawLineMasked).not.toContain('555')
  })

  it('skips partials with no remaining missing fields', () => {
    const records = buildPartialFailureRecords({
      partials: [{ block: 'x', fields: [], reason: 'enrichment_incomplete' }],
      shape: 'mixed',
    })
    expect(records).toEqual([])
  })
})

describe('recordParseFailures', () => {
  it('maps records to parse_failures rows', async () => {
    const calls: Array<{ table: string; rows: unknown }> = []
    const supabase = {
      from: (table: string) => ({
        insert: async (rows: unknown) => {
          calls.push({ table, rows })
          return { error: null }
        },
      }),
    } as unknown as SupabaseClient

    await recordParseFailures(supabase, 'tenant-1', [
      {
        rawLineMasked: 'Jane Doe\n{{EMAIL}}',
        shape: 'mixed',
        layer: 'final_leftover',
        failedField: null,
        reason: 'unparsed_block',
        ruleId: null,
        sourcePlatform: null,
        sourceSignalPresent: true,
      },
    ])

    expect(calls.length).toBe(1)
    expect(calls[0].table).toBe('ops_parse_failures')
    const rows = calls[0].rows as Array<Record<string, unknown>>
    expect(rows[0]).toMatchObject({
      tenant_id: 'tenant-1',
      raw_line_masked: 'Jane Doe\n{{EMAIL}}',
      shape: 'mixed',
      layer: 'final_leftover',
      source_signal_present: true,
    })
  })

  it('is best-effort — a throwing client does not propagate', async () => {
    const supabase = {
      from: () => ({
        insert: async () => {
          throw new Error('table absent')
        },
      }),
    } as unknown as SupabaseClient
    await expect(
      recordParseFailures(supabase, 'tenant-1', [
        {
          rawLineMasked: 'x',
          shape: 'mixed',
          layer: 'final_leftover',
          failedField: null,
          reason: 'unparsed_block',
          ruleId: null,
          sourcePlatform: null,
          sourceSignalPresent: false,
        },
      ]),
    ).resolves.toBeUndefined()
  })

  it('no-ops on empty records (no DB call)', async () => {
    let called = false
    const supabase = {
      from: () => {
        called = true
        return { insert: async () => ({ error: null }) }
      },
    } as unknown as SupabaseClient
    await recordParseFailures(supabase, 'tenant-1', [])
    expect(called).toBe(false)
  })
})
