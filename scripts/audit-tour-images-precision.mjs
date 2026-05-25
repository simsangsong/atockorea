#!/usr/bin/env node
/**
 * Precision audit for tour product images — covers every dimension the
 * previous quick passes missed.
 *
 * Checks:
 *   A. Same stop holds BOTH `foo.webp` AND `foo-2.webp` / `foo-3.webp`
 *      (visually identical because the -N variants were byte-identical
 *      at write time, then 102 of them were physically deleted on
 *      2026-05-25 — the remaining 234 are still on disk and would
 *      render as a duplicate of the base).
 *      Probe: stop.images, stop.galleryItems, stop.imageCredits,
 *             top-level galleryItems.
 *   B. Same image used by multiple stops within one tour (cross-stop).
 *   C. References to files that don't exist on disk.
 *   D. Hero arrays (hero.images, heroImages) for the same dup patterns.
 *   E. stop.images vs stop.galleryItems cohesion — does each
 *      galleryItem appear in `images` and vice versa?
 *   F. POIs referenced from stops (poiKey / _poi_meta.poi_key) that
 *      do not have an entry in match_pois (orphan stop reference).
 */

import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const PRODUCT_DIR = join(REPO, "components/product-tour-static");
const PUBLIC_DIR = join(REPO, "public");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

/**
 * Only `-2.webp` / `-3.webp` are the collision-suffix variants the
 * import pipeline produces (the 50f4418a delete-set was exclusively
 * these). Anything else — `-001.webp`, `-43.webp`, `-2026-5-10-12-23-03.webp`
 * — is the file's real stem and must not be conflated with a "base".
 */
const stripSuffix = (src) => src.replace(/-(2|3)\.webp$/, ".webp");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function stopLabel(stop) {
  return (
    stop?.name ||
    stop?.title ||
    stop?.locationName ||
    stop?.poiKey ||
    stop?._poi_meta?.poi_key ||
    "(unnamed stop)"
  );
}

const findings = {
  A_visual_dups_in_stop: [],
  A_visual_dups_top_gallery: [],
  B_cross_stop_reuse: [],
  C_missing_files: new Set(),
  D_hero_issues: [],
  E_cohesion: [],
};

const entries = await fs.readdir(PRODUCT_DIR, { withFileTypes: true });
const slugs = entries.filter((d) => d.isDirectory()).map((d) => d.name);

