#!/usr/bin/env node
/**
 * Apply the two 2026-08-04 Seoul-departure products over supabase-js.
 *
 *   node --env-file=.env.local scripts/apply-seoul-new-products-2026-08.mjs --dry-run
 *   node --env-file=.env.local scripts/apply-seoul-new-products-2026-08.mjs
 *   node --env-file=.env.local scripts/apply-seoul-new-products-2026-08.mjs --only <slug>
 *   node --env-file=.env.local scripts/apply-seoul-new-products-2026-08.mjs --inactive
 *
 * Why this exists: the equivalent SQL in supabase/pending-db-apply needs `psql`
 * plus a Postgres connection string, and this repo's machines do not reliably
 * have either — apply-tour-catalog-2026-08-04.mjs dies at that step. Rows come
 * from seoul-new-products-rows-2026-08.mjs, the same module the SQL generator
 * reads, so the two paths cannot disagree about a field.
 *
 * --inactive writes tours.is_active = false. Use it for the winter product
 * outside its season: nothing in the app reads matching_profile.seasonality
 * (checked 2026-08-04 — the field has no consumer), so `is_active` and
 * CONSUMER_BLOCKED_TOUR_SLUGS are the only things that actually gate a sale.
 *
 * Idempotent. Existing rows are updated on exactly the columns the SQL's
 * DO UPDATE lists, so hand-tuned values in the other columns survive a re-run.
 */
import { createClient } from "@supabase/supabase-js";
import { PRODUCTS, buildRows } from "./seoul-new-products-rows-2026-08.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const INACTIVE = args.includes("--inactive");
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.error(
    "missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with: node --env-file=.env.local scripts/apply-seoul-new-products-2026-08.mjs",
  );
  process.exit(2);
}

// Mirrors the SQL's ON CONFLICT (slug) DO UPDATE list. Columns absent here are
// written on first insert only.
const TOUR_UPDATE_COLS = [
  "title", "city", "tag", "subtitle", "description", "highlight",
  "price", "original_price", "price_currency", "price_type", "image_url", "gallery_images",
  "duration", "difficulty", "group_size", "lunch_included", "ticket_included",
  "pickup_info", "notes", "badges", "schedule",
  "rating", "review_count", "pickup_points_count", "dropoff_points_count",
  "is_active", "seo_title", "meta_description",
];

