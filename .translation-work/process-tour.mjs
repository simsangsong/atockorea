#!/usr/bin/env node
// Usage: node .translation-work/process-tour.mjs <slug>
// For each locale (ko, ja, zh, zh-TW, es):
//   1. Verify the translation map file exists and has the right key count
//   2. Run inject (writes the final tour-product JSON)
//   3. Run validate (structural checks)
// Appends one-line status per locale to .translation-work/progress.log.

import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const slug = process.argv[2];
if (!slug) { console.error('Usage: node process-tour.mjs <slug>'); process.exit(2); }

const LOCALES = ['ko', 'ja', 'zh', 'zh-TW', 'es'];
const extractPath = `.translation-work/extracts/${slug}.strings.json`;
const expectedCount = Object.keys(JSON.parse(readFileSync(extractPath, 'utf-8'))).length;

const stamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const log = (line) => { console.log(line); appendFileSync('.translation-work/progress.log', line + '\n'); };

log(`\n[${stamp()}] === Tour: ${slug} (expected ${expectedCount} strings) ===`);

let passCount = 0, failCount = 0;
for (const loc of LOCALES) {
  const transPath = `.translation-work/translations/${slug}.${loc}.json`;
  if (!existsSync(transPath)) {
    log(`[${stamp()}] FAIL ${slug}.${loc} — translation map missing`);
    failCount++;
    continue;
  }
  let trans;
  try { trans = JSON.parse(readFileSync(transPath, 'utf-8')); }
  catch (e) {
    log(`[${stamp()}] FAIL ${slug}.${loc} — translation parse error: ${e.message}`);
    failCount++;
    continue;
  }
  const cnt = Object.keys(trans).length;
  if (cnt !== expectedCount) {
    log(`[${stamp()}] FAIL ${slug}.${loc} — string count ${cnt}/${expectedCount}`);
    failCount++;
    continue;
  }
  // Inject
  try {
    execSync(`node .translation-work/inject.mjs ${slug} ${loc}`, { stdio: 'pipe' });
  } catch (e) {
    log(`[${stamp()}] FAIL ${slug}.${loc} — inject error: ${e.stderr?.toString() || e.message}`);
    failCount++;
    continue;
  }
  // Validate
  try {
    execSync(`node .translation-work/validate-translation.mjs ${slug} ${loc}`, { stdio: 'pipe' });
    log(`[${stamp()}] PASS ${slug}.${loc} (${cnt} strings)`);
    passCount++;
  } catch (e) {
    log(`[${stamp()}] FAIL ${slug}.${loc} — validation: ${(e.stderr?.toString() || e.message).split('\n').slice(0, 3).join(' | ')}`);
    failCount++;
  }
}

log(`[${stamp()}] === ${slug} done: ${passCount} pass / ${failCount} fail ===`);
process.exit(failCount > 0 ? 1 : 0);
