/**
 * @jest-environment node
 *
 * The general "declared but unread prop" scan, held at zero.
 *
 * `declaredButUnread.test.ts` pins the one instance that cost something —
 * `GuideConsole` declared `participants`, the route sent it on every poll, and
 * the component named it once, in the type. This is the sweep that was the
 * stated follow-up, and the plan named the risk with it: written in a hurry it
 * drowns in rest/spread and destructuring false positives, gets muted, and then
 * protects nothing.
 *
 * So it is built for precision (see `lib/audit/declaredProps.ts`) and it is
 * held at ZERO rather than at a ceiling. Three findings existed when it was
 * written and all three were removed in the same commit, which is what makes
 * zero an honest number here instead of an aspiration:
 *
 *   · RoomDrawer.onOpenConcierge — 🔴 the interesting one. A live handler was
 *     passed for every customer and the drawer never called it. Wiring it would
 *     have been WRONG: FA-024 fixed the concierge at two doors for a measured
 *     reason and `conciergeDoorCount.test.ts` guards that. The dead tile's
 *     remnants (prop, icon import, ten locale strings) went instead.
 *   · GuideSeatDashboard.tourTitle — passed by three call sites, never rendered;
 *     the cockpit header already shows the tour name.
 *   · JoinFlow.tourDate — required, computed by the page from the token, never
 *     read. Adding a date line would have been inventing product; the prop went.
 *
 * ⚠ Removing them broke two live features on the way, and tsc did not notice:
 * a global rename also stripped `tourTitle` from `TravelTimelineEntry` (it goes
 * into the share text) and from `HomeTab`. Both props are optional, so the
 * compiler was happy. Reading the diff caught it. Same lesson as the rest of
 * this audit — the type system does not know what a prop is FOR.
 */
import { scanDeclaredProps } from '@/lib/audit/declaredProps';

const scan = scanDeclaredProps();

describe('declared-but-unread props', () => {
  it('🔴 nothing is declared and left unread', () => {
    expect(scan.findings.map((f) => `${f.file} ${f.component}.${f.prop}`)).toEqual([]);
  });

  it('the sweep is not empty — it examined real components', () => {
    // B-3. A broken walk or a parser change makes findings zero for the wrong
    // reason, and a zero-finding assertion would then pass forever.
    expect(scan.files).toBeGreaterThan(80);
    expect(scan.examined).toBeGreaterThan(100);
    expect(scan.declaredProps).toBeGreaterThan(500);
  });

  it('says out loud what it could not look at', () => {
    // The skips are the honest part: a component whose props type lives in
    // another file, or that forwards its props wholesale, is out of reach. A
    // scan that hid those would be claiming coverage it does not have.
    const skippedTotal = Object.values(scan.skipped).reduce((a, b) => a + b, 0);
    expect(skippedTotal).toBeGreaterThan(0);
    // …but not so many that the sweep is mostly holes.
    expect(skippedTotal).toBeLessThan(scan.examined / 2);
  });

  it('🔴 the concierge keeps its two doors — the finding was not wired back', () => {
    // If someone re-adds the drawer handler to satisfy the scan, this says why
    // that is the wrong direction before they spend the afternoon on it.
    const drawer = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'components/tour-mode/RoomDrawer.tsx'),
      'utf8',
    ) as string;
    expect(drawer).not.toMatch(/onOpenConcierge/);
    expect(drawer).not.toMatch(/IconConcierge/);
  });
});
