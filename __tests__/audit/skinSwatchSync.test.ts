/**
 * Standing gate — the skin picker's poster colours stay derived, not copied (UX-004).
 *
 * The failure this guards: SkinPicker's SWATCH table was ten skins of hex
 * copied by hand from app/tour-room-theme.css. The day a skin token changed,
 * the picker would keep previewing the old colour and nothing would go red —
 * the values matching TODAY was exactly why nobody looked (UIUX-LEDGER UX-004).
 *
 * Three assertions, one positive control:
 *   1. the generated file agrees with a fresh render of the CSS canon
 *   2. a tampered copy FAILS the checker — runs every time, so "in sync" can
 *      never silently mean "checker compares nothing" (UX-000 처방 4)
 *   3. SkinPicker actually reads the generated file and holds no hex of its
 *      own — the wiring assertion; a derived table nobody imports is the
 *      absent-caller defect this track keeps finding
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const GEN_SCRIPT = path.join(ROOT, 'scripts', 'gen-skin-swatch.mjs');
const GEN_FILE = path.join(ROOT, 'components', 'tour-mode', 'skinSwatch.gen.ts');
const PICKER = path.join(ROOT, 'components', 'tour-mode', 'SkinPicker.tsx');

describe('skin swatch stays derived from the CSS canon (UX-004)', () => {
  it('is not stale — the generator agrees with the committed file', () => {
    expect(fs.existsSync(GEN_FILE)).toBe(true);
    execFileSync(process.execPath, [GEN_SCRIPT, '--check'], { cwd: ROOT, stdio: 'pipe' });
  });

  it('positive control — a tampered copy must fail the checker', () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'swatch-')), 'tampered.gen.ts');
    fs.writeFileSync(tmp, fs.readFileSync(GEN_FILE, 'utf8').replace(/#eef1ee/, '#deadbe'));
    expect(() =>
      execFileSync(process.execPath, [GEN_SCRIPT, '--check', `--file=${tmp}`], { cwd: ROOT, stdio: 'pipe' }),
    ).toThrow();
  });

  it('SkinPicker imports the generated table and keeps no hex of its own', () => {
    const src = fs.readFileSync(PICKER, 'utf8');
    expect(src).toMatch(/from '\.\/skinSwatch\.gen'/);
    const hexes = src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexes).toEqual([]);
  });

  it('measures something — the table holds every skin, not a happy subset', () => {
    const gen = fs.readFileSync(GEN_FILE, 'utf8');
    const skins = gen.match(/^ {2}[a-z-]+:/gm) ?? [];
    expect(skins.length).toBeGreaterThanOrEqual(10);
  });
});
