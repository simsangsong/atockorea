#!/usr/bin/env node
/**
 * Sweeps every tour-product JSON (per locale) and the match_pois mirror to
 * surface:
 *   - galleryItems with duplicate `src` values (same slot rendered twice)
 *   - itineraryStops with duplicate images in a single stop
 *   - cross-stop image reuse within one tour (same image on multiple stops)
 *   - file references that no longer exist on disk
 *
 * Output: one block per offending tour/locale, summary tail.
 */

import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const PRODUCT_DIR = join(REPO, "components/product-tour-static");
const PUBLIC_DIR = join(REPO, "public");

const SUPPORTED_LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

function countDups(arr) {
  const m = new Map();
  for (const v of arr) {
    if (!v) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  const dups = {};
  for (const [k, n] of m) if (n > 1) dups[k] = n;
  return dups;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const entries = await fs.readdir(PRODUCT_DIR, { withFileTypes: true });
  const tourSlugs = entries.filter((d) => d.isDirectory()).map((d) => d.name);
  let totals = { galleryDups: 0, stopDups: 0, crossStop: 0, missing: 0 };
  const missingFiles = new Set();
  const dupRows = [];

  for (const slug of tourSlugs) {
    for (const locale of SUPPORTED_LOCALES) {
      const path = join(PRODUCT_DIR, slug, `${slug}.${locale}.json`);
      let raw;
      try {
        raw = await fs.readFile(path, "utf-8");
      } catch {
        continue;
      }
      let doc;
      try {
        doc = JSON.parse(raw);
      } catch (e) {
        console.warn(`[${slug}/${locale}] JSON parse error:`, e.message);
        continue;
      }

      // galleryItems duplicates (same src appearing >1 time)
      const items = Array.isArray(doc.galleryItems) ? doc.galleryItems : [];
      const gallerySrcs = items
        .map((it) => (it && typeof it === "object" ? it.src : it))
        .filter((s) => typeof s === "string" && s);
      const galleryDups = countDups(gallerySrcs);
      if (Object.keys(galleryDups).length > 0) {
        totals.galleryDups += Object.values(galleryDups).reduce((a, b) => a + b, 0);
        dupRows.push({
          kind: "gallery",
          slug,
          locale,
          dups: galleryDups,
          total: items.length,
        });
      }

      // itineraryStops — same image >1 inside one stop + same image across stops
      const stops = Array.isArray(doc.itineraryStops) ? doc.itineraryStops : [];
      const tourImageOccurrences = new Map();
      for (const stop of stops) {
        const title =
          stop?.title ||
          stop?.locationName ||
          stop?.poiKey ||
          stop?.id ||
          "(stop)";
        const imgs = Array.isArray(stop?.images) ? stop.images : [];
        const srcs = imgs
          .map((i) => (i && typeof i === "object" ? i.src : i))
          .filter((s) => typeof s === "string" && s);
        const stopDups = countDups(srcs);
        if (Object.keys(stopDups).length > 0) {
          totals.stopDups += Object.values(stopDups).reduce((a, b) => a + b, 0);
          dupRows.push({
            kind: "stop",
            slug,
            locale,
            stop: title,
            dups: stopDups,
            total: imgs.length,
          });
        }
        for (const s of srcs) {
          const prior = tourImageOccurrences.get(s) ?? [];
          prior.push(title);
          tourImageOccurrences.set(s, prior);
        }
      }
      for (const [src, titles] of tourImageOccurrences) {
        if (titles.length > 1 && new Set(titles).size > 1) {
          totals.crossStop += 1;
          dupRows.push({
            kind: "cross-stop",
            slug,
            locale,
            src,
            stops: titles,
          });
        }
      }

      // Reference check — files mentioned but absent on disk
      const allSrcs = new Set([
        ...gallerySrcs,
        ...stops.flatMap((s) =>
          (Array.isArray(s?.images) ? s.images : [])
            .map((i) => (i && typeof i === "object" ? i.src : i))
            .filter((x) => typeof x === "string" && x),
        ),
      ]);
      for (const src of allSrcs) {
        if (!src.startsWith("/")) continue;
        const onDisk = join(PUBLIC_DIR, src.replace(/^\//, ""));
        if (!(await exists(onDisk))) {
          if (!missingFiles.has(src)) {
            missingFiles.add(src);
            totals.missing += 1;
          }
        }
      }
    }
  }

  // Report
  console.log(`\n=== TOUR IMAGE AUDIT — ${new Date().toISOString().slice(0, 10)} ===\n`);

  if (dupRows.length === 0 && missingFiles.size === 0) {
    console.log("✅ no duplicates or missing references found");
    return;
  }

  // group by slug for readability
  const bySlug = new Map();
  for (const row of dupRows) {
    const k = row.slug;
    if (!bySlug.has(k)) bySlug.set(k, []);
    bySlug.get(k).push(row);
  }

  // gallery dups
  console.log(`--- galleryItems with duplicate src ---`);
  for (const [slug, rows] of bySlug) {
    const gallery = rows.filter((r) => r.kind === "gallery");
    if (gallery.length === 0) continue;
    // locales with same dup pattern → group
    const seen = new Set();
    for (const g of gallery) {
      const sig = JSON.stringify(g.dups);
      if (seen.has(sig)) continue;
      seen.add(sig);
      const locales = gallery
        .filter((x) => JSON.stringify(x.dups) === sig)
        .map((x) => x.locale)
        .join(",");
      console.log(`\n  ${slug} [${locales}] — gallery ${g.total} slots`);
      for (const [src, n] of Object.entries(g.dups)) {
        console.log(`    x${n}  ${src}`);
      }
    }
  }

  // stop dups
  console.log(`\n--- itineraryStops: same image >1 inside one stop ---`);
  for (const [slug, rows] of bySlug) {
    const stops = rows.filter((r) => r.kind === "stop");
    if (stops.length === 0) continue;
    const seen = new Set();
    for (const s of stops) {
      const sig = `${s.stop}::${JSON.stringify(s.dups)}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      const locales = stops
        .filter((x) => `${x.stop}::${JSON.stringify(x.dups)}` === sig)
        .map((x) => x.locale)
        .join(",");
      console.log(`\n  ${slug} [${locales}] — stop "${s.stop}" ${s.total} imgs`);
      for (const [src, n] of Object.entries(s.dups)) {
        console.log(`    x${n}  ${src}`);
      }
    }
  }

  // cross-stop
  console.log(`\n--- cross-stop image reuse within one tour ---`);
  for (const [slug, rows] of bySlug) {
    const cs = rows.filter((r) => r.kind === "cross-stop");
    if (cs.length === 0) continue;
    const seen = new Set();
    for (const r of cs) {
      const sig = `${r.src}::${[...new Set(r.stops)].join("|")}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      console.log(`  ${slug} — ${r.src}`);
      console.log(`    stops: ${[...new Set(r.stops)].join(" / ")}`);
    }
  }

  console.log(`\n--- references to files NOT on disk ---`);
  for (const m of [...missingFiles].sort().slice(0, 50)) {
    console.log(`  ${m}`);
  }
  if (missingFiles.size > 50) console.log(`  … +${missingFiles.size - 50} more`);

  console.log(`\nSUMMARY  galleryDup=${totals.galleryDups} stopDup=${totals.stopDups} crossStop=${totals.crossStop} missing=${totals.missing}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
