/**
 * N8 — where the light source goes, and the one place it must not.
 *
 * `.tr-atmos` is a single accent radial that gives a flat canvas a sky. It
 * shipped on the guest room and stopped there (N-j: every staff surface read
 * `atmos:false`), so the material upgrade ended one screen in.
 *
 * 🔴 The cockpit is excluded BY DECISION, not by oversight, and that is worth a
 * test because it looks like an omission to anyone tidying up later:
 *
 *   the cockpit is dark-fixed because of night-driving glare (A5), and laying a
 *   glow over a screen that was darkened to stop glare undoes the reason it is
 *   dark.
 *
 * Someone "finishing N8" by adding the fourth surface would be reverting an
 * accessibility decision while believing they were completing a ticket.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');

const css = read('app', 'tour-room-theme.css');
const room = read('components', 'tour-mode', 'RoomShell.tsx');
const staff = read('components', 'tour-mode', 'staff', 'StaffShell.tsx');
const entry = read('components', 'tour-mode', 'TourModeEntry.tsx');
const planner = read('components', 'tour-mode', 'plan', 'PlanEditorClient.tsx');
const cockpit = read('components', 'tour-mode', 'cockpit', 'Cockpit.tsx');

describe('atmosphere scope (N8 / N-j)', () => {
  it.each([
    ['guest room', room],
    ['guide console', staff],
    ['entry', entry],
    ['planner', planner],
  ])('%s carries the light source', (_name, source) => {
    expect(source).toMatch(/className=\{?[`"][^`"]*\btr-atmos\b/);
  });

  /**
   * 🔴 The invariant. Not "not yet" — never, unless the glare decision is
   * revisited on purpose.
   */
  it('the cockpit does NOT — night-driving glare (A5)', () => {
    expect(cockpit).not.toMatch(/\btr-atmos\b/);
  });

  /**
   * The class is now applied to four surfaces, so it can no longer rely on each
   * one remembering to lift its content above the pseudo-element. Without the
   * negative z-index the wash paints OVER text — the X13 failure, where
   * `getComputedStyle` reported a visible heading on a screen that rendered as
   * an empty gradient.
   */
  it('paints under content rather than over it', () => {
    const block = /\.tr-atmos::before\s*\{([\s\S]*?)\}/.exec(css);
    expect(block).not.toBeNull();
    expect(block![1]).toMatch(/z-index:\s*-1/);
    expect(block![1]).toMatch(/pointer-events:\s*none/);
  });

  /** The high-contrast skin is a deliberate absence of atmosphere. */
  it('the contrast skin still opts out', () => {
    expect(css).toMatch(/\[data-tr-skin='contrast'\][^{]*\.tr-atmos::before\s*\{[^}]*display:\s*none/);
  });
});
