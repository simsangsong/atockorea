// Phase 0-bis — L3/L4 LLM caller with prompt caching + tool-use output
// Master plan §6.3 — system prompt + dictionary cached via cache_control: ephemeral.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { ParsedBooking, OTASource } from '@/lib/ops/parse/types'
import type { Model, UsageTokens } from './pricing'

// Read system prompt once at module load. Avoids per-request disk I/O.
// Exported as the canonical SYSTEM_PROMPT: the fixture harness
// (scripts/test-import.mjs) and tests read it from here so they never diverge
// from prod. (The legacy "single source = route.ts" claim is stale — route.ts
// now just calls runFunnel; the prompt lives in prompts/system.txt and the
// tool schema lives below.)
export const SYSTEM_PROMPT = readFileSync(
  path.join(process.cwd(), 'lib', 'ops', 'parse', 'prompts', 'system.txt'),
  'utf-8',
)

export const EXTRACT_TOOL = {
  name: 'extract_bookings',
  description: 'Extract structured tour booking records from raw OTA text.',
  input_schema: {
    type: 'object' as const,
    properties: {
      bookings: {
        type: 'array',
        description: 'List of extracted bookings, in the order they appear.',
        items: {
          type: 'object',
          properties: {
            sourcePlatform: { type: 'string', enum: ['klook', 'gyg', 'viator', 'kkday', 'tripcom', 'csv', 'manual'] },
            externalBookingId: { type: 'string' },
            leadName: { type: 'string' },
            partySize: { type: 'integer', minimum: 0 },
            tourDate: { type: 'string' },
            productName: { type: 'string' },
            pickupPointRaw: { type: 'string' },
            pickupPointNormalized: { type: 'string' },
            pickupTime: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            whatsapp: { type: 'string' },
            language: { type: 'string' },
            notes: { type: 'string' },
            // Phase 27 §45 Sprint C — cruise ship name as it appears in the
            // source (e.g. "Celebrity Millennium", "Costa Serena"). The LLM
            // emits the TEXT only; resolution to cruise_ships.id is the
            // backstop's job (cruise-ship-backstop.ts), so cruiseShipId is
            // deliberately NOT in this schema (IDs stay backstop-only). Optional
            // and unrequired: a non-cruise booking has no ship signal and must
            // omit it (anti-hallucination rule #1), so genuinely ship-less rows
            // stay empty and are never flagged by the completeness gate (§45.5
            // defense line #1).
            cruiseShipText: { type: 'string' },
            confidenceScore: { type: 'number', minimum: 0, maximum: 1 },
            issues: { type: 'array', items: { type: 'string' } },
          },
          required: ['sourcePlatform', 'externalBookingId', 'leadName', 'partySize', 'confidenceScore', 'issues'],
        },
      },
    },
    required: ['bookings'],
  },
}

export interface LLMCallResult {
  bookings: ParsedBooking[]
  usage: UsageTokens
  model: Model
}

const MODEL_IDS: Record<Model, string> = {
  'haiku-4-5': 'claude-haiku-4-5-20251001',
  'sonnet-4-6': 'claude-sonnet-4-6',
}

