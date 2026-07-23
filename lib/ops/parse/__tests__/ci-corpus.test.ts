// Phase 27 / Sprint 27.F — CI-safe parser corpus.
//
// Unlike bulk-jeju-coverage.test.ts (which reads PII fixtures from the
// .gitignored tmp/ and self-skips on a fresh clone), this test runs in CI on
// every checkout: it loads the SANITIZED, committed corpus
// `tests/fixtures/import/ci-bulk-jeju-sanitized.txt` (produced by
// `scripts/sanitize-fixture.mjs` from v3+v5 — names/phones/emails replaced,
// structure preserved) and asserts HARD thresholds so a deterministic-coverage
// regression fails the build. It also enforces a wall-clock budget as a
// ReDoS/catastrophic-backtracking guard (§45.5 defense line 4).

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { heuristicExtract } from '../heuristics'
import { applyRules, tryCompile } from '../rules'
import { SIX_REMAINING_ACTIVE_RULES } from './fixtures/active-rules'

const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'import', 'ci-bulk-jeju-sanitized.txt')
const raw = readFileSync(FIXTURE, 'utf-8')

// Multi-line handwritten roster (manual_kr) — the dominant real format. Already
// re-segmented to whole bookings (one per blank-separated block) + sanitized,
// so heuristics/rules run directly without maybeResegment (which segment.test.ts
// covers). Guards the 27.G-B segmentation + pickup-extraction work.
const MANUAL_FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'import', 'ci-manual-notes-sanitized.txt')
const manualRaw = readFileSync(MANUAL_FIXTURE, 'utf-8')

// Hard wall-clock budget for the full deterministic parse of this corpus.
// Real runtime is single-digit ms; a blown budget means catastrophic regex
// backtracking (ReDoS) crept into heuristics or an active rule.
const PARSE_BUDGET_MS = 2000

function runDeterministic(text: string) {
  const t0 = performance.now()
  const l2 = heuristicExtract(text)
  const l25 = applyRules(SIX_REMAINING_ACTIVE_RULES, l2.leftover)
  const elapsedMs = performance.now() - t0
  const bookings = [...l2.bookings, ...l25.bookings]
  return { l2, l25, bookings, elapsedMs }
}

describe('CI corpus — sanitized v3+v5 (no PII, runs on every checkout)', () => {
  it('compiles every active rule', () => {
    for (const r of SIX_REMAINING_ACTIVE_RULES) {
      expect(tryCompile(r.template_pattern)).not.toBeNull()
    }
  })

  it('meets deterministic coverage + field-completion thresholds', () => {
    const blocks = raw.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean)
    const { l2, bookings, elapsedMs } = runDeterministic(raw)

    const language = bookings.filter(b => b.language).length
    const pickup = bookings.filter(b => b.pickupPointRaw || b.pickupPointNormalized).length
    const badNames = bookings.filter(b => /dietary|restriction|traveler/i.test(b.leadName ?? '')).length
    const platforms = new Map<string, number>()
    for (const b of bookings) platforms.set(b.sourcePlatform, (platforms.get(b.sourcePlatform) ?? 0) + 1)
    const manual = platforms.get('manual') ?? 0
    const distinctPax = new Set(bookings.map(b => b.partySize)).size

    console.log('')
    console.log('═══ CI corpus (sanitized v3+v5) ═══')
    console.log(`  blocks                ${blocks.length}`)
    console.log(`  deterministic emit    ${bookings.length} (L2 ${l2.bookings.length})`)
    console.log(`  language complete     ${language}/${bookings.length}`)
    console.log(`  pickup complete       ${pickup}/${bookings.length}`)
    console.log(`  bad names             ${badNames}`)
    console.log(`  manual platform       ${manual}/${bookings.length}`)
    console.log(`  distinct party sizes  ${distinctPax}`)
    console.log(`  elapsed_ms            ${elapsedMs.toFixed(1)}`)
    console.log('')

    // Coverage floors — pinned just below the measured baseline (51 blocks →
    // 49 deterministic emit). A drop means a heuristic/rule regression.
    expect(blocks.length).toBe(51)
    expect(bookings.length).toBeGreaterThanOrEqual(48)

    // Field completion — these blocks carry explicit language + pickup tokens;
    // the deterministic layers must extract them (Phase 26 invariant).
    // Baseline: language 49/49 (100%), pickup 34/49 (69%).
    expect(language / bookings.length).toBeGreaterThanOrEqual(0.95)
    expect(pickup / bookings.length).toBeGreaterThanOrEqual(0.6)

    // Quality guards — the Dietary/Traveler trap must NOT become a lead name
    // (regression b7cf5b4); platform must be detected; pax must be diverse.
    expect(badNames).toBe(0)
    expect(manual / bookings.length).toBeLessThan(0.1)
    expect(distinctPax).toBeGreaterThanOrEqual(3)

    // ReDoS / catastrophic-backtracking guard (§45.5 defense line 4).
    expect(elapsedMs).toBeLessThan(PARSE_BUDGET_MS)
  })
})

describe('CI corpus — manual-notes (sanitized multi-line, 27.G-B)', () => {
  it('meets coverage + pickup + name-quality thresholds', () => {
    const blocks = manualRaw.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean)
    const { bookings, elapsedMs } = runDeterministic(manualRaw)

    const pickup = bookings.filter(b => b.pickupPointRaw || b.pickupPointNormalized).length
    const language = bookings.filter(b => b.language).length
    const badNames = bookings.filter(b =>
      /dietary|restriction|traveler/i.test(b.leadName ?? '') ||
      /^(?:비고|도착\s*정보|크루즈선|특별\s*요구사항)\s*[:：]/.test(b.leadName ?? ''),
    ).length

    console.log('')
    console.log('═══ CI corpus (manual-notes) ═══')
    console.log(`  blocks ${blocks.length} | emit ${bookings.length} | pickup ${pickup} | language ${language} | badNames ${badNames} | ${elapsedMs.toFixed(1)}ms`)
    console.log('')

    // Baseline: 50 blocks → 48 emit, 48 pickup, 48 language, 0 bad names.
    expect(blocks.length).toBe(50)
    expect(bookings.length).toBeGreaterThanOrEqual(46)
    // Multi-line manual pickup extraction (27.G-B): "<region> - <pickup>" header.
    expect(pickup / bookings.length).toBeGreaterThanOrEqual(0.9)
    expect(language / bookings.length).toBeGreaterThanOrEqual(0.9)
    // No section-header / note-label fragment may surface as a lead name.
    expect(badNames).toBe(0)
    expect(elapsedMs).toBeLessThan(PARSE_BUDGET_MS)
  })
})
