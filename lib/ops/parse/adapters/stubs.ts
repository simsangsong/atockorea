// Phase 0-bis — Stub adapters
// Master plan §6.2 — "Others stubbed with detect() → 0 until traffic justifies".
// When traffic appears, promote a stub to its own file and implement parse().
// Viator + KKday graduated to ./viator.ts + ./kkday.ts (OTA email ingest 2026-06-21).

import type { PlatformAdapter } from './types'

function stub(id: string, label: string): PlatformAdapter {
  return {
    id,
    label,
    detect: () => 0,
    parse: (raw: string) => ({ bookings: [], leftover: [raw] }),
  }
}

export const tripcomAdapter = stub('tripcom', 'Trip.com')
