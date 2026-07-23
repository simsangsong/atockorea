// Parser Autopilot — dedup marker (recordAutopilotMarker) contract.
// Guards the novelty-dedup fix: a novel fingerprint must leave a marker so it
// never re-dispatches, and must NOT double-insert when a template already exists.


// Capture inserts + drive the existing-recheck result per test.
let existing: { id: string } | null = null
const inserts: Record<string, unknown>[] = []

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          or: () => ({
            maybeSingle: () => Promise.resolve({ data: existing, error: null }),
          }),
        }),
      }),
      insert: (row: Record<string, unknown>) => {
        inserts.push(row)
        return Promise.resolve({ data: null, error: null })
      },
    }),
  }),
}))

import { recordAutopilotMarker } from '../format-templates'

const fp = {
  fingerprint: 'fp-abc123',
  kind: 'mixed' as const,
  headerColumns: undefined,
  shapeSignature: undefined,
}

beforeEach(() => {
  existing = null
  inserts.length = 0
})

describe('recordAutopilotMarker', () => {
  it('inserts a draft marker for a brand-new fingerprint', async () => {
    existing = null
    await recordAutopilotMarker({ tenantId: 't1', fingerprint: fp })
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({
      tenant_id: 't1',
      fingerprint: 'fp-abc123',
      status: 'draft', // never matched by lookupActiveTemplate → parse unchanged
      name: 'autopilot:novel-failure',
      column_mapping: null,
    })
  })

  it('is a no-op when any template already exists (no re-dispatch, no dup)', async () => {
    existing = { id: 'tmpl-1' }
    await recordAutopilotMarker({ tenantId: 't1', fingerprint: fp })
    expect(inserts).toHaveLength(0)
  })
})
