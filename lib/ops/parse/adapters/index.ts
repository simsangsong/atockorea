// Phase 0-bis — Adapter registry
// Master plan §6.2

import { csvAdapter } from './csv'
import { klookAdapter } from './klook'
import { klookEmailAdapter } from './klook-email'
import { getYourGuideAdapter } from './getyourguide'
import { groupedRosterAdapter } from './grouped-roster'
import { viatorAdapter } from './viator'
import { kkdayAdapter } from './kkday'
import { tripcomAdapter } from './stubs'
import type { PlatformAdapter } from './types'
import { ADAPTER_DETECT_THRESHOLD } from './types'

export const ADAPTERS: PlatformAdapter[] = [
  // 이메일 템플릿 어댑터를 명단-붙여넣기 어댑터보다 먼저 둔다. 동점일 때
  // 앞쪽이 이기는데(pickAdapter는 > 로만 갱신), Klook 확정메일은 명단용
  // klookAdapter도 부분 매칭해서 L3 재분할을 유발했던 이력이 있다.
  klookEmailAdapter,
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
