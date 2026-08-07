#!/usr/bin/env node
/**
 * Applies the same two guest-copy cleanups to `tour_product_pages.detail_payload`
 * that `strip-translator-commentary-2026-08.mjs` applied to the bundles.
 *
 * 🔴 It re-runs the TRANSFORM, it does not copy the bundle over. `detail_payload`
 * is what the page renders and several sessions write to it; pushing a whole
 * bundle would silently discard whatever landed there since this branch forked.
 * Removing a translator's note and a pair of asterisks cannot destroy anyone's
 * work, whatever else has changed in the row.
 *
 *   node --env-file=.env.local scripts/clean-guest-copy-db-2026-08.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");

/** Products whose bundles were cleaned in the same pass. */
const SLUGS = [
  "busan-cruise-shore-excursion-bus-tour",
  "busan-small-group-sightseeing-tour-cruise-passengers",
  "incheon-seoul-private-car-shore-excursion-cruise",
  "busan-gyeongju-unesco-legacy-tour-national-museum",
  "jeju-cherry-blossom-tour-east-route",
  "jeju-cruise-shore-excursion-bus-tour",
  "jeju-winter-southwest-tangerine-snow-camellia-tour",
  "seoul-suburbs-private-chartered-car-10hr",
];

const NOTE_WORD =
  "(?:Notes?|注意|注釈|譯注|译注|備考|备考|注|비고|참고|Nota|Notas|Hinweis|Remarque|Примечание)";
const COMMENTARY = new RegExp(`\\s*(?:>|---|—)\\s*\\**\\s*${NOTE_WORD}\\s*\\**\\s*[:：][\\s\\S]*$`);
const ARTIFACT =
  /`[a-z-]+-[a-z0-9/.[\]]+`|Tailwind|CSS|UI ?(?:컴포넌트|コンポーネント|component)|第\s*\d+[–\-~]?\d*\s*[行項]|\d+\s*[・,、]\s*\d+\s*(?:番|행|行|項)|保留原文|不作翻译|不译|不譯|そのまま(?:保持|維持|記載)|원문 유지|kept untranslated/i;

/** Only these render `**x**` as emphasis; anywhere else it prints asterisks. */
const MARKDOWN_KEYS = new Set(["highlights", "description", "whyOnRoute", "tip"]);
const SKIP_ROOT = new Set(["page_sections", "_publication"]);

let commentary = 0;
let bold = 0;

function cleanString(value, lastKey) {
  let next = value;
  if (COMMENTARY.test(next) && ARTIFACT.test(next)) {
    const cut = next.replace(COMMENTARY, "").trim();
    if (cut.length) {
      next = cut;
      commentary += 1;
    }
  }
  if (!MARKDOWN_KEYS.has(lastKey)) {
    const stripped = next.replace(/\*\*([^*]+)\*\*/g, "$1");
    if (stripped !== next) {
      next = stripped;
      bold += 1;
    }
  }
  return next;
}

function clean(node, lastKey, isRoot) {
  if (typeof node === "string") return cleanString(node, lastKey);
  if (Array.isArray(node)) return node.map((v) => clean(v, lastKey, false));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (isRoot && SKIP_ROOT.has(k)) out[k] = v;
      else out[k] = clean(v, k, false);
    }
    return out;
  }
  return node;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
if (!url || !key) {
  console.error("missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — run with --env-file=.env.local");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let rows = 0;
for (const slug of SLUGS) {
  const { data, error } = await db
    .from("tour_product_pages")
    .select("id, slug, locale, detail_payload")
    .eq("slug", slug);
  if (error) throw new Error(`${slug}: ${error.message}`);
  for (const row of data ?? []) {
    const before = commentary + bold;
    const next = clean(row.detail_payload, "", true);
    if (commentary + bold === before) continue;
    if (DRY) {
      console.log(`  [dry-run] ${slug}/${row.locale}`);
    } else {
      const { error: upErr } = await db
        .from("tour_product_pages")
        .update({ detail_payload: next, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (upErr) throw new Error(`${slug}/${row.locale}: ${upErr.message}`);
      console.log(`  ${slug}/${row.locale}`);
    }
    rows += 1;
  }
}

console.log(
  `\n${DRY ? "[dry-run] would update" : "updated"} ${rows} row(s) — ${commentary} translator note(s), ${bold} literal-asterisk field(s)`,
);