export async function callExtract(
  model: Model,
  ambiguousText: string,
  dictionaryBlock: string,
  userHint?: string,
): Promise<LLMCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL_IDS[model],
      // Chunked callers (callExtractChunked) keep each request to LLM_CHUNK_SIZE
      // blocks, but a single block can carry verbose notes — give generous
      // headroom so the tool_use JSON never truncates (stop_reason=max_tokens
      // silently drops the whole batch; see funnel L3/L4).
      max_tokens: 8192,
      temperature: 0,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: dictionaryBlock, cache_control: { type: 'ephemeral' } },
      ],
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'extract_bookings' },
      messages: [{
        role: 'user',
        content: userHint
          ? `${userHint}\n\n═══ AMBIGUOUS LINES ═══\n${ambiguousText}`
          : `═══ AMBIGUOUS LINES ═══\n${ambiguousText}`,
      }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Claude ${model} ${res.status}: ${body.slice(0, 200)}`)
  }

  const json = await res.json() as {
    content: Array<{ type: string; input?: { bookings?: unknown[] } }>
    usage?: UsageTokens
  }

  const toolUse = json.content.find(c => c.type === 'tool_use')
  // Defensive: the model occasionally returns `bookings` as a non-array (a single
  // object, or an index-keyed map) for a dense/ambiguous chunk. Coerce to [] so
  // one malformed chunk yields 0 rows instead of throwing and rejecting the whole
  // Promise.all in callExtractChunked (which would drop EVERY block in the batch).
  const rawBookings = toolUse?.input?.bookings
  const raw = (Array.isArray(rawBookings) ? rawBookings : []) as Partial<ParsedBooking>[]

  const bookings: ParsedBooking[] = raw.map((b, idx) => normalize(b, idx))

  return {
    bookings,
    model,
    usage: {
      input_tokens: json.usage?.input_tokens ?? 0,
      cache_read_input_tokens: (json.usage as { cache_read_input_tokens?: number } | undefined)?.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: (json.usage as { cache_creation_input_tokens?: number } | undefined)?.cache_creation_input_tokens ?? 0,
      output_tokens: json.usage?.output_tokens ?? 0,
    },
  }
}

// Max ambiguous blocks per LLM request. A single un-chunked call on a large
// manifest (>~30 bookings) blows past max_tokens, truncates the tool_use JSON
// (stop_reason=max_tokens), and yields ZERO usable rows — silently dropping the
// whole batch. 25 blocks ≈ ~1.5k output tokens, comfortably under the cap.
export const LLM_CHUNK_SIZE = 25

const EMPTY_USAGE: UsageTokens = {
  input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 0,
}

/**
 * Split `blocks` into LLM_CHUNK_SIZE batches, extract each in parallel, then
 * merge. Dedups on real externalBookingId (placeholder MANUAL-<n> ids collide
 * across chunks by construction, so they are never deduped). Usage is summed so
 * cost accounting stays accurate.
 *
 * Chunks are isolated via allSettled: one chunk failing (a transient 429, a
 * malformed tool_use, a timeout) yields 0 rows for THAT chunk only instead of
 * rejecting the whole import — a large manifest spanning several chunks no longer
 * loses every block because one chunk hiccupped. Only when EVERY chunk fails do
 * we throw (preserving the funnel's total-failure signal: l3 error + autopilot).
 */
export async function callExtractChunked(
  model: Model,
  blocks: string[],
  dictionaryBlock: string,
  userHint?: string,
): Promise<LLMCallResult> {
  if (blocks.length === 0) return { bookings: [], model, usage: { ...EMPTY_USAGE } }

  const chunks: string[][] = []
  for (let i = 0; i < blocks.length; i += LLM_CHUNK_SIZE) {
    chunks.push(blocks.slice(i, i + LLM_CHUNK_SIZE))
  }

  // Prompt-cache warming (Phase 27 §45). The system prompt + dictionary block are
  // a shared `cache_control: ephemeral` prefix. Firing every chunk at once races
  // them before the first response writes the cache, so EACH chunk pays full
  // cache_creation on that prefix instead of cache_read (~10% of input price).
  // For a multi-chunk import, run the first chunk alone to warm the prefix, THEN
  // fire the rest in parallel against the warm cache. Single-chunk imports (the
  // common case, ≤25 blocks) are unchanged. Trade: one extra sequential round-trip
  // on large imports buys ~90% off the prefix cost of every chunk after the first.
  let settled: PromiseSettledResult<LLMCallResult>[]
  if (chunks.length === 1) {
    settled = await Promise.allSettled([
      callExtract(model, chunks[0].join('\n\n---\n\n'), dictionaryBlock, userHint),
    ])
  } else {
    const [first] = await Promise.allSettled([
      callExtract(model, chunks[0].join('\n\n---\n\n'), dictionaryBlock, userHint),
    ])
    const rest = await Promise.allSettled(
      chunks.slice(1).map(c => callExtract(model, c.join('\n\n---\n\n'), dictionaryBlock, userHint)),
    )
    settled = [first, ...rest]
  }
  const results = settled
    .filter((s): s is PromiseFulfilledResult<LLMCallResult> => s.status === 'fulfilled')
    .map(s => s.value)
  if (results.length === 0) {
    // Every chunk failed — surface the first reason so the funnel logs the L3
    // error and triggers the failure/autopilot path (same as the old throw).
    const firstRejection = settled.find(s => s.status === 'rejected') as PromiseRejectedResult | undefined
    throw firstRejection?.reason ?? new Error('all LLM chunks failed')
  }
  // PARTIAL failure: keep the chunks that succeeded (don't lose them the way the
  // old Promise.all throw did), but do NOT swallow it silently — surface a warning.
  // The failed chunks' blocks produced no bookings, so they remain unmatched in
  // leftover and are retried by the next layer (L4) / logged to parse_failures;
  // the warning makes the transient failure visible instead of looking like a
  // clean success that happens to be short some bookings. (Rejected requests carry
  // no usage, so their token cost is unavoidably not counted here.)
  const rejectedCount = settled.length - results.length
  if (rejectedCount > 0) {
    const firstRejection = settled.find(s => s.status === 'rejected') as PromiseRejectedResult | undefined
    console.warn(
      `[parse.llm] ${rejectedCount}/${settled.length} ${model} chunk(s) failed; their blocks fall back to leftover (L4 / parse_failures).`,
      firstRejection?.reason,
    )
  }

  const seen = new Set<string>()
  const bookings: ParsedBooking[] = []
  const usage: UsageTokens = { ...EMPTY_USAGE }
  for (const r of results) {
    for (const b of r.bookings) {
      const id = b.externalBookingId
      const placeholder = !id || /^MANUAL-\d+$/.test(id)
      if (!placeholder) {
        if (seen.has(id)) continue
        seen.add(id)
      }
      bookings.push(b)
    }
    usage.input_tokens += r.usage.input_tokens
    usage.cache_read_input_tokens += r.usage.cache_read_input_tokens
    usage.cache_creation_input_tokens += r.usage.cache_creation_input_tokens
    usage.output_tokens += r.usage.output_tokens
  }
  return { bookings, model, usage }
}

const VALID_OTA = new Set<OTASource>(['klook', 'gyg', 'viator', 'kkday', 'tripcom', 'csv', 'manual'])

function normalize(b: Partial<ParsedBooking>, idx: number): ParsedBooking {
  const sp = String(b.sourcePlatform ?? 'manual').toLowerCase()
  const sourcePlatform: OTASource = VALID_OTA.has(sp as OTASource) ? (sp as OTASource) : 'manual'

  return {
    sourcePlatform,
    externalBookingId: b.externalBookingId?.trim() || `MANUAL-${idx + 1}`,
    leadName: b.leadName?.trim() ?? '',
    partySize: clampPartySize(b.partySize),
    tourDate: b.tourDate?.trim(),
    productName: b.productName?.trim(),
    pickupPointRaw: cleanPickup(b.pickupPointRaw),
    pickupPointNormalized: cleanPickup(b.pickupPointNormalized),
    pickupTime: normalizeTime(b.pickupTime),
    email: b.email?.trim().toLowerCase(),
    phone: b.phone?.trim(),
    whatsapp: b.whatsapp?.trim(),
    language: b.language?.trim().toLowerCase(),
    notes: b.notes?.trim(),
    // Phase 27 §45 Sprint C — carry the LLM-emitted ship text through. The
    // backstop later resolves it to cruiseShipId and canonicalizes the spelling,
    // so we only clean obvious junk here. cruiseShipId is intentionally not read
    // from the LLM (backstop-only).
    cruiseShipText: cleanShipText(b.cruiseShipText),
    confidenceScore: clampConfidence(b.confidenceScore),
    issues: Array.isArray(b.issues) ? b.issues.filter(i => typeof i === 'string') : [],
  }
}

// Phase 27 §45 Sprint C — a ship value that is empty, whitespace, or a literal
// "no value" placeholder collapses to undefined, mirroring cleanPickup. A real
// ship name always carries a letter; "N/A"/"-"/"미정" are not ships, so the
// completeness gate doesn't treat them as a filled field. Unlike pickup, "미정"
// is NOT meaningful for a ship (there is no to-be-determined ship), so it drops.
function cleanShipText(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined
  const v = s.trim()
  if (v.length === 0) return undefined
  if (/^(?:n\/?a|none|null|-+|tbd|미정|추후|확인\s*중|해당\s*없음)$/i.test(v)) return undefined
  if (!/\p{L}/u.test(v)) return undefined
  return v
}

// Phase 26 §44.5.6 — a pickup value that is empty, whitespace, or a literal
// "no value" placeholder (N/A, NA, -, none, null) must collapse to undefined.
// Otherwise the Step 4 pickup review counts it as "원문만" (raw) and the guide
// card shows a blank chip. "미정"/"TBD" are KEPT — they are meaningful
// to-be-determined markers, not absence.
function cleanPickup(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined
  const v = s.trim()
  if (v.length === 0) return undefined
  if (/^(?:n\/?a|none|null|-+|해당\s*없음)$/i.test(v)) return undefined
  // §44.5.11 — punctuation-only junk (the LLM emits a bare "/" or "/ " for an
  // empty GYG pickup field). A real pickup always has a letter or digit.
  if (!/[\p{L}\p{N}]/u.test(v)) return undefined
  return v
}

function clampPartySize(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1
  return Math.max(1, Math.min(50, Math.round(n)))
}

function clampConfidence(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0.5
  return Math.max(0, Math.min(1, n))
}

function normalizeTime(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined
  const m = s.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!m) return undefined
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 23 || min < 0 || min > 59) return undefined
  return `${h.toString().padStart(2, '0')}:${m[2]}`
}
