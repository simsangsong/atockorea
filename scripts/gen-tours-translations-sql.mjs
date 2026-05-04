// Generate SQL to populate tours.translations from each tour's static
// catalog_card across 5 non-en locales (ko, ja, zh, zh-TW, es).
//
// Output: a single SQL file with one UPDATE per tour. The UPDATE writes a
// JSONB object: { ko: {title, description, badges, duration}, ja: {...}, ... }
// — the keys consumed by /api/tours' transformer.

import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";

const LOCALES = ["ko", "ja", "zh", "zh-TW", "es"];
const TOURS_DIR = "components/product-tour-static";

function safeStr(v) {
  return typeof v === "string" ? v : "";
}
function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function tourSlugs() {
  return readdirSync(TOURS_DIR).filter((d) => {
    const full = path.join(TOURS_DIR, d);
    if (!statSync(full).isDirectory()) return false;
    if (d === "_shared" || d === "catalog") return false;
    return true;
  });
}

function buildLocaleEntry(slug, locale) {
  const file = path.join(TOURS_DIR, slug, `${slug}.${locale}.json`);
  const j = JSON.parse(readFileSync(file, "utf-8"));
  const cc = j.catalog_card || {};
  // Description preference: shortCardDescription (richer) → subtitle (short)
  const description = safeStr(cc.shortCardDescription) || safeStr(cc.subtitle);
  return {
    title: safeStr(cc.title),
    description,
    badges: safeArr(cc.badges).map(String),
    duration: safeStr(cc.duration),
  };
}

const stmts = [];
const slugs = tourSlugs().sort();
for (const slug of slugs) {
  const entries = {};
  for (const L of LOCALES) {
    try {
      entries[L] = buildLocaleEntry(slug, L);
    } catch (e) {
      console.error(`! Skipping ${slug}/${L}: ${e.message}`);
    }
  }
  if (Object.keys(entries).length === 0) continue;
  const json = JSON.stringify(entries).replace(/'/g, "''");
  stmts.push(
    `UPDATE tours SET translations = '${json}'::jsonb, updated_at = NOW() WHERE slug = '${slug}';`,
  );
}

const sql = `-- Backfill tours.translations for 30 static tours across 5 non-en locales.
-- Source: components/product-tour-static/<slug>/<slug>.<locale>.json catalog_card
-- Generated: ${new Date().toISOString()}
BEGIN;
${stmts.join("\n")}
COMMIT;
`;

writeFileSync("scripts/.generated-tours-translations.sql", sql, "utf-8");
console.log(`wrote ${stmts.length} UPDATE statements to scripts/.generated-tours-translations.sql`);
console.log(`(${slugs.length} tour folders inspected)`);
