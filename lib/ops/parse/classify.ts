// Phase 27 §45 Sprint 27.0 — Input shape classifier.
//
// classifyShape(raw) labels a paste with a coarse "shape" so downstream stages
// (and Sprint A's completeness gate) can reason about provenance. In 27.0 this
// is a HINT only — it does NOT route parsing, so it is behavior-neutral. It
// reuses the existing adapter detect() scores (pickAdapter) and the same
// OTA-marker signals heuristics.detectPlatformFromLines() uses, then falls back
// to manual-shape signals (email headers, tab-delimited excel paste, driver
// roster, Korean / Chinese script ratio) with 'mixed' as the catch-all.
//
// Ordering rationale: a paste that carries TWO OR MORE distinct OTA markers is
// a multi-source operator roster (the v3/v5/cruise-manifest family) and must be
// 'mixed' even though one adapter's markers can cross the 0.8 detect threshold.
// So the "≥2 distinct OTA → mixed" test runs BEFORE trusting a single text
// adapter (klook/gyg). A structured CSV still wins (its own grammar is a strong
// single-source signal regardless of platform-column values).
//
// ReDoS-safety (master skill §45.5): every regex here is anchored or a literal
// alternation with no nested unbounded quantifier; '.' is avoided in favour of
// bounded classes / '[^\n]'. Validated against the v3 693-block corpus.

import { pickAdapter } from './adapters'

export type InputShape =
  | 'ota:klook'
  | 'ota:gyg'
  | 'ota:csv'
  | 'manual_kr'
  | 'manual_cn'
  | 'driver_list'
  | 'excel_paste'
  | 'email'
  | 'mixed'

// Cap the slice we inspect — classification is a cheap hint, and bounding the
// input also bounds regex exposure. The rows that matter are front-loaded.
const HEAD = 8000

// OTA platform markers — mirror of heuristics.detectPlatformFromLines() + the
// adapter header/ref signals. Used to count DISTINCT platforms in a paste.
const OTA_MARKERS: Array<{ id: string; re: RegExp }> = [
  { id: 'klook', re: /클룩|klook/i },
  { id: 'gyg', re: /겟유?가이드|getyourguide|\bGYG[A-Z0-9]/i },
  { id: 'viator', re: /비아토르|viator|\bBR-\d/i },
  { id: 'kkday', re: /kkday|케이케이데이|\b\d{2}KK\d{6}/i },
  { id: 'tripcom', re: /트립닷컴|tripcom|trip\.com/i },
]

const EMAIL_HEADER_RE = /^(?:From|To|Cc|Subject|Sent|Date|보낸사람|받는사람|제목|날짜)\s*:/gim
const FORWARD_RE = /-{3,}\s*(?:Original Message|Forwarded message|전달된 메시지)|^On\s[^\n]{0,80}\swrote:/im
const DRIVER_RE = /\d+\s*호차|기사\s*(?:님|배정|명단)|배차|차량\s*배정|기사명단|호차\s*배정/

const KOREAN_RE = /[가-힣]/g
const HAN_RE = /[一-鿿]/g
const KANA_RE = /[぀-ヿ]/g

export function classifyShape(raw: string): InputShape {
  if (!raw || raw.trim().length === 0) return 'mixed'
  const head = raw.slice(0, HEAD)

  // 1. Email / forwarded message — needs ≥2 header lines (or a forward marker)
  //    so a stray "Subject:" inside an OTA export doesn't misfire.
  if (looksLikeEmail(head)) return 'email'

  // Distinct OTA platforms present in the head.
  const distinctOta = OTA_MARKERS.filter(m => m.re.test(head)).length

  // 2. Structured CSV/Excel grammar is a strong single-source signal — trust it
  //    even if a platform column lists multiple OTA names.
  const adapter = pickAdapter(raw)
  if (adapter?.id === 'csv') return 'ota:csv'

  // 3. Multi-source operator roster (≥2 distinct OTA markers) → mixed. Runs
  //    BEFORE trusting a single text adapter, because klook+gyg+viator pastes
  //    let one adapter cross 0.8 yet are genuinely mixed.
  if (distinctOta >= 2) return 'mixed'

  // 4. Clean single-platform text export (adapter detect ≥ 0.8, one OTA marker).
  if (adapter?.id === 'klook') return 'ota:klook'
  if (adapter?.id === 'gyg') return 'ota:gyg'
  // viator/kkday/tripcom adapters are stubs (detect:0) so never reach here.

  // 5. Tab-delimited excel paste that wasn't clean enough for the CSV adapter.
  if (looksLikeExcelPaste(head)) return 'excel_paste'

  // 6. Driver / vehicle roster.
  if (DRIVER_RE.test(head)) return 'driver_list'

  // 7. Script-dominant manual rosters.
  const ko = (head.match(KOREAN_RE) ?? []).length
  const han = (head.match(HAN_RE) ?? []).length
  const kana = (head.match(KANA_RE) ?? []).length

  // Chinese handwritten: Han present, no Hangul, no kana.
  if (han >= 4 && ko === 0 && kana === 0) return 'manual_cn'
  // Korean operator roster: Hangul is the dominant CJK script.
  if (ko >= 2 && ko >= han) return 'manual_kr'
  // A lone OTA marker inside an otherwise-Korean paste still reads as manual_kr.
  if (distinctOta >= 1 && ko >= 2) return 'manual_kr'

  // 8. Catch-all.
  return 'mixed'
}

function looksLikeEmail(head: string): boolean {
  const headerLines = (head.match(EMAIL_HEADER_RE) ?? []).length
  if (headerLines >= 2) return true
  return FORWARD_RE.test(head)
}

function looksLikeExcelPaste(head: string): boolean {
  const lines = head.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 8)
  if (lines.length < 2) return false
  const tabbed = lines.filter(l => l.includes('\t'))
  if (tabbed.length < Math.max(2, Math.ceil(lines.length * 0.6))) return false
  // Consistent-ish column count across the tab-delimited lines.
  const cols = tabbed.map(l => l.split('\t').length)
  const first = cols[0]
  if (first < 2) return false
  const consistent = cols.filter(c => Math.abs(c - first) <= 1).length
  return consistent >= Math.ceil(cols.length * 0.6)
}
