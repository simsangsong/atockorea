/**
 * Generate `docs/audit/feature-journey.md` — the role × journey-stage grid.
 *
 * Same arrangement as `gen-k4-coverage.ts`: the doc is a projection of
 * `lib/audit/featureJourney.ts`, and `__tests__/audit/featureJourney.test.ts`
 * fails when the two drift.
 *
 *   npx tsx scripts/gen-feature-journey.ts          # write
 *   npx tsx scripts/gen-feature-journey.ts --check  # exit 1 if stale
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildJourneyMatrix, renderJourneyMarkdown } from '../lib/audit/featureJourney';

const OUT = path.join('docs', 'audit', 'feature-journey.md');

function main() {
  const matrix = buildJourneyMatrix();
  const populated = matrix.reduce((n, cell) => n + cell.pairs.length, 0);
  if (populated === 0) {
    // A grid with nothing in it would render as "every cell empty", which reads
    // as a catastrophic finding rather than as a broken generator.
    console.error('journey grid is empty — refusing to write it');
    process.exit(2);
  }
  const markdown = renderJourneyMarkdown();

  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (current !== markdown) {
      console.error(`${OUT} is stale — run: npx tsx scripts/gen-feature-journey.ts`);
      process.exit(1);
    }
    console.log(`${OUT} is up to date (${populated} endpoints across ${matrix.length} cells)`);
    return;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, markdown, 'utf8');
  const empty = matrix.filter((cell) => cell.pairs.length === 0);
  console.log(
    `wrote ${OUT} — ${populated} endpoints across ${matrix.length} cells, ` +
      `${empty.length} empty (${empty.map((c) => `${c.role}/${c.stage}`).join(', ') || 'none'})`,
  );
}

main();
