#!/usr/bin/env node
// Phase 6 — src↔location attribution audit.
//
// For each tour bundle (EN only — locales mirror EN), walk every
// galleryItems[] in the document. For each item with both `src` and
// `location`, extract the src "stem" (filename minus extension and
// trailing numeric suffix) and compare against the location string.
//
// Heuristic:
//   - filename has a slug-like stem ("bomun-lake-cherry-blossom-...")
//   - convert stem to token set ["bomun", "lake", "cherry", "blossom"]
//   - check if any meaningful token from the stem appears in the
//     location string (case-insensitive); if NONE overlap, flag as
//     a mismatch candidate
//
// The atoc photo import pipeline (reference_atoc_photo_import_pipeline)
// derives filenames from the Korean place folder name, so the filename
// is the AUTHORITATIVE attribution. A location string that shares no
// tokens with the filename stem almost certainly has the wrong location.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");

const STOPWORDS = new Set([
  "a", "an", "the", "of", "and", "or", "for", "to", "in", "at", "on",
  "with", "by", "from", "into", "image", "gallery", "photo", "thumb",
  "thumbnail", "hero", "card", "tour", "tours", "korea", "jeju", "seoul", "busan",
  "kakaotalk", "atc", "atoc", "modified", "main", "default", "alt", "alt1", "alt2",
  "small", "large", "medium", "wide", "tall", "portrait", "landscape", "square",
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "ko", "ja", "en", "zh", "es", "tw",
]);

function extractStemTokens(srcUrl) {
  if (!srcUrl || typeof srcUrl !== "string") return new Set();
  // /images/itinerary/bomun-lake-cherry-blossom-promenade.webp
  // /images/tours/seopjikoji/kakaotalk-20260510-230009595-10.webp
  const filename = srcUrl.split("/").pop() || "";
  const stem = filename.replace(/\.[a-z0-9]+$/i, "");
  // also include the parent folder name (often the canonical poi slug)
  const parts = srcUrl.split("/").filter(Boolean);
  const folder = parts.length >= 2 ? parts[parts.length - 2] : "";
  const combined = `${folder} ${stem}`;
  const tokens = combined.toLowerCase().split(/[\s\-_]+/).filter(Boolean);
  return new Set(tokens.filter((t) => !STOPWORDS.has(t) && !/^\d+$/.test(t)));
}

// DMZ has multiple sub-attractions; treat the umbrella folder as a
// valid prefix for any DMZ sub-POI (3rd tunnel, dora observatory,
// gamaksan bridge, imjingak, etc.). Same for haenyeo-museum (haenyeo).
const UMBRELLA_ALIASES = {
  dmz: ["3rd infiltration tunnel", "3rd tunnel", "dora observatory", "imjingak", "gamaksan", "freedom bridge", "suspension bridge"],
  "jeju-haenyeo-museum": ["haenyeo", "seongeup"],
  ilchulland: ["ilchul land", "micheon cave"],
};

function umbrellaMatches(srcFolder, locText) {
  const aliases = UMBRELLA_ALIASES[srcFolder];
  if (!aliases) return false;
  const lc = locText.toLowerCase();
  return aliases.some((a) => lc.includes(a));
}

function locationTokens(loc) {
  if (!loc || typeof loc !== "string") return new Set();
  // Convert Korean+English location to simple lowercase tokens.
  // Korean chars don't help here — we focus on overlap of ASCII tokens
  // (POI proper nouns: Bomun, Seongsan, Hwaseong, etc.).
  const asciiOnly = loc.replace(/[^\x00-\x7F]/g, " ");
  const tokens = asciiOnly.toLowerCase().split(/[\s\-_,.()/—–&]+/).filter(Boolean);
  return new Set(tokens.filter((t) => !STOPWORDS.has(t) && t.length >= 3));
}

function walkBundle(node, onGallery, breadcrumb = "$") {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkBundle(v, onGallery, `${breadcrumb}[${i}]`));
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "galleryItems" && Array.isArray(v)) {
        v.forEach((item, i) => onGallery(item, `${breadcrumb}.${k}[${i}]`));
      }
      walkBundle(v, onGallery, `${breadcrumb}.${k}`);
    }
  }
}

const slugs = fs
  .readdirSync(TOURS_DIR)
  .filter((s) => fs.existsSync(path.join(TOURS_DIR, s, `${s}.en.json`)));

const mismatches = [];
let totalGalleryItems = 0;
let totalChecked = 0;

for (const slug of slugs) {
  const fp = path.join(TOURS_DIR, slug, `${slug}.en.json`);
  const obj = JSON.parse(fs.readFileSync(fp, "utf8"));
  const seen = new Set();
  walkBundle(obj, (item, crumb) => {
    if (!item || typeof item !== "object") return;
    totalGalleryItems++;
    const src = item.src || item.image;
    const loc = item.location;
    if (!src || !loc) return;
    totalChecked++;
    const stemTok = extractStemTokens(src);
    const locTok = locationTokens(loc);
    if (stemTok.size === 0 || locTok.size === 0) return;
    // overlap check (token-level)
    let overlap = 0;
    for (const t of stemTok) {
      if (locTok.has(t)) {
        overlap++;
        break;
      }
    }
    // substring fallback — catches concatenated folder slugs like
    // "ilchulland" matching location "Ilchul Land"
    if (overlap === 0) {
      const lcLoc = loc.toLowerCase();
      for (const t of stemTok) {
        if (t.length >= 5 && lcLoc.includes(t)) {
          overlap++;
          break;
        }
      }
    }
    // umbrella folder allowlist (DMZ → dora/gamaksan/3rd tunnel/imjingak)
    if (overlap === 0) {
      const parts = src.split("/").filter(Boolean);
      const folder = parts.length >= 2 ? parts[parts.length - 2] : "";
      if (umbrellaMatches(folder, loc)) overlap = 1;
    }
    if (overlap === 0) {
      const key = `${slug}|${src}|${loc}`;
      if (seen.has(key)) return;
      seen.add(key);
      mismatches.push({
        slug,
        crumb,
        src,
        location: loc,
        caption: item.caption || "",
        stemTokens: [...stemTok],
        locTokens: [...locTok],
      });
    }
  });
}

console.log(`\n=== Phase 6 attribution audit ===\n`);
console.log(`Tours scanned: ${slugs.length}`);
console.log(`Total galleryItems: ${totalGalleryItems}`);
console.log(`Items with both src + location: ${totalChecked}`);
console.log(`Mismatch candidates: ${mismatches.length}\n`);

const bySlug = new Map();
for (const m of mismatches) {
  if (!bySlug.has(m.slug)) bySlug.set(m.slug, []);
  bySlug.get(m.slug).push(m);
}

for (const [slug, items] of [...bySlug.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n[${slug}]  ${items.length} mismatches`);
  for (const m of items.slice(0, 8)) {
    console.log(`  src: ${m.src.split("/").slice(-2).join("/")}`);
    console.log(`  loc: ${m.location}`);
    console.log(`  stem: [${m.stemTokens.slice(0, 5).join(", ")}]  loc-tokens: [${m.locTokens.slice(0, 5).join(", ")}]`);
    console.log("");
  }
  if (items.length > 8) console.log(`  (+${items.length - 8} more)`);
}

const wantJson = process.argv.includes("--json");
if (wantJson) {
  const out = path.join(ROOT, "scripts", "phase-6-attribution-mismatches.json");
  fs.writeFileSync(out, JSON.stringify(mismatches, null, 2));
  console.log(`\nWrote ${mismatches.length} mismatches to ${out}`);
}
