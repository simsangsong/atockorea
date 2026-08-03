/**
 * qa-declared-props — props a component declares and never reads.
 *
 * The scan lives in `lib/audit/declaredProps.ts` so the standing gate reads the
 * same result this prints. See that file for why every rule prefers a miss to a
 * false alarm.
 *
 * Usage: npx tsx scripts/qa-declared-props.ts
 * Exit:  0 = nothing unread · 1 = findings · 2 = the scan examined nothing
 */
import { scanDeclaredProps } from '../lib/audit/declaredProps';

const scan = scanDeclaredProps();

console.log(`scanned ${scan.files} component files`);
console.log(`examined ${scan.examined} components · ${scan.declaredProps} declared props\n`);

console.log('not examined, and why:');
for (const [reason, count] of Object.entries(scan.skipped)) {
  console.log(`  ${reason.padEnd(22)} ${count}`);
}

if (scan.findings.length > 0) {
  console.log('\n🔴 declared and never read:');
  for (const f of scan.findings) console.log(`  ${f.file}  ${f.component}.${f.prop}`);
} else {
  console.log('\n✅ every examined prop is read somewhere in its file');
}

// B-3: a checker that measures nothing while reporting success is a lie.
if (scan.examined === 0 || scan.declaredProps === 0) {
  console.error('\n🔴 examined nothing — the walk or the parser is broken, not the repo.');
  process.exit(2);
}
process.exit(scan.findings.length > 0 ? 1 : 0);
