import type { ParsedBooking } from '@/lib/ops/parse/types'
import type { FunnelEvent } from './funnel-events'

const KST_TIME_ZONE = 'Asia/Seoul'
const CRUISE_TOUR_RE =
  /cruise|cruise\s*terminal|port\s+of\s+jeju|jeju\s+port|busan\s+port|incheon\s+port|gangjeong|seogwipo|celebrity|spectrum|millennium|ovation|anthem|norwegian|\bncl\b|\uD06C\uB8E8\uC988|\uAC15\uC815|\uC11C\uADC0\uD3EC|\uC81C\uC8FC\uD56D|\uBD80\uC0B0\uD56D|\uC778\uCC9C\uD56D|\uD558\uC120|\uC2B9\uC120/i

export function kstDateOffset(days: number, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const year = Number(parts.find(p => p.type === 'year')?.value)
  const month = Number(parts.find(p => p.type === 'month')?.value)
  const day = Number(parts.find(p => p.type === 'day')?.value)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))

  return [
    shifted.getUTCFullYear(),
    pad2(shifted.getUTCMonth() + 1),
    pad2(shifted.getUTCDate()),
  ].join('-')
}

export function kstDateFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return kstDateOffset(0, d)
}

export function isCruiseTourBooking(b: ParsedBooking): boolean {
  if (b.cruiseShipText?.trim() || b.cruiseShipId) return true
  const haystack = [
    b.productName,
    b.pickupPointRaw,
    b.pickupPointNormalized,
    b.notes,
  ].filter(Boolean).join(' ')
  return CRUISE_TOUR_RE.test(haystack)
}

// Guide Schedule Management Phase 4 — parse-time tour_type classification.
// cruise (any booking is a cruise tour) → 'cruise'; otherwise default 'bus' (the
// common shared-bus day tour). The operator overrides to 'private' at import
// (trust-based, Hard Rule 4). Drives per-tour 단가 resolution.
export type TourType = 'bus' | 'private' | 'cruise'
export function classifyTourType(bookings: ParsedBooking[]): TourType {
  if (bookings.some(isCruiseTourBooking)) return 'cruise'
  return 'bus'
}

export function applyBusTourDateDefaults(
  bookings: ParsedBooking[],
  emit?: (e: FunnelEvent) => void,
  now = new Date(),
): number {
  const defaultDate = kstDateOffset(1, now)
  let applied = 0

  for (const booking of bookings) {
    if (booking.tourDate) continue
    if (isCruiseTourBooking(booking)) continue
    booking.tourDate = defaultDate
    applied++
  }

  emit?.({
    event: 'tour_date_default_done',
    data: { applied, defaultDate, policy: 'kst_next_day_non_cruise' },
  })
  return applied
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
