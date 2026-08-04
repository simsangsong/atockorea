/**
 * @jest-environment node
 *
 * Standing gate — `docs/audit/UIUX-COVERAGE.md` is a generated artefact (U1).
 *
 * 🔴 Why a gate and not just a script.
 *
 * This track has already merged a regression by editing a generated doc by
 * hand and never re-running its owner. The doc looked right and the numbers
 * underneath had moved. So the generator's `--check` has to run where nobody
 * can forget it: inside `npm run gate`.
 *
 * The second assertion is the one that matters more. A coverage collector that
 * silently parses zero members reports a cheerful, entirely false "everything
 * is covered" — the exact failure mode recorded in the full-audit ledger. So
 * the gate refuses a doc that claims no axes and no surfaces, independently of
 * whether the generator agrees with itself.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOC = path.join(ROOT, 'docs/audit/UIUX-COVERAGE.md');
const GEN = path.join(ROOT, 'scripts/gen-uiux-coverage.mjs');

describe('UIUX-COVERAGE.md (generated)', () => {
  it('is not stale — the generator agrees with the committed doc', () => {
    expect(fs.existsSync(GEN)).toBe(true);
    // Throws (non-zero exit) when the doc differs from a fresh render.
    execFileSync(process.execPath, [GEN, '--check'], { cwd: ROOT, stdio: 'pipe' });
  });

  it('measures something — a zero-axis, zero-surface doc is a broken collector, not a clean bill', () => {
    const md = fs.readFileSync(DOC, 'utf8');

    // Every axis section carries "그물 안 N / 전체 M"; M must never be 0.
    const totals = [...md.matchAll(/그물 안 (\d+) \/ 전체 (\d+)/g)].map((m) => Number(m[2]));
    expect(totals.length).toBeGreaterThanOrEqual(4);
    expect(totals.every((t) => t > 0)).toBe(true);

    // The surface table must list real routes, not an empty shell.
    const rows = [...md.matchAll(/^\| `\/tour-mode[^`]*` \|/gm)];
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });
});
