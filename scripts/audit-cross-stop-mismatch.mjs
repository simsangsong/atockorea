#!/usr/bin/env node
/**
 * Deep dive on Category B from audit-tour-images-precision.mjs:
 *   "same image used by multiple stops within one tour".
 *
 * For every shared src, we infer the image's "place token" from its
 * path and compare to each stop's poi_key + name. A stop is flagged as
 * BORROWING when the image's token does not appear in its own
 * poi_key / name (i.e., the photo belongs to a different POI).
 *
 * Output: docs/tour-image-cross-stop-mismatch-2026-05-25.md
 * Also prints a per-tour summary.
 */

import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const PRODUCT_DIR = join(REPO, "components/product-tour-static");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const normalizeToken = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

function tokensFromSrc(src) {
  // /images/tours/<folder>/file.webp  → folder
  // /images/itinerary/<stem>.webp     → stem split by `-` (keep all parts)
  // /images/<other>/...               → first path segment after /images/
  const m1 = src.match(/^\/images\/tours\/([^/]+)\//);
  if (m1) return [normalizeToken(m1[1])];
  const m2 = src.match(/^\/images\/itinerary\/([^./]+)\.webp/);
  if (m2) {
    const stem = normalizeToken(m2[1]);
    // tokens: full stem + leading word(s) so we can match a poi_key
    // prefix like "jagalchi" against stem "jagalchi-harbor-sign"
    const parts = stem.split("-");
    const variants = new Set([stem]);
    for (let n = 1; n <= Math.min(3, parts.length); n++) {
      variants.add(parts.slice(0, n).join("-"));
    }
    return [...variants];
  }
  const m3 = src.match(/^\/images\/([^/]+)\//);
  if (m3) return [normalizeToken(m3[1])];
  return [];
}

function stopIdentityTokens(stop) {
  const fields = [
    stop?._poi_meta?.poi_key,
    stop?.poiKey,
    stop?.name,
    stop?.title,
    stop?.locationName,
    stop?.location,
  ].filter(Boolean);
  const set = new Set();
  for (const f of fields) {
    const norm = normalizeToken(f);
    if (!norm) continue;
    set.add(norm);
    // also add each word
    for (const part of norm.split("-")) {
      if (part.length >= 3) set.add(part);
    }
  }
  return set;
}

function stopLabel(stop) {
  return (
    stop?.name ||
    stop?.title ||
    stop?.locationName ||
    stop?._poi_meta?.poi_key ||
    stop?.poiKey ||
    "(unnamed stop)"
  );
}

function srcMatchesStop(srcTokens, stopTokens) {
  if (srcTokens.length === 0 || stopTokens.size === 0) return null;
  for (const t of srcTokens) {
    if (!t) continue;
    if (stopTokens.has(t)) return true;
    // partial: src token is prefix of any stop token (or vice versa)
    for (const st of stopTokens) {
      if (st.length < 4 || t.length < 4) continue;
      if (st.startsWith(t) || t.startsWith(st)) return true;
      if (st.includes(t) || t.includes(st)) return true;
    }
  }
  return false;
}

const perTour = new Map(); // slug → { locales: Set, findings: [] }

const entries = await fs.readdir(PRODUCT_DIR, { withFileTypes: true });
const slugs = entries.filter((d) => d.isDirectory()).map((d) => d.name).sort();

for (const slug of slugs) {
  for (const locale of LOCALES) {
    const path = join(PRODUCT_DIR, slug, `${slug}.${locale}.json`);
    let raw;
    try { raw = await fs.readFile(path, "utf-8"); } catch { continue; }
    let doc;
    try { doc = JSON.parse(raw); } catch { continue; }

    const stops = Array.isArray(doc.itineraryStops) ? doc.itineraryStops : [];
    if (stops.length === 0) continue;

    // Build per-stop src set and per-stop identity tokens
    const stopMeta = stops.map((s) => {
      const srcs = new Set();
      for (const img of s.images ?? []) {
        const v = typeof img === "object" ? img?.src : img;
        if (typeof v === "string") srcs.add(v);
      }
      for (const it of s.galleryItems ?? []) {
        if (typeof it?.src === "string") srcs.add(it.src);
      }
      return { label: stopLabel(s), tokens: stopIdentityTokens(s), srcs };
    });

    // Reverse map: src → [stopIdx]
    const srcToStops = new Map();
    stopMeta.forEach((m, idx) => {
      for (const s of m.srcs) {
        if (!srcToStops.has(s)) srcToStops.set(s, []);
        srcToStops.get(s).push(idx);
      }
    });

    for (const [src, idxs] of srcToStops) {
      const distinct = [...new Set(idxs)];
      if (distinct.length < 2) continue;
      const srcTokens = tokensFromSrc(src);
      const home = distinct
        .map((i) => ({ i, match: srcMatchesStop(srcTokens, stopMeta[i].tokens) }))
        .filter((r) => r.match === true);
      const borrowers = distinct.filter(
        (i) => !home.some((h) => h.i === i)
      );
      if (borrowers.length === 0) continue;

      if (!perTour.has(slug)) perTour.set(slug, { locales: new Set(), findings: [] });
      const bucket = perTour.get(slug);
      bucket.locales.add(locale);
      bucket.findings.push({
        locale,
        src,
        srcTokens,
        homeStops: home.map((h) => stopMeta[h.i].label),
        borrowerStops: borrowers.map((i) => stopMeta[i].label),
      });
    }
  }
}

// Collapse: across locales, same (src, borrower) usually repeats → dedup by src+borrower
const finalReport = [];
for (const [slug, { findings }] of perTour) {
  const dedup = new Map();
  for (const f of findings) {
    const key = `${f.src}::${f.borrowerStops.sort().join("|")}`;
    if (!dedup.has(key)) {
      dedup.set(key, {
        src: f.src,
        srcTokens: f.srcTokens,
        locales: new Set(),
        homeStops: new Set(),
        borrowerStops: new Set(),
      });
    }
    const e = dedup.get(key);
    e.locales.add(f.locale);
    for (const h of f.homeStops) e.homeStops.add(h);
    for (const b of f.borrowerStops) e.borrowerStops.add(b);
  }
  finalReport.push({
    slug,
    items: [...dedup.values()].map((e) => ({
      src: e.src,
      srcTokens: e.srcTokens,
      locales: [...e.locales].sort(),
      homeStops: [...e.homeStops],
      borrowerStops: [...e.borrowerStops],
    })),
  });
}

finalReport.sort((a, b) => b.items.length - a.items.length);

// Console summary
console.log(`\n=== CROSS-STOP IMAGE MISMATCH AUDIT — ${new Date().toISOString().slice(0, 10)} ===\n`);
let totalIssues = 0;
for (const t of finalReport) {
  if (t.items.length === 0) continue;
  console.log(`\n[${t.slug}]  (${t.items.length} mismatched-src groups)`);
  for (const it of t.items.slice(0, 5)) {
    totalIssues++;
    const home = it.homeStops.length > 0 ? it.homeStops.join(" / ") : "(no home — token didn't match any stop)";
    console.log(`  • ${it.src}`);
    console.log(`    home   : ${home}`);
    console.log(`    borrows: ${it.borrowerStops.join(" / ")}`);
    console.log(`    locales: ${it.locales.join(",")}`);
  }
  if (t.items.length > 5) console.log(`    … +${t.items.length - 5} more in this tour`);
}

// Markdown report
const today = new Date().toISOString().slice(0, 10);
const reportPath = join(REPO, `docs/tour-image-cross-stop-mismatch-${today}.md`);
const lines = [];
lines.push(`# Tour image cross-stop mismatch audit — ${today}`);
lines.push("");
lines.push(`**Generated by:** \`scripts/audit-cross-stop-mismatch.mjs\``);
lines.push("");
lines.push("Inspects every \`itineraryStops[*].images\` + \`galleryItems[*].src\` across all locales. Flags an image as **borrowed** when the same exact \`src\` appears on multiple stops AND the image's path-token does not match the borrower stop's poi_key/name. \"Home\" stops are those whose identity tokens DO match the image's path.");
lines.push("");
lines.push(`## Summary`);
lines.push("");
lines.push(`- Total tours flagged: **${finalReport.filter((t) => t.items.length > 0).length}**`);
const grandTotal = finalReport.reduce((a, t) => a + t.items.length, 0);
lines.push(`- Total mismatched (src, borrower) pairs: **${grandTotal}**`);
lines.push("");
lines.push(`> The earlier audit reported 150 raw cross-stop *occurrences* (counted per locale). After collapsing locales and filtering to the cases where the borrower's identity tokens disagree with the photo's path token, the unique borrower pairs are listed below.`);
lines.push("");
for (const t of finalReport) {
  if (t.items.length === 0) continue;
  lines.push(`## \`${t.slug}\` — ${t.items.length} mismatch groups`);
  lines.push("");
  for (const it of t.items) {
    lines.push(`### \`${it.src}\``);
    lines.push("");
    lines.push(`- **path tokens:** ${it.srcTokens.map((s) => "\`" + s + "\`").join(", ") || "(none)"}`);
    lines.push(`- **home stop(s):** ${it.homeStops.length > 0 ? it.homeStops.map((s) => "\`" + s + "\`").join(" / ") : "_(none — photo's path token matches no stop in this tour)_"}`);
    lines.push(`- **borrower stop(s):** ${it.borrowerStops.map((s) => "\`" + s + "\`").join(" / ")}`);
    lines.push(`- **locales affected:** ${it.locales.join(", ")}`);
    lines.push("");
  }
}

await fs.writeFile(reportPath, lines.join("\n"), "utf-8");
console.log(`\n→ full report written: ${reportPath}`);
console.log(`\nGRAND TOTAL: ${grandTotal} mismatched (src, borrower) groups across ${finalReport.filter((t) => t.items.length > 0).length} tours`);
