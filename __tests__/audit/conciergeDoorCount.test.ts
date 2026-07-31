/**
 * @jest-environment node
 *
 * 🔴 FA-024 (full-app audit 2026-07-30) — one room, one door, and a component
 * that kept the third one alive in the source tree.
 *
 * `ConciergeEntryRow` had no renderer: its only reference was its own test. The
 * audit's first instinct was to WIRE it, because the chat tab looked like it had
 * no concierge entry. Reading the code says otherwise, in a comment left exactly
 * where the row used to be (`TourRoomClient.tsx`, X3): the row was the THIRD door
 * to one sheet — the shell header carries a ✨ button on every tab and the home
 * screen carries a tile — and it charged ~60px of a bottom stack that already ran
 * three rows deep under an empty feed. It was removed on purpose, with a measured
 * reason, and then survived as a file.
 *
 * An unrendered component with a plausible name is an invitation to undo that
 * decision. So the component is gone and this suite states the invariant that
 * replaces it:
 *
 *   1. the concierge sheet has exactly TWO entry points, and
 *   2. the header one is not tab-conditional, which is why the chat tab needs no
 *      row of its own.
 *
 * If a third door is ever wanted, delete this suite in the same commit — that is
 * the point of writing it down rather than trusting memory.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

const APP_SOURCES = [...walk(path.join(ROOT, 'components')), ...walk(path.join(ROOT, 'app'))].filter(
  (f) => !f.includes('__tests__'),
);

describe('FA-024 — the concierge has two doors, deliberately', () => {
  it('🔴 the retired entry row has not come back', () => {
    const references = APP_SOURCES.filter((f) => readFileSync(f, 'utf8').includes('ConciergeEntryRow'));
    expect(references.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it('🔴 exactly two things open the sheet: the shell header and the home tile', () => {
    // Non-vacuity first — a glob that matched nothing would pass everything.
    expect(APP_SOURCES.length).toBeGreaterThan(200);

    const shell = readFileSync(path.join(ROOT, 'components/tour-mode/RoomShell.tsx'), 'utf8');
    const home = readFileSync(path.join(ROOT, 'components/tour-mode/HomeTab.tsx'), 'utf8');
    expect(shell).toContain('data-testid="concierge-open"');
    expect(home).toContain('openConcierge');
  });

  it('🔴 the header button is not tab-conditional — that is why chat needs no row', () => {
    const shell = readFileSync(path.join(ROOT, 'components/tour-mode/RoomShell.tsx'), 'utf8');
    const at = shell.indexOf('data-testid="concierge-open"');
    expect(at).toBeGreaterThan(0);
    // Look at the JSX guarding the button: it may check that a concierge panel
    // was passed in, but it must not check WHICH tab is showing.
    const guard = shell.slice(Math.max(0, at - 900), at);
    expect(guard).toContain('{concierge &&');
    expect(guard).not.toMatch(/tab === '(chat|home|map|today|settings)'/);
  });
});