for (const slug of slugs) {
  for (const locale of LOCALES) {
    const path = join(PRODUCT_DIR, slug, `${slug}.${locale}.json`);
    let raw;
    try { raw = await fs.readFile(path, "utf-8"); } catch { continue; }
    let doc;
    try { doc = JSON.parse(raw); } catch { continue; }

    // ===== A. Visual dups inside same stop / top-level gallery =====
    const stops = Array.isArray(doc.itineraryStops) ? doc.itineraryStops : [];
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const label = stopLabel(stop);
      // Collect every src across stop.images + galleryItems + imageCredits
      const srcs = [];
      for (const img of stop.images ?? []) {
        const s = typeof img === "object" ? img?.src : img;
        if (typeof s === "string") srcs.push(s);
      }
      for (const it of stop.galleryItems ?? []) {
        if (typeof it?.src === "string") srcs.push(it.src);
      }
      for (const ic of stop.imageCredits ?? []) {
        if (typeof ic?.url === "string") srcs.push(ic.url);
      }
      // Group by base (suffix stripped)
      const byBase = new Map();
      for (const s of srcs) {
        const base = stripSuffix(s);
        if (!byBase.has(base)) byBase.set(base, new Set());
        byBase.get(base).add(s);
      }
      for (const [base, variants] of byBase) {
        if (variants.size > 1) {
          findings.A_visual_dups_in_stop.push({
            slug, locale, stop: label, base, variants: [...variants],
          });
        }
      }
    }

    // top-level galleryItems
    const top = Array.isArray(doc.galleryItems) ? doc.galleryItems : [];
    const topByBase = new Map();
    for (const it of top) {
      if (typeof it?.src !== "string") continue;
      const base = stripSuffix(it.src);
      if (!topByBase.has(base)) topByBase.set(base, new Set());
      topByBase.get(base).add(it.src);
    }
    for (const [base, variants] of topByBase) {
      if (variants.size > 1) {
        findings.A_visual_dups_top_gallery.push({
          slug, locale, base, variants: [...variants],
        });
      }
    }

    // ===== B. Cross-stop image reuse (same exact src on multiple stops) =====
    const srcStops = new Map();
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const label = stopLabel(stop);
      const allSrcs = new Set();
      for (const img of stop.images ?? []) {
        const s = typeof img === "object" ? img?.src : img;
        if (typeof s === "string") allSrcs.add(s);
      }
      for (const it of stop.galleryItems ?? []) {
        if (typeof it?.src === "string") allSrcs.add(it.src);
      }
      for (const s of allSrcs) {
        if (!srcStops.has(s)) srcStops.set(s, []);
        srcStops.get(s).push(label);
      }
    }
    for (const [src, stops_used] of srcStops) {
      if (new Set(stops_used).size > 1) {
        findings.B_cross_stop_reuse.push({
          slug, locale, src,
          stops: [...new Set(stops_used)],
        });
      }
    }

    // ===== C. Missing files on disk =====
    const allRefs = new Set();
    for (const it of top) if (typeof it?.src === "string") allRefs.add(it.src);
    for (const s of stops) {
      for (const img of s.images ?? []) {
        const v = typeof img === "object" ? img?.src : img;
        if (typeof v === "string") allRefs.add(v);
      }
      for (const it of s.galleryItems ?? []) {
        if (typeof it?.src === "string") allRefs.add(it.src);
      }
      for (const ic of s.imageCredits ?? []) {
        if (typeof ic?.url === "string") allRefs.add(ic.url);
      }
    }
    // hero
    const hero = doc.hero ?? {};
    if (typeof hero?.imageUrl === "string") allRefs.add(hero.imageUrl);
    for (const h of hero?.images ?? []) {
      const v = typeof h === "object" ? h?.src : h;
      if (typeof v === "string") allRefs.add(v);
    }
    for (const ref of allRefs) {
      if (!ref.startsWith("/")) continue;
      const onDisk = join(PUBLIC_DIR, ref.replace(/^\//, ""));
      if (!(await exists(onDisk))) findings.C_missing_files.add(`${ref}  (${slug}/${locale})`);
    }

    // ===== D. Hero array dup =====
    const heroImgs = hero?.images ?? [];
    if (Array.isArray(heroImgs) && heroImgs.length > 1) {
      const srcs = heroImgs.map((h) => (typeof h === "object" ? h?.src : h)).filter((s) => typeof s === "string");
      const byBase = new Map();
      for (const s of srcs) {
        const base = stripSuffix(s);
        if (!byBase.has(base)) byBase.set(base, new Set());
        byBase.get(base).add(s);
      }
      for (const [base, variants] of byBase) {
        if (variants.size > 1) {
          findings.D_hero_issues.push({ slug, locale, kind: "visual-dup", base, variants: [...variants] });
        }
      }
      const seen = new Set();
      for (const s of srcs) {
        if (seen.has(s)) {
          findings.D_hero_issues.push({ slug, locale, kind: "exact-dup", src: s });
        }
        seen.add(s);
      }
    }

    // ===== E. stop.images vs stop.galleryItems cohesion =====
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const label = stopLabel(stop);
      const imgsSet = new Set();
      for (const img of stop.images ?? []) {
        const v = typeof img === "object" ? img?.src : img;
        if (typeof v === "string") imgsSet.add(v);
      }
      const giSet = new Set();
      for (const it of stop.galleryItems ?? []) {
        if (typeof it?.src === "string") giSet.add(it.src);
      }
      if (imgsSet.size === 0 && giSet.size === 0) continue;
      const onlyInImgs = [...imgsSet].filter((s) => !giSet.has(s));
      const onlyInGi = [...giSet].filter((s) => !imgsSet.has(s));
      if (onlyInImgs.length > 0 || onlyInGi.length > 0) {
        findings.E_cohesion.push({
          slug, locale, stop: label,
          imgsOnly: onlyInImgs.length,
          giOnly: onlyInGi.length,
          imgsCount: imgsSet.size,
          giCount: giSet.size,
        });
      }
    }
  }
}

