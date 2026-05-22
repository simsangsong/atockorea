#!/usr/bin/env node
/**
 * Phase 4b — repair legacy-schema pickup_dropoff in NON-EN sources.
 *
 * Several tours were migrated to the new departure/return schema in EN only; their
 * ko/ja/zh/zh-TW/es rows still carry the old `meeting_points` shape, which the current
 * renderer can't read — so the pickup/drop-off section is MISSING on non-EN pages.
 *
 * Fix (only touches rows/files that are legacy — no departure key):
 *   - JSON locale file: delete pickup_dropoff so it inherits EN via the bundle merge.
 *   - DB locale row:    set pickup_dropoff = EN row's pickup_dropoff (renders correctly).
 * New-schema locale sources (already have departure) and EN are left untouched.
 *
 *   node scripts/normalize-legacy-pickup-dropoff.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOURS = join(ROOT, "components/product-tour-static");
const NON_EN = ["ko", "ja", "zh", "zh-TW", "es"];
const DRY = process.argv.includes("--dry-run");

function env(name) {
  for (const f of [".env.local", ".env"]) {
    try {
      const m = readFileSync(join(ROOT, f), "utf8").match(new RegExp("^\\s*" + name + "\\s*=\\s*(.+)\\s*$", "m"));
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      /* ignore */
    }
  }
  return process.env[name] || "";
}

function writeJsonPreserving(path, obj, originalText) {
  const eol = originalText.includes("\r\n") ? "\r\n" : "\n";
  let out = JSON.stringify(obj, null, 2);
  if (eol === "\r\n") out = out.replace(/\n/g, "\r\n");
  out += originalText.endsWith("\n") ? eol : "";
  writeFileSync(path, out, "utf8");
}

const isNew = (pd) => pd && Array.isArray(pd.departure);
const isLegacy = (pd) => pd && !Array.isArray(pd.departure);

async function main() {
  const sb = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const slugs = readdirSync(TOURS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((slug) => {
      const p = join(TOURS, slug, `${slug}.en.json`);
      if (!existsSync(p)) return false;
      try {
        return isNew(JSON.parse(readFileSync(p, "utf8")).pickup_dropoff);
      } catch {
        return false;
      }
    });

  let json = 0;
  let db = 0;
  for (const slug of slugs) {
    const enPD = JSON.parse(readFileSync(join(TOURS, slug, `${slug}.en.json`), "utf8")).pickup_dropoff;

    // JSON: drop legacy pickup_dropoff so the locale inherits EN.
    for (const loc of NON_EN) {
      const p = join(TOURS, slug, `${slug}.${loc}.json`);
      if (!existsSync(p)) continue;
      const text = readFileSync(p, "utf8");
      const obj = JSON.parse(text);
      if (!isLegacy(obj.pickup_dropoff)) continue;
      delete obj.pickup_dropoff;
      if (!DRY) writeJsonPreserving(p, obj, text);
      json++;
      console.log(`  JSON ${slug}.${loc}  legacy pickup_dropoff removed -> inherits EN${DRY ? " [dry]" : ""}`);
    }

    // DB: replace legacy rows' pickup_dropoff with the EN new-schema object.
    const { data, error } = await sb
      .from("tour_product_pages")
      .select("locale, detail_payload")
      .eq("slug", slug)
      .neq("locale", "en");
    if (error) {
      console.log(`  ✗ DB read ${slug}: ${error.message}`);
      continue;
    }
    for (const row of data || []) {
      if (!isLegacy(row.detail_payload?.pickup_dropoff)) continue;
      const dp = row.detail_payload;
      dp.pickup_dropoff = enPD;
      if (!DRY) {
        const { error: upErr } = await sb
          .from("tour_product_pages")
          .update({ detail_payload: dp })
          .eq("slug", slug)
          .eq("locale", row.locale);
        if (upErr) {
          console.log(`  ✗ DB update ${slug}.${row.locale}: ${upErr.message}`);
          continue;
        }
      }
      db++;
      console.log(`  DB   ${slug}.${row.locale}  legacy -> EN new-schema${DRY ? " [dry]" : ""}`);
    }
  }
  console.log(`\nDone${DRY ? " (dry-run)" : ""}: ${json} JSON files, ${db} DB rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
