#!/usr/bin/env node
/**
 * Audit every tour-product JSON (6 locales × all tours) for photo coverage,
 * cross-POI reuse, missing files, and orphans. Emits:
 *   docs/tour-photo-audit-<date>.json (machine)
 *   docs/tour-photo-audit-<date>.md   (human)
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TOURS_DIR = join(ROOT, "components/product-tour-static");
const PUBLIC_TOURS_DIR = join(ROOT, "public/images/tours");
const PUBLIC_ITINERARY_DIR = join(ROOT, "public/images/itinerary");
const PUBLIC_HERO_DIR = join(ROOT, "public/images/hero");
const PUBLIC_DEST_DIR = join(ROOT, "public/images/destinations");
const DOCS_DIR = join(ROOT, "docs");
const TODAY = new Date().toISOString().slice(0, 10);

function isPhotoFile(name) {
  return /\.(webp|jpg|jpeg|png|avif)$/i.test(name);
}

function listFilesRecursive(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

function listTourSlugs() {
  return readdirSync(TOURS_DIR)
    .filter((name) => {
      const full = join(TOURS_DIR, name);
      if (!statSync(full).isDirectory()) return false;
      if (name === "_shared" || name === "catalog") return false;
      return existsSync(join(full, `${name}.en.json`));
    });
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    return null;
  }
}

function isImageUrl(value) {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (!s) return false;
  return s.startsWith("/") || /^https?:\/\//i.test(s);
}

function poiKeyFromImagePath(path) {
  // e.g., /images/tours/cheongsapo-blue-line/foo.webp -> cheongsapo-blue-line
  const m = /^\/images\/tours\/([^\/]+)\//.exec(path);
  return m ? m[1] : null;
}

function collectStopPhotos(stop, source) {
  const out = [];
  const push = (path, field) => {
    if (!isImageUrl(path)) return;
    out.push({ path, source, field });
  };
  push(stop?.image, "stop.image");
  push(stop?.imageUrl, "stop.imageUrl");
  if (Array.isArray(stop?.images)) {
    stop.images.forEach((img, i) => {
      if (typeof img === "string") push(img, `stop.images[${i}]`);
      else if (img && typeof img === "object") {
        push(img.src ?? img.url ?? img.imageUrl, `stop.images[${i}].src`);
      }
    });
  }
  if (Array.isArray(stop?.photos)) {
    stop.photos.forEach((img, i) => {
      if (typeof img === "string") push(img, `stop.photos[${i}]`);
      else if (img && typeof img === "object") {
        push(img.src ?? img.url ?? img.imageUrl, `stop.photos[${i}].src`);
      }
    });
  }
  return out;
}

function collectDocPhotos(doc) {
  const out = [];
  if (!doc) return out;
  const push = (path, source, field, location = null) => {
    if (!isImageUrl(path)) return;
    out.push({ path, source, field, location });
  };
  push(doc?.hero?.imageUrl, "hero", "hero.imageUrl");
  push(doc?.hero?.image, "hero", "hero.image");
  push(doc?.seo?.ogImage, "seo", "seo.ogImage");
  push(doc?.catalog_card?.heroImage, "catalog", "catalog_card.heroImage");
  push(doc?.catalog_card?.thumbnail, "catalog", "catalog_card.thumbnail");
  if (Array.isArray(doc?.galleryItems)) {
    doc.galleryItems.forEach((item, i) => {
      if (item && typeof item === "object") {
        push(item.src ?? item.url ?? item.imageUrl, "gallery", `galleryItems[${i}].src`, item.location ?? null);
      }
    });
  }
  if (Array.isArray(doc?.itineraryStops)) {
    doc.itineraryStops.forEach((stop, i) => {
      const stopPhotos = collectStopPhotos(stop, `itineraryStops[${i}]`);
      const poiKey = stop?._poi_meta?.poi_key ?? null;
      const stopName = stop?.name ?? null;
      for (const p of stopPhotos) {
        out.push({ ...p, poiKey, stopName });
      }
    });
  }
  return out;
}

function main() {
  const slugs = listTourSlugs();
  const locales = ["en", "ko", "ja", "zh", "zh-TW", "es"];
  const allRefs = [];
  let docsCount = 0;
  let missingDocsCount = 0;

  for (const slug of slugs) {
    for (const locale of locales) {
      const path = join(TOURS_DIR, slug, `${slug}.${locale}.json`);
      if (!existsSync(path)) {
        missingDocsCount++;
        continue;
      }
      docsCount++;
      const doc = readJson(path);
      const refs = collectDocPhotos(doc).map((r) => ({ ...r, slug, locale }));
      allRefs.push(...refs);
    }
  }

  // Dedupe by path: track usages
  const byPath = new Map();
  for (const ref of allRefs) {
    const key = ref.path;
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key).push(ref);
  }

  // Physical files on disk (tours + itinerary + hero + destinations)
  const diskFiles = [
    ...listFilesRecursive(PUBLIC_TOURS_DIR),
    ...listFilesRecursive(PUBLIC_ITINERARY_DIR),
    ...listFilesRecursive(PUBLIC_HERO_DIR),
    ...listFilesRecursive(PUBLIC_DEST_DIR),
  ].filter((f) => isPhotoFile(f));
  const toWebPath = (absPath) => {
    let rel = absPath.replaceAll("\\", "/");
    const rootNorm = ROOT.replaceAll("\\", "/");
    if (rel.startsWith(rootNorm)) rel = rel.slice(rootNorm.length);
    if (rel.startsWith("/public/")) rel = rel.slice("/public".length);
    else if (rel.startsWith("public/")) rel = rel.slice("public".length);
    if (!rel.startsWith("/")) rel = "/" + rel;
    return rel;
  };
  const diskRelPaths = new Set(diskFiles.map(toWebPath));

  // Per-POI counts (using folder name from path as POI key)
  const perPoi = new Map();
  for (const [path, uses] of byPath.entries()) {
    const folderKey = poiKeyFromImagePath(path);
    if (!folderKey) continue;
    if (!perPoi.has(folderKey)) perPoi.set(folderKey, { folder: folderKey, photos: new Set(), uses: 0, locations: new Set(), poiKeys: new Set(), stopNames: new Set() });
    const entry = perPoi.get(folderKey);
    entry.photos.add(path);
    entry.uses += uses.length;
    for (const u of uses) {
      if (u.location) entry.locations.add(u.location);
      if (u.poiKey) entry.poiKeys.add(u.poiKey);
      if (u.stopName) entry.stopNames.add(u.stopName);
    }
  }

  // Find REAL cross-POI mismatches: image used by 2+ distinct itineraryStop poi_keys
  const crossPoiReuse = [];
  for (const [path, uses] of byPath.entries()) {
    const folderKey = poiKeyFromImagePath(path);
    if (!folderKey) continue;
    const usedPoiKeys = new Set();
    const usedLocations = new Set();
    const sampleSlugs = new Set();
    for (const u of uses) {
      if (u.poiKey) usedPoiKeys.add(u.poiKey);
      if (u.location) usedLocations.add(u.location);
      if (u.slug) sampleSlugs.add(u.slug);
    }
    const distinctPoiKeys = [...usedPoiKeys].filter(Boolean);
    if (distinctPoiKeys.length >= 2) {
      crossPoiReuse.push({
        path,
        folderKey,
        usedPoiKeys: distinctPoiKeys,
        usedLocations: [...usedLocations],
        slugs: [...sampleSlugs],
        uses: uses.length,
      });
    }
  }

  // Missing files: referenced but not on disk
  const missing = [];
  for (const [path, uses] of byPath.entries()) {
    if (!path.startsWith("/images/")) continue; // skip http urls
    if (!diskRelPaths.has(path)) {
      missing.push({ path, refCount: uses.length, sampleSlug: uses[0]?.slug });
    }
  }

  // Orphan files: on disk but never referenced
  const refSet = new Set(byPath.keys());
  const orphans = [];
  for (const f of diskFiles) {
    const rel = toWebPath(f);
    if (!refSet.has(rel)) orphans.push(rel);
  }

  // Per-POI summary, sorted by photo count ascending (sparse first)
  const perPoiArr = [...perPoi.values()].map((p) => ({
    folder: p.folder,
    photoCount: p.photos.size,
    uses: p.uses,
    poiKeys: [...p.poiKeys],
    stopNames: [...p.stopNames],
    locations: [...p.locations],
  })).sort((a, b) => a.photoCount - b.photoCount);

  // Tour-product folders that have only 1 photo - likely sparse
  const sparse = perPoiArr.filter((p) => p.photoCount <= 1);

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      tourSlugs: slugs.length,
      locales: locales.length,
      docsScanned: docsCount,
      docsMissing: missingDocsCount,
      totalRefs: allRefs.length,
      uniquePhotoPaths: byPath.size,
      diskFiles: diskFiles.length,
      crossPoiReuseCount: crossPoiReuse.length,
      missingCount: missing.length,
      orphanCount: orphans.length,
      poiFolders: perPoiArr.length,
      sparsePois: sparse.length,
    },
    sparsePois: sparse,
    crossPoiReuse,
    missing,
    orphans,
    perPoi: perPoiArr,
  };

  if (!existsSync(DOCS_DIR)) {
    // ensure
  }
  const jsonOut = join(DOCS_DIR, `tour-photo-audit-${TODAY}.json`);
  writeFileSync(jsonOut, JSON.stringify(report, null, 2), "utf8");

  const md = [
    `# Tour Photo Audit — ${TODAY}`,
    "",
    "## Summary",
    "",
    `- Tour slugs scanned: **${report.summary.tourSlugs}**`,
    `- Locale docs scanned: **${report.summary.docsScanned}** (missing: ${report.summary.docsMissing})`,
    `- Total photo references in JSONs: **${report.summary.totalRefs}**`,
    `- Unique photo paths: **${report.summary.uniquePhotoPaths}**`,
    `- Physical files in /public/images/tours: **${report.summary.diskFiles}**`,
    `- POI folders: **${report.summary.poiFolders}** (sparse ≤1 photo: ${report.summary.sparsePois})`,
    `- Cross-POI reuse (same image, multiple POI keys/locations): **${report.summary.crossPoiReuseCount}**`,
    `- Missing files (referenced but not on disk): **${report.summary.missingCount}**`,
    `- Orphan files (on disk, never referenced): **${report.summary.orphanCount}**`,
    "",
    "## Sparse POI folders (≤1 photo)",
    "",
    sparse.length === 0 ? "_None._" : sparse.map((p) => `- \`${p.folder}\` — ${p.photoCount} photo · used by [${p.poiKeys.join(", ")}] (${p.uses} refs)`).join("\n"),
    "",
    "## Top 30 cross-POI reuse cases (review these first)",
    "",
    crossPoiReuse.length === 0 ? "_None._" : crossPoiReuse.slice(0, 30).map((c) => `- \`${c.path}\` (folder=\`${c.folderKey}\`) used by POI keys [${c.usedPoiKeys.join(", ")}] / locations [${c.usedLocations.slice(0, 3).join(" | ")}]`).join("\n"),
    "",
    "## Missing files (first 50)",
    "",
    missing.length === 0 ? "_None._" : missing.slice(0, 50).map((m) => `- \`${m.path}\` (${m.refCount} refs, sample slug: ${m.sampleSlug})`).join("\n"),
    "",
    "## Orphan files on disk (first 50)",
    "",
    orphans.length === 0 ? "_None._" : orphans.slice(0, 50).map((o) => `- \`${o}\``).join("\n"),
    "",
    "## Full per-POI photo count (ascending)",
    "",
    "| Photos | Folder | Distinct POI keys | Locations |",
    "|-------:|--------|-------------------|-----------|",
    ...perPoiArr.map((p) => `| ${p.photoCount} | \`${p.folder}\` | ${p.poiKeys.length} | ${p.locations.length} |`),
  ].join("\n");
  const mdOut = join(DOCS_DIR, `tour-photo-audit-${TODAY}.md`);
  writeFileSync(mdOut, md, "utf8");

  console.log(`Wrote:`);
  console.log(`  ${jsonOut}`);
  console.log(`  ${mdOut}`);
  console.log(`Summary:`, report.summary);
}

main();
