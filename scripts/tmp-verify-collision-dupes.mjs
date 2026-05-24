/**
 * Verify which collision-suffix files are actually byte-identical to the
 * base file. Emits a spec JSON of confirmed safe deletes.
 *
 *   node scripts/tmp-verify-collision-dupes.mjs > .tmp-dupes-spec.json
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { extname, join } from "path";

const ROOT = "public/images/tours";

function md5(path) {
  const buf = readFileSync(path);
  return createHash("md5").update(buf).digest("hex");
}

const findings = [];
function visit(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  const here = new Map();
  for (const e of entries) {
    const p = join(dir, e);
    let stat;
    try { stat = statSync(p); } catch { continue; }
    if (stat.isDirectory()) { visit(p); continue; }
    if (extname(e).toLowerCase() !== ".webp") continue;
    const m = e.match(/^(.+?)(?:-([1-9][0-9]?))?\.webp$/);
    if (!m) continue;
    const base = m[1];
    const suffix = m[2] ?? null;
    if (!here.has(base)) here.set(base, []);
    here.get(base).push({ file: e, path: p, suffix });
  }
  for (const [base, list] of here) {
    const baseEntry = list.find((x) => x.suffix === null);
    const collisions = list.filter((x) => x.suffix !== null);
    if (!baseEntry || collisions.length === 0) continue;
    const baseHash = md5(baseEntry.path);
    const dupes = [];
    const nonDupes = [];
    for (const c of collisions) {
      const ch = md5(c.path);
      if (ch === baseHash) dupes.push(c.file);
      else nonDupes.push({ file: c.file, hash: ch.slice(0, 8) });
    }
    if (dupes.length > 0 || nonDupes.length > 0) {
      findings.push({
        dir,
        base: baseEntry.file,
        baseHash: baseHash.slice(0, 8),
        identicalDupes: dupes,
        differentVariants: nonDupes,
      });
    }
  }
}

visit(ROOT);

const totalDupes = findings.reduce((s, f) => s + f.identicalDupes.length, 0);
const totalDifferent = findings.reduce((s, f) => s + f.differentVariants.length, 0);

writeFileSync(".tmp-dupes-spec.json", JSON.stringify(findings, null, 2));

console.error(`\n[summary]`);
console.error(`  folders with collisions:     ${findings.length}`);
console.error(`  byte-IDENTICAL dupes (safe delete): ${totalDupes}`);
console.error(`  byte-DIFFERENT variants (KEEP):     ${totalDifferent}`);

for (const f of findings) {
  if (f.identicalDupes.length === 0 && f.differentVariants.length === 0) continue;
  console.error(`\n  ${f.dir}/  base=${f.base}`);
  if (f.identicalDupes.length > 0) {
    console.error(`    🗑 identical (delete): ${f.identicalDupes.join(", ")}`);
  }
  if (f.differentVariants.length > 0) {
    console.error(`    ⚠ different (keep):   ${f.differentVariants.map((v) => v.file).join(", ")}`);
  }
}
