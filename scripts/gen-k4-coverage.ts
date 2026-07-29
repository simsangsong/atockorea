/**
 * Generate `docs/audit/K4-coverage.md` from the source tree.
 *
 * The ledger is discovered, not typed: a new route under `app/api/tour-rooms/**`
 * or `app/api/tour-mode/**` shows up here automatically, and
 * `__tests__/audit/k4Coverage.test.ts` fails until it is both declared in
 * `K4_DECLARATIONS` and regenerated into the doc.
 *
 *   npx tsx scripts/gen-k4-coverage.ts          # write
 *   npx tsx scripts/gen-k4-coverage.ts --check  # exit 1 if stale
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  buildLedger,
  collectK4Pairs,
  renderLedgerMarkdown,
  summarize,
  K4_ROOMS,
} from '../lib/audit/k4Coverage';

const OUT = path.join('docs', 'audit', 'K4-coverage.md');

function main() {
  const pairs = collectK4Pairs(process.cwd());
  if (pairs.length === 0) {
    // A generator that writes an empty ledger is worse than one that fails:
    // the empty file reads as "nothing to cover".
    console.error('no route files found — refusing to write an empty ledger');
    process.exit(2);
  }
  const rows = buildLedger(pairs, K4_ROOMS);
  const markdown = renderLedgerMarkdown(rows, K4_ROOMS);

  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (current !== markdown) {
      console.error(`${OUT} is stale — run: npx tsx scripts/gen-k4-coverage.ts`);
      process.exit(1);
    }
    console.log(`${OUT} is up to date (${rows.length} pairs)`);
    return;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, markdown, 'utf8');
  const s = summarize(rows);
  console.log(
    `wrote ${OUT} — ${s.total} pairs (${s.covered} to run, ${s.skipped} skipped by design), ` +
      `tiers free ${s.byTier.free} / llm ${s.byTier.llm} / people ${s.byTier.people}`,
  );
}

main();
