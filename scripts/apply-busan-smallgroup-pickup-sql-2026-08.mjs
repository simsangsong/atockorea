#!/usr/bin/env node
/**
 * Applies supabase/pending-db-apply/2026-08-05-14-busan-smallgroup-hotel-pickup.sql
 * over supabase-js, for machines with the service-role key but no psql and no
 * Postgres connection string.
 *
 *   node --env-file=.env.local scripts/apply-busan-smallgroup-pickup-sql-2026-08.mjs [--dry-run]
 *
 * WHY THIS EXISTS AND WHY IT DOES NOT PARSE THE SQL. The sibling
 * scripts/apply-jsonb-repair-sql.mjs parses its input, which is the right shape
 * of safety for surgical leaf patches. This file is 585 KB whose ten locale
 * statements are each ONE 55 KB line — a thirteen-deep nested jsonb_set chain.
 * Regex over that is how you get a parse that looks clean and is wrong.
 *
 * So it reads the bundles instead, which is what generated the SQL, and pins
 * the equivalence the other direction: every value it is about to write must
 * appear VERBATIM in the committed .sql. If the bundles and the SQL have
 * drifted, this refuses to run rather than writing the newer of the two.
 *
 * Idempotent: every write is a computed value keyed on (slug) or (slug, locale),
 * and the page writes are a compare-and-swap on updated_at so a concurrent
 * writer loses the race loudly instead of silently.
 *
 * Touches nothing else — no price, no is_active, no is_published, no offers.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = "busan-small-group-yonggungsa-skycapsule-gamcheon-tour";
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es", "de", "fr", "it", "ru"];
const SQL = path.join(
  REPO,
  "supabase/pending-db-apply/2026-08-05-14-busan-smallgroup-hotel-pickup.sql",
);

/** Kept identical to BLOCKS in scripts/gen-busan-smallgroup-pickup-sql-2026-08.mjs. */
const BLOCKS = [
  "seo",
  "catalog_card",
  "hero",
  "itineraryStops",
  "routeFlowStops",
  "routePhases",
  "routeShapeIntro",
  "whyTourWorks",
  "practicalAccordionItems",
  "bookingSupportSteps",
  "staticQuestions",
  "pickup_dropoff",
  "matching_profile",
];

const DRY = process.argv.includes("--dry-run");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — run with --env-file=.env.local");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const bundle = (loc) =>
  JSON.parse(
    readFileSync(path.join(REPO, "components/product-tour-static", SLUG, `${SLUG}.${loc}.json`), "utf8"),
  );

// ---------------------------------------------------------------------------
// Pin bundle ≡ SQL before touching anything
// ---------------------------------------------------------------------------
const src = readFileSync(SQL, "utf8");
const esc = (s) => String(s).replace(/'/g, "''");
const drift = [];

const docs = new Map(LOCALES.map((loc) => [loc, bundle(loc)]));
for (const [loc, d] of docs) {
  for (const k of BLOCKS) {
    if (d[k] === undefined) {
      drift.push(`${loc}: bundle has no "${k}"`);
      continue;
    }
    if (!src.includes(`'{"${k}"}', '${esc(JSON.stringify(d[k]))}'::jsonb, true`))
      drift.push(`${loc}.${k}: bundle value is not the one in the .sql`);
  }
  if (!src.includes(`  duration_label = '${esc(d.catalog_card.duration)}',`))
    drift.push(`${loc}: duration_label not in the .sql`);
  if (!src.includes(`  stops_count = ${d.catalog_card.stopsCount},`))
    drift.push(`${loc}: stops_count not in the .sql`);
  if (!src.includes(`WHERE slug = '${esc(SLUG)}' AND locale = '${esc(loc)}';`))
    drift.push(`${loc}: no statement for this locale in the .sql`);
}

const en = docs.get("en");
const toursRow = {
  duration: en.catalog_card.duration,
  schedule: en.itineraryStops.map((s) => ({ time: s.time, title: s.name, description: s.category })),
  pickup_points_count: 1,
  dropoff_points_count: en.pickup_dropoff.return.length,
};
if (!src.includes(`  duration = '${esc(toursRow.duration)}',`)) drift.push("tours.duration drift");
if (!src.includes(`  schedule = '${esc(JSON.stringify(toursRow.schedule))}'::jsonb,`))
  drift.push("tours.schedule drift");
if (!src.includes(`  dropoff_points_count = ${toursRow.dropoff_points_count},`))
  drift.push("tours.dropoff_points_count drift");

const declared = (src.match(/^UPDATE public\.tour_product_pages SET$/gm) || []).length;
if (declared !== LOCALES.length)
  drift.push(`.sql declares ${declared} page statements, expected ${LOCALES.length}`);

if (drift.length) {
  console.error(`✗ bundles and ${path.basename(SQL)} disagree — refusing to run.`);
  for (const d of drift) console.error("   " + d);
  process.exit(1);
}
console.log(
  `bundle ≡ sql: ${LOCALES.length} locales × ${BLOCKS.length} blocks + 2 columns + the tours row, all verbatim`,
);

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------
const stable = (v) =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );

let wroteRows = 0, noopRows = 0, missing = 0, cas = 0;

for (const [locale, d] of docs) {
  const { data: row, error } = await sb
    .from("tour_product_pages")
    .select("detail_payload,duration_label,stops_count,updated_at")
    .eq("slug", SLUG)
    .eq("locale", locale)
    .maybeSingle();
  if (error) throw new Error(`${locale}: ${error.message}`);
  if (!row) {
    missing += 1;
    console.log(`  ${locale}: no such row — skipped`);
    continue;
  }

  const next = structuredClone(row.detail_payload ?? {});
  for (const k of BLOCKS) next[k] = d[k];
  const durationLabel = d.catalog_card.duration;
  const stopsCount = d.catalog_card.stopsCount;

  if (
    stable(next) === stable(row.detail_payload) &&
    row.duration_label === durationLabel &&
    row.stops_count === stopsCount
  ) {
    noopRows += 1;
    continue;
  }
  if (DRY) {
    wroteRows += 1;
    continue;
  }

  const { data: wrote, error: werr } = await sb
    .from("tour_product_pages")
    .update({
      detail_payload: next,
      duration_label: durationLabel,
      stops_count: stopsCount,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", SLUG)
    .eq("locale", locale)
    .eq("updated_at", row.updated_at)
    .select("locale");
  if (werr) throw new Error(`${locale} write: ${werr.message}`);
  if (!wrote?.length) {
    cas += 1;
    console.log(`  ${locale}: CAS lost — row changed under us, NOT applied`);
    continue;
  }
  wroteRows += 1;
}

// tours row — no guard in the .sql either; it writes a value computed from EN.
const { data: t, error: terr } = await sb
  .from("tours")
  .select("duration,schedule,pickup_points_count,dropoff_points_count")
  .eq("slug", SLUG)
  .maybeSingle();
if (terr) throw new Error(`tours: ${terr.message}`);
let toursState = "missing row";
if (t) {
  const same =
    t.duration === toursRow.duration &&
    stable(t.schedule) === stable(toursRow.schedule) &&
    t.pickup_points_count === toursRow.pickup_points_count &&
    t.dropoff_points_count === toursRow.dropoff_points_count;
  if (same) toursState = "already current";
  else if (DRY) toursState = "would update";
  else {
    const { error: uerr } = await sb
      .from("tours")
      .update({ ...toursRow, updated_at: new Date().toISOString() })
      .eq("slug", SLUG);
    if (uerr) throw new Error(`tours write: ${uerr.message}`);
    toursState = "updated";
  }
}

console.log(
  `${DRY ? "would write" : "wrote"}: ${wroteRows} locale row(s) | already current: ${noopRows} | missing: ${missing} | CAS lost: ${cas} | tours: ${toursState}`,
);
if (cas) process.exit(1);
