#!/usr/bin/env node
/**
 * Phase 4 — standardize Busan CITY day-tour drop-offs to the 4 canonical points
 * (Nampo/Jagalchi, Busan Station, Seomyeon, Haeundae) and normalize pickup_dropoff
 * to the new departure/return schema in ALL locales.
 *
 * Several locale JSON/DB rows still carry the legacy `meeting_points` schema (or none),
 * which the current renderer can't read. We rebuild a localized new-schema pickup_dropoff
 * from each tour's EN base (corrected coords) and overwrite it everywhere, so every locale
 * renders the same departure + the canonical 4 drop-offs.
 *
 * Cruise/charter port tours and busan-top-attractions (already canonical) are NOT targets.
 *
 *   node scripts/standardize-busan-dropoffs.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOURS = join(ROOT, "components/product-tour-static");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
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

const TARGETS = [
  "busan-gyeongju-unesco-legacy-tour-national-museum",
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju",
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour",
  "from-busan-gyeongju-ancient-capital-day-tour",
];

const STATION = {
  busan_station: { en: "Busan Station", ko: "부산역", ja: "釜山駅", zh: "釜山站", "zh-TW": "釜山站", es: "Estación de Busan" },
  seomyeon: { en: "Seomyeon Station", ko: "서면역", ja: "西面駅", zh: "西面站", "zh-TW": "西面站", es: "Estación de Seomyeon" },
  haeundae: { en: "Haeundae Station", ko: "해운대역", ja: "海雲台駅", zh: "海云台站", "zh-TW": "海雲台站", es: "Estación de Haeundae" },
  nopo: { en: "Nopo Station", ko: "노포역", ja: "老圃駅", zh: "老圃站", "zh-TW": "老圃站", es: "Estación de Nopo" },
  nampo: { en: "Nampo-dong / Jagalchi area", ko: "남포동 / 자갈치 일대", ja: "南浦洞・ジャガルチ周辺", zh: "南浦洞 / 札嘎其一带", "zh-TW": "南浦洞 / 札嘉其一帶", es: "Nampo-dong / zona de Jagalchi" },
};
const EXIT = {
  en: (n) => ` (Exit ${n})`,
  ko: (n) => ` (${n}번 출구)`,
  ja: (n) => `（${n}番出口）`,
  zh: (n) => `（${n}号出口）`,
  "zh-TW": (n) => `（${n}號出口）`,
  es: (n) => ` (Salida ${n})`,
};
const KTX = { en: " (KTX main exit)", ko: " (KTX 정문)", ja: "（KTX正面出口）", zh: "（KTX正门）", "zh-TW": "（KTX正門）", es: " (salida principal KTX)" };

function baseKey(enName) {
  const n = enName.toLowerCase();
  if (n.includes("busan station")) return "busan_station";
  if (n.includes("seomyeon")) return "seomyeon";
  if (n.includes("haeundae")) return "haeundae";
  if (n.includes("nopo")) return "nopo";
  if (n.includes("nampo") || n.includes("jagalchi")) return "nampo";
  return null;
}

function locName(enName, locale) {
  const key = baseKey(enName);
  if (!key) return enName;
  let name = STATION[key][locale] ?? STATION[key].en;
  if (key === "nampo") return name; // no exit suffix
  if (/ktx/i.test(enName)) name += KTX[locale] ?? KTX.en;
  else {
    const m = enName.match(/exit\s*(\d+)/i);
    if (m) name += (EXIT[locale] ?? EXIT.en)(m[1]);
  }
  return name;
}

// Canonical 4 drop-offs (corrected coords), in order.
const RETURN_BASE = [
  { key: "nampo", lat: 35.09663, lng: 129.0308 },
  { key: "busan_station", lat: 35.11449, lng: 129.03933, exit: 4 },
  { key: "seomyeon", lat: 35.15782, lng: 129.06003, exit: 4 },
  { key: "haeundae", lat: 35.16396, lng: 129.15853, exit: 5 },
];
function returnFor(locale) {
  return RETURN_BASE.map((r, i) => {
    let name = STATION[r.key][locale] ?? STATION[r.key].en;
    if (r.exit) name += (EXIT[locale] ?? EXIT.en)(r.exit);
    return { lat: r.lat, lng: r.lng, name, type: "station", order: i + 1 };
  });
}

/** Build the localized new-schema pickup_dropoff from the EN base object. */
function buildPD(enPD, locale) {
  const departure = (enPD.departure || []).map((p) => {
    const out = { lat: p.lat, lng: p.lng, name: locName(p.name, locale), type: p.type ?? "station", order: p.order };
    if (locale === "en" && p.note) out.note = p.note; // keep EN-only meeting notes
    if (p.time) out.time = p.time;
    return out;
  });
  const pd = { departure, return: returnFor(locale) };
  if (enPD.notes) pd.notes = enPD.notes; // internal (return-band inference); not displayed
  if (enPD.type) pd.type = enPD.type;
  return pd;
}

function writeJsonPreserving(path, obj, originalText) {
  const eol = originalText.includes("\r\n") ? "\r\n" : "\n";
  let out = JSON.stringify(obj, null, 2);
  if (eol === "\r\n") out = out.replace(/\n/g, "\r\n");
  out += originalText.endsWith("\n") ? eol : "";
  writeFileSync(path, out, "utf8");
}

async function main() {
  const sb = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  let json = 0;
  let db = 0;
  for (const slug of TARGETS) {
    // EN base = corrected new-schema departure from the EN JSON file.
    const enText = readFileSync(join(TOURS, slug, `${slug}.en.json`), "utf8");
    const enObj = JSON.parse(enText);
    const enPD = enObj.pickup_dropoff;
    if (!enPD?.departure) {
      console.log(`  ✗ ${slug}: EN file has no departure; skipping`);
      continue;
    }

    for (const loc of LOCALES) {
      const p = join(TOURS, slug, `${slug}.${loc}.json`);
      if (!existsSync(p)) continue;
      const text = readFileSync(p, "utf8");
      const obj = JSON.parse(text);
      obj.pickup_dropoff = buildPD(enPD, loc);
      if (!DRY) writeJsonPreserving(p, obj, text);
      json++;
      console.log(`  JSON ${slug}.${loc}  pickup_dropoff normalized${DRY ? " [dry]" : ""}`);
    }

    const { data, error } = await sb.from("tour_product_pages").select("locale, detail_payload").eq("slug", slug);
    if (error) {
      console.log(`  ✗ DB read ${slug}: ${error.message}`);
      continue;
    }
    for (const row of data || []) {
      const dp = row.detail_payload;
      dp.pickup_dropoff = buildPD(enPD, row.locale);
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
      console.log(`  DB   ${slug}.${row.locale}  pickup_dropoff normalized${DRY ? " [dry]" : ""}`);
    }
  }
  console.log(`\nDone${DRY ? " (dry-run)" : ""}: ${json} JSON files, ${db} DB rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
