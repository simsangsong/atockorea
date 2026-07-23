// Phase 0-bis — L0→L4 funnel orchestrator
// Master plan §6.1 — each layer removes handled rows from the input to the next.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBooking, ImportRequestSource } from '@/lib/ops/parse/types'
import { DEFAULT_TENANT_ID } from '@/lib/ops/parse/types'
import { ADAPTERS, ADAPTER_DETECT_THRESHOLD, pickAdapter } from './adapters'
import type { PlatformAdapter } from './adapters/types'
import { fingerprintPaste } from './fingerprint'
import { heuristicExtract } from './heuristics'
import { loadDictForTenant, formatDictBlock, normalizeForLookup, type DictRow } from './dictionary'
import { callExtractChunked } from './llm'
import { pickModel } from './router'
import { estimateCostUSD, aggregateUsage, type UsageTokens } from './pricing'
import { recordObservation, queuePickupProposal, runAutoPromote } from './learning'
import { canonicalizeAllPickups } from './canonicalize-backstop'
import { resolveAllCruiseShips } from './cruise-ship-backstop'
import { inferMissingCruiseDatesFromPortCalls, resolveAllCruisePortCalls } from './cruise-port-call-backstop'
import { applyBusTourDateDefaults } from './tour-date'
import { runRulesLayer, loadShadowRulesForTenant } from './rules'
import { recordShadowAgreement } from './shadow'
import { buildInputContext } from './normalize'
import { classifyShape } from './classify'
import type { InputShape } from './classify'
import { stripEmailEnvelope } from './email-envelope'
import { extractByColumns } from './column-extract'
import { maybeResegment } from './segment'
import { buildFinalLeftoverFailures, buildPartialFailureRecords, recordParseFailures } from './failures'
import { shouldTriggerAutopilot, dispatchAutopilot } from './autopilot-trigger'
import { shouldAlertOperator, sendOperatorParseFailureAlert } from './operator-alert'
import { completenessGate, mergeEnrichment, stillMissing, applyReviewFlags, type PartialRow } from './gate'
import { applyValidationRepair } from './repair'
import { lookupRowCache, writeRowCache } from './row-cache'
import { extractFormatFingerprint } from './format-fingerprint'
import { bumpTemplateHit, lookupActiveTemplate, lookupAnyTemplate, recordAutopilotMarker, recordDraftTemplate } from './format-templates'
import {
  inheritSectionHeaders,
  inheritSectionDates,
  looksLikeJunkHeaderBooking,
  clearJunkProductName,
  isStructuralNoiseBlock,
} from './section-header'
import { inferWhatsappFromPhone, propagateCountryCode } from './whatsapp-from-phone'
import type { FunnelEvent, FunnelEventName } from './funnel-events'

// Sprint 27.A — max deterministic partials enriched per import (1 chunk). Over
// the cap, partials are review-flagged instead of enriched, bounding LLM cost.
const ENRICHMENT_CAP = 25

// Sprint 27.I — shapes the data-driven column extractor (L1.5) runs on.
// 'mixed' is included for the spaced-slash multi-OTA operator roster
// ("klook / Name / Jeju / 6 / Hotel" — ≥2 distinct OTA markers classify it
// mixed, master plan §45). toGrid stays strict (≥3 consistent columns, ≥2 rows),
// so a blank-line-separated multi-line manual_kr roster never grids here; the
// extractor also self-defers (→ LLM) on an ambiguous mapping, so widening the
// shape set only RESCUES single-line grids the LLM would otherwise have to —
// and can't, when it is unavailable (the K ONE TOUR final-leftover case).
const TABULAR_SHAPES: ReadonlySet<InputShape> = new Set<InputShape>([
  'ota:csv',
  'excel_paste',
  'driver_list',
  'mixed',
])
function isTabularShape(shape: InputShape): boolean {
  return TABULAR_SHAPES.has(shape)
}

export type { FunnelEvent, FunnelEventName }

export interface FunnelInput {
  /** atockorea port: optional — defaults to DEFAULT_TENANT_ID ('atockorea').
   *  Signature kept for the future B2B split (consolidation plan §2). */
  tenantId?: string
  raw: string
  platform: ImportRequestSource
  forceAccuracy?: boolean
  supabase: SupabaseClient
  emit: (e: FunnelEvent) => void
}

export interface FunnelOutput {
  bookings: ParsedBooking[]
  metrics: {
    l0_hits: number
    l1_hits: number
    l2_hits: number
    l3_hits: number
    l4_hits: number
    /** Sprint 27.A — deterministic partials topped up by enrichment (distinct
     *  from l3_hits, which counts ambiguous-leftover extractions). Persisted to
     *  parse_metrics.layer_l3_enrichment since 27.G-C. */
    l3_enrichment: number
    /** Sprint 27.G — ambiguous blocks served from parse_row_cache (skipped the
     *  LLM). Persisted to parse_metrics.layer_l0_row_hit since 27.G-C. */
    l0_row_hits: number
    /** Sprint 27.H — field re-route/pull/clear/fill ops applied to LLM rows. */
    repairs_applied: number
    /** Sprint 27.H — low-structural rows re-extracted on Sonnet (escalation). */
    escalations: number
    /** Sprint 27.H — mean honest structural confidence over LLM rows (or null). */
    mean_structural_confidence: number | null
    total: number
    elapsed_ms: number
    cost_usd: number
    layers_used: string[]
  }
}

