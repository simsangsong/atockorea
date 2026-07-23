// Regression test for L2 heuristics + L2.5 active rules coverage on real
// bulk historical data. Fixtures (tmp/bulk-jeju*.txt) contain customer PII
// and are .gitignored — the describe block auto-skips when they're absent
// so CI / fresh clones don't error.
//
// To run locally: place the fixture files under tmp/ then `npx vitest run
// src/lib/parse/__tests__/bulk-jeju-coverage.test.ts`.

import * as fs from 'node:fs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { heuristicExtract } from '../heuristics'
import { applyRules, tryCompile } from '../rules'

import { SIX_REMAINING_ACTIVE_RULES } from './fixtures/active-rules'

// Phase 26 §44.10 — measure field-completion rate per fixture. The new
// Phase 26 invariant: L2 + L2.5 (deterministic layers) must fill
// `language` / `whatsapp` / `notes` from source signals; pre-Phase-26,
// only ~15% (L3-only path) reached the UI with these populated.
function reportFieldCompletion(label: string, bookings: { language?: string; whatsapp?: string; notes?: string; phone?: string }[]) {
  if (bookings.length === 0) return
  const pct = (n: number) => `${((n / bookings.length) * 100).toFixed(0)}%`.padStart(5)
  const lang = bookings.filter(b => b.language).length
  const wa = bookings.filter(b => b.whatsapp).length
  const notes = bookings.filter(b => b.notes).length
  console.log(`─── ${label} field completion ─────────────────────`)
  console.log(`  language: ${String(lang).padStart(3)}/${bookings.length} (${pct(lang)})`)
  console.log(`  whatsapp: ${String(wa).padStart(3)}/${bookings.length} (${pct(wa)})`)
  console.log(`  notes:    ${String(notes).padStart(3)}/${bookings.length} (${pct(notes)})`)
  console.log('')
}

// Skip the whole block if the local PII fixture is absent (CI / fresh clone).
// The .gitignore excludes /tmp/, so /tmp/bulk-jeju.txt and bulk-jeju-v2.txt
// only exist on developer machines where parser regression matters.
const v1Path = path.join(process.cwd(), 'tmp', 'bulk-jeju.txt')
const v2Path = path.join(process.cwd(), 'tmp', 'bulk-jeju-v2.txt')
const v3Path = path.join(process.cwd(), 'tmp', 'bulk-jeju-v3.txt')
const v4Path = path.join(process.cwd(), 'tmp', 'bulk-jeju-v4.txt')
const v5Path = path.join(process.cwd(), 'tmp', 'bulk-jeju-v5.txt')
const fixturesPresent = fs.existsSync(v1Path)
const describeIfFixtures = fixturesPresent ? describe : describe.skip

