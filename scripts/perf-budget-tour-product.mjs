#!/usr/bin/env node
/**
 * Tour-product route JS budget meter (master plan §P-0/§P-1, W6 CI gate).
 *
 * Measures the real script payload of the prerendered tour-product detail
 * pages by parsing each page's .html output for /_next/static/*.js refs and
 * summing their raw + gzip sizes. This is what the browser actually downloads
 * on first load, independent of build-log formatting.
 *
 * Usage:
 *   node scripts/perf-budget-tour-product.mjs            # report
 *   node scripts/perf-budget-tour-product.mjs --check    # exit 1 if over budget
 *   node scripts/perf-budget-tour-product.mjs --json     # machine-readable
 *
 * Budget (--check): baseline gz + 15KB plan-wide cap (§P-1). Update BASELINE_GZ
 * only via a reviewed PR that cites the plan §C entry recording the change.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
const NEXT = join(ROOT, ".next");

const SLUGS = [
  "tour-product/jeju-grand-highlights-loop",
  "tour-product/jeju-island-private-car-charter-tour",
  "tour-product/busan-small-group-sightseeing-tour-cruise-passengers",
  "tour-product/seoul-private-nami-morning-calm-petite-france",
  "ko/tour-product/jeju-grand-highlights-loop",
];

// gz bytes for the union payload of the 5 QA routes, captured at W0.1 baseline.
// null until W0.1 records it; --check is a no-op while null.
const BASELINE_GZ = 504976; // W0.1 2026-07-14, origin/main df5b9d42 (+W1.1 motion constants)
const PLAN_CAP_GZ = 15 * 1024; // §P-1: plan-wide cumulative +15KB gz ceiling

const args = new Set(process.argv.slice(2));

function scriptsForHtml(htmlPath) {
  const html = readFileSync(htmlPath, "utf8");
  const refs = new Set();
  const re = /(?:src|href)="(\/_next\/static\/[^"]+?\.js)(?:\?[^"]*)?"/g;
  let m;
  while ((m = re.exec(html))) refs.add(m[1]);
  return [...refs];
}

function sizeOf(ref) {
  const file = join(NEXT, ref.replace(/^\/_next\//, "").replaceAll("/", "\\"));
  if (!existsSync(file)) return null;
  const buf = readFileSync(file);
  return { raw: buf.length, gz: gzipSync(buf, { level: 9 }).length };
}

const perRoute = [];
const union = new Map();
for (const slug of SLUGS) {
  const htmlPath = join(NEXT, "server", "app", ...slug.split("/")) + ".html";
  if (!existsSync(htmlPath)) {
    perRoute.push({ slug, error: "html not found (build first)" });
    continue;
  }
  const refs = scriptsForHtml(htmlPath);
  let raw = 0;
  let gz = 0;
  let missing = 0;
  for (const ref of refs) {
    const s = sizeOf(ref);
    if (!s) {
      missing++;
      continue;
    }
    raw += s.raw;
    gz += s.gz;
    if (!union.has(ref)) union.set(ref, s);
  }
  perRoute.push({ slug, scripts: refs.length, raw, gz, missing });
}

let unionRaw = 0;
let unionGz = 0;
for (const s of union.values()) {
  unionRaw += s.raw;
  unionGz += s.gz;
}

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
const result = {
  perRoute,
  union: { scripts: union.size, raw: unionRaw, gz: unionGz },
  baselineGz: BASELINE_GZ,
};

if (args.has("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const r of perRoute) {
    if (r.error) console.log(`  ${r.slug}: ${r.error}`);
    else
      console.log(
        `  /${r.slug}: ${r.scripts} scripts, ${kb(r.raw)} raw, ${kb(r.gz)} gz${r.missing ? ` (${r.missing} missing)` : ""}`,
      );
  }
  console.log(`  UNION: ${union.size} scripts, ${kb(unionRaw)} raw, ${kb(unionGz)} gz`);
}

if (args.has("--check")) {
  if (BASELINE_GZ == null) {
    console.log("  --check: no baseline recorded yet, skipping gate");
  } else if (unionGz > BASELINE_GZ + PLAN_CAP_GZ) {
    console.error(
      `  BUDGET EXCEEDED: union gz ${kb(unionGz)} > baseline ${kb(BASELINE_GZ)} + cap ${kb(PLAN_CAP_GZ)}`,
    );
    process.exit(1);
  } else {
    console.log(
      `  budget OK: ${kb(unionGz)} <= ${kb(BASELINE_GZ + PLAN_CAP_GZ)} (baseline+cap)`,
    );
  }
}
