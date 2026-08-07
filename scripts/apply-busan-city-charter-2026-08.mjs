#!/usr/bin/env node
/**
 * Apply the Busan city private charter over supabase-js.
 *
 *   node --env-file=../../../.env.local scripts/apply-busan-city-charter-2026-08.mjs --dry-run
 *   node --env-file=<path to .env.local> scripts/apply-busan-city-charter-2026-08.mjs
 *
 * Why this exists alongside the SQL: `supabase/pending-db-apply/2026-08-07-06-*.sql`
 * needs `psql` plus SUPABASE_DB_URL, and this repo's machines do not reliably
 * have either — `npm run tours:apply-2026-08-04` dies at exactly that step.
 * Rows come from `gen-busan-city-charter-sql-2026-08.mjs`, the same module that
 * writes the SQL, so the two paths cannot disagree about a field.
 *
 * Idempotent: upsert on tours(slug) and tour_product_pages(slug, locale); the
 * default offer is inserted only when the page has none.
 */
import { createClient } from "@supabase/supabase-js";
import { SLUG, buildRows } from "./gen-busan-city-charter-sql-2026-08.mjs";

const DRY = process.argv.includes("--dry-run");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.error(
    "missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with: node --env-file=<path>/.env.local scripts/apply-busan-city-charter-2026-08.mjs",
  );
  process.exit(2);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const rows = buildRows();
let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => {
  failures += 1;
  console.error(`  \x1b[31m✗\x1b[0m ${m}`);
};

if (DRY) {
  console.log(`[dry-run] ${SLUG}`);
  console.log(`  tours: price ${rows.tour.price} per ${rows.tour.price_type}, is_active ${rows.tour.is_active}`);
  console.log(`  pages: ${rows.pages.map((p) => p.locale).join(", ")}`);
  console.log(`  offer: ${rows.offer.amount_minor} ${rows.offer.currency}`);
  process.exit(0);
}

{
  const { error } = await sb.from("tours").upsert(rows.tour, { onConflict: "slug" });
  if (error) bad(`tours: ${error.message}`);
  else ok(`tours upserted (${rows.tour.price} USD / ${rows.tour.price_type})`);
}

for (const page of rows.pages) {
  const { error } = await sb.from("tour_product_pages").upsert(page, { onConflict: "slug,locale" });
  if (error) bad(`tour_product_pages[${page.locale}]: ${error.message}`);
  else ok(`tour_product_pages[${page.locale}] upserted`);
}

{
  const { data: page, error: pErr } = await sb
    .from("tour_product_pages")
    .select("id")
    .eq("slug", SLUG)
    .eq("locale", "en")
    .maybeSingle();
  if (pErr || !page) bad(`offer: could not resolve en page (${pErr?.message ?? "not found"})`);
  else {
    const { data: existing } = await sb
      .from("tour_product_offers")
      .select("id")
      .eq("tour_product_page_id", page.id)
      .limit(1);
    if (existing?.length) ok("offer already present — left alone");
    else {
      const { error } = await sb
        .from("tour_product_offers")
        .insert({ tour_product_page_id: page.id, ...rows.offer });
      if (error) bad(`offer: ${error.message}`);
      else ok(`offer inserted (${rows.offer.amount_minor} ${rows.offer.currency})`);
    }
  }
}

console.log(
  failures
    ? `\n\x1b[31m${failures} failure(s)\x1b[0m`
    : `\ndone. Next: node scripts/import-match-v18.mjs --single ${SLUG}`,
);
process.exit(failures ? 1 : 0);