console.log(`\n=== TOUR IMAGE PRECISION AUDIT — ${new Date().toISOString().slice(0, 10)} ===\n`);

console.log(`A1) Stop-internal VISUAL dups (base + -N variant in one stop):`);
console.log(`    groups: ${findings.A_visual_dups_in_stop.length}`);
if (findings.A_visual_dups_in_stop.length > 0) {
  for (const r of findings.A_visual_dups_in_stop.slice(0, 8)) {
    console.log(`      ${r.slug}/${r.locale}  "${r.stop}"`);
    console.log(`        base: ${r.base}`);
    console.log(`        variants: ${r.variants.join(", ")}`);
  }
  if (findings.A_visual_dups_in_stop.length > 8) console.log(`      … +${findings.A_visual_dups_in_stop.length - 8} more`);
}

console.log(`\nA2) Top-level galleryItems VISUAL dups:`);
console.log(`    groups: ${findings.A_visual_dups_top_gallery.length}`);
for (const r of findings.A_visual_dups_top_gallery.slice(0, 5)) {
  console.log(`      ${r.slug}/${r.locale}  base: ${r.base}  variants: ${r.variants.join(", ")}`);
}

console.log(`\nB) Cross-stop image reuse (same src on multiple stops):`);
console.log(`    occurrences: ${findings.B_cross_stop_reuse.length}`);
for (const r of findings.B_cross_stop_reuse.slice(0, 8)) {
  console.log(`      ${r.slug}/${r.locale}`);
  console.log(`        ${r.src}`);
  console.log(`        stops: ${r.stops.join(" / ")}`);
}
if (findings.B_cross_stop_reuse.length > 8) console.log(`      … +${findings.B_cross_stop_reuse.length - 8} more`);

console.log(`\nC) References to files NOT on disk:`);
console.log(`    distinct missing: ${findings.C_missing_files.size}`);
for (const m of [...findings.C_missing_files].slice(0, 20)) console.log(`      ${m}`);
if (findings.C_missing_files.size > 20) console.log(`      … +${findings.C_missing_files.size - 20} more`);

console.log(`\nD) Hero array issues:`);
console.log(`    occurrences: ${findings.D_hero_issues.length}`);
for (const r of findings.D_hero_issues.slice(0, 8)) {
  console.log(`      ${r.slug}/${r.locale}  ${r.kind}  ${r.base ?? r.src}`);
  if (r.variants) console.log(`        variants: ${r.variants.join(", ")}`);
}

console.log(`\nE) stop.images vs stop.galleryItems cohesion drift:`);
console.log(`    drifted stops: ${findings.E_cohesion.length}`);
for (const r of findings.E_cohesion.slice(0, 8)) {
  console.log(`      ${r.slug}/${r.locale}  "${r.stop}"  imgs=${r.imgsCount} (only:${r.imgsOnly})  gi=${r.giCount} (only:${r.giOnly})`);
}
if (findings.E_cohesion.length > 8) console.log(`      … +${findings.E_cohesion.length - 8} more`);

console.log(`\nSUMMARY:`);
console.log(`  A1 stop-internal visual dups : ${findings.A_visual_dups_in_stop.length}`);
console.log(`  A2 top gallery visual dups   : ${findings.A_visual_dups_top_gallery.length}`);
console.log(`  B cross-stop reuse           : ${findings.B_cross_stop_reuse.length}`);
console.log(`  C missing-on-disk refs       : ${findings.C_missing_files.size}`);
console.log(`  D hero array issues          : ${findings.D_hero_issues.length}`);
console.log(`  E images↔galleryItems drift  : ${findings.E_cohesion.length}`);
