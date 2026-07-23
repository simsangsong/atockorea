// AtoC 통합 Phase 1 slice 2 — inbox commit machine (plan §3 A-5~A-7).
//
// runFunnel → per-booking commit state machine:
//
//   confirm:  confidence <0.60            → 'failed'    (recordParseFailures + alert)
//             product unmapped (A-7b)     → 'review_queued'  (오배치 방지 — 자동커밋 금지)
//             confidence 0.60~0.84 (A-6)  → 'review_queued'
//             confidence ≥0.85 + mapped   → bookings upsert (source, external_booking_id)
//                                           + ensureRoom (기존 tour-room 경로 재사용)
//                                           → 'auto_committed'
//   cancel:   (source, external_booking_id) match → status='cancelled' soft → 'cancelled'
//             no match/키 없음                    → 'review_queued'
//   change:   같은 신뢰도 게이트, match 시 화이트리스트 patch
//             (tour_date / number_of_guests / pickup→ota_raw_meta) → 'changed'
//
// Room placement note (조사 결과 — plan A-7c "기존 dispatch 경로 함수 호출만"):
// tour_rooms.booking_id는 NOT NULL UNIQUE (20260515133521) — booking_id-null
// 공유룸 모델은 이 스키마에 존재하지 않는다. 기존 유일한 룸 생성 경로는
// lib/tour-room/access.ts:ensureRoom (booking_id conflict upsert, per-booking).
// 조인투어의 "(tour_id, tour_date) 공유"는 룸 레벨이 아니라 가이드 tour-date
// 스코프 토큰(dispatch.ts)이 담당한다. 따라서 join/private 모두 ensureRoom을
// 호출하고(신규 룸 함수 금지 준수), tour_kind는 ota_raw_meta에 각인해 후속
// 슬라이스(좌석판·plan 가드)가 읽게 한다.
//
// 원문 이메일은 이 모듈에 들어오고 나가는 어디에서도 저장되지 않는다 (A-2).
// DB에 닿는 요약은 전부 maskLine() 마스킹본이다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { runFunnel, type FunnelOutput, type FunnelEvent } from '@/lib/ops/parse/funnel'
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { DEFAULT_TENANT_ID } from '@/lib/ops/parse/types'
import { normalizeForLookup } from '@/lib/ops/parse/dictionary'
import { maskLine } from '@/lib/ops/parse/mask'
import { recordParseFailures, type ParseFailureRecord } from '@/lib/ops/parse/failures'
import { ensureRoom } from '@/lib/tour-room/access'
import { sendLowConfidenceAlert } from './alert'
import type { InboundChannel, InboundIntent } from './classify'

// A-6 thresholds (plan §3).
export const AUTO_COMMIT_MIN_CONFIDENCE = 0.85
export const REVIEW_MIN_CONFIDENCE = 0.6

export type CommitResultKind =
  | 'auto_committed'
  | 'review_queued'
  | 'failed'
  | 'cancelled'
  | 'changed'

export interface InboundCommitItem {
  externalBookingId: string | null
  commitResult: CommitResultKind
  reason: string | null
  bookingId: string | null
  roomId: string | null
  tourKind: 'join' | 'private' | null
  confidence: number
  /** PII-free (maskLine + initials) — safe for ops_email_parse_logs. */
  maskedSummary: Record<string, unknown>
}

export interface InboundCommitOutput {
  items: InboundCommitItem[]
  metrics: FunnelOutput['metrics'] | null
  /** Aggregate for the single ops_email_parse_logs row (worst-first). */
  aggregateResult: CommitResultKind | 'ignored'
  maxConfidence: number | null
  firstBookingId: string | null
  alert: { sent: boolean; skipped: boolean }
}

