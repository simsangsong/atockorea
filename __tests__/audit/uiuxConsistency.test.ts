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

/**
 * Ratchet down; never up. Lower the ceiling in the SAME commit that lowers the
 * count, or the slack silently becomes room for the next regression.
 *   20 → 19  (U9, UX-001: the guide console loading branch got a skeleton)
 */
const CEILING = {
  tokenBypass: 104,
  bareLoadingFiles: 19,
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
   * 🔴 This assertion was inverted, not deleted.
   *
   * It used to demand that GuideConsole BE flagged, because the detector's first
   * cut reported it clean — an unrelated live-dot pulse 350 lines from the
   * loading branch satisfied a file-level check, and the worst case we knew
   * about looked fine. U9 then fixed the defect, so the old assertion started
   * failing for the right reason.
   *
   * Deleting it would have thrown away a regression guard. Inverting it keeps
   * one: the console's loading branch now has a skeleton beside its message, and
   * if it ever loses that again this goes red. What the old version protected —
   * that the detector still judges by proximity rather than file-level presence
   * — is now carried by the positive control below, which cannot be satisfied by
   * an accident of distance.
   */
  it('UX-001 stays fixed: the guide console loading branch has a shape', () => {
    const hit = result.bareLoading.list.find((b) => b.file.endsWith('guide/GuideConsole.tsx'));
    expect(hit).toBeUndefined();
  });
});

/**
 * 🔴 U8 — both directions, every run.
 *
 * The mutations this track ran until now only proved a gate goes red when it is
 * broken. That leaves the other half untested: whether the detector stays quiet
 * on code that is correct. Without it, "strict enough to block everything" and
 * "catching the right things" look identical from the outside, and the first
 * time someone writes a correct component that trips the gate, the gate gets
 * deleted rather than fixed.
 *
 * A human has to remember to run a mutation. These controls run every time.
 */
const scan = (root: string) =>
  JSON.parse(
    execFileSync(process.execPath, [SCRIPT, `--roots=${root}`, '--json'], { cwd: ROOT, encoding: 'utf8' }),
  ) as typeof result;

describe('detector controls (both directions)', () => {
  it('positive — flags a file that breaks both rules', () => {
    const r = scan('scripts/fixtures/uiux/dirty');
    expect(r.scanned).toBe(1);
    expect(r.tokenBypass.total).toBeGreaterThan(0);
    expect(r.bareLoading.files).toBe(1);
  });

  it('negative — stays silent on a file that follows both rules', () => {
    const r = scan('scripts/fixtures/uiux/clean');
    expect(r.scanned).toBe(1); // the walker reached it at all
    expect(r.tokenBypass.total).toBe(0);
    expect(r.bareLoading.files).toBe(0);
  });
});
