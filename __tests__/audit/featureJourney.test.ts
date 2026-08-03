/**
 * The journey grid must stay honest in three directions (feature audit F1).
 *
 * 1. Every declared endpoint has a stage — a new route cannot slip in without
 *    somebody deciding when in the trip it is used, exactly as `k4Coverage`
 *    already forces actor and tier.
 * 2. Every empty cell is a written decision. An undeclared hole fails.
 * 3. Every declared-empty cell is still actually empty. Without this the
 *    reasons rot: someone adds `driver/after`, the finding stays on the page,
 *    and the repo now documents a gap it no longer has.
 *
 * (3) is the one that is easy to leave out and is why this file exists rather
 * than a paragraph in a plan.
 */
import fs from 'node:fs';
import path from 'node:path';
import { K4_DECLARATIONS } from '@/lib/audit/k4Coverage';
import {
  buildJourneyMatrix,
  cellKey,
  DECLARED_EMPTY,
  FEATURE_STAGES,
  JOURNEY_STAGES,
  renderJourneyMarkdown,
  SMART_APP_ROLES,
} from '@/lib/audit/featureJourney';

describe('feature journey grid', () => {
  it('covers the same endpoint set as the K4 ledger, both directions', () => {
    const declared = Object.keys(K4_DECLARATIONS).sort();
    const staged = Object.keys(FEATURE_STAGES).sort();
    // Non-vacuous: an empty pair of lists would satisfy the equality below.
    expect(declared.length).toBeGreaterThan(50);
    expect(staged).toEqual(declared);
  });

  it('builds one cell per role × stage', () => {
    const matrix = buildJourneyMatrix();
    expect(matrix).toHaveLength(SMART_APP_ROLES.length * JOURNEY_STAGES.length);
  });

  it('declares a reason for every empty cell', () => {
    const undeclared = buildJourneyMatrix()
      .filter((cell) => cell.pairs.length === 0)
      .map((cell) => cellKey(cell.role, cell.stage))
      .filter((key) => !DECLARED_EMPTY[key]);

    // A role that cannot act at some point in the trip is a finding. It may be
    // the right answer, but it has to be written down rather than noticed later.
    expect(undeclared).toEqual([]);
  });

  it('has no stale emptiness declaration', () => {
    const stillEmpty = new Set(
      buildJourneyMatrix()
        .filter((cell) => cell.pairs.length === 0)
        .map((cell) => cellKey(cell.role, cell.stage)),
    );
    const stale = Object.keys(DECLARED_EMPTY).filter((key) => !stillEmpty.has(key));
    expect(stale).toEqual([]);
  });

  it('gives the guest an unbroken trip', () => {
    // The guest is the one person who is present at every stage. A hole in this
    // row means somebody paid and then hit a dead end.
    const holes = buildJourneyMatrix()
      .filter((cell) => cell.role === 'guest' && cell.pairs.length === 0)
      .map((cell) => cell.stage);
    expect(holes).toEqual([]);
  });
});

describe('🔴 docs/audit/feature-journey.md is not stale', () => {
  const OUT = path.join(process.cwd(), 'docs', 'audit', 'feature-journey.md');

  it('exists', () => {
    expect(fs.existsSync(OUT)).toBe(true);
  });

  it('matches what the generator would write, byte for byte', () => {
    // Editing the doc by hand is how a regression got merged once already: the
    // numbers were corrected on the page and never in the source.
    const actual = fs.readFileSync(OUT, 'utf8');
    if (actual !== renderJourneyMarkdown()) {
      throw new Error('feature-journey.md is stale — run: npx tsx scripts/gen-feature-journey.ts');
    }
    expect(actual).toBe(renderJourneyMarkdown());
  });
});