describeIfFixtures('bulk-jeju coverage — funnel L2 + active rules', () => {
  // Guarded: describe.skip still evaluates this body at collection time, so a
  // bare readFileSync would throw ENOENT on CI / fresh clones (where the PII
  // fixture is absent). fixturesPresent is false there and the tests are skipped.
  const raw = fixturesPresent ? readFileSync(v1Path, 'utf-8') : ''

  it('measures coverage and surfaces leftover blocks', () => {
    // Step 1 — split into blocks (mirrors funnel/heuristics block split)
    const allBlocks = raw.split(/\n\s*\n+/).map(b => b.trim()).filter(b => b.length > 0)

    // Step 2 — run L2 heuristics on the entire paste at once
    const l2Result = heuristicExtract(raw)

    // Step 3 — run remaining active rules on L2 leftover (this simulates L2.5)
    const l25Result = applyRules(SIX_REMAINING_ACTIVE_RULES, l2Result.leftover)

    const totalEmitted = l2Result.bookings.length + l25Result.bookings.length
    const finalLeftover = l25Result.leftover

    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' BULK JEJU — L2 + L2.5 coverage report')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`  Total raw blocks (post-split):      ${allBlocks.length}`)
    console.log(`  L2 heuristics emitted:              ${l2Result.bookings.length}`)
    console.log(`  L2 leftover (sent to L2.5):         ${l2Result.leftover.length}`)
    console.log(`  L2.5 active rules emitted:          ${l25Result.bookings.length}`)
    console.log(`  Final leftover (would go to L3):    ${finalLeftover.length}`)
    console.log(`  ────────────────────────────────────────────────────`)
    console.log(`  Total deterministic emit:           ${totalEmitted}`)
    console.log(`  L3 escalation rate:                 ${((finalLeftover.length / allBlocks.length) * 100).toFixed(1)}%`)
    console.log('')
    reportFieldCompletion('Phase 26', [...l2Result.bookings, ...l25Result.bookings])
    console.log('')

    if (finalLeftover.length > 0) {
      console.log('─── ALL leftover blocks ──────────────────────────────────────')
      for (let i = 0; i < finalLeftover.length; i++) {
        const block = finalLeftover[i]
        const isJustHeader = block.length < 30 && !block.includes('@') && !/\(\d+/.test(block)
        const tag = isJustHeader ? '[HEADER/DATE]' : '[REAL BOOKING?]'
        console.log(`\n[#${i + 1}] ${tag} ${'-'.repeat(50)}`)
        console.log(block)
      }
      console.log('')
    }

    if (l2Result.bookings.length > 0) {
      // Platform distribution
      const byPlatform = new Map<string, number>()
      for (const b of l2Result.bookings) {
        byPlatform.set(b.sourcePlatform, (byPlatform.get(b.sourcePlatform) ?? 0) + 1)
      }
      console.log('─── Platform distribution (L2 emit) ─────────────────────────')
      for (const [p, n] of Array.from(byPlatform.entries()).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${p.padEnd(10)} ${n}`)
      }
      console.log('')

      // Sample tricky formats
      console.log('─── Sample GYG (N Adults) short-form ────────────────────────')
      const gygShort = l2Result.bookings.find(b => b.externalBookingId?.startsWith('GYG') && b.partySize > 0)
      if (gygShort) {
        console.log(`  ${gygShort.leadName} | party=${gygShort.partySize} | ref=${gygShort.externalBookingId} | platform=${gygShort.sourcePlatform}`)
      } else {
        console.log('  none found')
      }

      console.log('─── Sample Viator (1 Adult) short-form ──────────────────────')
      const viatorShort = l2Result.bookings.find(b => b.externalBookingId?.startsWith('BR-') && b.partySize > 0)
      if (viatorShort) {
        console.log(`  ${viatorShort.leadName} | party=${viatorShort.partySize} | ref=${viatorShort.externalBookingId} | platform=${viatorShort.sourcePlatform}`)
      }

      console.log('─── Sample CJK Chinese name (秋蓉 陳) ───────────────────────')
      const cjk = l2Result.bookings.find(b => /[一-鿿]/.test(b.leadName))
      if (cjk) {
        console.log(`  ${cjk.leadName} | party=${cjk.partySize} | ref=${cjk.externalBookingId} | platform=${cjk.sourcePlatform}`)
      } else {
        console.log('  none found')
      }
      console.log('')
    }

    // Regression guards — current baseline is L2 emitting 107 real bookings
    // (~99% coverage). The "Hungyu fen 공항 1명 …" freeform note is now rescued
    // by the bare-roster parser (was the lone non-header leftover); the rest of
    // leftover is section headers ("남쪽", "동쪽", "제주도 1월 10일", …).
    // Drop in deterministic emit ⇒ regression.
    expect(allBlocks.length).toBe(133)
    expect(l2Result.bookings.length).toBeGreaterThanOrEqual(107)
    expect(finalLeftover.length).toBeLessThanOrEqual(27)

    // Quality regression guards: every emitted booking should have a real
    // platform (not 'manual' unless the block lacked any OTA marker) and a
    // real party size (not the broken default of 1 for every booking).
    const platformDist = new Map<string, number>()
    for (const b of l2Result.bookings) {
      platformDist.set(b.sourcePlatform, (platformDist.get(b.sourcePlatform) ?? 0) + 1)
    }
    // klook + viator + kkday + gyg should dominate; manual should be <10%
    const manualCount = platformDist.get('manual') ?? 0
    expect(manualCount / l2Result.bookings.length).toBeLessThan(0.1)

    // Party size diversity — broken heuristic returned 1 for every booking.
    const distinctPartySizes = new Set(l2Result.bookings.map(b => b.partySize))
    expect(distinctPartySizes.size).toBeGreaterThanOrEqual(3)
  })

  it('verifies each remaining active rule compiles', () => {
    for (const r of SIX_REMAINING_ACTIVE_RULES) {
      const compiled = tryCompile(r.template_pattern)
      expect(compiled).not.toBeNull()
    }
  })

  ;((fs.existsSync(v2Path)) ? it : it.skip)('measures v2 coverage (PDF-extracted + slash-separated + new platforms)', () => {
    const raw = readFileSync(v2Path, 'utf-8')
    const allBlocks = raw.split(/\n\s*\n+/).map(b => b.trim()).filter(b => b.length > 0)
    const l2Result = heuristicExtract(raw)
    const l25Result = applyRules(SIX_REMAINING_ACTIVE_RULES, l2Result.leftover)
    const totalEmitted = l2Result.bookings.length + l25Result.bookings.length
    const finalLeftover = l25Result.leftover

    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' BULK JEJU v2 — coverage report (new formats)')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`  Total raw blocks:                   ${allBlocks.length}`)
    console.log(`  L2 heuristics emitted:              ${l2Result.bookings.length}`)
    console.log(`  L2 leftover:                        ${l2Result.leftover.length}`)
    console.log(`  L2.5 active rules emitted:          ${l25Result.bookings.length}`)
    console.log(`  Final leftover (L3):                ${finalLeftover.length}`)
    console.log(`  Total deterministic emit:           ${totalEmitted}`)
    console.log(`  L3 escalation rate:                 ${((finalLeftover.length / allBlocks.length) * 100).toFixed(1)}%`)
    console.log('')
    reportFieldCompletion('Phase 26', [...l2Result.bookings, ...l25Result.bookings])

    // Platform distribution
    const byPlatform = new Map<string, number>()
    for (const b of [...l2Result.bookings, ...l25Result.bookings]) {
      byPlatform.set(b.sourcePlatform, (byPlatform.get(b.sourcePlatform) ?? 0) + 1)
    }
    console.log('')
    console.log('─── Platform distribution ───────────────────────────────────')
    for (const [p, n] of Array.from(byPlatform.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${p.padEnd(10)} ${n}`)
    }
    console.log('')

    console.log('─── ALL leftover blocks (need new pattern) ──────────────────')
    for (let i = 0; i < finalLeftover.length; i++) {
      const block = finalLeftover[i]
      const isJustHeader = block.length < 30 && !block.includes('@') && !/\(\d+/.test(block)
      const tag = isJustHeader ? '[HEADER]' : '[REAL BOOKING?]'
      console.log(`\n[#${i + 1}] ${tag} ${'-'.repeat(50)}`)
      console.log(block.length > 300 ? block.slice(0, 300) + '...' : block)
    }
    console.log('')

    expect(allBlocks.length).toBeGreaterThan(60)
  })

  ;((fs.existsSync(v3Path)) ? it : it.skip)('measures v3 coverage (KakaoTalk HTML export — 남쪽/서남쪽/부산항/9월 cruise mix)', () => {
    const raw = readFileSync(v3Path, 'utf-8')
    const allBlocks = raw.split(/\n\s*\n+/).map(b => b.trim()).filter(b => b.length > 0)
    const l2Result = heuristicExtract(raw)
    const l25Result = applyRules(SIX_REMAINING_ACTIVE_RULES, l2Result.leftover)
    const totalEmitted = l2Result.bookings.length + l25Result.bookings.length
    const finalLeftover = l25Result.leftover

    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' BULK JEJU v3 — coverage report')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`  Total raw blocks:                   ${allBlocks.length}`)
    console.log(`  L2 heuristics emitted:              ${l2Result.bookings.length}`)
    console.log(`  L2 leftover:                        ${l2Result.leftover.length}`)
    console.log(`  L2.5 active rules emitted:          ${l25Result.bookings.length}`)
    console.log(`  Final leftover (L3):                ${finalLeftover.length}`)
    console.log(`  Total deterministic emit:           ${totalEmitted}`)
    console.log(`  L3 escalation rate:                 ${((finalLeftover.length / allBlocks.length) * 100).toFixed(1)}%`)
    console.log('')
    reportFieldCompletion('Phase 26', [...l2Result.bookings, ...l25Result.bookings])

    // Platform distribution
    const byPlatform = new Map<string, number>()
    for (const b of [...l2Result.bookings, ...l25Result.bookings]) {
      byPlatform.set(b.sourcePlatform, (byPlatform.get(b.sourcePlatform) ?? 0) + 1)
    }
    console.log('')
    console.log('─── Platform distribution ───────────────────────────────────')
    for (const [p, n] of Array.from(byPlatform.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${p.padEnd(10)} ${n}`)
    }

    // Per-rule hits at L2.5
    console.log('')
    console.log('─── L2.5 per-rule hits ──────────────────────────────────────')
    for (const [id, n] of Object.entries(l25Result.perRuleHits).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${id.slice(0, 8)}  ${n}`)
    }

    // Dump ALL leftover blocks to tmp/ for offline triage.
    const dumpPath = path.join(process.cwd(), 'tmp', 'bulk-jeju-v3-leftover.txt')
    const dump = finalLeftover.map((b, i) => `[#${i + 1}] ${'-'.repeat(60)}\n${b}`).join('\n\n')
    fs.writeFileSync(dumpPath, dump, 'utf-8')
    console.log(`\n(full leftover dump written to ${dumpPath})`)

    console.log('')
    console.log('─── Leftover blocks (first 40, truncated) ───────────────────')
    const maxLeftoverShown = Math.min(40, finalLeftover.length)
    for (let i = 0; i < maxLeftoverShown; i++) {
      const block = finalLeftover[i]
      const isJustHeader = block.length < 30 && !block.includes('@') && !/\(\d+/.test(block)
      const tag = isJustHeader ? '[HEADER]' : '[REAL?]'
      console.log(`\n[#${i + 1}] ${tag} ${'-'.repeat(50)}`)
      console.log(block.length > 400 ? block.slice(0, 400) + '...' : block)
    }
    if (finalLeftover.length > maxLeftoverShown) {
      console.log(`\n... and ${finalLeftover.length - maxLeftoverShown} more`)
    }
    console.log('')

    expect(allBlocks.length).toBeGreaterThan(200)
  })

  ;((fs.existsSync(v4Path)) ? it : it.skip)('measures v4 coverage (numbered N./N번. multi-line operator format)', () => {
    const raw = readFileSync(v4Path, 'utf-8')
    const allBlocks = raw.split(/\n\s*\n+/).map(b => b.trim()).filter(b => b.length > 0)
    const l2Result = heuristicExtract(raw)
    const l25Result = applyRules(SIX_REMAINING_ACTIVE_RULES, l2Result.leftover)
    const totalEmitted = l2Result.bookings.length + l25Result.bookings.length
    const finalLeftover = l25Result.leftover

    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' BULK JEJU v4 — coverage report')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`  Total raw blocks:                   ${allBlocks.length}`)
    console.log(`  L2 heuristics emitted:              ${l2Result.bookings.length}`)
    console.log(`  L2 leftover:                        ${l2Result.leftover.length}`)
    console.log(`  L2.5 active rules emitted:          ${l25Result.bookings.length}`)
    console.log(`  Final leftover (L3):                ${finalLeftover.length}`)
    console.log(`  Total deterministic emit:           ${totalEmitted}`)
    console.log(`  L3 escalation rate:                 ${((finalLeftover.length / allBlocks.length) * 100).toFixed(1)}%`)
    console.log('')
    reportFieldCompletion('Phase 26', [...l2Result.bookings, ...l25Result.bookings])

    const byPlatform = new Map<string, number>()
    for (const b of [...l2Result.bookings, ...l25Result.bookings]) {
      byPlatform.set(b.sourcePlatform, (byPlatform.get(b.sourcePlatform) ?? 0) + 1)
    }
    console.log('')
    console.log('─── Platform distribution ───────────────────────────────────')
    for (const [p, n] of Array.from(byPlatform.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${p.padEnd(10)} ${n}`)
    }

    console.log('')
    console.log('─── L2.5 per-rule hits ──────────────────────────────────────')
    for (const [id, n] of Object.entries(l25Result.perRuleHits).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${id.slice(0, 8)}  ${n}`)
    }

    // Dump all leftover for triage.
    const dumpPath = path.join(process.cwd(), 'tmp', 'bulk-jeju-v4-leftover.txt')
    const dump = finalLeftover.map((b, i) => `[#${i + 1}] ${'-'.repeat(60)}\n${b}`).join('\n\n')
    fs.writeFileSync(dumpPath, dump, 'utf-8')
    console.log(`\n(full leftover dump written to ${dumpPath})`)

    expect(allBlocks.length).toBeGreaterThan(200)
  })

  ;((fs.existsSync(v5Path)) ? it : it.skip)('measures v5 coverage (ATOC KOREA multi-platform slash export — 클룩/겟유가이드/비아토르)', () => {
    const raw = readFileSync(v5Path, 'utf-8')
    const allBlocks = raw.split(/\n\s*\n+/).map(b => b.trim()).filter(b => b.length > 0)
    const l2Result = heuristicExtract(raw)
    const l25Result = applyRules(SIX_REMAINING_ACTIVE_RULES, l2Result.leftover)
    const totalEmitted = l2Result.bookings.length + l25Result.bookings.length
    const finalLeftover = l25Result.leftover

    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(' BULK JEJU v5 — coverage report')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`  Total raw blocks:                   ${allBlocks.length}`)
    console.log(`  L2 heuristics emitted:              ${l2Result.bookings.length}`)
    console.log(`  L2 leftover:                        ${l2Result.leftover.length}`)
    console.log(`  L2.5 active rules emitted:          ${l25Result.bookings.length}`)
    console.log(`  Final leftover (L3):                ${finalLeftover.length}`)
    console.log(`  Total deterministic emit:           ${totalEmitted}`)
    console.log(`  L3 escalation rate:                 ${((finalLeftover.length / allBlocks.length) * 100).toFixed(1)}%`)
    console.log('')
    reportFieldCompletion('Phase 26', [...l2Result.bookings, ...l25Result.bookings])

    const byPlatform = new Map<string, number>()
    for (const b of [...l2Result.bookings, ...l25Result.bookings]) {
      byPlatform.set(b.sourcePlatform, (byPlatform.get(b.sourcePlatform) ?? 0) + 1)
    }
    console.log('')
    console.log('─── Platform distribution ───────────────────────────────────')
    for (const [p, n] of Array.from(byPlatform.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${p.padEnd(10)} ${n}`)
    }

    // Pickup completion — operator's #1 complaint was "all missing_pickup".
    const allEmit = [...l2Result.bookings, ...l25Result.bookings]
    const withPickup = allEmit.filter(b => b.pickupPointRaw || b.pickupPointNormalized).length
    console.log('')
    console.log(`─── Pickup present: ${withPickup}/${allEmit.length} ───`)

    // Bad lead names — the "Traveler N: Dietary..." class.
    const badNames = allEmit.filter(b => /dietary|restriction|traveler/i.test(b.leadName ?? ''))
    console.log(`─── Suspect lead names (dietary/traveler): ${badNames.length} ───`)
    for (const b of badNames.slice(0, 10)) console.log(`    "${b.leadName}"`)

    console.log('')
    console.log('─── L2.5 per-rule hits ──────────────────────────────────────')
    for (const [id, n] of Object.entries(l25Result.perRuleHits).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${id.slice(0, 8)}  ${n}`)
    }

    const dumpPath = path.join(process.cwd(), 'tmp', 'bulk-jeju-v5-leftover.txt')
    const dump = finalLeftover.map((b, i) => `[#${i + 1}] ${'-'.repeat(60)}\n${b}`).join('\n\n')
    fs.writeFileSync(dumpPath, dump, 'utf-8')
    console.log(`\n(full leftover dump written to ${dumpPath})`)

    expect(allBlocks.length).toBeGreaterThan(60)
  })
})
