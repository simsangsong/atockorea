#!/usr/bin/env node
/**
 * Post-build QA for the two new Seoul products (2026-08-04).
 *
 * Exists because of a lesson from the Busan small-group track: `page_sections`
 * mirrored an EN string into every non-EN bundle and nothing caught it. So after
 * every build, scan for "did an EN source string survive into a non-EN bundle"
 * plus the structural invariants that the type system cannot see.
 *
 * Checks per product:
 *   1. All expected locale bundles exist and parse.
 *   2. catalog_card.slug equals the directory slug in EVERY locale — a translated
 *      slug mints a phantom catalog card pointing at a 404 (this really happened
 *      to jeju-eastern-unesco-spots-day-tour .es).
 *   3. Structural parity with EN: same stop count, same stop numbers/times, same
 *      FAQ/season/flow counts, same price.
 *   4. EN-leak: for a set of distinctive EN sentences, assert they do NOT appear
 *      verbatim in any non-EN bundle.
 *   5. No unresolved placeholder markers (TODO/TBD/XXX/Lorem).
 *   6. Winter product only: seasonality is winter_only and the season accordion
 *      is present in every locale.
 *
 * Exit code 1 on any failure — this is meant to run in a pre-commit sweep, not
 * to print advice.
 *
 * Run: node scripts/qa-seoul-new-products-2026-08.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SERVED = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const STAGED = ["de", "fr", "it", "ru"];

const PRODUCTS = [
  { slug: "seoul-gapyeong-nami-morning-calm-petite-france-day-tour", winter: false },
  { slug: "seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour", winter: true },
];

/**
 * Distinctive EN strings that must never survive untranslated. Chosen to be long
 * enough that a legitimate coincidence is impossible, and drawn from the blocks
 * that actually leaked on the previous product (sticky note, hero tagline,
 * accordion bodies, FAQ answers).
 */
const LEAK_PROBES = [
  "Select your date and group size to check live availability",
  "Winter season only — select your date",
  "Two Seoul pickup points",
  "own expense",
  "Free cancellation up to 24 hours before pickup",
  "the ice wall is a village-built",
  "Comfortable walking shoes",
  "Non-slip winter footwear",
];

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};

