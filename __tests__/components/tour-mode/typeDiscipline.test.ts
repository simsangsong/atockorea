/**
 * U4-D7 — the tour-room typography scale is enforced, not advisory.
 *
 * tour-room-theme.css declares (U-D6) that tr-display / tr-title / tr-body-lg /
 * tr-body / tr-name / tr-card-text / tr-label / tr-meta are the ONLY text
 * sizes in tour-room components. The 2026-07-26 audit found ~290 violations —
 * Tailwind `text-sm`/`text-base`/arbitrary `text-[Npx]` — which silently opt
 * out of the --tr-font-scale accessibility slider (5 steps in Settings). This
 * suite makes the rule executable: a new violation fails CI with the file and
 * line, instead of eroding the scale one commit at a time.
 *
 * Also enforced: the lucide barrel (components/tour-mode/icons.ts, U-D3/U4-D6).
 * Components import icons from the barrel so the room's icon language stays
 * swappable in one place; direct `from 'lucide-react'` imports are only
 * allowed where listed below.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), 'components', 'tour-mode');

/** Tailwind font-size utilities (responsive/state variants, !important, any
 *  size step incl. 5xl+, and arbitrary px/rem/em values). */
const TEXT_UTILITY =
  /(?:^|[\s'"`:])!?text-(?:xs|sm|base|lg|\d?xl|\[\d+(?:\.\d+)?(?:px|rem|em)\])(?=$|[\s'"`])/;

/**
 * Known, justified exceptions. Each entry documents WHY it is allowed — do
 * not add to this list to silence the test; use the tr-* scale instead.
 */
const TEXT_ALLOWLIST: Record<string, { pattern: string; reason: string }[]> = {
  'ActionGrid.tsx': [
    // The "+" tray is user-protected as-is (plan §N, 2026-07-26): the Kakao-
    // style tile grid keeps its exact current look, labels included.
    { pattern: 'text-[12px]', reason: 'user-protected tray label size' },
    { pattern: 'text-[10px]', reason: 'user-protected tray hint size' },
  ],
  'ChatFeed.tsx': [
    // Emoji glyphs in the reaction picker are pictographs, not typography —
    // they do not participate in the text scale.
    { pattern: 'text-2xl', reason: 'reaction picker emoji glyph size' },
  ],
  'Cockpit.tsx': [
    // The cockpit is the DRIVING surface: its large text exists for at-arm's-
    // length legibility behind the wheel (clock, party count, big touch labels,
    // pinch-zoomed chat bubbles). Shrinking these to tr-display(20px) would
    // trade driving safety for typographic purity — kept at their tuned sizes.
    { pattern: 'text-xl', reason: 'driving-mode large label' },
    { pattern: 'text-2xl', reason: 'driving-mode large label' },
    { pattern: 'text-4xl', reason: 'driving-mode headcount display' },
  ],
  'DriverConsole.tsx': [
    // Same rationale as the cockpit it gates: PIN entry / 운행 시작 are read
    // from a car seat. The W0 sweep shrank these 30-36px → 20px; the
    // adversarial review (2026-07-27) called the inconsistency out — restored.
    { pattern: 'text-2xl', reason: 'driving-gate large label' },
    { pattern: 'text-3xl', reason: 'driving-gate CTA / titles' },
    { pattern: 'text-4xl', reason: 'PIN input at arm-length' },
  ],
  'GuideSeatDashboard.tsx': [
    // Legend numeral inside a fixed 16px circle; tr-meta's 14px line box clips.
    { pattern: 'text-[9px]', reason: 'seat-legend numeral in 16px dot' },
  ],
};

/**
 * Files allowed to import from 'lucide-react' directly. Everything else goes
 * through the barrel. `import type` is always allowed (types are erased).
 */
const LUCIDE_ALLOWLIST = new Set<string>([
  'icons.ts', // the barrel itself
  // The cockpit's remaining direct imports all feed the user-protected
  // ActionGrid driverActions tile config (plan §N) — rerouting them changes
  // nothing visually but churns protected code; consolidate when the tray
  // is next intentionally revised.
  'Cockpit.tsx',
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(ROOT);

describe('tour-mode type discipline (U4-D7)', () => {
  it('uses only the tr-* typography scale (no Tailwind text sizing)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const base = path.basename(file);
      const allowed = TEXT_ALLOWLIST[base] ?? [];
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const match = line.match(TEXT_UTILITY);
        if (!match) return;
        const token = match[0].trim().replace(/^['"`:]/, '');
        if (allowed.some((a) => line.includes(a.pattern))) return;
        violations.push(`${rel}:${i + 1} → ${token}`);
      });
    }
    expect(violations).toEqual([]);
  });

  it('imports lucide icons through the barrel (icons.ts), not directly', () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const base = path.basename(file);
      if (LUCIDE_ALLOWLIST.has(base)) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // single or double quotes, plus deep imports ('lucide-react/…').
        if (!/from\s+['"]lucide-react(?:\/[^'"]*)?['"]/.test(line)) return;
        if (/^\s*import\s+type\s/.test(line)) return; // type-only: erased at build
        violations.push(`${rel}:${i + 1}`);
      });
    }
    expect(violations).toEqual([]);
  });
});
