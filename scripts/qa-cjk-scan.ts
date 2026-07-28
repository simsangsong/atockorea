/**
 * X1 / U-D17 — CJK character-level line-break sweep (CLAUDE.md P1-5).
 *
 * Replaces `qa-cjk-scan.mjs`, whose net had four holes (see lib/audit/cjkBreak.ts).
 * The short version: it only matched width classes, so a chip whose width comes
 * from its own content — the exact thing that collapsed to `엑 / 셀` on the ops
 * bookings toolbar — passed straight through, and the scanner reported clean.
 *
 * Usage:
 *   npx tsx scripts/qa-cjk-scan.ts [roots…]      (default: components app)
 *   FAIL_ON=certain npx tsx scripts/qa-cjk-scan.ts   → exit 1 if any certain hit
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { scanSource, type CjkBreakHit } from '../lib/audit/cjkBreak';

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('components', 'app');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const files = roots.flatMap((r) => walk(r));
const hits: CjkBreakHit[] = [];
for (const file of files) {
  hits.push(...scanSource(path.relative('.', file).replace(/\\/g, '/'), readFileSync(file, 'utf8')));
}

const certain = hits.filter((h) => h.confidence === 'certain');
const suspect = hits.filter((h) => h.confidence === 'suspect');

console.log(`scanned ${files.length} .tsx files under ${roots.join(', ')}\n`);
console.log(`CERTAIN — CJK text in an unprotected control/constrained box: ${certain.length}`);
console.log(`SUSPECT — unprotected control whose label is an expression:  ${suspect.length}\n`);

function report(list: CjkBreakHit[], limitPerFile = 4) {
  const byFile = new Map<string, CjkBreakHit[]>();
  for (const h of list) {
    if (!byFile.has(h.file)) byFile.set(h.file, []);
    byFile.get(h.file)!.push(h);
  }
  for (const [file, group] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${file}  (${group.length})`);
    for (const h of group.slice(0, limitPerFile)) {
      console.log(`      :${h.line}  <${h.tag}> [${h.reason}]  "${h.text}"`);
    }
    // Silent truncation reads as "that was all of them" — say what was dropped.
    if (group.length > limitPerFile) console.log(`      … +${group.length - limitPerFile} more`);
  }
}

console.log('== CERTAIN ==');
report(certain);
if (suspect.length) {
  console.log('\n== SUSPECT (label is an expression — check by eye) ==');
  report(suspect, 2);
}

if (process.env.FAIL_ON === 'certain' && certain.length > 0) process.exitCode = 1;
