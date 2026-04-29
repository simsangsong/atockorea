/**
 * Haiku live smoke test — calls the v1.8 parser against the real Anthropic API
 * for a small set of queries and prints telemetry + cost.
 *
 * Usage:  npx tsx scripts/match-haiku-live.ts
 * Requires ANTHROPIC_API_KEY in .env.local (auto-loaded by Node 20+ via --env-file).
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { haikuParse } from "../lib/tour-match-v2/parser-haiku";
import { matchTours } from "../lib/tour-match-v2/matcher";
import { computeHaikuCost } from "../lib/tour-match-v2/cost-calc";
import { explainTopMatch } from "../lib/tour-match-v2/explainer-haiku";
import type { MatchTourRow } from "../lib/tour-match-v2/types";

// @ts-expect-error import.meta.url under tsx
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TOURS_DIR = join(ROOT, "components/product-tour-static");

// Load .env.local manually (Node tsx doesn't auto-load)
function loadEnv() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

// Minimal local row builder (sync with import-match-v18.mjs)
function buildSimpleRow(slug: string, doc: any): MatchTourRow {
  const mp = doc.matching_profile ?? {};
  const mm = doc.matching_metadata ?? {};
  const stops = doc.itineraryStops ?? [];
  const s = slug.toLowerCase();
  let region: string | null = mp?.destination_region ?? null;
  if (s.includes("jeju")) region = "jeju";
  else if (s.startsWith("busan-") || s.startsWith("from-busan-")) region = "busan_gyeongju";
  else if (s.includes("incheon")) region = "incheon_seoul";
  else if (s.includes("seoul")) region = s.includes("suwon") ? "suwon" : "seoul";
  else if (s.includes("pocheon")) region = "pocheon";

  const isCruise = s.includes("cruise") || s.includes("shore-excursion");
  const allRV = stops.length > 0 && stops.every((st: any) => (st?._poi_meta?.poi_key ?? "").startsWith("route_variant_"));
  const isCharter =
    (s.includes("private-chartered") || s.includes("private-car-charter")) && allRV;

  return {
    slug,
    product_id: doc.product_id ?? slug,
    locale: doc.locale ?? "en",
    schema_version: doc.schema_version ?? 7,
    matching_profile: mp,
    matching_metadata: mm,
    available_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    primary_themes: (mm.primary_themes ?? []).map(String),
    secondary_themes: (mm.secondary_themes ?? []).map(String),
    best_for: (mm.best_for ?? []).map(String),
    not_recommended_for: (mm.not_recommended_for ?? []).map(String),
    anchor_poi_keys: [...new Set(stops.map((s: any) => s?._poi_meta?.poi_key).filter((k: any) => typeof k === "string" && !k.startsWith("OPS_")))] as string[],
    competing_products: [],
    destination_region: region,
    pickup_region: null,
    duration_hours: null,
    vehicle_type: mp.vehicle_type ?? null,
    enrichment_batch: null,
    kb_version: stops[0]?._poi_meta?.kb_version ?? null,
    profile_version: mm.profile_version ?? mp.profile_version ?? 6,
    a_grade: false,
    is_cruise_excursion: isCruise,
    is_charter_route_options: isCharter,
  };
}

async function main() {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set. Aborting Haiku live test.");
    process.exit(1);
  }

  const slugs = readdirSync(TOURS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "catalog" && d.name !== "route-variants")
    .map((d) => d.name).sort();
  const tourRows: MatchTourRow[] = [];
  for (const slug of slugs) {
    const p = join(TOURS_DIR, slug, `${slug}.en.json`);
    if (!existsSync(p)) continue;
    const doc = JSON.parse(readFileSync(p, "utf8"));
    tourRows.push(buildSimpleRow(slug, doc));
  }
  console.log(`Loaded ${tourRows.length} tours.\n`);

  const queries = [
    "벚꽃 시즌에 가족이랑 제주 동부 1일투어",
    "we have 5 hours from Busan cruise port, need a private car tour",
    "12月に済州島でみかん狩りと雪景色を家族で",
  ];

  let totalCost = 0;
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    console.log(`\n[${i + 1}/${queries.length}] "${q}"`);
    try {
      const parsed = await haikuParse(q);
      const t = parsed._telemetry!;
      const cost = computeHaikuCost(t);
      totalCost += cost;
      const result = matchTours(parsed, tourRows, 3);

      console.log(`  parsed: regions=${JSON.stringify(parsed.regions)}, season_locks=${JSON.stringify(parsed.season_locks)}, personas=${JSON.stringify(parsed.personas)}, wants_cruise=${parsed.wants_cruise}`);
      console.log(`  top-3:  ${result.top_matches.map((m) => `${m.slug}(${m.total_score})`).join(", ")}`);
      console.log(`  parser: input=${t.input_tokens} c_create=${t.cache_create_input_tokens} c_read=${t.cache_read_input_tokens} output=${t.output_tokens}  cost=$${cost.toFixed(6)} elapsed=${t.elapsed_ms}ms`);

      // Top-1 explanation
      const winner = result.top_matches[0];
      if (winner) {
        const winnerRow = tourRows.find((r) => r.slug === winner.slug)!;
        const ex = await explainTopMatch({ query: q, locale: "ko", parsed, winner, winnerRow });
        totalCost += ex.cost_usd;
        const et = ex.telemetry;
        console.log(`  explain: input=${et.input_tokens} c_create=${et.cache_create_input_tokens} c_read=${et.cache_read_input_tokens} output=${et.output_tokens}  cost=$${ex.cost_usd.toFixed(6)} elapsed=${ex.elapsed_ms}ms`);
        console.log(`  explanation: ${ex.explanation}`);
      }
    } catch (e) {
      console.error(`  ERROR: ${(e as Error).message}`);
    }
  }
  console.log(`\nTotal cost across ${queries.length} queries: $${totalCost.toFixed(6)} (≈ ₩${(totalCost * 1400).toFixed(2)})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
