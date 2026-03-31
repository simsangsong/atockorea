/**
 * Builds: supabase/migrations/20260328230000_seven_tours_detail_translations.sql
 * Run: node scripts/generate-tour-detail-i18n-sql.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { tourBundles } from "./i18n/seven-tours-bundle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "../supabase/migrations/20260328230000_seven_tours_detail_translations.sql");

let sql = `-- Seven flagship tours: full detail translations (ko, ja, zh, zh-TW, es).
-- Replaces per-locale objects under translations; include list-card fields (badges, duration, highlight).

`;

for (const { id, locales } of tourBundles) {
  const payload = JSON.stringify(locales);
  const tag = `tr${id.replace(/-/g, "").slice(0, 12)}`;
  if (payload.includes(`$${tag}$`)) {
    throw new Error(`Payload contains dollar-tag delimiter: ${id}`);
  }
  sql += `UPDATE tours SET translations = COALESCE(translations, '{}'::jsonb) || $${tag}$${payload}$${tag}$::jsonb WHERE id = '${id}';\n\n`;
}

fs.writeFileSync(outPath, sql, "utf8");
console.log("Wrote", outPath, `(${Math.round(fs.statSync(outPath).size / 1024)} KB)`);
