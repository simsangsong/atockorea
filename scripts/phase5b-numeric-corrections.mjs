/**
 * Tour-content Phase 5b — numeric corrections (EN, surgical).
 *
 * Master plan §5 listed 10+ "verify-then-fix" numeric items. The 2026-05-23
 * audit confirmed 4 of them are already consistent across the EN bundles
 * (Nami ₩19,000, Morning Calm 20 themed gardens, Ahopsan ₩5,000, Herb Island
 * Wed closure phrasing). Two remain:
 *
 *   1. **Bukchon hanok count** — `from-incheon-seoul-day-tour-cruise-guests`
 *      says "≈600 traditional houses" in two places while the matching
 *      reasoning row and the sister tour (`incheon-seoul-private-car-shore-
 *      excursion-cruise`) both say "~900". Source: Seoul Tourism. Unify on
 *      ≈900.
 *
 *   2. **Sanjeong Lake trail length + time** — `pocheon-sanjeong-lake-herb-
 *      island-art-valley` says "3 km loop / ~50-60 min" in description +
 *      whyOnRoute while the FAQ and reasoning both say "full loop 4 km".
 *      Source: AllTrails 2.3 mi → ≈3.7 km (round to 4); 75 min easy walk.
 *      Unify on 4 km / 75 min.
 *
 * Targeted needle-and-replacement edits only (memory rule
 * `feedback_data_preservation`). EN-first per Phase 5a pattern;
 * locale propagation tracked separately.
 *
 * Re-running this script is idempotent — each replacement is a literal
 * string swap, applied only if the needle still exists. `mutations`
 * counter prints how many actual swaps happened so we know if a re-run
 * was a no-op.
 */
import { readFileSync, writeFileSync } from "node:fs";

const EDITS = [
  // Bukchon hanok 600 → 900
  {
    slug: "from-incheon-seoul-day-tour-cruise-guests",
    needles: [
      ["≈600 traditional houses", "≈900 traditional houses"],
      ["Approximately 600 traditional houses", "Approximately 900 traditional houses"],
    ],
  },
  // Sanjeong Lake 3 km / 50-60 min → 4 km / 75 min
  {
    slug: "pocheon-sanjeong-lake-herb-island-art-valley",
    needles: [
      [
        "well-maintained **3 km loop walking trail** circles the water (~50-60 min easy walk per AllTrails 2.3 mi loop)",
        "well-maintained **4 km loop walking trail** circles the water (~75 min easy walk per AllTrails 2.3 mi loop)",
      ],
      [
        "the 3 km circular trail packs the maximum mountain-mirror photography density into a 90-minute time budget",
        "the 4 km circular trail packs the maximum mountain-mirror photography density into a 90-minute time budget",
      ],
      [
        "**3 km gentle loop with 23.5 m maximum depth lake depth",
        "**4 km gentle loop with 23.5 m maximum depth lake depth",
      ],
      ["3 km loop walking trail (~50-60 min easy)", "4 km loop walking trail (~75 min easy)"],
      ["Free walking time on the 3 km loop trail (~60 min)", "Free walking time on the 4 km loop trail (~75 min)"],
      ["Easy — flat 3 km loop in 50-60 min", "Easy — flat 4 km loop in ~75 min"],
      ["The 3 km easy loop is the family default", "The 4 km easy loop is the family default"],
      ["+ 3 km loop trail +", "+ 4 km loop trail +"],
      ["Sanjeong Lake easy 3 km loop", "Sanjeong Lake easy 4 km loop"],
    ],
  },
];

const ROOT = "C:/Users/sangsong/atockorea-content-fix/components/product-tour-static";
let total = 0;

for (const { slug, needles } of EDITS) {
  const path = `${ROOT}/${slug}/${slug}.en.json`;
  let txt = readFileSync(path, "utf8");
  let local = 0;
  for (const [needle, replacement] of needles) {
    if (!txt.includes(needle)) {
      console.log(`  ${slug}: NEEDLE NOT FOUND — "${needle.slice(0, 60)}…"`);
      continue;
    }
    const before = txt.length;
    txt = txt.split(needle).join(replacement);
    const swaps = (before - txt.length === 0 && needle.length === replacement.length)
      ? "≥1"
      : Math.round((before - txt.length) / (needle.length - replacement.length || 1));
    local++;
    console.log(`  ${slug}: swapped "${needle.slice(0, 60)}…" (${swaps} occurrence${swaps !== "≥1" && swaps > 1 ? "s" : ""})`);
  }
  if (local > 0) {
    // Validate JSON survives the edit before writing.
    try {
      JSON.parse(txt);
    } catch (e) {
      throw new Error(`${slug}: JSON parse failed after edits — ${e.message}`);
    }
    writeFileSync(path, txt, "utf8");
    total += local;
  }
}

console.log(`\ntotal swaps applied: ${total}`);
