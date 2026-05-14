/**
 * One-shot: set catalog_card.thumbnail / heroImage, hero.imageUrl, seo.ogImage
 * from the first substantive top-level itinerary stop that uses /images/...
 *
 * Usage:
 *   node scripts/sync-catalog-thumbnails-from-itinerary.mjs
 *   node scripts/sync-catalog-thumbnails-from-itinerary.mjs --no-db
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  applyCatalogHeroThumbnails,
  absoluteSiteUrlForOg,
  firstCatalogImageFromPayload,
  syncRootGalleryFromItinerary,
} from "./tour-payload-thumb-sync.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnvLocal() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") process.env[key] = val;
  }
}

function jsonFileToSlugLocale(relPath) {
  const m = relPath.match(
    /product-tour-static[/\\]([^/\\]+)[/\\]([^/\\]+)\.(en|ko|ja|es|zh|zh-TW)\.json$/,
  );
  if (!m) return null;
  if (m[1] !== m[2]) return null;
  return { slug: m[1], locale: m[3] };
}

async function main() {
  loadEnvLocal();
  const noDb = process.argv.includes("--no-db");
  const staticRoot = join(ROOT, "components", "product-tour-static");

  let supabase = null;
  if (!noDb) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !key) {
      console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
      process.exit(1);
    }
    supabase = createClient(url, key);
  }

  const modified = [];

  function walk(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && /\.(en|ko|ja|es|zh|zh-TW)\.json$/.test(ent.name)) {
        const rel = p.slice(ROOT.length + 1).replace(/\\/g, "/");
        const id = jsonFileToSlugLocale(rel);
        if (!id) continue;
        let data;
        try {
          data = JSON.parse(readFileSync(p, "utf8"));
        } catch {
          continue;
        }
        const thumb = firstCatalogImageFromPayload(data);
        let changed = false;
        if (thumb) changed = applyCatalogHeroThumbnails(data, thumb) || changed;
        changed = syncRootGalleryFromItinerary(data) || changed;
        if (!changed) continue;
        writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
        modified.push(id);
        console.log(`Thumbnail + atmosphere gallery sync: ${rel}`);
      }
    }
  }

  walk(staticRoot);

  if (!modified.length) {
    console.log("No files updated (thumbnails + atmosphere gallery already aligned).");
    return;
  }

  if (supabase) {
    const done = new Set();
    for (const { slug, locale } of modified) {
      const k = `${slug}|${locale}`;
      if (done.has(k)) continue;
      done.add(k);
      const fp = join(staticRoot, slug, `${slug}.${locale}.json`);
      const payload = JSON.parse(readFileSync(fp, "utf8"));
      const rel = firstCatalogImageFromPayload(payload);
      const abs = rel ? absoluteSiteUrlForOg(rel) : null;
      const { error } = await supabase
        .from("tour_product_pages")
        .update({
          detail_payload: payload,
          ...(abs ? { hero_image_url: abs, thumbnail_url: abs } : {}),
        })
        .eq("slug", slug)
        .eq("locale", locale);
      if (error) console.warn(`DB ${slug}/${locale}: ${error.message}`);
      else console.log(`DB row: ${slug} (${locale})`);
    }
  }

  console.log(`Done. ${modified.length} JSON file(s) touched.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
