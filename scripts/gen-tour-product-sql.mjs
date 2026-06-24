#!/usr/bin/env node
/**
 * Restore of scripts/gen-tour-product-sql.mjs.
 *
 * Emits an idempotent .sql file per tour-product slug that mirrors
 * scripts/apply-tour-product.mjs 1:1 (tours + tour_product_pages all-locale +
 * tour_product_offers), but writes SQL instead of upserting via the JS client.
 *
 * Usage:
 *   node scripts/gen-tour-product-sql.mjs <slug> [<slug> ...] --out-dir <dir>
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

// ---- arg parse ----
const argv = process.argv.slice(2);
let outDir = join(root, "supabase/pending-upload");
const slugs = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--out-dir") outDir = join(root, argv[++i]);
  else slugs.push(argv[i]);
}
if (!slugs.length) { console.error("need slug(s)"); process.exit(1); }
mkdirSync(outDir, { recursive: true });

// ---- SQL serializers ----
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jb = (o) => `${q(JSON.stringify(o))}::jsonb`;
const txtArr = (a) => `ARRAY[${(a || []).map(q).join(", ")}]::text[]`;
const numOrNull = (n) => (n === null || n === undefined || n === "" || !Number.isFinite(Number(n)) ? "NULL" : String(Number(n)));
const boolSql = (b) => (b ? "TRUE" : "FALSE");

// ---- mapping logic (copied 1:1 from scripts/apply-tour-product.mjs) ----
const asRecord = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
function mergeFullPageWithLocaleBase(en, loc) {
  const merged = { ...en, ...loc };
  if (loc?.sectionUi && en?.sectionUi) merged.sectionUi = { ...en.sectionUi, ...loc.sectionUi };
  else if (loc?.sectionUi) merged.sectionUi = loc.sectionUi;
  return merged;
}
const TOURS_CITY_ALLOWED = ["Seoul", "Busan", "Jeju"];
function resolveToursCity(doc, slug) {
  const cc = asRecord(doc.catalog_card);
  const ov = asRecord(asRecord(doc.sql_overrides).tours);
  if (ov.city && TOURS_CITY_ALLOWED.includes(ov.city)) return ov.city;
  const hay = [cc.region, cc.title, cc.subtitle, slug].filter((v) => typeof v === "string" && v).join(" | ").toLowerCase();
  for (const c of TOURS_CITY_ALLOWED) if (hay.includes(c.toLowerCase())) return c;
  return "Jeju";
}
function resolveToursPrice(doc) {
  const ov = asRecord(asRecord(doc.sql_overrides).tours);
  if (ov.price != null) { const f = Number(ov.price); if (Number.isFinite(f) && f >= 0) return f; }
  const al = asRecord(doc.price).amountLabel;
  if (al != null) { const n = Number(String(al).replace(/[^0-9.]/g, "")); if (Number.isFinite(n) && n > 0) return n; }
  const pl = asRecord(doc.catalog_card).priceLabel;
  if (typeof pl === "string") { const m = pl.match(/(\d+(?:\.\d+)?)/); if (m) return Number(m[1]); }
  return 0;
}
let _pr = null;
function loadPricingRules() {
  if (_pr !== null) return _pr;
  const p = join(root, "data/tour-policies/pricing-rules.json");
  if (!existsSync(p)) return (_pr = { rules: [] });
  try { _pr = JSON.parse(readFileSync(p, "utf8")); } catch { _pr = { rules: [] }; }
  return _pr;
}
function resolvePolicyPrice(doc) {
  const ov = asRecord(asRecord(doc.sql_overrides).tours);
  if (ov.price != null || ov.original_price != null) return null;
  const mp = asRecord(doc.matching_profile);
  const dest = String(mp.destination_region ?? "").toLowerCase();
  const pt = String(mp.product_type ?? "");
  if (!dest || !pt) return null;
  const { rules } = loadPricingRules();
  if (!Array.isArray(rules)) return null;
  const m = rules.find((r) => String(r.destination_region).toLowerCase() === dest && String(r.product_type) === pt);
  if (!m) return null;
  return { price: Number(m.price), originalPrice: m.original_price != null ? Number(m.original_price) : null, currency: m.currency || "USD" };
}
function buildToursRow(doc, slug) {
  const cc = asRecord(doc.catalog_card);
  const ov = asRecord(asRecord(doc.sql_overrides).tours);
  const pp = resolvePolicyPrice(doc);
  const price = pp ? pp.price : resolveToursPrice(doc);
  const city = resolveToursCity(doc, slug);
  const cur = pp ? pp.currency : (asRecord(doc.price).currency ?? "USD");
  const hero = cc.heroImage ?? asRecord(doc.hero).imageUrl ?? "";
  const gallery = Array.isArray(doc.galleryItems) ? doc.galleryItems.map((g) => g?.src).filter((u) => typeof u === "string" && u) : [];
  const itin = Array.isArray(doc.itineraryStops) ? doc.itineraryStops.map((s) => ({ time: s?.time ?? "", title: s?.name ?? "", description: s?.category ?? "" })) : [];
  return {
    title: cc.title ?? slug, slug, city,
    tag: ov.tag ?? `Small group · ${cc.region ?? ""}`.trim(),
    subtitle: cc.subtitle ?? "", description: ov.description ?? cc.shortCardDescription ?? "",
    highlight: ov.highlight ?? cc.subtitle ?? "",
    price: Number(price.toFixed(2)),
    original_price: ov.original_price ?? (pp ? pp.originalPrice : null) ?? cc.compareAtPriceUsd ?? null,
    price_currency: cur, price_type: ov.price_type ?? asRecord(doc.price).per ?? "person",
    image_url: hero, gallery_images: gallery,
    duration: ov.duration ?? cc.duration ?? "", difficulty: ov.difficulty ?? "Moderate",
    group_size: ov.group_size ?? "Small group", lunch_included: ov.lunch_included ?? false,
    ticket_included: ov.ticket_included ?? false,
    pickup_info: ov.pickup_info ?? "Pickup confirmed after booking.",
    notes: ov.notes ?? "Weather and operational conditions may shift the stop order or duration.",
    badges: Array.isArray(cc.badges) ? cc.badges : [], highlights: ov.highlights ?? [],
    includes: ov.includes ?? [], excludes: ov.excludes ?? [],
    schedule: ov.schedule ?? itin, itinerary_details: ov.itinerary_details ?? [], faqs: ov.faqs ?? [],
    rating: Number(cc.rating ?? 0), review_count: Number(cc.reviewCount ?? 0),
    pickup_points_count: Number(ov.pickup_points_count ?? 2), dropoff_points_count: Number(ov.dropoff_points_count ?? 0),
    is_active: ov.is_active ?? true, is_featured: ov.is_featured ?? false,
    translations: ov.translations ?? {},
    seo_title: ov.seo_title ?? asRecord(doc.seo).pageTitle ?? cc.title ?? slug,
    meta_description: ov.meta_description ?? asRecord(doc.seo).metaDescription ?? cc.shortCardDescription ?? "",
  };
}
function buildPagesRow(doc, slug, locale) {
  const merged = locale === "en" ? { ...doc } : doc;
  if ("page_sections" in merged) delete merged.page_sections;
  if (locale !== "en") merged.locale = locale;
  const pp = resolvePolicyPrice(doc);
  if (pp) {
    merged.price = { ...asRecord(merged.price), amountLabel: String(pp.price), currency: pp.currency, originalAmountLabel: pp.originalPrice != null ? String(pp.originalPrice) : undefined };
  }
  const cc = asRecord(merged.catalog_card), hero = asRecord(merged.hero), price = asRecord(merged.price), seo = asRecord(merged.seo);
  return {
    slug, locale, product_id: slug, is_published: true, sort_order: 1,
    title: cc.title ?? "", subtitle: cc.subtitle ?? "", region_label: cc.region ?? "",
    duration_label: cc.duration ?? "", stops_count: Number(cc.stopsCount ?? 0),
    rating_avg: Number(cc.rating ?? 0), review_count: Number(cc.reviewCount ?? 0),
    badges: Array.isArray(cc.badges) ? cc.badges : [], hero_image_url: cc.heroImage ?? hero.imageUrl ?? "",
    thumbnail_url: cc.thumbnail ?? "", card_short_description: cc.shortCardDescription ?? "",
    seo_title: seo.pageTitle ?? "", meta_description: seo.metaDescription ?? "",
    headline_line_1: merged.headlineLine1 ?? "", headline_line_2: merged.headlineLine2 ?? "",
    price_amount_label: price.amountLabel ?? "", price_currency: price.currency ?? "USD", price_per: price.per ?? "person",
    detail_payload: merged,
  };
}
const usdMinor = (m) => Math.round(Number(m) * 100);

function loadBundle(slug) {
  const dir = join(root, `components/product-tour-static/${slug}`);
  const b = {};
  b.en = JSON.parse(readFileSync(join(dir, `${slug}.en.json`), "utf8"));
  for (const l of LOCALES) { if (l === "en") continue; const p = join(dir, `${slug}.${l}.json`); if (existsSync(p)) b[l] = JSON.parse(readFileSync(p, "utf8")); }
  return b;
}

const TOURS_COLS = ["title","slug","city","tag","subtitle","description","highlight","price","original_price","price_currency","price_type","image_url","gallery_images","duration","difficulty","group_size","lunch_included","ticket_included","pickup_info","notes","badges","highlights","includes","excludes","schedule","itinerary_details","faqs","rating","review_count","pickup_points_count","dropoff_points_count","is_active","is_featured","translations","seo_title","meta_description"];
function toursValue(r) {
  const v = {
    title:q(r.title),slug:q(r.slug),city:q(r.city),tag:q(r.tag),subtitle:q(r.subtitle),description:q(r.description),highlight:q(r.highlight),
    price:numOrNull(r.price),original_price:numOrNull(r.original_price),price_currency:q(r.price_currency),price_type:q(r.price_type),
    image_url:q(r.image_url),gallery_images:jb(r.gallery_images),duration:q(r.duration),difficulty:q(r.difficulty),group_size:q(r.group_size),
    lunch_included:boolSql(r.lunch_included),ticket_included:boolSql(r.ticket_included),pickup_info:q(r.pickup_info),notes:q(r.notes),
    badges:jb(r.badges),highlights:jb(r.highlights),includes:jb(r.includes),excludes:jb(r.excludes),schedule:jb(r.schedule),
    itinerary_details:jb(r.itinerary_details),faqs:jb(r.faqs),rating:numOrNull(r.rating),review_count:numOrNull(r.review_count),
    pickup_points_count:numOrNull(r.pickup_points_count),dropoff_points_count:numOrNull(r.dropoff_points_count),
    is_active:boolSql(r.is_active),is_featured:boolSql(r.is_featured),translations:jb(r.translations),seo_title:q(r.seo_title),meta_description:q(r.meta_description),
  };
  return TOURS_COLS.map((c) => v[c]).join(",\n  ");
}

const PAGES_COLS = ["slug","locale","product_id","is_published","sort_order","tour_id","title","subtitle","region_label","duration_label","stops_count","rating_avg","review_count","badges","hero_image_url","thumbnail_url","card_short_description","seo_title","meta_description","headline_line_1","headline_line_2","price_amount_label","price_currency","price_per","detail_payload"];
function pagesValue(r, slug) {
  const v = {
    slug:q(r.slug),locale:q(r.locale),product_id:q(r.product_id),is_published:boolSql(r.is_published),sort_order:numOrNull(r.sort_order),
    tour_id:`(SELECT id FROM public.tours WHERE slug = ${q(slug)} LIMIT 1)`,
    title:q(r.title),subtitle:q(r.subtitle),region_label:q(r.region_label),duration_label:q(r.duration_label),stops_count:numOrNull(r.stops_count),
    rating_avg:numOrNull(r.rating_avg),review_count:numOrNull(r.review_count),badges:txtArr(r.badges),hero_image_url:q(r.hero_image_url),
    thumbnail_url:q(r.thumbnail_url),card_short_description:q(r.card_short_description),seo_title:q(r.seo_title),meta_description:q(r.meta_description),
    headline_line_1:q(r.headline_line_1),headline_line_2:q(r.headline_line_2),price_amount_label:q(r.price_amount_label),price_currency:q(r.price_currency),
    price_per:q(r.price_per),detail_payload:jb(r.detail_payload),
  };
  return PAGES_COLS.map((c) => v[c]).join(",\n  ");
}
const upd = (cols) => cols.filter((c)=>c!=="slug"&&c!=="locale").map((c)=>`  ${c} = EXCLUDED.${c}`).join(",\n");

for (const slug of slugs) {
  const b = loadBundle(slug);
  const en = b.en;
  const tr = buildToursRow(en, slug);
  const pp = resolvePolicyPrice(en);
  const usd = pp ? pp.price : Number(String(asRecord(en.price).amountLabel ?? resolveToursPrice(en)).replace(/[^0-9.]/g, ""));
  const minor = Number.isFinite(usd) ? usdMinor(usd) : 0;
  const cur = pp ? pp.currency : (asRecord(en.price).currency ?? "USD");

  let sql = `-- =============================================================================\n`;
  sql += `-- ${slug} — tour product upsert (tours + tour_product_pages all-locale + offer)\n`;
  sql += `-- Script: scripts/gen-tour-product-sql.mjs  (mirrors scripts/apply-tour-product.mjs)\n`;
  sql += `-- Locales: ${Object.keys(b).join(", ")}\n`;
  sql += `-- Idempotent: tours ON CONFLICT(slug); tour_product_pages ON CONFLICT(slug,locale); offer guarded.\n`;
  sql += `-- =============================================================================\n\nBEGIN;\n\n`;

  sql += `-- 1) tours\nINSERT INTO public.tours (\n  ${TOURS_COLS.join(", ")}\n) VALUES (\n  ${toursValue(tr)}\n)\nON CONFLICT (slug) DO UPDATE SET\n${upd(TOURS_COLS)},\n  updated_at = NOW();\n\n`;

  sql += `-- 2) tour_product_pages (one row per locale)\n`;
  for (const loc of Object.keys(b)) {
    const baseDoc = loc === "en" ? b.en : mergeFullPageWithLocaleBase(b.en, b[loc]);
    const pr = buildPagesRow(baseDoc, slug, loc);
    sql += `INSERT INTO public.tour_product_pages (\n  ${PAGES_COLS.join(", ")}\n) VALUES (\n  ${pagesValue(pr, slug)}\n)\nON CONFLICT (slug, locale) DO UPDATE SET\n${upd(PAGES_COLS)},\n  updated_at = NOW();\n\n`;
  }

  sql += `-- 3) tour_product_offers (default seed offer; insert-if-missing then sync amount)\n`;
  sql += `INSERT INTO public.tour_product_offers (tour_product_page_id, label, amount_minor, currency, is_active, is_default)\n`;
  sql += `SELECT p.id, 'Default (seed)', ${minor}, ${q(cur)}, TRUE, TRUE\n  FROM public.tour_product_pages p\n WHERE p.slug = ${q(slug)} AND p.locale = 'en'\n   AND NOT EXISTS (SELECT 1 FROM public.tour_product_offers o WHERE o.tour_product_page_id = p.id AND o.is_default AND o.is_active);\n`;
  sql += `UPDATE public.tour_product_offers o SET amount_minor = ${minor}, currency = ${q(cur)}\n  FROM public.tour_product_pages p\n WHERE o.tour_product_page_id = p.id AND p.slug = ${q(slug)} AND p.locale = 'en' AND o.is_default AND o.is_active;\n\n`;

  sql += `COMMIT;\n`;
  const out = join(outDir, `insert-${slug}-product.generated.sql`);
  writeFileSync(out, sql);
  console.log(`wrote ${out} (${(sql.length/1024).toFixed(1)} KB, locales=${Object.keys(b).length})`);
}
