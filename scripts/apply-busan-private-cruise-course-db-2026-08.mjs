#!/usr/bin/env node
/**
 * Runs `restore-busan-private-cruise-course-2026-08.mjs` against the live
 * `tour_product_pages.detail_payload` — the source the product page actually
 * renders (`TOUR_PRODUCT_USE_SUPABASE=1`). Fixing the bundles alone changes
 * nothing a guest sees.
 *
 * 🔴 It re-runs the TRANSFORM, it does not push the bundle. Several sessions
 * write these rows; a wholesale copy would silently discard whatever landed
 * since this branch forked. Restoring clipped English and correcting a poi_key
 * cannot destroy anyone's work, whatever else has changed in the row.
 *
 * de/fr/it/ru have no bundle — they are staged rows served as English. Here they
 * get their poi_keys corrected and nothing else: their itinerary text is a
 * machine translation of the English this pass just fixed, so re-translating
 * them belongs to the i18n pipeline, from the corrected English.
 *
 *   node --env-file=.env.local scripts/apply-busan-private-cruise-course-db-2026-08.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { restore } from "./restore-busan-private-cruise-course-2026-08.mjs";

const DRY = process.argv.includes("--dry-run");
const SLUG = "busan-private-car-charter-cruise-shore";

/** jsonb does not preserve key order, so compare canonically or every row looks dirty. */
const canon = (v) =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : x,
  );

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
if (!url || !key) {
  console.error("missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — run with --env-file=.env.local");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await db
  .from("tour_product_pages")
  .select("id, locale, detail_payload")
  .eq("slug", SLUG);
if (error) throw new Error(error.message);
if (!data?.length) {
  console.error(`🔴 no rows for ${SLUG}`);
  process.exit(2);
}

const esRow = data.find((r) => r.locale === "es");
if (!esRow) {
  console.error("🔴 no Spanish row — it is the photo donor for the Gamcheon stop");
  process.exit(2);
}

let updated = 0;
for (const row of data.sort((a, b) => a.locale.localeCompare(b.locale))) {
  const before = canon(row.detail_payload);
  const { log, skipped } = restore(row.detail_payload, row.locale, esRow.detail_payload);
  if (skipped) {
    console.error(`🔴 ${row.locale}: ${skipped}`);
    process.exit(2);
  }
  if (canon(row.detail_payload) === before) {
    console.log(`  ${row.locale}: unchanged`);
    continue;
  }
  console.log(`  ${row.locale}: ${log.length} change(s)`);
  for (const line of log) console.log(`      ${line}`);
  if (!DRY) {
    const { error: upErr } = await db
      .from("tour_product_pages")
      .update({ detail_payload: row.detail_payload, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (upErr) throw new Error(`${row.locale}: ${upErr.message}`);
  }
  updated += 1;
}

console.log(`\n${DRY ? "[dry-run] would update" : "updated"} ${updated} row(s) of ${data.length}`);
