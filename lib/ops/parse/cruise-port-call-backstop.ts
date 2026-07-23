// Cruise port-call backstop — runs after cruise-ship-backstop has filled
// `cruiseShipId`. For every booking with both a ship_id AND a tour_date,
// looks up the matching scheduled voyage in cruise_port_calls and attaches
// the FK (cruise_port_call_id) plus an `cruisePortCallMultiple` warning flag.
//
// Detector path (Task 3): the multiple-match flag drives the
// `cruise_ship_conflict` alert; missing port_call drives a soft notice
// (the ship is correct but the schedule hasn't been imported yet).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { findPortCallByShipDate } from '@/lib/ops/cruise/find-port-call'
import type { FunnelEvent } from './funnel-events'
import { kstDateFromIso, kstDateOffset } from './tour-date'

type PortCallMatch = Awaited<ReturnType<typeof findPortCallByShipDate>>

interface PortCallCandidate {
  id: string
  port_canonical_id: string
  arrival_at: string
  departure_at: string | null
  terminal_info: string | null
  prev_port?: string | null
  next_port?: string | null
  pickup_locations?: { canonical_name?: string | null; address?: string | null } | Array<{ canonical_name?: string | null; address?: string | null }> | null
}

export async function inferMissingCruiseDatesFromPortCalls(
  supabase: SupabaseClient,
  bookings: ParsedBooking[],
  emit: (e: FunnelEvent) => void,
  now = new Date(),
): Promise<void> {
  const targets = bookings.filter(
    b => b.cruiseShipId && !b.tourDate && !b.cruisePortCallId,
  )
  if (targets.length === 0) {
    emit({ event: 'cruise_date_infer_done', data: { attempted: 0, inferred: 0, ambiguous: 0 } })
    return
  }

  emit({ event: 'cruise_date_infer_start', data: { attempted: targets.length } })
  const t0 = performance.now()
  const fromDate = kstDateOffset(1, now)
  const toDate = kstDateOffset(60, now)
  const byShip = new Map<string, Promise<PortCallCandidate[]>>()
  let inferred = 0
  let ambiguous = 0

  await Promise.all(targets.map(async (b) => {
    const shipId = b.cruiseShipId
    if (!shipId) return
    try {
      let promise = byShip.get(shipId)
      if (!promise) {
        promise = fetchUpcomingPortCalls(supabase, shipId, fromDate, toDate)
        byShip.set(shipId, promise)
      }
      const calls = await promise
      const picked = pickPortCallForUndatedBooking(b, calls, fromDate)
      if (picked.status === 'matched') {
        b.tourDate = kstDateFromIso(picked.call.arrival_at) ?? undefined
        b.cruisePortCallId = picked.call.id
        if (picked.multiple) b.cruisePortCallMultiple = true
        inferred++
      } else if (picked.status === 'ambiguous') {
        pushIssue(b, 'cruise_port_call_date_ambiguous')
        ambiguous++
      } else {
        pushIssue(b, 'cruise_port_call_date_missing')
      }
    } catch {
      pushIssue(b, 'cruise_port_call_date_missing')
    }
  }))

  emit({
    event: 'cruise_date_infer_done',
    data: {
      attempted: targets.length,
      inferred,
      ambiguous,
      fromDate,
      toDate,
      elapsed_ms: Math.round(performance.now() - t0),
    },
  })
}

export async function resolveAllCruisePortCalls(
  supabase: SupabaseClient,
  bookings: ParsedBooking[],
  emit: (e: FunnelEvent) => void,
): Promise<void> {
  const targets = bookings.filter(
    b => b.cruiseShipId && b.tourDate && !b.cruisePortCallId,
  )
  if (targets.length === 0) {
    emit({ event: 'cruise_port_call_resolve_done', data: { attempted: 0, resolved: 0 } })
    return
  }
  emit({ event: 'cruise_port_call_resolve_start', data: { attempted: targets.length } })
  const t0 = performance.now()
  let resolved = 0
  let ambiguous = 0
  const byShipDate = new Map<string, Promise<PortCallMatch>>()
  const findPortCallCached = (shipId: string, tourDate: string): Promise<PortCallMatch> => {
    const key = `${shipId}|${tourDate}`
    let promise = byShipDate.get(key)
    if (!promise) {
      promise = findPortCallByShipDate(supabase, shipId, tourDate).catch(() => null)
      byShipDate.set(key, promise)
    }
    return promise
  }

  await Promise.all(
    targets.map(async (b) => {
      const r = await findPortCallCached(b.cruiseShipId!, b.tourDate!)
      if (r) {
        b.cruisePortCallId = r.port_call_id
        if (r.multiple) {
          b.cruisePortCallMultiple = true
          pushIssue(b, 'cruise_port_call_multiple')
          ambiguous++
        }
        resolved++
      } else {
        b.cruisePortCallId = null
        pushIssue(b, 'cruise_port_call_unmatched')
      }
    }),
  )

  emit({
    event: 'cruise_port_call_resolve_done',
    data: {
      attempted: targets.length,
      unique: byShipDate.size,
      resolved,
      ambiguous,
      elapsed_ms: Math.round(performance.now() - t0),
    },
  })
}

