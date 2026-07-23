// Phase 0 / §5.1 pickup canonicalization backstop for the funnel.
//
// After every extraction layer emits bookings, this step fills
// `pickupPointNormalized` for any booking that has `pickupPointRaw`. Large OTA
// pastes repeat the same few pickup points hundreds of times, so the backstop
// resolves each unique raw pickup once and applies the result to every row.

import type { ParsedBooking } from '@/lib/ops/parse/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canonicalizePickup } from '@/lib/ops/pickup/canonicalize'
import type { FunnelEvent } from './funnel-events'

export async function canonicalizeAllPickups(
  bookings: ParsedBooking[],
  tenantId: string,
  emit: (e: FunnelEvent) => void,
  supabase?: SupabaseClient,
): Promise<void> {
  const targets = bookings.filter(b => !b.pickupPointNormalized && b.pickupPointRaw)
  if (targets.length === 0) {
    emit({ event: 'canonicalize_done', data: { attempted: 0, unique: 0, resolved: 0 } })
    return
  }

  const byRaw = new Map<string, ParsedBooking[]>()
  for (const booking of targets) {
    const raw = booking.pickupPointRaw?.trim()
    if (!raw) continue
    const key = raw.toLocaleLowerCase()
    const rows = byRaw.get(key) ?? []
    rows.push(booking)
    byRaw.set(key, rows)
  }

  emit({ event: 'canonicalize_start', data: { attempted: targets.length, unique: byRaw.size } })
  const t0 = performance.now()
  let resolved = 0

  await Promise.all(
    Array.from(byRaw.values()).map(async (rows) => {
      const raw = rows[0]?.pickupPointRaw?.trim()
      if (!raw) return
      try {
        const result = await canonicalizePickup(raw, tenantId, undefined, supabase)
        if (result.canonical_name && result.confidence >= 0.85) {
          for (const booking of rows) {
            booking.pickupPointNormalized = result.canonical_name
          }
          resolved += rows.length
        }
      } catch {
        // Best-effort: keep the raw value; the learning loop can queue it.
      }
    }),
  )

  emit({
    event: 'canonicalize_done',
    data: {
      attempted: targets.length,
      unique: byRaw.size,
      resolved,
      elapsed_ms: Math.round(performance.now() - t0),
    },
  })
}
