// Phase 27 §45 Sprint C — cruise LLM schema completion.
//
// The deterministic gate (Sprint A) already flags ship-signal-present-but-empty
// rows and routes them to L3 enrichment, and the cruise-ship-backstop already
// resolves cruiseShipText → cruiseShipId. The missing link this sprint closes is
// that the LLM literally could not EMIT a ship: cruiseShipText was absent from
// the EXTRACT_TOOL schema and from normalize(). These tests pin that gap closed.

const REAL_FETCH = globalThis.fetch
import { EXTRACT_TOOL, SYSTEM_PROMPT, callExtract } from '../llm'

const bookingProps = EXTRACT_TOOL.input_schema.properties.bookings.items
  .properties as Record<string, unknown>
const required = EXTRACT_TOOL.input_schema.properties.bookings.items.required as string[]

describe('EXTRACT_TOOL schema (Sprint C)', () => {
  it('exposes cruiseShipText as a first-class string field', () => {
    expect(bookingProps.cruiseShipText).toEqual({ type: 'string' })
  })

  it('does NOT expose cruiseShipId — IDs stay backstop-only (master plan §45.3)', () => {
    expect('cruiseShipId' in bookingProps).toBe(false)
    expect('cruisePortCallId' in bookingProps).toBe(false)
  })

  it('keeps cruiseShipText optional — ship-less rows omit it (§45.5 defense line #1)', () => {
    expect(required).not.toContain('cruiseShipText')
  })
})

describe('SYSTEM_PROMPT cruise guidance', () => {
  it('tells the model to emit cruiseShipText, never invent, never output an id', () => {
    expect(SYSTEM_PROMPT).toMatch(/cruiseShipText/)
    expect(SYSTEM_PROMPT).toMatch(/NEVER invent a ship/i)
    expect(SYSTEM_PROMPT).toMatch(/database id/i)
  })
})

describe('callExtract maps cruiseShipText from tool_use output', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    ;(globalThis as { fetch?: unknown }).fetch = REAL_FETCH
  })

  function mockFetchReturning(bookings: unknown[]) {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'tool_use', input: { bookings } }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
      text: async () => '',
    }))
    ;(globalThis as { fetch?: unknown }).fetch = fetchMock
    return fetchMock
  }

  function row(extra: Record<string, unknown>) {
    return {
      sourcePlatform: 'manual',
      externalBookingId: 'B1',
      leadName: 'Jane Doe',
      partySize: 2,
      confidenceScore: 0.8,
      issues: [],
      ...extra,
    }
  }

  it('carries a ship name through to the parsed booking', async () => {
    mockFetchReturning([row({ cruiseShipText: 'Costa Serena' })])
    const { bookings } = await callExtract('haiku-4-5', 'block', 'DICT')
    expect(bookings[0].cruiseShipText).toBe('Costa Serena')
  })

  it('trims surrounding whitespace', async () => {
    mockFetchReturning([row({ cruiseShipText: '  Norwegian Spirit  ' })])
    const { bookings } = await callExtract('haiku-4-5', 'block', 'DICT')
    expect(bookings[0].cruiseShipText).toBe('Norwegian Spirit')
  })

  it('collapses placeholder / empty ship values to undefined', async () => {
    for (const placeholder of ['N/A', 'n/a', '-', '미정', '추후', 'TBD', '', '   ', '123']) {
      mockFetchReturning([row({ cruiseShipText: placeholder })])
      const { bookings } = await callExtract('haiku-4-5', 'block', 'DICT')
      expect(bookings[0].cruiseShipText).toBeUndefined()
    }
  })

  it('omits cruiseShipText for a non-cruise row (field simply absent in output)', async () => {
    mockFetchReturning([row({ sourcePlatform: 'klook', leadName: 'Land Tour' })])
    const { bookings } = await callExtract('haiku-4-5', 'block', 'DICT')
    expect(bookings[0].cruiseShipText).toBeUndefined()
  })

  it('never emits cruiseShipId even if the model hallucinates one', async () => {
    // The schema has no cruiseShipId, but a misbehaving model could still put it
    // in the JSON. normalize() must not surface it (ids are backstop-only).
    mockFetchReturning([row({ cruiseShipText: 'Spectrum of the Seas', cruiseShipId: 'ship-999' })])
    const { bookings } = await callExtract('haiku-4-5', 'block', 'DICT')
    expect(bookings[0].cruiseShipText).toBe('Spectrum of the Seas')
    expect(bookings[0].cruiseShipId).toBeUndefined()
  })
})