const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const C = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m` };
let failures = 0;
const ok = (m) => console.log(`  ${C.g("✓")} ${m}`);
const bad = (m) => {
  failures += 1;
  console.error(`  ${C.r("✗")} ${m}`);
};

const pick = (obj, cols) => Object.fromEntries(cols.map((c) => [c, obj[c]]));

/**
 * Canonical JSON for comparing a round-tripped jsonb against the source object.
 * Postgres jsonb does not preserve key order, so a plain JSON.stringify compare
 * reports every row as different even when nothing changed.
 */
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

for (const cfg of PRODUCTS) {
  if (ONLY && cfg.slug !== ONLY) continue;
  console.log(`\n### ${cfg.slug}`);
  const rows = buildRows(cfg);
  if (INACTIVE) rows.tour.is_active = false;

  console.log(
    `  ${C.d(`USD ${rows.priceUsd} · is_active=${rows.tour.is_active} · ` +
      `${rows.pages.length} served + ${rows.stagedPages.length} staged locales`)}`,
  );
  if (DRY) {
    console.log(`  ${C.d("dry run — no writes")}`);
    continue;
  }

  // 1) tours
  const { data: existing } = await sb.from("tours").select("id").eq("slug", cfg.slug).maybeSingle();
  if (existing?.id) {
    const { error } = await sb
      .from("tours")
      .update(pick(rows.tour, TOUR_UPDATE_COLS))
      .eq("slug", cfg.slug);
    if (error) bad(`tours update: ${error.message}`);
    else ok(`tours updated (existing row)`);
  } else {
    const { error } = await sb.from("tours").insert(rows.tour);
    if (error) bad(`tours insert: ${error.message}`);
    else ok(`tours inserted`);
  }

  const { data: tour } = await sb.from("tours").select("id").eq("slug", cfg.slug).maybeSingle();
  if (!tour?.id) {
    bad(`tours row missing after write — skipping pages`);
    continue;
  }

  // 2) tour_product_pages — served locales, upsert
  const served = rows.pages.map((r) => ({ ...r, tour_id: tour.id, updated_at: new Date().toISOString() }));
  const { error: e2 } = await sb
    .from("tour_product_pages")
    .upsert(served, { onConflict: "slug,locale" });
  if (e2) bad(`pages upsert: ${e2.message}`);
  else ok(`${served.length} served locale pages upserted`);

  // 3) staged locales — INSERT-only, never clobber an existing translation
  if (rows.stagedPages.length) {
    const { data: have } = await sb
      .from("tour_product_pages")
      .select("locale")
      .eq("slug", cfg.slug)
      .in("locale", rows.stagedPages.map((r) => r.locale));
    const already = new Set((have ?? []).map((r) => r.locale));
    const fresh = rows.stagedPages
      .filter((r) => !already.has(r.locale))
      .map((r) => ({ ...r, tour_id: tour.id }));
    if (!fresh.length) ok(`staged locales already present — nothing inserted`);
    else {
      const { error: e3 } = await sb.from("tour_product_pages").insert(fresh);
      if (e3) bad(`staged insert: ${e3.message}`);
      else ok(`${fresh.length} staged locale pages inserted (${fresh.map((r) => r.locale).join(", ")})`);
    }
  }

  // 4) offer — insert only if this page has no default offer yet
  const { data: enPage } = await sb
    .from("tour_product_pages")
    .select("id")
    .eq("slug", cfg.slug)
    .eq("locale", "en")
    .maybeSingle();
  if (!enPage?.id) bad(`EN page missing — offer not written`);
  else {
    const { data: defaults } = await sb
      .from("tour_product_offers")
      .select("id,amount_minor")
      .eq("tour_product_page_id", enPage.id)
      .eq("is_default", true);
    if (defaults?.length) {
      const cur = Number(defaults[0].amount_minor);
      if (cur !== rows.offer.amount_minor) {
        bad(
          `default offer is ${cur / 100} USD but the bundle says ${rows.offer.amount_minor / 100} — ` +
            `left alone, fix deliberately`,
        );
      } else ok(`default offer already correct (${cur / 100} USD)`);
    } else {
      const { error: e4 } = await sb
        .from("tour_product_offers")
        .insert({ ...rows.offer, tour_product_page_id: enPage.id });
      if (e4) bad(`offer insert: ${e4.message}`);
      else ok(`default offer inserted (${rows.offer.amount_minor / 100} USD)`);
    }
  }

  // 5) verify — detail_payload must equal the bundle byte-for-byte
  const { data: back } = await sb
    .from("tour_product_pages")
    .select("locale,is_published,price_amount_label,detail_payload")
    .eq("slug", cfg.slug);
  for (const r of rows.pages.concat(rows.stagedPages)) {
    const got = (back ?? []).find((x) => x.locale === r.locale);
    if (!got) bad(`${r.locale}: page row missing after write`);
    else if (canon(got.detail_payload) !== canon(r.detail_payload)) {
      bad(`${r.locale}: detail_payload does not match the built bundle`);
    }
  }
  ok(`${rows.pages.length + rows.stagedPages.length} detail_payloads match their bundles`);
  const { data: t2 } = await sb
    .from("tours")
    .select("price,is_active")
    .eq("slug", cfg.slug)
    .maybeSingle();
  if (Number(t2?.price) !== rows.priceUsd) bad(`tours.price is ${t2?.price}, expected ${rows.priceUsd}`);
  else ok(`verified: price USD ${t2.price}, is_active=${t2.is_active}`);
}

console.log("");
if (failures) {
  console.error(C.r(`${failures} failure(s).`));
  process.exit(1);
}
console.log(C.g(DRY ? "Dry run complete." : "Done."));
console.log(C.d("Next: node scripts/import-match-v18.mjs --single <slug> for each applied slug"));
