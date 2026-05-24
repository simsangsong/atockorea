/**
 * Find ONLY the `--append` collision suffixes (-2, -3, ... -9, -10+) that
 * BOTH (a) exist as files on disk under public/images/tours/ AND (b) have a
 * sibling without the suffix. That's the real duplicate signal — original
 * KakaoTalk sequence files (foo-10.webp etc.) without a sibling foo.webp
 * stay as separate photos.
 *
 *   node scripts/tmp-find-collision-duplicates.mjs
 */
import { readdirSync, statSync } from "fs";
import { extname, join } from "path";

const ROOT = "public/images/tours";

const findings = [];

function visit(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  const here = { dir, byBase: new Map() };
  for (const e of entries) {
    const p = join(dir, e);
    let stat;
    try { stat = statSync(p); } catch { continue; }
    if (stat.isDirectory()) { visit(p); continue; }
    if (extname(e).toLowerCase() !== ".webp") continue;
    // strip optional trailing "-N" where N is positive int (e.g. foo-2.webp / foo-12.webp)
    const m = e.match(/^(.+?)(?:-([1-9][0-9]?))?\.webp$/);
    if (!m) continue;
    const base = m[1];
    const suffix = m[2] ?? null;
    if (!here.byBase.has(base)) here.byBase.set(base, []);
    here.byBase.get(base).push({ file: e, suffix });
  }
  for (const [base, list] of here.byBase) {
    const hasBase = list.some((x) => x.suffix === null);
    const collisions = list.filter((x) => x.suffix !== null);
    if (hasBase && collisions.length > 0) {
      findings.push({
        dir,
        base: `${base}.webp`,
        collisions: collisions.map((c) => c.file).sort(),
      });
    }
  }
}

visit(ROOT);

console.log(`[collision-duplicates found: ${findings.length}]`);
for (const f of findings) {
  console.log(`\n  ${f.dir}/`);
  console.log(`    base:       ${f.base}`);
  console.log(`    collisions: ${f.collisions.join(", ")}`);
}
