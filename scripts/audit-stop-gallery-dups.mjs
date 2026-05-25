#!/usr/bin/env node
/** Audit + dedupe stop.galleryItems and stop.imageCredits in tour-product JSONs. */

import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const PRODUCT_DIR = join(REPO, "components/product-tour-static");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const APPLY = process.argv.includes("--apply");
let totalGi = 0;
let totalIc = 0;
let touched = 0;

function dedupeArray(arr, keyFn) {
  if (!Array.isArray(arr)) return { out: arr, removed: 0 };
  const seen = new Set();
  const out = [];
  let removed = 0;
  for (const item of arr) {
    const key = keyFn(item);
    if (key == null) {
      out.push(item);
      continue;
    }
    if (seen.has(key)) {
      removed += 1;
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return { out, removed };
}

const entries = await fs.readdir(PRODUCT_DIR, { withFileTypes: true });
const slugs = entries.filter((d) => d.isDirectory()).map((d) => d.name);

for (const slug of slugs) {
  for (const locale of LOCALES) {
    const path = join(PRODUCT_DIR, slug, `${slug}.${locale}.json`);
    let raw;
    try { raw = await fs.readFile(path, "utf-8"); } catch { continue; }
    let doc;
    try { doc = JSON.parse(raw); } catch { continue; }

    const stops = Array.isArray(doc.itineraryStops) ? doc.itineraryStops : [];
    let fileGi = 0, fileIc = 0;
    for (const stop of stops) {
      const gi = dedupeArray(stop.galleryItems, (it) => it?.src ?? null);
      stop.galleryItems = gi.out;
      fileGi += gi.removed;
      const ic = dedupeArray(stop.imageCredits, (it) => it?.url ?? null);
      stop.imageCredits = ic.out;
      fileIc += ic.removed;
    }
    if (fileGi > 0 || fileIc > 0) {
      totalGi += fileGi;
      totalIc += fileIc;
      touched += 1;
      if (APPLY) {
        const next = JSON.stringify(doc, null, 2) + "\n";
        await fs.writeFile(path, next, "utf-8");
      }
      console.log(`${slug}/${locale}  gi=${fileGi}  ic=${fileIc}`);
    }
  }
}

console.log(`\n${APPLY ? "APPLIED" : "DRY-RUN"} — files: ${touched}  gi removed: ${totalGi}  ic removed: ${totalIc}`);
