/**
 * Forces each product's catalogue card onto its chosen thumbnail from
 * `product-thumbnails.mjs`, instead of whatever the first itinerary stop happens to be.
 *
 * Writes every surface the card is copied to: the six locale JSONs
 * (`catalog_card.heroImage` / `.thumbnail`, `hero.imageUrl`, `hero.images[0]`,
 * `seo.ogImage`), `tour_product_pages.hero_image_url` / `.thumbnail_url`, and
 * `tours.image_url`. Run `scripts/build-catalog-cards.mjs` afterwards — the generated
 * catalogue is a third copy and will otherwise keep pointing at the old frame.
 *
 *   node scripts/photo-curation/apply-product-thumbnails.mjs [--dry-run] [--no-db]
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { applyCatalogHeroThumbnails } from "../tour-payload-thumb-sync.mjs";
import { PRODUCT_THUMBNAILS } from "./product-thumbnails.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const LOCALES = ["en", "ko", "ja", "es", "zh", "zh-TW"];
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const NO_DB = args.includes("--no-db");

function loadEnvLocal() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnvLocal();

let supabase = null;
if (!DRY && !NO_DB) {
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

const staticRoot = join(ROOT, "components", "product-tour-static");
let files = 0;
const applied = [];

for (const [slug, spec] of Object.entries(PRODUCT_THUMBNAILS)) {
  const onDisk = join(ROOT, "public", spec.image.replace(/^\//, ""));
  if (!existsSync(onDisk)) {
    console.error(`!! ${slug}: image missing on disk — ${spec.image}`);
    process.exitCode = 1;
    continue;
  }

  let touchedLocales = 0;
  for (const locale of LOCALES) {
    const abs = join(staticRoot, slug, `${slug}.${locale}.json`);
    if (!existsSync(abs)) continue;
    const data = JSON.parse(readFileSync(abs, "utf8"));
    const before = data?.catalog_card?.heroImage || null;
    if (!applyCatalogHeroThumbnails(data, spec.image)) continue;
    if (!DRY) writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    touchedLocales += 1;
    files += 1;
    if (locale === "en") applied.push({ slug, before, after: spec.image, why: spec.why });
  }

  if (!touchedLocales) continue;
  if (DRY || !supabase) continue;

  for (const locale of LOCALES) {
    const abs = join(staticRoot, slug, `${slug}.${locale}.json`);
    if (!existsSync(abs)) continue;
    const payload = JSON.parse(readFileSync(abs, "utf8"));
    const { error } = await supabase
      .from("tour_product_pages")
      .update({
        detail_payload: payload,
        hero_image_url: spec.image,
        thumbnail_url: spec.image,
      })
      .eq("slug", slug)
      .eq("locale", locale);
    if (error) console.warn(`  tour_product_pages ${slug}/${locale}: ${error.message}`);
  }
  const { error } = await supabase.from("tours").update({ image_url: spec.image }).eq("slug", slug);
  if (error) console.warn(`  tours ${slug}: ${error.message}`);
}

const short = (p) => (p || "—").split("/").slice(-2).join("/");
for (const a of applied) console.log(`${a.slug}\n    ${short(a.before)}  ->  ${short(a.after)}\n    ${a.why}`);
console.log(`\n${applied.length} products re-pointed, ${files} locale files written${DRY ? " [dry-run]" : ""}`);
if (!DRY) console.log("Next: node scripts/build-catalog-cards.mjs");