async function fetchUpcomingPortCalls(
  supabase: SupabaseClient,
  shipId: string,
  fromDate: string,
  toDate: string,
): Promise<PortCallCandidate[]> {
  const { data } = await supabase
    .from('ops_cruise_port_calls')
    .select(`
      id, port_canonical_id, arrival_at, departure_at, terminal_info, prev_port, next_port,
      ops_pickup_locations(canonical_name, address)
    `)
    .eq('cruise_ship_id', shipId)
    .gte('arrival_at', `${fromDate}T00:00:00+09:00`)
    .lte('arrival_at', `${toDate}T23:59:59+09:00`)
    .order('arrival_at', { ascending: true })

  return Array.isArray(data) ? data as PortCallCandidate[] : []
}

type PickResult =
  | { status: 'matched'; call: PortCallCandidate; multiple: boolean }
  | { status: 'ambiguous' }
  | { status: 'none' }

function pickPortCallForUndatedBooking(
  booking: ParsedBooking,
  calls: PortCallCandidate[],
  tomorrowDate: string,
): PickResult {
  if (calls.length === 0) return { status: 'none' }

  const hint = portHintText(booking)
  if (hint) {
    const matching = calls.filter(call => portHintMatchesCall(hint, call))
    const tomorrowMatching = matching.filter(call => kstDateFromIso(call.arrival_at) === tomorrowDate)
    if (tomorrowMatching.length === 1) return { status: 'matched', call: tomorrowMatching[0], multiple: false }
    if (tomorrowMatching.length > 1) return { status: 'matched', call: tomorrowMatching[0], multiple: true }

    const dates = new Set(matching.map(call => kstDateFromIso(call.arrival_at)).filter(Boolean))
    if (matching.length === 1 && dates.size === 1) return { status: 'matched', call: matching[0], multiple: false }
    if (matching.length > 1) return { status: 'ambiguous' }
  }

  const tomorrowCalls = calls.filter(call => kstDateFromIso(call.arrival_at) === tomorrowDate)
  if (tomorrowCalls.length === 1) return { status: 'matched', call: tomorrowCalls[0], multiple: false }
  if (tomorrowCalls.length > 1) return { status: 'ambiguous' }
  return { status: 'none' }
}

function portHintText(booking: ParsedBooking): string {
  const raw = [
    booking.pickupPointNormalized,
    booking.pickupPointRaw,
    booking.productName,
    booking.notes,
  ].filter(Boolean).join(' ')
  return normalizePortText(raw)
}

function portHintMatchesCall(hint: string, call: PortCallCandidate): boolean {
  const port = pickupLocation(call.pickup_locations)
  const target = normalizePortText([
    port?.canonical_name,
    port?.address,
    call.terminal_info,
    call.prev_port,
    call.next_port,
  ].filter(Boolean).join(' '))

  if (!target) return false
  if (target.length >= 6 && hint.includes(target)) return true
  if (hint.length >= 6 && target.includes(hint)) return true

  return PORT_HINT_GROUPS.some(group =>
    group.keys.some(key => hint.includes(key))
    && group.targets.some(targetToken => target.includes(targetToken)),
  )
}

function pickupLocation(value: PortCallCandidate['pickup_locations']): { canonical_name?: string | null; address?: string | null } | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function normalizePortText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^0-9a-z\uAC00-\uD7A3]+/g, '')
}

const PORT_HINT_GROUPS: Array<{ keys: string[]; targets: string[] }> = [
  {
    keys: ['gangjeong', 'seogwipo', '\uAC15\uC815', '\uC11C\uADC0\uD3EC'],
    targets: ['gangjeong', 'seogwipo', '\uAC15\uC815', '\uC11C\uADC0\uD3EC'],
  },
  {
    keys: ['portofjeju', 'jejuport', 'jejuinternationalcruise', '\uC81C\uC8FC\uD56D'],
    targets: ['jeju', '\uC81C\uC8FC'],
  },
  {
    keys: ['busanport', 'busaninternationalcruise', 'yeongdo', '\uBD80\uC0B0', '\uC601\uB3C4'],
    targets: ['busan', 'yeongdo', '\uBD80\uC0B0', '\uC601\uB3C4'],
  },
  {
    keys: ['incheonport', 'incheoninternationalcruise', '\uC778\uCC9C'],
    targets: ['incheon', '\uC778\uCC9C'],
  },
]

function pushIssue(booking: ParsedBooking, issue: string): void {
  booking.issues ??= []
  if (!booking.issues.includes(issue)) booking.issues.push(issue)
}