export interface InboundCommitInput {
  supabase: SupabaseClient
  tenantId?: string
  channel: InboundChannel
  intent: Exclude<InboundIntent, 'unrelated'>
  /** Full in-memory email text. NEVER persisted (A-2). */
  raw: string
  messageId?: string | null
  emit?: (e: FunnelEvent) => void
  /**
   * Phase 2 리뷰 큐 [승인 커밋] (plan A-6 "0.60~0.84 → 사람 확정 후 A-7").
   * true면 confidence 게이트(<0.60 failed / <0.85 review_queued)를 건너뛴다 —
   * 사람이 마스킹 요약을 보고 확정했으므로. 매핑/외부ID/tour_date 요건은
   * 그대로 유지된다 (A-7b 오배치 방지는 승인으로도 우회 불가).
   */
  approveMode?: boolean
}

const OTA_CHANNELS: ReadonlySet<string> = new Set(['klook', 'viator', 'gyg', 'kkday', 'atoc'])

/** "Massimo Cassina" → "Massimo C." — plan §5.2 masking style. */
export function maskName(name: string | null | undefined): string | null {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return null
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0]?.toUpperCase() ?? ''}.`
}

interface ProductMapRow {
  tour_id: string
  tour_kind: 'join' | 'private'
}

async function lookupProductMap(
  supabase: SupabaseClient,
  tenantId: string,
  channel: string,
  productName: string | undefined,
): Promise<ProductMapRow | null> {
  const normalized = normalizeForLookup(productName ?? '')
  if (!normalized) return null
  try {
    const { data } = await supabase
      .from('ops_channel_product_map')
      .select('tour_id, tour_kind')
      .eq('tenant_id', tenantId)
      .eq('channel', channel)
      .eq('product_name_normalized', normalized)
      .eq('active', true)
      .maybeSingle()
    if (!data) return null
    return {
      tour_id: (data as { tour_id: string }).tour_id,
      tour_kind: ((data as { tour_kind?: string }).tour_kind === 'private' ? 'private' : 'join'),
    }
  } catch {
    return null
  }
}

async function findExistingBooking(
  supabase: SupabaseClient,
  source: string,
  externalBookingId: string,
): Promise<{ id: string; tour_id: string | null; tour_date: string | null; status: string | null; ota_raw_meta: Record<string, unknown> | null } | null> {
  const { data } = await supabase
    .from('bookings')
    .select('id, tour_id, tour_date, status, ota_raw_meta')
    .eq('source', source)
    .eq('external_booking_id', externalBookingId)
    .maybeSingle()
  return (data as never) ?? null
}

function buildMaskedSummary(b: ParsedBooking, channel: string): Record<string, unknown> {
  return {
    lead_name: maskName(b.leadName),
    party_size: b.partySize,
    tour_date: b.tourDate ?? null,
    product_name: b.productName ?? null,
    pickup: b.pickupPointNormalized ?? (b.pickupPointRaw ? maskLine(b.pickupPointRaw).masked : null),
    channel,
    source_platform: b.sourcePlatform,
    external_booking_id: b.externalBookingId || null,
    confidence: b.confidenceScore,
    issues: b.issues?.slice(0, 5) ?? [],
  }
}

/** Masked ota_raw_meta payload (plan A-7a — 마스킹된 요약만, contact PII는
 *  bookings 자체 컬럼에만 존재). */
function buildOtaRawMeta(b: ParsedBooking, channel: string, tourKind: 'join' | 'private' | null): Record<string, unknown> {
  return {
    channel,
    tour_kind: tourKind,
    product_name: b.productName ?? null,
    pickup_raw: b.pickupPointRaw ?? null,
    pickup_normalized: b.pickupPointNormalized ?? null,
    pickup_time: b.pickupTime ?? null,
    language: b.language ?? null,
    confidence: b.confidenceScore,
    parsed_at: new Date().toISOString(),
  }
}

function isIsoDate(s: string | undefined): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

const LANGUAGE_CODE_RX = /^[a-z]{2}(-[A-Za-z]{2,4})?$/

async function commitConfirm(
  supabase: SupabaseClient,
  tenantId: string,
  channel: string,
  b: ParsedBooking,
  item: InboundCommitItem,
  approveMode = false,
): Promise<void> {
  const mapping = await lookupProductMap(supabase, tenantId, channel, b.productName)
  if (!mapping) {
    // A-7b — 미매핑 상품은 자동 커밋 금지 (오배치 방지). approveMode도 우회 불가.
    item.commitResult = 'review_queued'
    item.reason = normalizeForLookup(b.productName ?? '') ? 'unmapped_product' : 'missing_product_name'
    return
  }
  item.tourKind = mapping.tour_kind

  if (!approveMode && b.confidenceScore < AUTO_COMMIT_MIN_CONFIDENCE) {
    item.commitResult = 'review_queued'
    item.reason = 'confidence_below_auto'
    return
  }
  if (!b.externalBookingId) {
    // 멱등 키의 절반이 없으면 upsert가 불가능 — 자동커밋 금지.
    item.commitResult = 'review_queued'
    item.reason = 'missing_external_booking_id'
    return
  }
  if (!isIsoDate(b.tourDate)) {
    item.commitResult = 'review_queued'
    item.reason = 'missing_tour_date'
    return
  }

  let merchantId: string | null = null
  try {
    const { data: tour } = await supabase
      .from('tours')
      .select('id, merchant_id')
      .eq('id', mapping.tour_id)
      .maybeSingle()
    merchantId = (tour as { merchant_id?: string | null } | null)?.merchant_id ?? null
  } catch {
    /* merchant is optional */
  }

  const otaRawMeta = buildOtaRawMeta(b, channel, mapping.tour_kind)
  const upsertFields: Record<string, unknown> = {
    tour_id: mapping.tour_id,
    merchant_id: merchantId,
    tour_date: b.tourDate,
    booking_date: b.tourDate,
    number_of_guests: Math.min(40, Math.max(1, Math.round(b.partySize || 1))),
    contact_name: b.leadName || 'OTA Guest',
    contact_email: b.email ?? null,
    contact_phone: b.phone ?? b.whatsapp ?? null,
    ota_raw_meta: otaRawMeta,
  }
  if (b.language && LANGUAGE_CODE_RX.test(b.language)) {
    upsertFields.preferred_language = b.language.slice(0, 10)
  }

  // Manual upsert on the (source, external_booking_id) partial unique index:
  // PostgREST upsert cannot target a partial index predicate, so we
  // select→update|insert and fall back to update on a 23505 race.
  const existing = await findExistingBooking(supabase, channel, b.externalBookingId)
  let bookingId: string | null = null
  if (existing) {
    const { error } = await supabase.from('bookings').update(upsertFields).eq('id', existing.id)
    if (error) throw error
    bookingId = existing.id
  } else {
    const insertRow = {
      ...upsertFields,
      source: channel,
      external_booking_id: b.externalBookingId,
      unit_price: 0,
      total_price: 0,
      final_price: 0,
      status: 'confirmed', // rooms + D-1 dispatch treat it like any paid booking
      payment_status: 'external', // A-7a — Stripe 홀드 플로우와 절대 혼선 금지
    }
    const { data, error } = await supabase.from('bookings').insert(insertRow).select('id').single()
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        const raced = await findExistingBooking(supabase, channel, b.externalBookingId)
        if (raced) {
          const { error: updErr } = await supabase.from('bookings').update(upsertFields).eq('id', raced.id)
          if (updErr) throw updErr
          bookingId = raced.id
        } else {
          throw error
        }
      } else {
        throw error
      }
    } else {
      bookingId = (data as { id: string }).id
    }
  }

  item.bookingId = bookingId
  item.commitResult = 'auto_committed'

  // A-7c — 룸 배치: 기존 tour-room 경로(ensureRoom) 호출만. join/private 공통
  // per-booking 룸 (module doc 참조). 룸 실패는 커밋을 되돌리지 않는다 —
  // ensureRoom은 다음 접근 시 같은 upsert로 자가치유된다.
  try {
    const room = await ensureRoom(supabase, { id: bookingId!, tour_id: mapping.tour_id, tour_date: b.tourDate })
    item.roomId = room.id
  } catch (e) {
    item.reason = `room_create_failed: ${e instanceof Error ? e.message : 'unknown'}`
  }
}

async function commitCancel(
  supabase: SupabaseClient,
  channel: string,
  b: ParsedBooking,
  item: InboundCommitItem,
): Promise<void> {
  if (!b.externalBookingId) {
    item.commitResult = 'review_queued'
    item.reason = 'cancel_missing_external_booking_id'
    return
  }
  const existing = await findExistingBooking(supabase, channel, b.externalBookingId)
  if (!existing) {
    item.commitResult = 'review_queued'
    item.reason = 'cancel_target_not_found'
    return
  }
  // A-7d — soft only: status 전이 하나만. 결제/환불/룸 로직 불개입 (slice-2 스코프).
  if (existing.status !== 'cancelled') {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', existing.id)
    if (error) throw error
  }
  item.bookingId = existing.id
  item.commitResult = 'cancelled'
}

async function commitChange(
  supabase: SupabaseClient,
  channel: string,
  b: ParsedBooking,
  item: InboundCommitItem,
  approveMode = false,
): Promise<void> {
  if (!approveMode && b.confidenceScore < AUTO_COMMIT_MIN_CONFIDENCE) {
    item.commitResult = 'review_queued'
    item.reason = 'change_confidence_below_auto'
    return
  }
  if (!b.externalBookingId) {
    item.commitResult = 'review_queued'
    item.reason = 'change_missing_external_booking_id'
    return
  }
  const existing = await findExistingBooking(supabase, channel, b.externalBookingId)
  if (!existing) {
    item.commitResult = 'review_queued'
    item.reason = 'change_target_not_found'
    return
  }

  // A-7e — 화이트리스트 patch만: tour_date / 인원 / 픽업. 그 외 필드 불변.
  const patch: Record<string, unknown> = {}
  const changedFields: string[] = []
  if (isIsoDate(b.tourDate) && b.tourDate !== existing.tour_date) {
    patch.tour_date = b.tourDate
    patch.booking_date = b.tourDate
    changedFields.push('tour_date')
  }
  if (b.partySize && b.partySize > 0) {
    patch.number_of_guests = Math.min(40, Math.max(1, Math.round(b.partySize)))
    changedFields.push('number_of_guests')
  }
  if (b.pickupPointRaw || b.pickupPointNormalized || b.pickupTime) {
    patch.ota_raw_meta = {
      ...(existing.ota_raw_meta ?? {}),
      pickup_raw: b.pickupPointRaw ?? null,
      pickup_normalized: b.pickupPointNormalized ?? null,
      pickup_time: b.pickupTime ?? null,
      pickup_changed_at: new Date().toISOString(),
    }
    changedFields.push('pickup')
  }

  if (changedFields.length === 0) {
    item.commitResult = 'review_queued'
    item.reason = 'change_no_whitelisted_fields'
    item.bookingId = existing.id
    return
  }

  const { error } = await supabase.from('bookings').update(patch).eq('id', existing.id)
  if (error) throw error
  item.bookingId = existing.id
  item.commitResult = 'changed'
  item.maskedSummary.changed_fields = changedFields
}

const RESULT_SEVERITY: Record<CommitResultKind, number> = {
  failed: 4,
  review_queued: 3,
  cancelled: 2,
  changed: 2,
  auto_committed: 1,
}

/**
 * Parse the in-memory email text and commit each booking (idempotent).
 * Never persists the raw email; per-item errors degrade that item to 'failed'
 * without aborting the batch.
 */
export async function commitInboundEmail(input: InboundCommitInput): Promise<InboundCommitOutput> {
  const { supabase, channel, intent, raw } = input
  const tenantId = input.tenantId ?? DEFAULT_TENANT_ID
  const emit = input.emit ?? (() => undefined)

  const funnel = await runFunnel({ tenantId, raw, platform: 'mixed', supabase, emit })

  const items: InboundCommitItem[] = []
  const failureRecords: ParseFailureRecord[] = []

  for (const b of funnel.bookings) {
    // 채널 확정: 분류가 unknown이면 파서가 행 단위로 식별한 플랫폼을 신뢰.
    const effectiveChannel = channel !== 'unknown' ? channel : OTA_CHANNELS.has(b.sourcePlatform) ? b.sourcePlatform : null

    const item: InboundCommitItem = {
      externalBookingId: b.externalBookingId || null,
      commitResult: 'review_queued',
      reason: null,
      bookingId: null,
      roomId: null,
      tourKind: null,
      confidence: b.confidenceScore,
      maskedSummary: buildMaskedSummary(b, effectiveChannel ?? 'unknown'),
    }
    items.push(item)

    try {
      // A-6 — <0.60 → 실패 코퍼스 (마스킹) + 알림. intent 무관 공통 게이트.
      // approveMode(사람 확정)에서는 건너뛴다.
      if (!input.approveMode && b.confidenceScore < REVIEW_MIN_CONFIDENCE) {
        item.commitResult = 'failed'
        item.reason = 'low_confidence'
        failureRecords.push({
          rawLineMasked: maskLine(
            [b.leadName, b.productName, b.tourDate, b.pickupPointRaw].filter(Boolean).join(' · ') || '(empty booking)',
          ).masked.slice(0, 2000),
          shape: 'email',
          layer: 'inbox_commit',
          failedField: null,
          reason: 'low_confidence',
          ruleId: null,
          sourcePlatform: b.sourcePlatform ?? null,
          sourceSignalPresent: true,
        })
        continue
      }

      if (!effectiveChannel) {
        item.commitResult = 'review_queued'
        item.reason = 'unknown_channel'
        continue
      }

      if (intent === 'cancel') await commitCancel(supabase, effectiveChannel, b, item)
      else if (intent === 'change') await commitChange(supabase, effectiveChannel, b, item, input.approveMode)
      else await commitConfirm(supabase, tenantId, effectiveChannel, b, item, input.approveMode)
    } catch (e) {
      item.commitResult = 'failed'
      item.reason = `commit_error: ${e instanceof Error ? e.message : 'unknown'}`
    }
  }

  // 실패 코퍼스 영속화 (best-effort — recordParseFailures가 자체 swallow).
  if (failureRecords.length > 0) {
    await recordParseFailures(supabase, tenantId, failureRecords)
  }

  // <0.60 알림 — OPS_ALERT_EMAIL 부재 시 sendLowConfidenceAlert가 스킵.
  let alert: { sent: boolean; skipped: boolean } = { sent: false, skipped: true }
  if (failureRecords.length > 0) {
    const res = await sendLowConfidenceAlert({
      channel,
      intent,
      messageId: input.messageId ?? null,
      maskedSamples: failureRecords.map((r) => r.rawLineMasked),
      failedCount: failureRecords.length,
      totalCount: funnel.bookings.length,
    })
    alert = { sent: res.sent, skipped: res.skipped }
  }

  const aggregateResult: InboundCommitOutput['aggregateResult'] =
    items.length === 0
      ? 'failed'
      : items.reduce<CommitResultKind>(
          (worst, it) => (RESULT_SEVERITY[it.commitResult] > RESULT_SEVERITY[worst] ? it.commitResult : worst),
          items[0].commitResult,
        )

  return {
    items,
    metrics: funnel.metrics,
    aggregateResult,
    maxConfidence: items.length ? Math.max(...items.map((i) => i.confidence)) : null,
    firstBookingId: items.find((i) => i.bookingId)?.bookingId ?? null,
    alert,
  }
}
