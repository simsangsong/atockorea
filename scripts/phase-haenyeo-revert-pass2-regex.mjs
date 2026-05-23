#!/usr/bin/env node
// Phase 2 — haenyeo timing residual cleanup via per-string regex.
//
// Pass-1 needles caught the most common phrasings, but pre-existing data
// has many subtle variants (description body bullets, FAQ answers,
// reasoning notes, "(13:30, 15:00, weather dependent)" parentheticals).
//
// Strategy: walk every string value in each tour bundle. If the value
// contains a Haenyeo keyword (haenyeo / 해녀 / 海女) AND a 13:30 or 15:00
// timing token, normalize the timing to "14:00 (1 show/day)" using a
// per-locale regex chain. Strings without both keywords are left alone,
// so unrelated 13:30/15:00 mentions (e.g., lunch service windows) are
// untouched.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOURS_DIR = path.join(ROOT, "components", "product-tour-static");

const HAENYEO_RX = /(haenyeo|해녀|海女)/i;
const TIMING_RX = /(13:30|15:00)/;

// Replacement rules. Applied in order; first match wins.
// Each rule: [matcher (regex), replacement (string|function)].
const REPLACEMENTS = [
  // ───── EN canonical phrasings ─────
  [/twice daily at 13:30 and 15:00 \(2 shows\/day\)/gi, "once daily at 14:00 (1 show/day)"],
  [/twice daily at 13:30 and 15:00/gi, "once daily at 14:00"],
  [/run \*?\*?daily at 13:30 and 15:00\*?\*?/gi, "run once daily at 14:00 (1 show/day)"],
  [/daily at 13:30 and 15:00/gi, "once daily at 14:00 (1 show/day)"],
  [/Daily haenyeo \(women diver\) free-diving demonstrations at 13:30 and 15:00/gi, "Daily haenyeo (women diver) free-diving demonstration once a day at 14:00"],
  [/free-diving demonstrations at 13:30 and 15:00/gi, "free-diving demonstration once a day at 14:00"],
  [/demonstrations daily 13:30 \+ 15:00/gi, "demonstration once daily at 14:00"],
  [/at 13:30 ?\/ ?15:00 shows/gi, "at 14:00 show"],
  [/at 13:30\/15:00/gi, "at 14:00 (1 show/day)"],
  [/\(13:30 ?\/ ?15:00 shows;?/gi, "(14:00 show;"],
  [/13:30 ?\/ ?15:00 shows/gi, "14:00 show"],
  [/\(13:30 ?\/ ?15:00\)/gi, "(14:00)"],
  [/\(13:30 and 15:00 at Seongsan\)/gi, "(14:00 at Seongsan)"],
  [/13:30 and 15:00 at Seongsan/gi, "14:00 at Seongsan"],
  [/\(typically 13:30 and 15:00,? weather dependent\)/gi, "(typically 14:00, weather dependent)"],
  [/typically 13:30 and 15:00/gi, "typically 14:00 (1 show/day)"],
  [/13:30 \+ 15:00/g, "14:00"],
  [/13:30, 15:00/g, "14:00"],

  // ───── KO ─────
  [/매일 13:30과 15:00 2회/g, "매일 14:00 1회"],
  [/매일 2회 13:30 ?\/ ?15:00/g, "매일 1회 14:00"],
  [/13:30 ?\/ ?15:00 시연/g, "14:00 시연"],
  [/13:30 ?\/ ?15:00 공연/g, "14:00 공연"],
  [/13:30 및 15:00에/g, "14:00에"],
  [/매일 13:30 및 15:00/g, "매일 14:00 1회"],
  [/13:30 및 15:00\) 사전/g, "14:00) 사전"],
  [/13:30 및 15:00\)/g, "14:00 1회)"],
  [/매일 13:30, 15:00/g, "매일 14:00 1회"],
  [/매일 13:30·15:00/g, "매일 14:00 1회"],
  [/매일 13:30과 15:00/g, "매일 14:00 1회"],
  [/13:30, 15:00 해녀/g, "14:00 해녀"],
  [/13:30 \+ 15:00 해녀/g, "14:00 해녀"],
  [/13:30 \+ 15:00/g, "14:00"],
  [/\(보통 13:30, 15:00, 날씨에 따라 변동\)/g, "(보통 14:00, 날씨에 따라 변동)"],
  [/보통 13:30, 15:00/g, "보통 14:00"],
  [/보통 13:30/g, "보통 14:00"],
  [/15:00 성산에서 해녀 시연을 본/g, "14:00 성산에서 해녀 시연을 본"],
  [/15:00 해녀/g, "14:00 해녀"],

  // ───── JA ─────
  [/毎日13:30と15:00の2回/g, "毎日14:00に1回"],
  [/毎日13:30 ?と ?15:00/g, "毎日14:00に1回"],
  [/毎日 ?13:30 ?・ ?15:00/g, "毎日 14:00 1回"],
  [/1日2回 ?13:30 ?\/ ?15:00/g, "1日1回14:00"],
  [/13:30 ?\/ ?15:00 ?公演/g, "14:00公演"],
  [/13:30 ?\/ ?15:00 ?開始/g, "14:00開始"],
  [/13:30 ?\/ ?15:00 ?実演/g, "14:00実演"],
  [/通常13:30と15:00/g, "通常14:00（1日1回）"],
  [/15:00実演/g, "14:00実演"],
  [/15:00に城山で海女/g, "14:00に城山で海女"],
  [/15:00海女/g, "14:00海女"],

  // ───── ZH (simplified) ─────
  [/每日13:30和15:00各举行一次/g, "每日14:00举行一次"],
  [/每天13:30和15:00各举行一场/g, "每天14:00举行一场"],
  [/每日13:30及15:00/g, "每日14:00"],
  [/每天13:30和15:00/g, "每天14:00"],
  [/13:30和15:00各举行一场/g, "14:00各举行一场"],
  [/13:30和15:00/g, "14:00（每日1场）"],
  [/13:30 ?\/ ?15:00 场次/g, "14:00场次"],
  [/13:30 \+ 15:00海女/g, "14:00海女"],
  [/13:30 \+ 15:00/g, "14:00"],
  [/通常每天13:30和15:00/g, "通常每天14:00"],
  [/15:00于城山观看了海女/g, "14:00于城山观看了海女"],
  [/15:00海女/g, "14:00海女"],

  // ───── ZH-TW (traditional) ─────
  [/每日13:30和15:00各舉行一場/g, "每日14:00舉行一場"],
  [/每日13:30及15:00/g, "每日14:00"],
  [/每日 ?13:30 ?及 ?15:00/g, "每日14:00"],
  // bold-delimited variants where ** sits between 每日 and the times
  [/\*\*13:30及15:00\*\*/g, "**14:00**"],
  [/於13:30及15:00\*\*/g, "於14:00**"],
  [/於13:30及15:00/g, "於14:00"],
  [/13:30及15:00各舉行一場/g, "14:00舉行一場"],
  [/13:30及15:00/g, "14:00（每日1場）"],
  [/13:30和15:00各舉行一場/g, "14:00舉行一場"],
  [/13:30和15:00舉行/g, "14:00舉行"],
  [/13:30和15:00/g, "14:00（每日1場）"],
  [/13:30 ?\/ ?15:00 場次/g, "14:00場次"],
  [/13:30 \+ 15:00海女/g, "14:00海女"],
  [/13:30 \+ 15:00/g, "14:00"],
  [/通常每天13:30和15:00/g, "通常每天14:00"],
  [/15:00觀賞城山海女/g, "14:00觀賞城山海女"],
  [/15:00海女/g, "14:00海女"],

  // ───── ES ─────
  [/dos veces al día a las 13:30 y 15:00 \(2 espectáculos\/día\)/gi, "una vez al día a las 14:00 (1 espectáculo/día)"],
  [/dos veces al día a las 13:30 y 15:00/gi, "una vez al día a las 14:00"],
  [/diariamente a las 13:30 y a las 15:00/gi, "diariamente a las 14:00 (1 espectáculo/día)"],
  [/diariamente a las 13:30 y las 15:00/gi, "diariamente a las 14:00 (1 espectáculo/día)"],
  [/diariamente a las 13:30 y 15:00/gi, "diariamente a las 14:00 (1 espectáculo/día)"],
  [/diariamente a las 13:30 \+ 15:00/gi, "diariamente a las 14:00 (1 espectáculo/día)"],
  [/diarias a las 13:30 y 15:00/gi, "diaria a las 14:00 (1 espectáculo/día)"],
  [/a diario a las 13:30 y las 15:00/gi, "a diario a las 14:00 (1 espectáculo/día)"],
  [/a las 13:30 y las 15:00/gi, "a las 14:00 (1 espectáculo/día)"],
  [/a las 13:30 y a las 15:00/gi, "a las 14:00 (1 espectáculo/día)"],
  [/a las 13:30 y 15:00/gi, "a las 14:00 (1 espectáculo/día)"],
  [/espectáculos a las 13:30 y 15:00; pueden cancelarse/gi, "espectáculo a las 14:00; puede cancelarse"],
  [/\(13:30 y 15:00 en Seongsan\)/gi, "(14:00 en Seongsan)"],
  [/13:30 y 15:00/gi, "14:00"],
  [/13:30 ?\/ ?15:00 ?shows/gi, "14:00 show"],
  [/de las 15:00/gi, "de las 14:00"],
  [/a las 15:00 la demostración haenyeo/gi, "a las 14:00 la demostración haenyeo"],
  [/demostración a las 15:00\)/gi, "demostración a las 14:00)"],
  [/a las 15:00 haenyeo/gi, "a las 14:00 haenyeo"],

  // ───── Universal: "(15:00 demo)" / "(15:00 ...)"  in any locale ─────
  [/\(15:00 demo\)/g, "(14:00 demo)"],
  [/at base \(15:00\)/g, "at base (14:00)"],

  // ───── Final stop-gap: strip "13:30" and surrounding glue tokens
  //       if it still survives with haenyeo in same string ─────
  [/13:30\s*(?:and|和|及|·|·|,|\+|y)\s*15:00/gi, "14:00"],
  [/\*\*\s*13:30\s*\*\*/g, "**14:00**"],
];

