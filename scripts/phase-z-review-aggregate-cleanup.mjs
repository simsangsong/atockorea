/**
 * Tour-content Phase Z — fabricated review-aggregate residual cleanup.
 *
 * The Phase Z jest sweep surfaced 2 EN bundles still carrying Phase 1a-style
 * "X.X/5 (N reviews)" review aggregates that earlier passes had missed:
 *   - east-signature-nature-core: description ("4.8/5 (127 reviews).") +
 *     reasoning body ("4.8/5 rating across 127 reviews —")
 *   - busan-small-group-sightseeing-tour-cruise-passengers: subtitle
 *     ("The 4.9/5 rating across 32 reviews reflects how tightly...")
 *
 * Per Phase 1a rationale: AtoC catalog does not surface aggregate review
 * counts, and fabricated numbers create review-fraud / trust-policy risk.
 * Each sentence is removed cleanly without disturbing the surrounding copy.
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "C:/Users/sangsong/atockorea-content-fix/components/product-tour-static";

const EDITS = [
  {
    slug: "east-signature-nature-core",
    needles: [
      [" 4.8/5 (127 reviews).", ""],
      [
        "Licensed local operator with 4.8/5 rating across 127 reviews — itinerary refined over hundreds of east Jeju runs.",
        "Licensed local operator with an itinerary refined over hundreds of east Jeju runs.",
      ],
    ],
  },
  {
    slug: "busan-small-group-sightseeing-tour-cruise-passengers",
    needles: [
      [" The 4.9/5 rating across 32 reviews reflects how tightly this circuit is planned.", ""],
    ],
  },
];

let total = 0;
for (const { slug, needles } of EDITS) {
  const path = `${ROOT}/${slug}/${slug}.en.json`;
  let txt = readFileSync(path, "utf8");
  let local = 0;
  for (const [needle, replacement] of needles) {
    if (!txt.includes(needle)) {
      console.log(`  ${slug}: needle NOT FOUND — "${needle.slice(0, 60)}…"`);
      continue;
    }
    txt = txt.split(needle).join(replacement);
    console.log(`  ${slug}: swapped "${needle.slice(0, 60)}…"`);
    local++;
  }
  if (local > 0) {
    try {
      JSON.parse(txt);
    } catch (e) {
      throw new Error(`${slug}: JSON parse failed — ${e.message}`);
    }
    writeFileSync(path, txt, "utf8");
    total += local;
  }
}
console.log(`\ntotal swaps applied: ${total}`);
