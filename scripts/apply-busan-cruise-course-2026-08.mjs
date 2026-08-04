#!/usr/bin/env node
/**
 * Applies the Busan cruise course alignment to the DB over supabase-js, for
 * machines with the service-role key but no psql.
 *
 *   node --env-file=.env.local scripts/apply-busan-cruise-course-2026-08.mjs [--dry-run]
 *
 * `psql -f supabase/pending-db-apply/2026-08-04-11-busan-cruise-course.sql` is the
 * intended route and stays the right one where a connection string exists. That
 * file is 2 MB of full-row UPDATEs (detail_payload is the whole page document),
 * which is past what the MCP SQL endpoint will take in one call.
 *
 * 🔴 THIS READS THE SAME SOURCE AS THE SQL — the static bundles — so the two
 * cannot drift. It does not parse the .sql file; it rebuilds the same writes.
 *
 * Idempotent: every write is keyed on (slug) or (slug, locale), and rows whose
 * payload already matches are skipped, so re-running reports 0 changes.
 *
 * Visibility and price are NOT touched: 2026-08-04-10 owns those.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const SLUGS = [
  "busan-cruise-shore-excursion-bus-tour",
  "busan-small-group-sightseeing-tour-cruise-passengers",
  "busan-private-car-charter-cruise-shore",
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
if (!url || !key) {
  console.error("missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — run with --env-file=.env.local");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const bundle = (slug, loc) =>
  JSON.parse(readFileSync(`components/product-tour-static/${slug}/${slug}.${loc}.json`, "utf8"));

/**
 * Postgres `jsonb` does not preserve key order, so the payload that comes back
 * never string-matches the bundle byte for byte. Comparing raw JSON.stringify
 * made every row look changed and the "already current" count was always 0 —
 * an idempotence check that could not fail is not a check.
 */
const canonical = (v) => {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  }
  return v;
};
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

let changed = 0;
let skipped = 0;

for (const slug of SLUGS) {
  const en = bundle(slug, "en");
  const cc = en.catalog_card || {};
  const seo = en.seo || {};
  const stops = en.itineraryStops || [];
  const schedule = stops.map((s) => ({ time: s.time, title: s.name, description: s.category || "" }));
  const gallery = (en.galleryItems || []).slice(0, 5).map((g) => g.src).filter(Boolean);

  const tourPatch = {
    title: cc.title || "",
    subtitle: cc.subtitle || "",
    description: cc.shortCardDescription || "",
    highlight: cc.subtitle || "",
    duration: cc.duration || "",
    badges: cc.badges || [],
    schedule,
    seo_title: seo.pageTitle || "",
    meta_description: seo.metaDescription || "",
    updated_at: new Date().toISOString(),
  };
  if (gallery.length) {
    tourPatch.image_url = gallery[0];
    tourPatch.gallery_images = gallery;
  }

  if (DRY) {
    console.log(`[dry-run] tours ${slug}: duration=${tourPatch.duration} schedule=${schedule.length}`);
  } else {
    const { error } = await db.from("tours").update(tourPatch).eq("slug", slug);
    if (error) throw new Error(`tours ${slug}: ${error.message}`);
    console.log(`tours ${slug}: duration=${tourPatch.duration} schedule=${schedule.length} entries`);
  }

  for (const locale of LOCALES) {
    const b = locale === "en" ? en : bundle(slug, locale);
    const lcc = b.catalog_card || {};
    const lseo = b.seo || {};

    const { data: existing, error: readErr } = await db
      .from("tour_product_pages")
      .select("id, detail_payload")
      .eq("slug", slug)
      .eq("locale", locale)
      .maybeSingle();
    if (readErr) throw new Error(`read ${slug}/${locale}: ${readErr.message}`);
    if (!existing) {
      console.warn(`  ! no row for ${slug}/${locale} — skipped (this file never INSERTs)`);
      continue;
    }
    if (same(existing.detail_payload, b)) {
      skipped += 1;
      continue;
    }

    const patch = {
      title: lcc.title || cc.title || "",
      subtitle: lcc.subtitle || "",
      region_label: lcc.region || "",
      duration_label: lcc.duration || "",
      stops_count: lcc.stopsCount ?? 9,
      badges: lcc.badges || [],
      hero_image_url: b.hero?.imageUrl || lcc.heroImage || "",
      thumbnail_url: lcc.thumbnail || lcc.heroImage || "",
      card_short_description: lcc.shortCardDescription || "",
      seo_title: lseo.pageTitle || "",
      meta_description: lseo.metaDescription || "",
      headline_line_1: b.headlineLine1 || "",
      headline_line_2: b.headlineLine2 || "",
      detail_payload: b,
      updated_at: new Date().toISOString(),
    };

    if (DRY) {
      console.log(`  [dry-run] ${slug}/${locale}: stops_count=${patch.stops_count} duration=${patch.duration_label}`);
    } else {
      const { error } = await db.from("tour_product_pages").update(patch).eq("id", existing.id);
      if (error) throw new Error(`update ${slug}/${locale}: ${error.message}`);
      console.log(`  ${slug}/${locale}: stops_count=${patch.stops_count} duration=${patch.duration_label}`);
    }
    changed += 1;
  }
}

console.log(`\n${DRY ? "[dry-run] would update" : "updated"} ${changed} page row(s); ${skipped} already current.`);
console.log("Next: node scripts/import-match-v18.mjs --single <each slug>");
