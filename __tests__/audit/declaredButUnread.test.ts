/**
 * Data that arrives and is dropped (feature audit F7).
 *
 * `GuideConsole` declared `participants` on its room type — the API had always
 * sent it, every poll carried it — and the component referenced it exactly
 * once: in the type. So the answer to "did the driver ever open the link the
 * guide minted?" was on screen-adjacent data the whole time, and ops still
 * found out on the morning it mattered.
 *
 * This is the track's dominant defect (an engine with no consumer) one layer
 * down: not a module nobody imports, but a FIELD nobody reads. `qa-caller-
 * absence` cannot see it — the component is imported and rendered, and the
 * field is genuinely present in the payload.
 *
 * Pinned narrowly and on purpose. A general "declared but unread prop" scanner
 * is the right follow-up, and it needs care to survive rest/spread props and
 * destructuring aliases; a wide version written in a hurry would produce noise,
 * get muted, and protect nothing. This locks the one that was actually lost.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

describe('declared-but-unread room data', () => {
  const GUIDE_CONSOLE = 'components/tour-mode/guide/GuideConsole.tsx';

  it('the guide console reads participants, not just declares them', () => {
    const src = read(GUIDE_CONSOLE);
    // Non-vacuous: if the file moves or the field is renamed, fail rather than
    // pass over a source that no longer contains what this is guarding.
    expect(src).toContain('participants');
    const mentions = src.match(/participants/g)?.length ?? 0;
    expect(mentions).toBeGreaterThan(1);
  });

  it('shows the guide when a driver has not opened their link', () => {
    const src = read(GUIDE_CONSOLE);
    expect(src).toMatch(/participants\.some\(\s*\(p\)\s*=>\s*p\.role === 'driver'\s*\)/);
    expect(src).toContain('data-testid="driver-not-joined"');
  });

  it('the guide overview still sends the role that answers it', () => {
    // The badge is only as true as its input. If the route stops selecting
    // `role`, every room silently reads "기사 미확인" forever.
    const route = read('app/api/tour-mode/guide/overview/route.ts');
    expect(route).toMatch(/from\('tour_room_participants'\)/);
    expect(route).toMatch(/\.select\(\s*'room_id, role/);
  });
});
