#!/usr/bin/env node
/**
 * Copy locale-specific POI stop content from static tour JSONs into
 * public.match_pois.content_locales.
 *
 * This is intentionally a copy, not translation. Each itineraryStop is matched
 * 1:1 by `_poi_meta.poi_key`; the localized stop fields from the tour JSON are
 * stored under content_locales[locale]. Existing English scalar columns remain
 * the fallback for older UI/API consumers.
 *
 * Usage:
 *   node --env-file=.env.local scripts/enrich-match-pois-locales-from-tour-jsons.mjs [--dry-run]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TOURS_DIR = join(ROOT, "components/product-tour-static");

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const NON_EN_LOCALES = ["ko", "ja", "zh", "zh-TW", "es"];
const OTHER_NAME_LOCALES = ["ja", "zh", "zh-TW", "es"];
const DRY_RUN = process.argv.includes("--dry-run");

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function cleanString(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function cleanStringArray(v) {
  if (!Array.isArray(v)) return null;
  const out = v.map(cleanString).filter(Boolean);
  return out.length > 0 ? out : null;
}

function cleanImageString(v) {
  const s = cleanString(v);
  if (!s) return null;
  if (/[`>]/.test(s) || /note:/i.test(s)) return null;
  if (!s.startsWith("/") && !/^https?:\/\//i.test(s)) return null;
  return s;
}

function cleanImageArray(v) {
  if (!Array.isArray(v)) return null;
  const seen = new Set();
  const out = [];
  for (const value of v) {
    const img = cleanImageString(value);
    if (img && !seen.has(img)) {
      seen.add(img);
      out.push(img);
    }
  }
  return out.length > 0 ? out : null;
}

function cleanObject(v) {
  if (!isPlainObject(v)) return null;
  return Object.keys(v).length > 0 ? v : null;
}

function parseDuration(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(min|minute|hour|hr)/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  return unit.startsWith("h") ? Math.round(v * 60) : Math.round(v);
}

function normalizeRegion(raw) {
  if (!raw) return null;
  const lc = String(raw).toLowerCase().trim();
  if (lc.includes("busan")) return "busan";
  if (lc.includes("jeju")) return "jeju";
  if (lc.includes("incheon")) return "incheon";
  if (lc.includes("seoul")) return "seoul";
  if (lc.includes("gyeongju")) return "gyeongju";
  if (lc.includes("yangsan")) return "yangsan";
  return lc.split(/[\s/+&,]/)[0] || null;
}

function isRealPoi(meta) {
  if (!meta || typeof meta.poi_key !== "string") return false;
  if (meta.match === "transit_only") return false;
  if (meta.poi_key.startsWith("OPS_")) return false;
  if (meta.poi_key.startsWith("route_variant_")) return false;
  return true;
}

function listTourDirs() {
  return readdirSync(TOURS_DIR)
    .filter((entry) => {
      const full = join(TOURS_DIR, entry);
      try {
        return statSync(full).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.localeCompare(b));
}

function localeContentFromStop(stop, slug) {
  const content = {
    name: cleanString(stop.name),
    category: cleanString(stop.category),
    description: cleanString(stop.description),
    highlights: cleanStringArray(stop.highlights),
    smart_notes: cleanObject(stop.smartNotes),
    visit_basics: cleanObject(stop.visitBasics),
    convenience: cleanObject(stop.convenience),
    why_on_route: cleanString(stop.whyOnRoute),
    image: cleanImageString(stop.image),
    images: cleanImageArray(stop.images),
    duration: cleanString(stop.duration),
    time_used: cleanStringArray(stop.timeUsed),
    source_tour_slug: slug,
  };

  for (const key of Object.keys(content)) {
    if (content[key] == null) delete content[key];
  }
  return Object.keys(content).length > 1 ? content : null;
}

const pois = new Map();

function ensurePoi(key) {
  let acc = pois.get(key);
  if (!acc) {
    acc = {
      poi_key: key,
      name_en: null,
      name_ko: null,
      names_other_locales: {},
      content_locales: {},
      region: null,
      category: null,
      default_stay_minutes: null,
      _seenLocales: new Set(),
      _sourceTours: new Set(),
    };
    pois.set(key, acc);
  }
  return acc;
}

function mergeStop(stop, region, locale, slug) {
  const key = stop._poi_meta.poi_key;
  const acc = ensurePoi(key);
  const name = cleanString(stop.name);

  if (locale === "en") {
    acc.name_en ||= name;
    acc.category ||= cleanString(stop.category);
    acc.default_stay_minutes ??= parseDuration(stop.duration);
  } else if (locale === "ko") {
    acc.name_ko ||= name;
  } else if (OTHER_NAME_LOCALES.includes(locale) && name) {
    acc.names_other_locales[locale] ||= name;
  }

  acc.region ||= region;
  acc._seenLocales.add(locale);
  acc._sourceTours.add(slug);

  const content = localeContentFromStop(stop, slug);
  if (content && !acc.content_locales[locale]) {
    acc.content_locales[locale] = content;
  }
}

function walkTours() {
  let tourDirsScanned = 0;
  let filesScanned = 0;
  let stopsScanned = 0;

  for (const slug of listTourDirs()) {
    tourDirsScanned++;
    let tourRegion = null;

    for (const locale of LOCALES) {
      const file = join(TOURS_DIR, slug, `${slug}.${locale}.json`);
      if (!existsSync(file)) continue;
      filesScanned++;

      let json;
      try {
        json = JSON.parse(readFileSync(file, "utf8"));
      } catch (e) {
        console.warn(`Skip ${file}: parse error ${e.message}`);
        continue;
      }

      if (locale === "en" || !tourRegion) {
        tourRegion =
          normalizeRegion(json.catalog_card?.region) ||
          normalizeRegion(json.hero?.meta?.region) ||
          tourRegion;
      }

      const stops = Array.isArray(json.itineraryStops) ? json.itineraryStops : [];
      for (const stop of stops) {
        if (!isRealPoi(stop._poi_meta)) continue;
        stopsScanned++;
        mergeStop(stop, tourRegion, locale, slug);
      }
    }
  }

  return { tourDirsScanned, filesScanned, stopsScanned };
}

function rowFromAcc(acc) {
  const contentLocales = {};
  for (const locale of LOCALES) {
    if (acc.content_locales[locale]) contentLocales[locale] = acc.content_locales[locale];
  }

  const namesOther = Object.keys(acc.names_other_locales).length
    ? acc.names_other_locales
    : null;

  return {
    poi_key: acc.poi_key,
    name_ko: acc.name_ko,
    names_other_locales: namesOther,
    content_locales: Object.keys(contentLocales).length ? contentLocales : null,
  };
}

function coverage(rows) {
  const byLocale = Object.fromEntries(LOCALES.map((locale) => [locale, 0]));
  const nonEnComplete = [];
  for (const row of rows) {
    for (const locale of LOCALES) {
      if (row.content_locales?.[locale]) byLocale[locale]++;
    }
    if (NON_EN_LOCALES.every((locale) => row.content_locales?.[locale])) {
      nonEnComplete.push(row.poi_key);
    }
  }
  return { byLocale, nonEnCompleteCount: nonEnComplete.length };
}

async function main() {
  console.log("Walking localized tour JSONs...");
  const stats = walkTours();
  const rows = [...pois.values()].map(rowFromAcc);
  const cov = coverage(rows);

  console.log(
    `Scanned ${stats.tourDirsScanned} tour dirs / ${stats.filesScanned} locale files / ${stats.stopsScanned} localized stop instances`
  );
  console.log(`Found ${rows.length} unique real POI keys`);
  console.log("content_locales coverage:", cov.byLocale);
  console.log(`POIs with all 5 non-English locales: ${cov.nonEnCompleteCount}/${rows.length}`);

  const missingAny = rows
    .filter((row) => !NON_EN_LOCALES.every((locale) => row.content_locales?.[locale]))
    .map((row) => ({
      poi_key: row.poi_key,
      missing: NON_EN_LOCALES.filter((locale) => !row.content_locales?.[locale]),
    }));
  if (missingAny.length) {
    console.warn(`Missing at least one non-English locale for ${missingAny.length} POIs`);
    console.warn(JSON.stringify(missingAny.slice(0, 20), null, 2));
  }

  if (DRY_RUN) {
    console.log("[--dry-run] Skipping Supabase updates.");
    return;
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY env");
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  let updated = 0;
  const notFound = [];

  for (const row of rows) {
    const payload = {
      name_ko: row.name_ko,
      names_other_locales: row.names_other_locales,
      content_locales: row.content_locales,
    };
    const { data, error } = await sb
      .from("match_pois")
      .update(payload)
      .eq("poi_key", row.poi_key)
      .select("poi_key");

    if (error) {
      console.error(`UPDATE error ${row.poi_key}:`, error.message);
      continue;
    }
    if (!data || data.length === 0) {
      notFound.push(row.poi_key);
      continue;
    }
    updated++;
  }

  console.log(`Updated ${updated}/${rows.length} existing match_pois rows`);
  if (notFound.length) {
    console.warn(`No existing match_pois row for ${notFound.length} POI keys:`);
    console.warn(notFound.join(", "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