export async function runFunnel(input: FunnelInput): Promise<FunnelOutput> {
  const { tenantId = DEFAULT_TENANT_ID, raw, platform, forceAccuracy, supabase, emit } = input
  const t0 = performance.now()

  const all: ParsedBooking[] = []
  let l0Hits = 0
  let l1Hits = 0
  let l2Hits = 0
  let l3Hits = 0
  let l4Hits = 0
  let l3Enrichment = 0 // Sprint 27.A — deterministic partials topped up (≠ l3 ambiguous)
  let l0RowHits = 0 // Sprint 27.G — ambiguous blocks served from parse_row_cache
  let repairsApplied = 0 // Sprint 27.H — field re-route/pull/clear/fill ops on LLM rows
  let escalations = 0 // Sprint 27.H — low-structural rows re-extracted on Sonnet (L4)
  const structuralScores: number[] = [] // Sprint 27.H — honest scores for telemetry
  const usageItems: Array<{ model: 'haiku-4-5' | 'sonnet-4-6'; usage: UsageTokens }> = []
  const layersUsed: string[] = []

  // ── Sprint 27.0 — classify + normalize ONCE, before L1 ────────────────────
  // Downstream layers consume the parser-facing `normalized` view. `raw` stays
  // the source of truth: the L0 fingerprint below still hashes `raw` (cache key
  // unchanged), and `inputCtx.signals` is the single source of truth Sprint A's
  // completeness gate reads (Hard Rule #17 — do NOT add a second scanner). The
  // normalized view is behavior-neutral (cosmetic whitespace cleanup the layers
  // already perform), so deterministic emit is identical to parsing `raw`.
  //
  // Sprint 27.G-B — gated manual-notes re-segmentation. Multi-line handwritten
  // rosters fragment one booking into head + contact pieces under blank-line
  // splitting; when detected (never fires on single-blank-separated v1–v5),
  // re-segment FIRST so signals (#17) + layers see whole bookings. fingerprint
  // still hashes the original `raw` below (cache key unchanged).
  // OTA email ingest — strip the forwarded envelope (marker + From/To/Cc/Date/
  // Subject header run) BEFORE anything else, but only for the 'email' shape so
  // non-email pastes are untouched. Without this the envelope becomes a phantom
  // booking and steals the forward date / no-reply address (measured 2026-06-21).
  // fingerprint below still hashes the original `raw` (cache key unchanged).
  const envelope = classifyShape(raw) === 'email' ? stripEmailEnvelope(raw) : { stripped: false, text: raw }
  if (envelope.stripped) layersUsed.push('email:envelope')

  const reseg = maybeResegment(envelope.text)
  if (reseg.resegmented) layersUsed.push('reseg:manual')
  const inputCtx = buildInputContext(reseg.text)
  emit({ event: 'resegment_done', data: { resegmented: reseg.resegmented } })

  // ── Format fingerprint (Sprint 28 — cross-format learning loop) ───────────
  // Hash the input's *shape*, not its bytes. Used to (a) hint about a known
  // format the admin has promoted to active (deterministic apply path TODO),
  // and (b) record a draft template after a successful L3/L4 run so the next
  // import with the same layout is recognized. Independent of the L0 byte
  // cache — fingerprint matches even when the payload differs.
  const formatFp = extractFormatFingerprint(raw)
  const matchedTemplate = await lookupActiveTemplate(supabase, tenantId, formatFp.fingerprint).catch(() => null)
  emit({
    event: 'format_fingerprint',
    data: {
      kind: formatFp.kind,
      fingerprint: formatFp.fingerprint.slice(0, 16),
      matchedTemplateId: matchedTemplate?.id ?? null,
      matchedTemplateStatus: matchedTemplate?.status ?? null,
    },
  })

  // ── L0: full-paste fingerprint cache ──────────────────────────────────────
  emit({ event: 'l0_start', data: { totalChars: raw.length } })
  const pasteFingerprint = fingerprintPaste(tenantId, raw)
  let remaining = inputCtx.normalized
  let l0HitWholePaste = false
  try {
    const { data: cached } = await supabase
      .from('ops_parse_cache')
      .select('parsed, hit_count')
      .eq('fingerprint', pasteFingerprint)
      .maybeSingle()
    if (cached?.parsed && Array.isArray(cached.parsed)) {
      const cachedBookings = cached.parsed as ParsedBooking[]
      all.push(...cachedBookings)
      l0Hits = cachedBookings.length
      l0HitWholePaste = true
      remaining = ''
      // Bump hit count + last_hit_at asynchronously (best-effort).
      void supabase
        .from('ops_parse_cache')
        .update({
          hit_count: Number((cached as { hit_count?: number }).hit_count ?? 0) + 1,
          last_hit_at: new Date().toISOString(),
        })
        .eq('fingerprint', pasteFingerprint)
        .then(() => undefined)
      layersUsed.push('l0_full')
    }
  } catch {
    // Cache miss / table absent → continue.
  }
  emit({ event: 'l0_done', data: { hits: l0Hits, wholePasteHit: l0HitWholePaste } })

  if (l0HitWholePaste) {
    await runFinalBackstops()
    flagCachedPartialsForReview()
    await persistCacheParsed(pasteFingerprint)
    if (matchedTemplate) void bumpTemplateHit(matchedTemplate.id, all.length > 0)
    return finalize()
  }

  // ── L1: platform adapter ──────────────────────────────────────────────────
  emit({ event: 'l1_start', data: {} })
  const explicit: PlatformAdapter | null =
    platform !== 'mixed' && platform !== 'manual'
      ? ADAPTERS.find(a => a.id === platform) ?? null
      : null
  const detected = explicit ?? pickAdapter(remaining)
  let leftoverL1: string[] = [remaining]
  if (detected) {
    const result = detected.parse(remaining)
    all.push(...result.bookings)
    l1Hits = result.bookings.length
    leftoverL1 = result.leftover
    if (l1Hits > 0) layersUsed.push(`l1:${detected.id}`)
  }
  emit({
    event: 'l1_done',
    data: {
      adapter: detected?.id ?? null,
      hits: l1Hits,
      leftoverBlocks: leftoverL1.length,
      detectThreshold: ADAPTER_DETECT_THRESHOLD,
    },
  })

  // ── L1.5: data-driven column extraction (Sprint 27.I) ─────────────────────
  // For a TABULAR shape the L1 adapter couldn't map (unfamiliar / wrong /
  // absent headers — the unseen-tenant case), profile each column by its DATA
  // and extract deterministically by column. This eliminates LLM column
  // mis-mapping on the first import: the phone column is the column whose cells
  // are phone-shaped, decided from the data, no LLM and no human. Defers (no-op)
  // when the leftover isn't confidently tabular or no identity column resolves.
  if (isTabularShape(inputCtx.shape) && leftoverL1.join('\n\n').trim().length > 0) {
    const colResult = extractByColumns(leftoverL1.join('\n\n'))
    if (colResult.bookings.length > 0) {
      all.push(...colResult.bookings)
      l1Hits += colResult.bookings.length
      leftoverL1 = colResult.leftover
      layersUsed.push('l1.5:columns')
    }
    emit({
      event: 'l1_5_columns_done',
      data: {
        hits: colResult.bookings.length,
        confidence: Number(colResult.confidence.toFixed(3)),
        mappedFields: colResult.mapping ? Object.keys(colResult.mapping) : [],
      },
    })
  }

  // ── Structural-noise filter (Phase 27 §45 — dirty-CSV defense) ────────────
  // Drop blocks that are entirely column-label headers ("구분,예약번호,…"),
  // decorative banners ("■■ 6/19 추가 단체 ■■"), or standalone section/date
  // dividers BEFORE the deterministic layers see them. Left in, heuristics
  // mis-parses them into a phantom booking AND contaminates an adjacent real
  // booking (header text leaking into productName, ref lost). A block carrying
  // any contact value is never noise (it's a booking), so real rows are safe.
  {
    // Filter the adapter's leftover blocks IN PLACE — do NOT re-join+re-split on
    // blank lines, which would re-fragment a multi-line booking that contains an
    // internal blank line and could drop its header-only fragment. isStructuralNoiseBlock
    // already inspects every line of a multi-line block.
    const kept = leftoverL1.filter(b => b.trim().length > 0 && !isStructuralNoiseBlock(b))
    const dropped = leftoverL1.length - kept.length
    if (dropped > 0) {
      leftoverL1 = kept
      layersUsed.push('noise_filtered')
      emit({ event: 'noise_filtered', data: { dropped } })
    }
  }

  // ── L2: heuristics ────────────────────────────────────────────────────────
  emit({ event: 'l2_start', data: {} })
  const l2Input = leftoverL1.join('\n\n')
  let leftoverL2: string[] = leftoverL1
  if (l2Input.trim().length > 0) {
    const result = heuristicExtract(l2Input)
    all.push(...result.bookings)
    l2Hits = result.bookings.length
    leftoverL2 = result.leftover
    if (l2Hits > 0) layersUsed.push('l2')
  }
  emit({ event: 'l2_done', data: { hits: l2Hits, leftoverBlocks: leftoverL2.length } })

  // ── L2.5: active parse_rules (master plan §7.1 Loop 2) ───────────────────
  // Mined templates promoted to status='active' apply deterministically here
  // before any LLM call. Hits roll into l2_hits (same deterministic class as
  // heuristics) but appear separately in layers_used for traceability.
  if (leftoverL2.length > 0) {
    const rulesResult = await runRulesLayer(supabase, tenantId, leftoverL2, emit)
    if (rulesResult.bookings.length > 0) {
      all.push(...rulesResult.bookings)
      l2Hits += rulesResult.bookings.length
      leftoverL2 = rulesResult.leftover
      layersUsed.push('l2:rules')
    }
  }

  // ── Deterministic phantom cleanup (Phase 27 §45 — dirty-CSV defense) ──────
  // A multi-line dense block (banner + header glued to data rows, no blank line)
  // can't be dropped block-wise (it carries real bookings), so heuristics may
  // still emit the banner/header line itself as a phantom booking (conf 0.85,
  // MANUAL-n ref). The L3/L4 accept filters guard LLM rows; mirror that guard
  // here for the DETERMINISTIC rows in `all`. Also clear any column-header text a
  // surviving real row absorbed into productName.
  {
    const before = all.length
    const kept = all.filter(b => !looksLikeJunkHeaderBooking(b))
    const droppedJunk = before - kept.length
    if (droppedJunk > 0) {
      all.length = 0
      all.push(...kept)
      l2Hits = Math.max(0, l2Hits - droppedJunk)
      if (!layersUsed.includes('metadata_header_guard')) layersUsed.push('metadata_header_guard')
    }
    for (const b of all) clearJunkProductName(b)
  }

  // ── Sprint 27.A — completeness gate (Hard Rule #18) ──────────────────────
  // A deterministic row whose source block carried a signal for a field it left
  // empty is NOT a final success — it is an enrichment target. Reads the Sprint
  // 0 signals (#17 — no second scanner). signal-ABSENT fields are never flagged,
  // so genuinely-absent rows are NOT sent to L3 (no blind flooding).
  const { partials } = completenessGate({ deterministicBookings: all, ctx: inputCtx })
  const partialsToEnrich = partials.slice(0, ENRICHMENT_CAP)
  const partialsOverCap = partials.slice(ENRICHMENT_CAP)
  // Over-cap partials are review-flagged immediately (never silent successes).
  for (const p of partialsOverCap) applyReviewFlags(p.booking, p.missingFields)
  emit({
    event: 'gate_done',
    data: { partials: partials.length, toEnrich: partialsToEnrich.length, overCap: partialsOverCap.length },
  })

  // ── Sprint 27.G — parse_row_cache (per-block L0 partial) ───────────────────
  // Each ambiguous block bound for the LLM is hashed; a block a prior import
  // already resolved via L3/L4 is restored at $0 (behavior-neutral — same stored
  // ParsedBooking) and removed from the L3 input. Only misses proceed to L3, and
  // if cache empties the leftover (and no partials remain) the fast path below
  // skips the LLM entirely. Best-effort: errors leave all blocks as misses.
  if (leftoverL2.length > 0) {
    const rowCache = await lookupRowCache(supabase, tenantId, leftoverL2)
    if (rowCache.hitCount > 0) {
      all.push(...rowCache.hits)
      l0RowHits = rowCache.hitCount
      leftoverL2 = rowCache.misses
      layersUsed.push('l0:row')
    }
    emit({ event: 'row_cache_done', data: { hits: l0RowHits, misses: leftoverL2.length } })
  }

  // ── L3/L4: LLM only when ambiguous leftover OR partials need enrichment ───
  // (partialsToEnrich===0 here implies partials===0, so the fast path is taken
  // only when the paste is BOTH fully deterministic AND complete.)
  if (leftoverL2.length === 0 && partialsToEnrich.length === 0) {
    // Even when L1+L2 fully handled the paste, normalize any raw pickup values
    // they emitted (adapters don't call canonicalizePickup themselves) and
    // resolve any ship text emitted by rules/heuristics to cruise_ships.id.
    await runFinalBackstops()
    if (matchedTemplate) void bumpTemplateHit(matchedTemplate.id, all.length > 0)
    return finalize()
  }

  // Load tenant dictionary once for both L3 and L4 calls (prompt-cached) AND
  // for the learning loop's canonical-id matching.
  let dictRows: DictRow[] = []
  let dictBlock = ''
  try {
    dictRows = await loadDictForTenant(supabase, tenantId)
    dictBlock = formatDictBlock(dictRows)
  } catch {
    dictBlock = 'DICTIONARY: (unavailable — proceed without canonical mapping)'
  }

  // L3 Haiku batch.
  emit({ event: 'l3_start', data: { ambiguousBlocks: leftoverL2.length } })
  const model = pickModel({ ambiguousLines: leftoverL2, forceAccuracy })
  let leftoverL3: ParsedBooking[] = []
  // Phase 27 §45 — LLM rows that actually swallowed a labeled metadata header
  // ("tour_name: … | guide: …"). Dropped from the booking stream; their source
  // block falls through to the final_leftover failure corpus below.
  const phantomHeaderRows: ParsedBooking[] = []
  let l3Bookings: ParsedBooking[] = []
  let l3Model: 'haiku-4-5' | 'sonnet-4-6' | null = null
  if (model === 'haiku-4-5' || model === 'sonnet-4-6') {
    try {
      const haikuModel = forceAccuracy ? 'sonnet-4-6' : 'haiku-4-5'
      const result = await callExtractChunked(haikuModel, leftoverL2, dictBlock)
      // Sprint 27.H — repair mis-mapped fields against each block's own tokens
      // and REPLACE the LLM's self-reported confidence with the honest
      // structural score BEFORE the accept/escalate filter. This is the choke
      // point that stops a broken row shipping (no human review): a mis-map
      // tanks the structural score, so it is escalated to Sonnet or dropped to
      // the failure corpus instead of slipping through at a self-claimed 0.8.
      const repaired = applyValidationRepair(result.bookings, leftoverL2)
      repairsApplied += repaired.reduce((n, r) => n + r.repairs.length, 0)
      structuralScores.push(...repaired.map(r => r.structural))
      // Accept rows whose STRUCTURAL confidence ≥ 0.6; escalate <0.6 to L4 if not already on Sonnet.
      const acceptedRaw = repaired.filter(r => r.booking.confidenceScore >= 0.6).map(r => r.booking)
      const lowConf = repaired.filter(r => r.booking.confidenceScore < 0.6).map(r => r.booking)
      const accepted = acceptedRaw.filter(b => !looksLikeJunkHeaderBooking(b))
      phantomHeaderRows.push(...acceptedRaw.filter(looksLikeJunkHeaderBooking))
      // A surviving real row may have absorbed a column-header line into its
      // productName — clear it so the wrong value never ships.
      for (const b of accepted) clearJunkProductName(b)
      all.push(...accepted)
      l3Hits = haikuModel === 'haiku-4-5' ? accepted.length : 0
      l4Hits = haikuModel === 'sonnet-4-6' ? accepted.length : 0
      leftoverL3 = lowConf
      l3Bookings = accepted
      l3Model = haikuModel
      usageItems.push({ model: haikuModel, usage: result.usage })
      if (accepted.length > 0) layersUsed.push(haikuModel === 'haiku-4-5' ? 'l3' : 'l4')
      emit({ event: 'l3_done', data: { hits: accepted.length, lowConfidence: lowConf.length, model: haikuModel } })
    } catch (err) {
      emit({ event: 'l3_done', data: { hits: 0, error: (err as Error).message } })
    }
  } else {
    emit({ event: 'l3_done', data: { hits: 0, skipped: 'no_ambiguous_input' } })
  }

  // L4 Sonnet fallback only when Haiku produced low-confidence rows AND we didn't already use Sonnet.
  let l4Bookings: ParsedBooking[] = []
  if (leftoverL3.length > 0 && model === 'haiku-4-5' && !forceAccuracy) {
    // Cost (Phase 27 §45 — L4 input scope): re-run Sonnet ONLY on the blocks
    // Haiku did NOT confidently resolve — the low-confidence rows' source blocks
    // plus any block that yielded no accepted row. Re-sending the blocks Haiku
    // already nailed was pure waste: the dedup below discarded those re-extracted
    // rows anyway, yet we still paid Sonnet input+output for them (≈80-90% of L4
    // spend on a typical mostly-good batch, at 3×/15× Haiku's price). selectL4Blocks
    // uses the same lead-name pairing the learning loop + row cache use.
    const l4Blocks = selectL4Blocks(l3Bookings, leftoverL2)
    emit({ event: 'l4_start', data: { ambiguousBlocks: l4Blocks.length } })
    try {
      // Re-run Sonnet (chunked) on the unresolved blocks; it sees the failed slots
      // and is free to revise. Dedup below keeps only genuinely new rows.
      const result = await callExtractChunked('sonnet-4-6', l4Blocks, dictBlock,
        'Haiku\'s pass produced low-confidence rows; re-extract from the same input with stricter accuracy.')
      // Sprint 27.H — repair + structural-rescore Sonnet's pass too, so the
      // escalation result is judged on what validates (the deterministic
      // reconciliation: a Sonnet row only wins if it now clears 0.6 structural
      // AND is new). A row neither pass can validate is dropped → logged as a
      // final-leftover failure (never shipped broken).
      const repairedL4 = applyValidationRepair(result.bookings, leftoverL2)
      repairsApplied += repairedL4.reduce((n, r) => n + r.repairs.length, 0)
      structuralScores.push(...repairedL4.map(r => r.structural))
      escalations += leftoverL3.length
      // Replace the low-confidence rows with whatever Sonnet returns at ≥0.6 structural.
      // Conservative: dedupe against already-emitted bookings on externalBookingId.
      const haveIds = new Set(all.map(b => b.externalBookingId))
      const newRowsRaw = repairedL4
        .map(r => r.booking)
        .filter(b => !haveIds.has(b.externalBookingId) && b.confidenceScore >= 0.6)
      const newRows = newRowsRaw.filter(b => !looksLikeJunkHeaderBooking(b))
      phantomHeaderRows.push(...newRowsRaw.filter(looksLikeJunkHeaderBooking))
      for (const b of newRows) clearJunkProductName(b)
      all.push(...newRows)
      l4Hits = newRows.length
      l4Bookings = newRows
      usageItems.push({ model: 'sonnet-4-6', usage: result.usage })
      if (newRows.length > 0) layersUsed.push('l4')
      emit({ event: 'l4_done', data: { hits: newRows.length, model: 'sonnet-4-6' } })
    } catch (err) {
      emit({ event: 'l4_done', data: { hits: 0, error: (err as Error).message } })
    }
  }

  // ── Sprint 27.A — enrich deterministic partials (capped at ENRICHMENT_CAP) ─
  // One L3 pass over the partial source blocks; merge fill-empty-only and
  // block-scoped 1:1 by lead name (#19). Whatever stays empty is review-flagged
  // (#18). Bounded by ENRICHMENT_CAP so cost scales with one chunk, not the
  // whole partial set.
  if (partialsToEnrich.length > 0) {
    emit({ event: 'l3_enrichment_start', data: { blocks: partialsToEnrich.length } })
    const enrichModel = forceAccuracy ? 'sonnet-4-6' : 'haiku-4-5'
    try {
      const result = await callExtractChunked(
        enrichModel,
        partialsToEnrich.map(p => p.block),
        dictBlock,
        'Each block was partially extracted by deterministic rules but the source clearly contains a phone / email / WhatsApp / pickup / cruise-ship / tour date / OTA platform value that was missed. Re-extract ALL fields from each block.',
      )
      usageItems.push({ model: enrichModel, usage: result.usage })
      for (const p of partialsToEnrich) {
        const match = findEnrichedFor(p, result.bookings)
        if (match) {
          const { merged, filledFields } = mergeEnrichment(p.booking, match)
          if (filledFields.length > 0) {
            Object.assign(p.booking, merged) // p.booking is a reference in `all`
            l3Enrichment++
          }
        }
        const remaining = stillMissing(p.booking, p.missingFields)
        if (remaining.length > 0) applyReviewFlags(p.booking, remaining)
      }
      emit({ event: 'l3_enrichment_done', data: { enriched: l3Enrichment, model: enrichModel } })
    } catch (err) {
      // On failure none are enriched — flag every partial (never a silent success).
      for (const p of partialsToEnrich) applyReviewFlags(p.booking, p.missingFields)
      emit({ event: 'l3_enrichment_done', data: { enriched: 0, error: (err as Error).message } })
    }
  }

  if (phantomHeaderRows.length > 0) layersUsed.push('metadata_header_guard')

  // ── Sprint 27.A/B — partials still missing after enrichment (+ over-cap) ───
  // layer='partial' failures (source_signal_present=true by definition). Lets
  // the failure dashboard separate "we missed extractable data" from leftover.
  void recordParseFailures(
    supabase,
    tenantId,
    buildPartialFailureRecords({
      partials: [
        ...partialsToEnrich.map(p => ({
          block: p.block,
          fields: stillMissing(p.booking, p.missingFields),
          reason: 'enrichment_incomplete',
        })),
        ...partialsOverCap.map(p => ({ block: p.block, fields: p.missingFields, reason: 'over_enrichment_cap' })),
      ],
      shape: inputCtx.shape,
      dict: dictRows.map(r => ({ canonical: r.canonical, aliases: r.aliases })),
    }),
  )

  // ── Sprint 27.B-lite — failure intelligence (final unparsed leftover) ──────
  // Blocks that reached L3 but no LLM booking was attributed to them are final
  // failures. Logged masked (#21) and tagged with the 27.0 source signal (#17:
  // read inputCtx.signals, no second scanner) so the failure dashboard and
  // Sprint A's gate can use them. Best-effort — never blocks the response, and
  // no-ops gracefully until the parse_failures migration is applied.
  const finalLeftoverFailures = buildFinalLeftoverFailures({
    leftoverBlocks: leftoverL2,
    llmBookings: [...l3Bookings, ...l4Bookings],
    ctx: inputCtx,
    dict: dictRows.map(r => ({ canonical: r.canonical, aliases: r.aliases })),
  })
  void recordParseFailures(supabase, tenantId, finalLeftoverFailures)

  // ── Parser Autopilot — IMMEDIATE trigger (docs/master-plan-parser-autopilot) ─
  // A NOVEL format (no template SEEN yet) that still left signal-present leftover
  // is the "new tenant's unseen sheet just failed" case — the one that churns a
  // tenant on first sitting. Fire the GitHub dispatch NOW (minutes, not the daily
  // sweep) so the agent starts hardening this shape. Gated so a known/working
  // format never triggers (NOT an agent-per-sheet). Fire-and-forget: masked
  // samples only, never blocks or alters the import response.
  //
  // NOVELTY for the trigger reads lookupAnyTemplate (draft/active/rejected) — NOT
  // the active-only `matchedTemplate` used for parse/bump. Using active-only here
  // re-fired on every re-upload of the same broken sheet, because the draft a
  // novel import leaves is never 'active' until an admin promotes it. Keep the
  // two flags separate (do not merge).
  {
    const signalPresentLeftovers = finalLeftoverFailures.filter(f => f.sourceSignalPresent)
    const count = signalPresentLeftovers.length
    const maskedSamples = signalPresentLeftovers.map(f => f.rawLineMasked)
    const seenTemplate = await lookupAnyTemplate(supabase, tenantId, formatFp.fingerprint).catch(() => null)
    const autopilotTriggered = shouldTriggerAutopilot({ matchedTemplate: !!seenTemplate, signalPresentLeftovers: count })
    if (autopilotTriggered) {
      layersUsed.push('autopilot:triggered')
      emit({ event: 'autopilot_triggered', data: { shape: inputCtx.shape, signalPresentLeftovers: count } })
      // Reserve a dedup marker so this novel fingerprint never re-dispatches
      // (lookupAnyTemplate will hit it next time). Only when the LLM contributed
      // NOTHING (l3/l4/enrichment all 0) — otherwise recordDraftTemplate below
      // leaves a RICH draft and the marker would clobber it. This llm-contribution
      // gate (not all.length===0) is what covers the deterministic-partial +
      // LLM-down case (e.g. 71 rows parsed by L1/L2 but $0 LLM): there all.length
      // is >0 yet no draft is recorded, so an all.length===0 gate would re-fire.
      const llmContribution = l3Hits + l4Hits + l3Enrichment
      if (llmContribution === 0) {
        await recordAutopilotMarker({ tenantId, fingerprint: formatFp }).catch(() => {})
      }
      void dispatchAutopilot({ formatFingerprint: formatFp.fingerprint, shape: inputCtx.shape, signalPresentLeftovers: count, maskedSamples })
    }
    // Real-time operator alert when the import LARGELY failed (more extractable
    // rows dropped than parsed) — the live-screen anti-churn lever (a human can
    // reach out in minutes, which the code-patch loop cannot do). Masked only.
    if (shouldAlertOperator({ signalPresentLeftovers: count, totalBookings: all.length })) {
      void sendOperatorParseFailureAlert({
        supabase,
        tenantId,
        shape: inputCtx.shape,
        formatFingerprint: formatFp.fingerprint,
        signalPresentLeftovers: count,
        totalBookings: all.length,
        maskedSamples,
        autopilotTriggered,
      })
    }
  }

  // ── Final post-processing backstops ───────────────────────────────────
  // Canonicalize pickups, resolve cruise ships, infer missing dates, then
  // attach cruise port-call ids. This also runs on L0 cached results so older
  // cached parses are upgraded before the wizard groups them.
  await runFinalBackstops()

  // ── Learning loop (Loop 1 + observation recorder) ──────────────────────
  // Record one observation per LLM-resolved booking, and queue pickup proposals
  // when the LLM mapped a raw pickup to a canonical-name already in the dict.
  await recordLearning({
    supabase,
    tenantId,
    bookings: l3Bookings,
    model: l3Model,
    rawBlocks: leftoverL2,
    dictRows,
  })
  if (l4Bookings.length > 0) {
    await recordLearning({
      supabase,
      tenantId,
      bookings: l4Bookings,
      model: 'sonnet-4-6',
      rawBlocks: leftoverL3.length > 0 ? leftoverL2 : leftoverL2,
      dictRows,
    })
  }

  // Best-effort auto-promote sweep (cheap RPC; idempotent).
  void runAutoPromote(supabase, tenantId)

  // ── Sprint 27.G — persist LLM-resolved blocks to parse_row_cache ───────────
  // Pair each L3/L4 booking back to its source block (same leadName heuristic
  // recordLearning uses) and upsert row_hash → parsed, so a future mixed paste
  // reusing this block skips the LLM. Deterministic rows are NOT cached (cheap
  // to re-derive). Bookings here are post-backstop (final resolved form).
  {
    const llmBookings = [...l3Bookings, ...l4Bookings]
    if (llmBookings.length > 0) {
      const byBlock = new Map<string, ParsedBooking[]>()
      for (let i = 0; i < llmBookings.length; i++) {
        const blk = matchBlockForBooking(llmBookings[i], leftoverL2, i)
        if (!blk) continue
        const arr = byBlock.get(blk) ?? []
        arr.push(llmBookings[i])
        byBlock.set(blk, arr)
      }
      await writeRowCache(
        supabase,
        tenantId,
        Array.from(byBlock, ([block, bookings]) => ({ block, bookings })),
        l3Model,
      )

      // Phase 27 §45 (learning loop) — shadow-rule agreement scoring. Replay the
      // tenant's SHADOW rules over the same blocks the LLM just resolved and
      // accrue match/agreement stats. This is the missing link that lets a mined
      // rule cross the statistical promotion threshold (Hard Rule #20: ≥100
      // matches, ≥0.95 agreement) from real traffic — without it success_count
      // stayed 0 forever and only manual-override promotion worked. Behavior-
      // neutral (shadow rules never emit) + best-effort.
      const shadowStats = await recordShadowAgreement(
        supabase,
        tenantId,
        loadShadowRulesForTenant,
        Array.from(byBlock, ([block, bookings]) => ({ block, expected: bookings[0] })),
      )
      if (shadowStats.length > 0) {
        layersUsed.push('shadow_scored')
        emit({
          event: 'shadow_rules_scored',
          data: {
            rules: shadowStats.length,
            matched: shadowStats.reduce((n, s) => n + s.matched, 0),
            agreed: shadowStats.reduce((n, s) => n + s.agreed, 0),
          },
        })
      }
    }
  }

  // ── Persist L0 cache for next time ────────────────────────────────────────
  if (all.length > 0 && !l0HitWholePaste) {
    await persistCacheParsed(pasteFingerprint, model === 'none' ? null : model)
  }

  // ── Format learning (Sprint 28) — record draft / bump hit ─────────────────
  // Fire when the run actually produced bookings AND at least one came from an
  // LLM layer (which is the proof the format is novel — fully deterministic
  // runs are already covered by L0/L2.5 rules). Best-effort; never blocks the
  // response, and silently no-ops if the table is missing in dev.
  {
    const llmContribution = l3Hits + l4Hits + l3Enrichment
    if (matchedTemplate) {
      // We hit a known template. Bump its counter so admin sees usage.
      void bumpTemplateHit(matchedTemplate.id, all.length > 0)
    } else if (llmContribution > 0 && all.length > 0) {
      void recordDraftTemplate({
        tenantId,
        fingerprint: formatFp,
        sampleInput: raw,
        bookings: all,
        platform,
      }).then(() => {
        emit({
          event: 'format_template_recorded',
          data: { kind: formatFp.kind, fingerprint: formatFp.fingerprint.slice(0, 16) },
        })
      })
    }
  }

  return finalize()

  function finalize(): FunnelOutput {
    const elapsed_ms = performance.now() - t0
    let cost = 0
    for (const u of usageItems) cost += estimateCostUSD(u.model, u.usage)
    const aggUsage = aggregateUsage(usageItems.map(u => u.usage))
    const meanStructural =
      structuralScores.length > 0
        ? Number((structuralScores.reduce((a, b) => a + b, 0) / structuralScores.length).toFixed(4))
        : null

    // Write parse_metrics best-effort (don't block the response on it).
    void supabase
      .from('ops_parse_metrics')
      .insert({
        tenant_id: tenantId,
        layer_l0_hit: l0Hits,
        layer_l1_hit: l1Hits,
        layer_l2_hit: l2Hits,
        layer_l3_hit: l3Hits,
        layer_l4_hit: l4Hits,
        layer_l3_enrichment: l3Enrichment,
        layer_l0_row_hit: l0RowHits,
        repairs_applied: repairsApplied,
        escalations,
        mean_structural_confidence: meanStructural,
        total_input_tokens: aggUsage.input_tokens + aggUsage.cache_creation_input_tokens,
        total_output_tokens: aggUsage.output_tokens,
        total_cached_tokens: aggUsage.cache_read_input_tokens,
        total_cost_usd: Number(cost.toFixed(6)),
        elapsed_ms: Math.round(elapsed_ms),
        total_bookings: all.length,
        force_accuracy: forceAccuracy ?? false,
      })
      // Best-effort: swallow errors (e.g. the 27.H columns before their
      // migration is applied) so metrics never block or break a parse.
      .then(() => undefined, () => undefined)

    return {
      bookings: all,
      metrics: {
        l0_hits: l0Hits,
        l1_hits: l1Hits,
        l2_hits: l2Hits,
        l3_hits: l3Hits,
        l4_hits: l4Hits,
        l3_enrichment: l3Enrichment,
        l0_row_hits: l0RowHits,
        repairs_applied: repairsApplied,
        escalations,
        mean_structural_confidence: meanStructural,
        total: all.length,
        elapsed_ms: Math.round(elapsed_ms),
        cost_usd: Number(cost.toFixed(4)),
        layers_used: layersUsed,
      },
    }
  }

  async function runFinalBackstops(): Promise<void> {
    // Speed (Phase 27 §45): two independent DB-bound chains overlap their Supabase
    // round-trips — pickup canonicalization vs the cruise→date→port-call chain.
    // They mutate disjoint fields (pickup* vs cruiseShip*/tourDate/cruisePortCall),
    // so concurrency is safe (JS is single-threaded; each mutation is atomic between
    // awaits). The cheap synchronous backstops (contact CC, WA-from-phone, section
    // header inheritance) run after, in their required order. layersUsed pushes from
    // the two chains may interleave — order there is cosmetic.
    await Promise.all([
      canonicalizeAllPickups(all, tenantId, emit, supabase),
      runCruiseDateChain(),
    ])
    // Section-header inheritance — fill empty productName from the most
    // recent standalone course header in the input ("동쪽" / "서쪽" lines).
    // Runs LAST so deterministic + LLM extractions get their chance first.
    const inh = inheritSectionHeaders(raw, all)
    if (inh.filled > 0) {
      layersUsed.push('section_header')
      emit({
        event: 'section_header_inherited',
        data: { filled: inh.filled, headers: inh.headers.map(h => h.header) },
      })
    }

    // Country-code propagation — runs BEFORE the empty-WA inference so the
    // explicit-but-CC-stripped case (e.g. Klook KR operator paste where
    // "WhatsApp: 0546168552" sits alongside phone "+972-0546168552") gets the
    // matching CC backfilled. Symmetric (phone→wa AND wa→phone). When both
    // sides already carry a CC, even if the numbers differ, both are kept.
    const ccInf = propagateCountryCode(all)
    if (ccInf.filledWhatsapp + ccInf.filledPhone > 0) {
      layersUsed.push('contact_cc_propagated')
      emit({
        event: 'contact_cc_propagated',
        data: { filledWhatsapp: ccInf.filledWhatsapp, filledPhone: ccInf.filledPhone },
      })
    }

    // Phone-implies-WhatsApp inference — OTAs (Viator, GYG) ship guests with
    // only a phone number; for non-KR/JP/CN country codes that phone is almost
    // always WhatsApp-reachable. Fill the empty whatsapp field so the wizard /
    // wa.me deep link work without a manual retype. Explicit whatsapp wins.
    const waInf = inferWhatsappFromPhone(all)
    if (waInf.filled > 0) {
      layersUsed.push('whatsapp_from_phone')
      emit({
        event: 'whatsapp_inferred_from_phone',
        data: { filled: waInf.filled },
      })
    }
  }

  // The cruise→date→port-call chain, extracted so it can overlap pickup
  // canonicalization. Internal ordering is load-bearing and unchanged: ship
  // resolution → port-call date inference → section-date inheritance (BEFORE the
  // KST+1 bus default, fill-empty-only #19) → bus-date default → port-call id
  // attach (needs resolved ship + tourDate).
  async function runCruiseDateChain(): Promise<void> {
    await resolveAllCruiseShips(supabase, all, tenantId, emit)
    await inferMissingCruiseDatesFromPortCalls(supabase, all, emit)
    const dInh = inheritSectionDates(raw, all)
    if (dInh.filled > 0) {
      layersUsed.push('section_date')
      emit({ event: 'section_date_inherited', data: { filled: dInh.filled, headers: dInh.headers } })
    }
    applyBusTourDateDefaults(all, emit)
    await resolveAllCruisePortCalls(supabase, all, emit)
  }

  async function persistCacheParsed(fingerprint: string, modelUsed: string | null = null): Promise<void> {
    if (all.length === 0) return
    emit({ event: 'persist_start', data: { target: 'parse_cache', rows: all.length } })
    const { error } = await supabase
      .from('ops_parse_cache')
      .upsert(
        {
          fingerprint,
          tenant_id: tenantId,
          parsed: all as unknown as object[],
          model_used: modelUsed,
          last_hit_at: new Date().toISOString(),
        },
        { onConflict: 'fingerprint' },
      )
    emit({
      event: 'persist_done',
      data: {
        target: 'parse_cache',
        rows: all.length,
        error: error?.message ?? null,
      },
    })
  }

  function flagCachedPartialsForReview(): void {
    const { partials } = completenessGate({ deterministicBookings: all, ctx: inputCtx })
    if (partials.length === 0) return
    for (const p of partials) applyReviewFlags(p.booking, p.missingFields)
    void recordParseFailures(
      supabase,
      tenantId,
      buildPartialFailureRecords({
        partials: partials.map(p => ({
          block: p.block,
          fields: stillMissing(p.booking, p.missingFields),
          reason: 'cache_incomplete',
        })),
        shape: inputCtx.shape,
        dict: [],
      }),
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Learning helpers
// ─────────────────────────────────────────────────────────────────────────────

async function recordLearning(input: {
  supabase: SupabaseClient
  tenantId: string
  bookings: ParsedBooking[]
  rawBlocks: string[]
  model: 'haiku-4-5' | 'sonnet-4-6' | null
  dictRows: DictRow[]
}): Promise<void> {
  if (input.bookings.length === 0 || !input.model) return

  const resolvedBy = input.model === 'haiku-4-5' ? 'haiku' : 'sonnet'
  const dictForMask = input.dictRows.map(r => ({ canonical: r.canonical, aliases: r.aliases }))

  // Pair bookings to raw blocks heuristically — same index, falling back to
  // searching for the booking's leadName in the block list. This isn't perfect
  // (the LLM may have re-ordered) but is good enough for templated learning.
  for (let i = 0; i < input.bookings.length; i++) {
    const b = input.bookings[i]
    const rawCandidate = matchBlockForBooking(b, input.rawBlocks, i)

    void recordObservation(input.supabase, {
      tenantId: input.tenantId,
      rawLine: rawCandidate,
      parsed: b,
      resolvedBy,
      dict: dictForMask,
    })

    // Loop 1 — if the LLM normalized to a canonical we already know AND the
    // raw value isn't already an alias of that canonical, queue it.
    if (b.pickupPointRaw && b.pickupPointNormalized) {
      const rawNorm = normalizeForLookup(b.pickupPointRaw)
      const targetCanonical = input.dictRows.find(
        d => normalizeCompare(d.canonical, b.pickupPointNormalized!),
      )
      if (targetCanonical && !targetCanonical.normalizedSet.has(rawNorm)) {
        void queuePickupProposal(input.supabase, {
          tenantId: input.tenantId,
          rawValue: b.pickupPointRaw,
          proposedCanonicalId: targetCanonical.id,
          proposedBy: resolvedBy,
          confidence: b.confidenceScore,
        })
      }
    }
  }
}

/**
 * Phase 27 §45 — choose the blocks to re-extract on Sonnet (L4). Returns only the
 * blocks Haiku did NOT confidently resolve: every leftover block minus the source
 * blocks of the accepted (≥0.6 structural) rows. This is the cost choke point for
 * L4 — re-sending already-resolved blocks to the 3×/15×-priced model was wasted
 * spend (the L4 dedup discarded those rows anyway).
 *
 * Pairing uses the same lead-name heuristic as the learning loop + row cache, so
 * it inherits the same "good enough" contract. Defensive fallback: if pairing
 * somehow marks every block resolved (it shouldn't, since L4 only runs when
 * low-confidence rows remain), return the full set rather than skip the re-extract
 * — never trade recall for cost (Hard Rule #18, degrade-safe).
 */
export function selectL4Blocks(acceptedBookings: ParsedBooking[], leftoverBlocks: string[]): string[] {
  const resolved = new Set<string>()
  for (let i = 0; i < acceptedBookings.length; i++) {
    resolved.add(matchBlockForBooking(acceptedBookings[i], leftoverBlocks, i))
  }
  const unresolved = leftoverBlocks.filter(blk => !resolved.has(blk))
  return unresolved.length > 0 ? unresolved : leftoverBlocks
}

function matchBlockForBooking(b: ParsedBooking, blocks: string[], idx: number): string {
  if (blocks[idx]) {
    // Quick: same-index block contains the lead name?
    if (b.leadName && blocks[idx].includes(b.leadName)) return blocks[idx]
  }
  if (b.leadName) {
    const hit = blocks.find(blk => blk.includes(b.leadName))
    if (hit) return hit
  }
  return blocks[idx] ?? blocks[0] ?? ''
}

function normalizeCompare(a: string, b: string): boolean {
  return normalizeForLookup(a) === normalizeForLookup(b)
}

// Sprint 27.A — match an enrichment result back to its partial, block-scoped
// 1:1 by lead name (#19 — never by externalBookingId, which collides on
// MANUAL-n placeholders). Both sides came from the same source block, so the
// lead name aligns (exact, or one contains the other for region-stripped names).
function findEnrichedFor(p: PartialRow, enriched: ParsedBooking[]): ParsedBooking | undefined {
  const lead = p.booking.leadName
  if (!lead || lead.length < 2) return undefined
  return enriched.find(
    e => !!e.leadName && (e.leadName === lead || p.block.includes(e.leadName) || lead.includes(e.leadName)),
  )
}
