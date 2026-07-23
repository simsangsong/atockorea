// Phase 0-bis — Adapter registry
// Master plan §6.2

import { csvAdapter } from './csv'
import { klookAdapter } from './klook'
import { getYourGuideAdapter } from './getyourguide'
import { groupedRosterAdapter } from './grouped-roster'
import { viatorAdapter } from './viator'
import { kkdayAdapter } from './kkday'
import { tripcomAdapter } from './stubs'
import type { PlatformAdapter } from './types'
import { ADAPTER_DETECT_THRESHOLD } from './types'

export const ADAPTERS: PlatformAdapter[] = [
  klookAdapter,
  getYourGuideAdapter,
  csvAdapter,
  groupedRosterAdapter,
  viatorAdapter,
  kkdayAdapter,
  tripcomAdapter,
]

/**
 * Pick the highest-scoring adapter for a raw paste.
 * Returns `null` if no adapter scores at or above the detect threshold (0.8).
 */
export function pickAdapter(raw: string): PlatformAdapter | null {
  let best: { adapter: PlatformAdapter; score: number } | null = null
  for (const a of ADAPTERS) {
    const score = a.detect(raw)
    if (!best || score > best.score) best = { adapter: a, score }
  }
  if (!best || best.score < ADAPTER_DETECT_THRESHOLD) return null
  return best.adapter
}

export { ADAPTER_DETECT_THRESHOLD }
export type { PlatformAdapter, AdapterResult } from './types'