function loadBundle(slug, loc) {
  const p = path.join(ROOT, "components/product-tour-static", slug, `${slug}.${loc}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

for (const { slug, winter } of PRODUCTS) {
  console.log(`\n### ${slug}`);
  const en = loadBundle(slug, "en");
  if (!en) {
    fail(`EN bundle missing — build has not run`);
    continue;
  }

  const expected = SERVED.concat(STAGED);
  for (const loc of expected) {
    const b = loadBundle(slug, loc);
    if (!b) {
      if (SERVED.includes(loc)) fail(`${loc}: served locale bundle MISSING`);
      else console.log(`  · ${loc}: staged bundle not present yet`);
      continue;
    }

    // 2. slug integrity
    if (b.catalog_card?.slug !== slug) {
      fail(`${loc}: catalog_card.slug is ${JSON.stringify(b.catalog_card?.slug)} — must equal the directory slug`);
    }
    if (b.slug !== slug) fail(`${loc}: top-level slug mismatch (${b.slug})`);
    if (b.locale !== loc) fail(`${loc}: locale field is ${b.locale}`);

    // 3. structural parity
    if (b.itineraryStops?.length !== en.itineraryStops.length) {
      fail(`${loc}: ${b.itineraryStops?.length} stops vs EN ${en.itineraryStops.length}`);
    } else {
      en.itineraryStops.forEach((s, i) => {
        const t = b.itineraryStops[i];
        if (t.number !== s.number) fail(`${loc}: stop ${i} number ${t.number} vs EN ${s.number}`);
        if (t.time !== s.time) fail(`${loc}: stop ${i} time "${t.time}" vs EN "${s.time}"`);
        if (!t.description || !String(t.description).trim()) fail(`${loc}: stop ${i} has empty description`);
        if (!t.whyOnRoute || !String(t.whyOnRoute).trim()) fail(`${loc}: stop ${i} has empty whyOnRoute`);
      });
    }
    for (const key of ["staticQuestions", "seasonalVariations", "routeFlowStops", "routePhases", "glanceItems"]) {
      if ((b[key] || []).length !== (en[key] || []).length) {
        fail(`${loc}: ${key} length ${(b[key] || []).length} vs EN ${(en[key] || []).length}`);
      }
    }
    if (b.price?.amountLabel !== en.price.amountLabel) {
      fail(`${loc}: price ${b.price?.amountLabel} vs EN ${en.price.amountLabel}`);
    }
    if (b.sticky_booking_bar?.price?.salePriceUsd !== en.price.salePriceUsd) {
      fail(`${loc}: sticky bar price drifted from the top-level price`);
    }

    // 6. winter invariants
    if (winter) {
      if (b.matching_profile?.seasonality !== "winter_only") {
        fail(`${loc}: seasonality is ${b.matching_profile?.seasonality}, expected winter_only`);
      }
      if (!(b.practicalAccordionItems || []).some((i) => i.id === "season-window")) {
        fail(`${loc}: season-window accordion missing`);
      }
    }

    const blob = JSON.stringify(b);

    // 4. EN leak — over DISPLAY copy only.
    //
    // matching_profile / matching_metadata are deliberately locale-invariant
    // English (the recommender reads them; no guest ever sees them), so their
    // English is not a leak. They used to slip past this probe by luck rather
    // than by rule — the donor's wording simply never collided with a probe
    // string. Excluding them explicitly is what makes the scan mean something.
    const { matching_profile, matching_metadata, ...displayOnly } = b;
    const displayBlob = JSON.stringify(displayOnly);
    if (loc !== "en") {
      for (const probe of LEAK_PROBES) {
        if (displayBlob.includes(probe)) {
          fail(`${loc}: untranslated EN string survived — "${probe}"`);
        }
      }
    }

    // 5. placeholders
    for (const marker of ["TODO", "TBD", "XXX", "Lorem ipsum", "PLACEHOLDER"]) {
      if (blob.includes(marker)) fail(`${loc}: placeholder marker "${marker}" present`);
    }
  }
  console.log(`  checked ${expected.filter((l) => loadBundle(slug, l)).length} locale bundles`);
}

/**
 * 7. The price lives in four places (builder constant → bundle, SLUG_OVERRIDES in
 *    staticTourProductRegistry.ts, SLUG_OVERRIDES in catalogRegistrationBuilder.ts,
 *    and the offers SQL). Nothing used to compare them, so changing one and
 *    forgetting the rest showed one price on the card and charged another. The two
 *    override maps are separate copies of the same data and have genuinely drifted
 *    before (jeju-grand-highlights-loop: 93 in one, 79 in the other), so check both.
 */
const OVERRIDE_FILES = [
  "components/product-tour-static/catalog/staticTourProductRegistry.ts",
  "components/product-tour-static/catalog/catalogRegistrationBuilder.ts",
];

console.log(`\n### price + group size agree across every surface`);
for (const { slug } of PRODUCTS) {
  const en = loadBundle(slug, "en");
  if (!en) continue;
  const bundlePrice = Number(en.price?.salePriceUsd);

  for (const rel of OVERRIDE_FILES) {
    const src = readFileSync(path.join(ROOT, rel), "utf8");
    const m = new RegExp(`"${slug}":\\s*\\{([^}]*)\\}`).exec(src);
    if (!m) {
      fail(`${path.basename(rel)}: no SLUG_OVERRIDES entry for ${slug}`);
      continue;
    }
    const listPrice = /listPriceUsd:\s*(\d+(?:\.\d+)?)/.exec(m[1]);
    if (!listPrice) fail(`${path.basename(rel)}: ${slug} has no listPriceUsd`);
    else if (Number(listPrice[1]) !== bundlePrice) {
      fail(
        `${path.basename(rel)}: ${slug} listPriceUsd ${listPrice[1]} ` +
          `but the EN bundle says ${bundlePrice}`,
      );
    }
    // Join-in coach products must not inherit the 8-guest small-group cap.
    const cap = /maxGroupSize:\s*(\d+)/.exec(m[1]);
    if (!cap) fail(`${path.basename(rel)}: ${slug} has no maxGroupSize`);
    else if (Number(cap[1]) < 20) {
      fail(
        `${path.basename(rel)}: ${slug} maxGroupSize ${cap[1]} — these are join-in ` +
          `coach tours, a small-group cap is a false claim`,
      );
    }
  }

  // Look in applied/ as well as pending/ — the file moves once it lands on the
  // DB, and a check that silently stops checking is worse than no check.
  let sqlPath = null;
  for (const dir of ["supabase/pending-db-apply", "supabase/pending-db-apply/applied"]) {
    const abs = path.join(ROOT, dir);
    if (!existsSync(abs)) continue;
    const hit = readdirSync(abs).find(
      (f) =>
        f.endsWith(".sql") &&
        f.includes("seoul") &&
        readFileSync(path.join(abs, f), "utf8").includes(`'${slug}'`),
    );
    if (hit) {
      sqlPath = path.join(abs, hit);
      break;
    }
  }
  if (!sqlPath) {
    fail(`${slug}: no offers SQL found in pending/ or applied/ — regenerate it`);
  } else {
    const body = readFileSync(sqlPath, "utf8");
    if (!body.includes(`${bundlePrice * 100}, 'USD'`)) {
      fail(
        `${path.basename(sqlPath)}: offers row does not carry the bundle price ` +
          `(${bundlePrice * 100} minor)`,
      );
    }
  }
  console.log(`  ${slug}: USD ${bundlePrice} ${sqlPath ? `(${path.basename(sqlPath)})` : ""}`);
}

if (failures) {
  console.error(`\n✗ ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\n✓ all checks passed");
