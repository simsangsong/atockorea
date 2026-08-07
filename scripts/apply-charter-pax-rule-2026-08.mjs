#!/usr/bin/env node
/**
 * Owner pricing rule, 2026-08-07:
 *   *"프라이빗 정원은 1-7인 같은 가격으로, 8인 부터는 그냥 2배 가격으로 나가는거야,
 *     제주 부산 서울 다 똑같이"*
 *
 * One vehicle takes up to 7. Eight or more means a second vehicle, so the rate
 * doubles. That replaces the seeded 1–6 / 7–9 / 10–13 ladder, whose middle and
 * top steps were never a real price list — the same three rows appear on four
 * different products in four different cities.
 *
 * The FAQ already said the same thing from the other side ("sedan or SUV for
 * 1–3, mid-size van for 4–7, larger groups please contact us"); it just never
 * matched the table beside it.
 *
 *   node --env-file=.env.local scripts/apply-charter-pax-rule-2026-08.mjs [--dry-run]
 *
 * Touches ONLY `pricingTiers.tiers`. Durations and prices per duration are left
 * exactly as each copy has them — bundle and DB have drifted on these products
 * and reconciling that is a separate, deliberately deferred job. Rewriting the
 * whole card would have clobbered whichever side is newer.
 *
 * ⚠ seoul-dmz-private-3rd-tunnel-suspension-bridge is EXCLUDED. Its card is a
 * hand-built per-head ladder (1–3 $419, 4 $469, 5 $499 … 14–15 $1149) rather
 * than the seeded template, so "the 1–7 price" is not derivable from it — that
 * one number is an owner call, not an inference.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];
const SLUGS = [
  "busan-private-car-charter-cruise-shore",
  "jeju-island-private-car-charter-tour",
  "seoul-suburbs-private-chartered-car-10hr",
  "incheon-seoul-private-car-shore-excursion-cruise",
];

/** One vehicle seats 7; 8+ is two vehicles. */
const SEATS_PER_VEHICLE = 7;

/**
 * Rebuild a card's tiers under the rule, keeping its own durations and its own
 * base prices. `paxLabel` stays English because it renders raw in every locale
 * today (see lib/i18n/pipeline/segments.ts) — changing that is an i18n job, and
 * inventing a Korean label here would only be right on one page in six.
 */
function applyRule(card) {
  if (!card || !Array.isArray(card.tiers) || !card.tiers.length) return null;
  const base = card.tiers[0];
  if (!base?.prices) return null;
  const doubled = Object.fromEntries(
    Object.entries(base.prices).map(([k, v]) => [k, typeof v === "number" ? v * 2 : v]),
  );
  const next = {
    ...card,
    tiers: [
      { paxLabel: `1–${SEATS_PER_VEHICLE} pax`, paxMin: 1, paxMax: SEATS_PER_VEHICLE, prices: { ...base.prices } },
      {
        paxLabel: `${SEATS_PER_VEHICLE + 1}+ pax`,
        paxMin: SEATS_PER_VEHICLE + 1,
        paxMax: SEATS_PER_VEHICLE * 2,
        prices: doubled,
      },
    ],
  };
  return same(next, card) ? null : next;
}

/**
 * Postgres `jsonb` does not keep key order, so a round-tripped card never
 * string-matches a freshly built one. Comparing raw JSON.stringify made every
 * DB row look changed on every run — an idempotence check that cannot fail.
 */
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  }
  return v;
}
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

let bundleWrites = 0;
for (const slug of SLUGS) {
  for (const locale of LOCALES) {
    const path = `components/product-tour-static/${slug}/${slug}.${locale}.json`;
    let raw;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const doc = JSON.parse(raw);
    const next = applyRule(doc.pricingTiers);
    if (!next) continue;
    doc.pricingTiers = next;
    const out = `${JSON.stringify(doc, null, 2)}\n`;
    if (out !== raw) {
      bundleWrites += 1;
      if (!DRY) writeFileSync(path, out);
    }
  }
  const en = JSON.parse(readFileSync(`components/product-tour-static/${slug}/${slug}.en.json`, "utf8"));
  const t = en.pricingTiers?.tiers ?? [];
  console.log(
    `${slug}\n  bundle → ${t.map((x) => `${x.paxLabel} ${Object.values(x.prices).join("/")}`).join("   |   ")}`,
  );
}
console.log(`\n${DRY ? "[dry-run] would rewrite" : "rewrote"} ${bundleWrites} bundle file(s)`);

// --- DB half: only the pricingTiers key, never the whole payload -------------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
if (!url || !key) {
  console.error("\nmissing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — run with --env-file=.env.local");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let dbWrites = 0;
for (const slug of SLUGS) {
  const { data: rows, error } = await db
    .from("tour_product_pages")
    .select("id, locale, detail_payload")
    .eq("slug", slug)
    .in("locale", LOCALES);
  if (error) throw new Error(`${slug}: ${error.message}`);
  for (const row of rows ?? []) {
    const payload = row.detail_payload;
    const next = applyRule(payload?.pricingTiers);
    if (!next) continue;
    if (DRY) {
      console.log(`  [dry-run] DB ${slug}/${row.locale}: ${next.tiers.map((t) => t.paxLabel).join(" + ")}`);
    } else {
      const { error: upErr } = await db
        .from("tour_product_pages")
        .update({ detail_payload: { ...payload, pricingTiers: next }, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (upErr) throw new Error(`${slug}/${row.locale}: ${upErr.message}`);
    }
    dbWrites += 1;
  }
}
console.log(`${DRY ? "[dry-run] would update" : "updated"} ${dbWrites} DB row(s)`);