// Apply replacements only to strings that contain BOTH a haenyeo keyword
// AND a 13:30 or 15:00 timing. Other strings (e.g., lunch 13:30) untouched.
function rewriteString(s) {
  if (typeof s !== "string") return s;
  if (!HAENYEO_RX.test(s) || !TIMING_RX.test(s)) return s;
  let out = s;
  for (const [matcher, replacement] of REPLACEMENTS) {
    out = out.replace(matcher, replacement);
  }
  return out;
}

function rewriteJson(node) {
  if (Array.isArray(node)) return node.map(rewriteJson);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = rewriteJson(v);
    return out;
  }
  return typeof node === "string" ? rewriteString(node) : node;
}

const files = [];
function walkDir(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkDir(p);
    else if (entry.endsWith(".json")) files.push(p);
  }
}
walkDir(TOURS_DIR);

console.log(`\n=== Haenyeo regex revert pass 2 ===\n`);
let touched = 0;
for (const fp of files) {
  const raw = fs.readFileSync(fp, "utf8");
  const obj = JSON.parse(raw);
  const out = rewriteJson(obj);
  const after = JSON.stringify(out, null, 2) + "\n";
  if (after === raw) continue;
  fs.writeFileSync(fp, after, "utf8");
  touched++;
  console.log(`  ${path.relative(TOURS_DIR, fp)}`);
}
console.log(`\n${touched} file(s) rewritten\n`);

// Tight residual scan after pass
console.log(`--- Tight residual scan (haenyeo ↔ 13:30/15:00 within 80 chars) ---`);
let residuals = 0;
for (const fp of files) {
  const t = fs.readFileSync(fp, "utf8");
  for (const m of t.matchAll(/(haenyeo|해녀|海女)[^"\n]{0,80}(13:30|15:00)|(13:30|15:00)[^"\n]{0,80}(haenyeo|해녀|海女)/gi)) {
    residuals++;
    console.log(`  ${path.relative(TOURS_DIR, fp)}: ${m[0].replace(/\s+/g, " ").slice(0, 140)}`);
  }
}
console.log(`\n=== Residuals: ${residuals} ===`);
