/**
 * X20 — the room harvester is actually RUN.
 *
 * 🔴 Why this is a source gate and not a behaviour test.
 *
 * `lib/rag/roomHarvest.ts` (253 lines) and `roomHarvest.server.ts` (160) were
 * written, unit-tested and merged — and then called by nothing except their own
 * tests. Every test was green, `tsc` was clean, and the corpus the module
 * exists to grow did not grow by a single row, because nobody ran it.
 *
 * A behaviour test cannot catch that: it would call the harvester itself and
 * pass. The defect is the ABSENCE of a caller, and absence is only visible from
 * outside the module. This repo has now hit that shape four times in one
 * session — a geofence with no staff consumer, a matrix learner reading one of
 * two tables, a planner reading one of two photo columns, and this.
 *
 * The owner's decision also has a second half worth pinning: "do not build a
 * second harvest". So this asserts both that the room source runs, and that it
 * runs from the SAME two entry points as the chat source.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');

const cron = read('app', 'api', 'cron', 'rag-harvest', 'route.ts');
const cli = read('scripts', 'harvest-qa-candidates.ts');
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

describe('rag harvest wiring (X20)', () => {
  it('the weekly cron runs the ROOM harvester, not only the chat one', () => {
    expect(cron).toContain('harvestRoomQaCandidates');
    expect(cron).toContain('harvestQaCandidates');
  });

  it('the CLI runs both sources too, so it cannot drift from the cron', () => {
    expect(cli).toContain('harvestRoomQaCandidates');
    expect(cli).toContain('harvestQaCandidates');
  });

  /**
   * The owner's instruction was "widen the existing flywheel, do not make a
   * second one". A new `rag:harvest-rooms` script would satisfy every other
   * assertion here while breaking exactly that.
   */
  it('there is still ONE harvest command', () => {
    const harvestScripts = Object.keys(pkg.scripts).filter((name) => name.startsWith('rag:harvest'));
    expect(harvestScripts.sort()).toEqual(['rag:harvest', 'rag:harvest:dry']);
  });

  it('the admin ping separates the two sources, because they need different eyes', () => {
    // A chat draft is a marketing answer; a room draft is what a guide told a
    // guest standing somewhere. One number for both hides that.
    expect(cron).toMatch(/counts\.chat/);
    expect(cron).toMatch(/counts\.room/);
  });

  /**
   * P-D11 is not repealed by X20. The owner kept the 30-day `needs` purge
   * explicitly: aggregate questions are the asset, the individual guest is not.
   */
  it('the 30-day needs purge is still in the flywheel', () => {
    const flywheel = read('app', 'api', 'cron', 'tour-room-flywheel', 'route.ts');
    expect(flywheel).toMatch(/needs/);
    expect(flywheel).toMatch(/30/);
  });
});
