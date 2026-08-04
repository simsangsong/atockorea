#!/usr/bin/env node
/**
 * One-shot content repair for the Gyeongju re-course (2026-08-04).
 *
 * Two things leaked into guest-facing copy and were only visible in a real
 * render — both found by eyeballing /tour-product/... in the browser, neither
 * caught by tsc or any test:
 *
 *  1) **markdown bold** in fields that do not render markdown. The ONLY
 *     renderer that turns `**x**` into emphasis is
 *     `_shared/TourStopDetailDrawer.tsx` ("emphasis instead of rendering
 *     literal asterisks"), and it only sees itineraryStops fields —
 *     highlights / description / whyOnRoute. Everything else prints the
 *     asterisks. Control: busan-top-attractions, pocheon and jeju-eastern all
 *     use `**` too, but ONLY in those three fields, so they render 0 literal
 *     asterisks. Gyeongju added it to nine more fields → 23 visible runs.
 *
 *  2) 🔴 — this repo's internal "important" notation — in guest strings.
 *     Control: 0 in every other product bundle, 5 in Gyeongju.
 *
 * The fix belongs in the content source, not the generated bundle:
 *   scripts/gyeongju-recourse-content/<locale>.json
 * After this, re-run scripts/gyeongju-recourse-2026-08.mjs (which now throws if
 * either leak comes back) and regenerate the SQL.
 *
 *   node scripts/gyeongju-strip-unrendered-markup-2026-08.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "gyeongju-recourse-content");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const DRY = process.argv.includes("--dry-run");

/**
 * Content keys whose strings land in fields the markdown-aware drawer never
 * sees. `**` here is printed literally, so strip the markers and keep the text.
 * (Paths are normalised: array indices become `[]`.)
 */
const RAW_FIELD_KEYS = new Set([
  "faqReplace[].answer",
  "faqAdd[].answer",
  "whyItems[].detail",
  "routeShapeSubtitle",
  "seasonal[].description",
  "pdNotes[]",
  "bestFor[]",
  "lessIdealFor[]",
  "pickupAccordion[]",
  "seasonalAccordion[]",
]);

/** Internal notation that must never reach a guest. */
const STATUS_EMOJI = /[🔴🟠🟡🟢⚠✅❌]️?\s*/gu;

const stripBold = (s) => s.replace(/\*\*([^*]+)\*\*/g, "$1");

let totalBold = 0;
let totalEmoji = 0;

for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.json`);
  const doc = JSON.parse(readFileSync(file, "utf8"));
  let bold = 0;
  let emoji = 0;

  const walk = (node, keyPath) => {
    if (typeof node === "string") return node; // handled by the parent
    if (Array.isArray(node)) {
      return node.map((v, i) => {
        const p = `${keyPath}[]`;
        if (typeof v === "string") return fix(v, p);
        return walk(v, keyPath ? `${keyPath}[${i}]`.replace(/\[\d+\]/g, "[]") : keyPath);
      });
    }
    if (node && typeof node === "object") {
      for (const k of Object.keys(node)) {
        if (k === "_note") continue; // internal, never rendered
        const p = keyPath ? `${keyPath}.${k}` : k;
        const v = node[k];
        if (typeof v === "string") node[k] = fix(v, p);
        else node[k] = walk(v, p);
      }
      return node;
    }
    return node;
  };

  function fix(value, keyPath) {
    let out = value;
    const normalised = keyPath.replace(/\[\d+\]/g, "[]");
    if (RAW_FIELD_KEYS.has(normalised) && /\*\*[^*]+\*\*/.test(out)) {
      bold += (out.match(/\*\*[^*]+\*\*/g) || []).length;
      out = stripBold(out);
    }
    if (STATUS_EMOJI.test(out)) {
      STATUS_EMOJI.lastIndex = 0;
      emoji += (out.match(STATUS_EMOJI) || []).length;
      out = out.replace(STATUS_EMOJI, "").trimStart();
    }
    STATUS_EMOJI.lastIndex = 0;
    return out;
  }

  walk(doc, "");
  totalBold += bold;
  totalEmoji += emoji;
  if (!DRY) writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`  ${loc.padEnd(6)} bold markers stripped: ${String(bold).padStart(3)}   status emoji removed: ${emoji}`);
}

console.log(
  `\n${DRY ? "[dry-run] would strip" : "stripped"} ${totalBold} bold markers and ${totalEmoji} status emoji across ${LOCALES.length} locales.`,
);
if (!totalBold && !totalEmoji) {
  console.error("nothing changed — the content is already clean, or the key list drifted.");
  process.exit(1);
}
