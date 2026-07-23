// Cruise ship backstop. Runs after all extraction layers and fills
// cruiseShipId from cruiseShipText. It also lifts ship names that were
// accidentally captured in pickup, notes, or product text.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBooking } from '@/lib/ops/parse/types'
import { resolveCruiseShipId } from '@/lib/ops/cruise/resolve-ship-id'
import type { FunnelEvent } from './funnel-events'

type ShipResolution = Awaited<ReturnType<typeof resolveCruiseShipId>>

// Cheap pre-gate for ship lifting. Use unicode escapes so this file stays
// stable across PowerShell/codepage output.
//
// The latin ship-brand keywords are word-bounded (\b\u2026\b): a brand name only
// signals cruise context when it stands as a whole token, never when it is
// embedded in a longer alphanumeric run. Without this, a LINE/WeChat id like
// "_princesspayapa" (contains "princess") trips the gate on a regular bus tour,
// and the resolver then fuzzy-matches it to "Diamond Princess" \u2014 a false ship
// on a non-cruise booking. The Korean / structural terms (\uD06C\uB8E8\uC988, cruise,
// terminals, flight number) stay unbounded; they don't embed false-positively.
const CRUISE_CONTEXT_RE =
  /\uD06C\uB8E8\uC988|cruise|\uC2A4\uBAA8\s*\uADF8\uB8F9|\uAC15\uC815|\uBD80\uC0B0\uD56D|\uC81C\uC8FC\uD56D|\uC778\uCC9C\uD56D|\uD06C\uB8E8\uC988\uC120|flight\s*number|cruise\s*terminal|\b(?:royal\s*carib|celebrity|princess|norwegian|costa|ovation|anthem|equinox|millennium|diamond|spectrum)\b/i

function hasCruiseContext(b: ParsedBooking): boolean {
  return CRUISE_CONTEXT_RE.test(
    `${b.productName ?? ''} ${b.pickupPointRaw ?? ''} ${b.pickupPointNormalized ?? ''} ${b.notes ?? ''}`,
  )
}

export async function resolveAllCruiseShips(
  supabase: SupabaseClient,
  bookings: ParsedBooking[],
  tenantId: string,
  emit: (e: FunnelEvent) => void,
): Promise<void> {
  const shipCache = new Map<string, Promise<ShipResolution>>()
  const resolveShipCached = (text: string | null | undefined): Promise<ShipResolution> => {
    const trimmed = text?.trim()
    const key = trimmed?.toLocaleLowerCase()
    if (!trimmed || !key) return Promise.resolve(null)
    let promise = shipCache.get(key)
    if (!promise) {
      promise = resolveCruiseShipId(supabase, trimmed, tenantId).catch(() => null)
      shipCache.set(key, promise)
    }
    return promise
  }

  let lifted = 0
  let liftedFromText = 0

  await Promise.all(
    bookings
      .filter(b => !b.cruiseShipText && hasCruiseContext(b))
      .map(async (b) => {
        const pickupMatch = await resolveShipCached(b.pickupPointRaw)
        if (pickupMatch) {
          b.cruiseShipText = pickupMatch.canonical_name
          b.cruiseShipId = pickupMatch.id
          b.pickupPointRaw = undefined
          b.pickupPointNormalized = undefined
          lifted++
          return
        }

        for (const src of [b.notes, b.productName]) {
          const match = await resolveShipCached(src)
          if (match) {
            b.cruiseShipText = match.canonical_name
            b.cruiseShipId = match.id
            liftedFromText++
            return
          }
          const rawShip = extractSourceShipText(src)
          if (rawShip) {
            b.cruiseShipText = rawShip
            b.cruiseShipId = null
            pushIssue(b, 'cruise_ship_unmatched')
            liftedFromText++
            return
          }
        }
      }),
  )

  if (lifted > 0) emit({ event: 'cruise_ship_lifted_from_pickup', data: { lifted } })
  if (liftedFromText > 0) emit({ event: 'cruise_ship_lifted_from_pickup', data: { lifted: liftedFromText, source: 'text' } })

  // Hard Rule #18 (signal-absent → review, never fabricate): a cruise booking
  // that carries no ship signal anywhere is flagged for operator review. The
  // cruise message template needs the ship, so a silent blank is a defect — but
  // inventing one is worse. GetYourGuide cruise rows structurally omit it.
  let missing = 0
  for (const b of bookings) {
    if (!b.cruiseShipText && hasCruiseContext(b)) {
      pushIssue(b, 'cruise_ship_missing')
      missing++
    }
  }

  const targets = bookings.filter(b => b.cruiseShipText && !b.cruiseShipId)
  if (targets.length === 0) {
    emit({ event: 'cruise_ship_resolve_done', data: { attempted: 0, resolved: 0, missing } })
    return
  }

  emit({ event: 'cruise_ship_resolve_start', data: { attempted: targets.length, unique: new Set(targets.map(b => b.cruiseShipText?.trim().toLocaleLowerCase()).filter(Boolean)).size } })
  const t0 = performance.now()
  let resolved = 0
  const methodCounts: Record<string, number> = {}

  await Promise.all(
    targets.map(async (b) => {
      const match = await resolveShipCached(b.cruiseShipText)
      if (match) {
        b.cruiseShipId = match.id
        b.cruiseShipText = match.canonical_name
        resolved++
        methodCounts[match.method] = (methodCounts[match.method] ?? 0) + 1
      } else {
        b.cruiseShipId = null
        pushIssue(b, 'cruise_ship_unmatched')
      }
    }),
  )

  emit({
    event: 'cruise_ship_resolve_done',
    data: {
      attempted: targets.length,
      unique: shipCache.size,
      resolved,
      missing,
      methods: methodCounts,
      elapsed_ms: Math.round(performance.now() - t0),
    },
  })
}

function extractSourceShipText(value: string | null | undefined): string | undefined {
  const text = value?.trim()
  if (!text) return undefined

  const match = text.match(
    /(?:크루즈선|선박\s*명?|Cruise\s*ship|Ship|항공편명|Flight\s*number)\s*(?:\([^)]*\))?\s*[:：]?\s*(.+)$/i,
  )
  if (!match) return undefined

  return cleanSourceShipText(match[1])
}

function cleanSourceShipText(raw: string): string | undefined {
  const value = raw
    .replace(/\s*(?:\||\/|;)?\s*(?:No\.?\s*of\s*participants|participants?|연락처|이메일|전화|Phone|WhatsApp|도착\s*정보|출발\s*정보|하선\s*시간|하차\s*위치)\s*[:：]?.*$/i, '')
    .replace(/[\/,;|:\s]+$/, '')
    .trim()

  if (value.length < 3) return undefined
  if (!/[A-Za-z가-힣一-鿿぀-ヿ]/.test(value)) return undefined
  if (/^(?:미정|unknown|none|null|n\/?a|-+|cruise\s*terminal|terminal|port)$/i.test(value)) return undefined
  return value
}

function pushIssue(booking: ParsedBooking, issue: string): void {
  booking.issues ??= []
  if (!booking.issues.includes(issue)) booking.issues.push(issue)
}
