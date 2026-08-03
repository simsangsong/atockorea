/**
 * qa-caller-absence — which modules and API routes has nobody wired up?
 *
 * The scan itself lives in `lib/audit/callerAbsence.ts` so the F8 ratchet
 * (`__tests__/audit/wiringRatchet.test.ts`) reads the same count this prints
 * instead of a second implementation that could drift. This file is the human
 * face of it.
 *
 * Usage: npx tsx scripts/qa-caller-absence.ts
 * Exit:  0 = printed a report · 2 = the scan may be blind (see below)
 */
import { scanCallerAbsence } from '../lib/audit/callerAbsence';

const scan = scanCallerAbsence();

console.log(`scanned ${scan.scannedFiles} source files\n`);
console.log(`# modules with NO importer at all: ${scan.orphanModules.length}`);
scan.orphanModules.forEach((m) => console.log('   ' + m));
console.log(`\n# modules imported ONLY by tests/scripts/mobile: ${scan.testOnlyModules.length}`);
scan.testOnlyModules.forEach(({ module, testOnly }) => console.log(`   ${module}  ←  ${testOnly.join(', ')}`));
console.log(`\n# smart-app API routes with NO reference anywhere: ${scan.orphanRoutes.length}`);
scan.orphanRoutes.forEach((r) => console.log('   ' + r));
console.log(`\n# smart-app API routes referenced ONLY by tests/scripts/mobile: ${scan.harnessOnlyRoutes.length}`);
scan.harnessOnlyRoutes.forEach(({ route, testOnly }) => console.log(`   ${route}  ←  ${testOnly.join(', ')}`));

console.log(`\n${scan.candidates ? '🔴' : '✅'} caller-absence candidates: ${scan.candidates}`);

if (scan.blinding.length > 0) {
  console.error('\n🔴 SCAN MAY BE BLIND — these count as app callers but look like ledgers:');
  for (const { file, count } of scan.blinding) console.error(`   ${file}  (${count} route literals)`);
  console.error(
    '   A ledger declares routes; it does not call them. Move it under lib/audit/,\n' +
      '   or add it to isTestish — otherwise every route it names reads as wired.',
  );
  process.exit(2);
}
