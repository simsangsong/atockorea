/**
 * @jest-environment node
 *
 * Standing gate — the messenger verb grid stays generated and honest (G0).
 *
 * The hand-written v0 table was wrong within the hour (it filed the
 * jump-to-bottom badge as unknown; ChatFeed had carried it all along).
 * This gate keeps the grid a measurement: stale doc fails, and the
 * generator's own self-checks (probed file missing/empty → throw, fewer
 * than 8 verbs present → broken collector, a must-verb probed absent →
 * regression or broken probe) run inside the --check call itself.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const GEN = path.join(ROOT, 'scripts', 'gen-grammar-grid.mjs');
const DOC = path.join(ROOT, 'docs', 'audit', 'GRAMMAR-GRID.md');

describe('GRAMMAR-GRID.md (generated)', () => {
  it('is not stale — the generator agrees with the committed doc', () => {
    expect(fs.existsSync(DOC)).toBe(true);
    execFileSync(process.execPath, [GEN, '--check'], { cwd: ROOT, stdio: 'pipe' });
  });

  it('measures something — the grid carries both presences and absences', () => {
    const doc = fs.readFileSync(DOC, 'utf8');
    // Non-vacuous in both directions: a grid with no ✗ rows has stopped
    // watching the frontier, one with no ✅ rows has stopped seeing the app.
    expect((doc.match(/\| ✅ \|/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect((doc.match(/\| ✗ \|/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(doc).toContain('생성물');
  });

  it('positive control — a tampered doc must fail the check', () => {
    const original = fs.readFileSync(DOC, 'utf8');
    try {
      fs.writeFileSync(DOC, original.replace('집계: 존재', '집계: 존재(변조) '));
      expect(() => execFileSync(process.execPath, [GEN, '--check'], { cwd: ROOT, stdio: 'pipe' })).toThrow();
    } finally {
      fs.writeFileSync(DOC, original);
    }
  });
});
