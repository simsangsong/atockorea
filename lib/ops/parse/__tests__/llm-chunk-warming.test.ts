// Phase 27 §45 — prompt-cache warming in callExtractChunked.
//
// Multi-chunk imports warm the shared system+dictionary cache with the first
// chunk, then fire the rest in parallel (so they hit cache_read, not a second
// cache_creation). These tests pin the behaviour that must NOT regress: every
// chunk still runs, results + usage merge, partial-failure isolation holds, and
// the first chunk genuinely precedes the rest.

const REAL_FETCH = globalThis.fetch
import { callExtractChunked, LLM_CHUNK_SIZE } from '../llm'

function blocks(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `Lead${i}  +82 10-0000-00${i.toString().padStart(2, '0')}`)
}

function okResponse(bookings: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'tool_use', input: { bookings } }],
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    }),
    text: async () => '',
  }
}

function row(id: string) {
  return { sourcePlatform: 'manual', externalBookingId: id, leadName: id, partySize: 1, confidenceScore: 0.8, issues: [] }
}

describe('callExtractChunked cache warming', () => {
  beforeEach(() => process.env.ANTHROPIC_API_KEY = 'test-key')
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    ;(globalThis as { fetch?: unknown }).fetch = REAL_FETCH
  })

  it('issues one request for a single chunk (≤ LLM_CHUNK_SIZE blocks)', async () => {
    const fetchMock = jest.fn(async () => okResponse([row('B1')]))
    ;(globalThis as { fetch?: unknown }).fetch = fetchMock
    const out = await callExtractChunked('haiku-4-5', blocks(LLM_CHUNK_SIZE), 'DICT')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(out.bookings).toHaveLength(1)
  })

  it('issues one request per chunk and merges all bookings + usage', async () => {
    let call = 0
    const fetchMock = jest.fn(async () => okResponse([row(`B${++call}`)]))
    ;(globalThis as { fetch?: unknown }).fetch = fetchMock
    // 2× chunk size + 1 → three chunks.
    const out = await callExtractChunked('haiku-4-5', blocks(LLM_CHUNK_SIZE * 2 + 1), 'DICT')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(out.bookings).toHaveLength(3)
    expect(out.usage.input_tokens).toBe(30)
    expect(out.usage.output_tokens).toBe(15)
  })

  it('runs the first chunk BEFORE the rest (warming order)', async () => {
    const order: string[] = []
    let call = 0
    const fetchMock = jest.fn(async () => {
      const n = ++call
      order.push(`start${n}`)
      await new Promise(r => setTimeout(r, 0))
      order.push(`end${n}`)
      return okResponse([row(`B${n}`)])
    })
    ;(globalThis as { fetch?: unknown }).fetch = fetchMock
    await callExtractChunked('haiku-4-5', blocks(LLM_CHUNK_SIZE * 2), 'DICT')
    // First chunk must fully resolve before chunk 2 starts (cache warm).
    expect(order.indexOf('end1')).toBeLessThan(order.indexOf('start2'))
  })

  it('keeps succeeding chunks when one chunk fails (partial-failure isolation)', async () => {
    let call = 0
    const fetchMock = jest.fn(async () => {
      call++
      if (call === 2) throw new Error('429 transient')
      return okResponse([row(`B${call}`)])
    })
    ;(globalThis as { fetch?: unknown }).fetch = fetchMock
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const out = await callExtractChunked('haiku-4-5', blocks(LLM_CHUNK_SIZE * 2 + 1), 'DICT')
    // Chunks 1 and 3 survive; chunk 2 dropped.
    expect(out.bookings).toHaveLength(2)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('throws only when every chunk fails', async () => {
    const fetchMock = jest.fn(async () => {
      throw new Error('all down')
    })
    ;(globalThis as { fetch?: unknown }).fetch = fetchMock
    await expect(callExtractChunked('haiku-4-5', blocks(LLM_CHUNK_SIZE * 2), 'DICT')).rejects.toThrow()
  })
})
