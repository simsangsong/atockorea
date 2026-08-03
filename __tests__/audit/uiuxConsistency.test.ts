/**
 * @jest-environment node
 *
 * Standing gate — the C axis (일관성) ceilings.
 *
 * 🔴 These are CEILINGS, not pass lines, and the difference matters.
 *
 * The pass line for token bypass is zero and for bare loading strings is zero.
 * Asserting that today would put 104 and 25 red marks in front of the next
 * person, who would switch the gate off or start an exemption list — which is
 * exactly how the CJK scanner grew four holes and how four element-by-element
 * sweeps failed to close 583 findings. So the numbers start where they are and
 * are only ever allowed to fall.
 *
 * Lower a ceiling in the same commit that lowers the count. A ceiling that
 * drifts above the real number is a gate that measures nothing.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts/qa-uiux-consistency.mjs');

/** Measured 2026-08-03 on a8dc24a8. Ratchet down; never up. */
const CEILING = {
  tokenBypass: 104,
  bareLoadingFiles: 20,
  scannedAtLeast: 100,
};

let result: {
  scanned: number;
  excluded: number;
  tokenBypass: { total: number; files: number };
  bareLoading: { files: number; list: { file: string; lines: number[] }[] };
  emptyStatePrimitive: { count: number };
};

beforeAll(() => {
  result = JSON.parse(execFileSync(process.execPath, [SCRIPT, '--json'], { cwd: ROOT, encoding: 'utf8' }));
});

describe('UI/UX consistency ceilings (C axis)', () => {
  it('scans a real population — an empty walk is a broken collector, not a clean app', () => {
    expect(result.scanned).toBeGreaterThanOrEqual(CEILING.scannedAtLeast);
    // Art and map layers must actually be excluded; if this is 0 the path rules
    // stopped matching and every scenery colour is about to be filed as a bug.
    expect(result.excluded).toBeGreaterThan(0);
  });

  it('token bypass does not grow', () => {
    expect(result.tokenBypass.total).toBeLessThanOrEqual(CEILING.tokenBypass);
  });

  it('bare loading strings do not grow', () => {
    expect(result.bareLoading.files).toBeLessThanOrEqual(CEILING.bareLoadingFiles);
  });

  /**
   * Locks the detector itself, not the app. The first cut asked whether a file
   * contained a skeleton anywhere and so reported GuideConsole — the worst known
   * case, UX-001 — as clean, because an unrelated live-dot pulse 350 lines away
   * satisfied it. If this stops being found, the detector has regressed to
   * file-level presence again.
   */
  it('still catches UX-001: the guide console loading branch', () => {
    const hit = result.bareLoading.list.find((b) => b.file.endsWith('guide/GuideConsole.tsx'));
    expect(hit).toBeDefined();
    expect(hit!.lines.length).toBeGreaterThan(0);
  });
});
