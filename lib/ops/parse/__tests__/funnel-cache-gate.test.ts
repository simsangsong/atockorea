import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBooking } from '@/lib/ops/parse/types'

jest.mock('../canonicalize-backstop', () => ({ canonicalizeAllPickups: jest.fn(async () => undefined) }))
jest.mock('../cruise-ship-backstop', () => ({ resolveAllCruiseShips: jest.fn(async () => undefined) }))
jest.mock('../cruise-port-call-backstop', () => ({
  inferMissingCruiseDatesFromPortCalls: jest.fn(async () => undefined),
  resolveAllCruisePortCalls: jest.fn(async () => undefined),
}))
jest.mock('../tour-date', () => ({ applyBusTourDateDefaults: jest.fn(() => undefined) }))

import { runFunnel } from '../funnel'

function booking(overrides: Partial<ParsedBooking> = {}): ParsedBooking {
  return {
    sourcePlatform: 'manual',
    externalBookingId: 'CACHE-1',
    leadName: 'John Smith',
    partySize: 1,
    confidenceScore: 0.92,
    issues: [],
    ...overrides,
  }
}

function stubSupabase(cached: ParsedBooking[], failureRows: unknown[]): SupabaseClient {
  return {
    from(table: string) {
      if (table === 'ops_parse_cache') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { parsed: cached, hit_count: 0 }, error: null }),
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
          upsert: async () => ({ error: null }),
        }
      }
      if (table === 'ops_parse_metrics') return { insert: async () => ({ error: null }) }
      if (table === 'ops_parse_failures') {
        return {
          insert: async (rows: unknown[]) => {
            failureRows.push(...rows)
            return { error: null }
          },
        }
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
    },
  } as unknown as SupabaseClient
}

describe('runFunnel L0 cache completeness gate', () => {
  it('review-flags cached rows that still miss source-signaled fields', async () => {
    const failures: unknown[] = []
    const out = await runFunnel({
      tenantId: 'tenant-1',
      raw: 'John Smith\n+1 202 555 0101\njohn@example.com',
      platform: 'manual',
      supabase: stubSupabase([booking()], failures),
      emit: () => undefined,
    })

    expect(out.metrics.layers_used).toContain('l0_full')
    expect(out.bookings[0].issues).toEqual(['incomplete_phone', 'incomplete_email'])
    await Promise.resolve()
    await Promise.resolve()
    expect(JSON.stringify(failures)).toContain('cache_incomplete')
  })
})
