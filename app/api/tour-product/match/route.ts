/**
 * Tour-product matcher API (v1.8 engine, dual-shape response).
 *
 * - Parser: Haiku 4.5 with prompt caching when ANTHROPIC_API_KEY is set,
 *   falls back to deterministic rule parser. (lib/tour-match-v2/parser.ts)
 * - Matcher: hard filter + soft scoring against `match_tours` rows.
 *   (lib/tour-match-v2/matcher.ts)
 * - Response: dual-shape — v2 fields (parsed_query, top_matches, notes) plus
 *   the legacy v1 fields (intent, winner, matchedProducts, ranked, …) so
 *   /match page + HomeV2MatchProvider keep working without changes.
 * - Audit: each call optionally logged to `match_queries` (set
 *   TOUR_MATCH_AUDIT_LOG=1; production-only by convention).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseQuery } from "@/lib/tour-match-v2/parser";
import { matchTours } from "@/lib/tour-match-v2/matcher";
import { fetchMatchTours } from "@/lib/tour-match-v2/fetch-tours";
import { buildV1Response } from "@/lib/tour-match-v2/adapter-v1";
import { computeHaikuCost } from "@/lib/tour-match-v2/cost-calc";
import { explainTopMatch } from "@/lib/tour-match-v2/explainer-haiku";

export const runtime = "nodejs";
export const maxDuration = 60;

function makeSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase env vars missing");
  }
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

function makeServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sk) return null;
  return createClient(url, sk, { auth: { persistSession: false } });
}

/**
 * Hero-card destination value → taxonomy region key. The card UI exposes
 * "jeju" / "seoul" / "busan"; the matching engine uses canonical region keys
 * (busan_gyeongju is the matching-profile key — there's no standalone "busan").
 */
const PINNED_DESTINATION_TO_REGION: Record<string, string> = {
  jeju: "jeju",
  seoul: "seoul",
  busan: "busan_gyeongju",
};

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const locale = typeof body.locale === "string" ? body.locale : "en";
    if (!text || text.length > 8000) {
      return NextResponse.json({ error: "Invalid text" }, { status: 400 });
    }

    // Pinned destination from the home hero card. When present, it takes
    // precedence over any region the parser extracts from the free-text intent.
    const pinnedRaw = typeof body.pinned_destination === "string" ? body.pinned_destination : null;
    const pinnedRegion = pinnedRaw ? PINNED_DESTINATION_TO_REGION[pinnedRaw.toLowerCase()] ?? null : null;

    // 1. Parse (Haiku → rule fallback)
    const parserModeEnv = (process.env.TOUR_MATCH_PARSER_MODE ?? "auto").toLowerCase();
    const parserMode: "haiku" | "rule" | "auto" =
      parserModeEnv === "haiku" || parserModeEnv === "rule" ? parserModeEnv : "auto";

    const tParse0 = Date.now();
    const parsed = await parseQuery(text, parserMode);
    const parseMs = Date.now() - tParse0;

    // Pinned region OVERRIDES parser-extracted regions (hard filter).
    // We replace the array (not union) so the user's card choice always wins,
    // even when the free-text intent mentioned a different city.
    if (pinnedRegion) {
      parsed.regions = [pinnedRegion];
    }

    // 2. Fetch match_tours rows
    const tDb0 = Date.now();
    const supabase = makeSupabaseClient();
    const tourRows = await fetchMatchTours(supabase, "en");
    const dbMs = Date.now() - tDb0;

    // 3. Match
    const tMatch0 = Date.now();
    const v2 = matchTours(parsed, tourRows, 5);
    const matchMs = Date.now() - tMatch0;

    // 4. Top-1 winner natural-language explanation (Haiku 2nd pass).
    //    Skipped when no winner OR ANTHROPIC_API_KEY missing OR explainer disabled.
    let matchExplanation: string | null = null;
    let explainMs = 0;
    let explainCostUsd = 0;
    let explainerTelemetry: Awaited<ReturnType<typeof explainTopMatch>>["telemetry"] | null = null;
    const explainerDisabled = process.env.TOUR_MATCH_EXPLAINER_DISABLED === "1";
    const winnerV2 = v2.top_matches[0];
    if (winnerV2 && !explainerDisabled && process.env.ANTHROPIC_API_KEY) {
      try {
        const winnerRow = tourRows.find((r) => r.slug === winnerV2.slug);
        if (winnerRow) {
          const tExp0 = Date.now();
          const out = await explainTopMatch({
            query: text,
            locale,
            parsed,
            winner: winnerV2,
            winnerRow,
          });
          matchExplanation = out.explanation;
          explainMs = out.elapsed_ms;
          explainCostUsd = out.cost_usd;
          explainerTelemetry = out.telemetry;
          if (!explainMs) explainMs = Date.now() - tExp0;
        }
      } catch (e) {
        console.error("[tour-product/match v1.8] explainer failed:", (e as Error).message);
      }
    }
    // Fallback: when no Haiku explanation, surface the parser notes (legacy behaviour)
    if (!matchExplanation) matchExplanation = parsed.parser_notes ?? null;

    // 5. Adapter — v1 fields for backward-compat consumers
    const v1 = buildV1Response(parsed, v2, matchExplanation, "v1.8");

    const totalMs = Date.now() - t0;

    // 5. Audit log (opt-in)
    if (process.env.TOUR_MATCH_AUDIT_LOG === "1") {
      const sb = makeServiceRoleClient();
      if (sb) {
        const cost = parsed._telemetry ? computeHaikuCost(parsed._telemetry) : 0;
        sb.from("match_queries")
          .insert({
            raw_query: text,
            raw_query_locale: parsed.raw_query_locale,
            parsed_query: parsed,
            top_matches: v2.top_matches,
            matched_tour_count: v2.candidates_passed_hard_filter,
            parser_model: parsed._telemetry?.model ?? "rule",
            parser_input_tokens: parsed._telemetry?.input_tokens ?? 0,
            parser_cache_read_tokens: parsed._telemetry?.cache_read_input_tokens ?? 0,
            parser_cache_create_tokens: parsed._telemetry?.cache_create_input_tokens ?? 0,
            parser_output_tokens: parsed._telemetry?.output_tokens ?? 0,
            parser_cost_usd: cost,
            parse_elapsed_ms: parseMs,
            match_elapsed_ms: matchMs,
            user_session_id: req.cookies.get("atc_session")?.value ?? null,
            user_locale: locale,
          })
          .then(({ error }) => {
            if (error) console.error("[match_queries audit log]", error.message);
          });
      }
    }

    console.info(
      JSON.stringify({
        tag: "[tour-product/match v1.8]",
        outcome: v1.matchOutcome,
        passed: v2.candidates_passed_hard_filter,
        rejected: v2.candidates_rejected_count,
        parser: parsed._telemetry?.model ?? "rule",
        parse_ms: parseMs,
        db_ms: dbMs,
        match_ms: matchMs,
        explain_ms: explainMs,
        explain_cost_usd: explainCostUsd,
        total_ms: totalMs,
      })
    );

    return NextResponse.json({
      // v2 native shape
      parsed_query: parsed,
      candidates_passed_hard_filter: v2.candidates_passed_hard_filter,
      candidates_rejected_count: v2.candidates_rejected_count,
      top_matches: v2.top_matches,
      notes: v2.notes,
      // v1.9 hardening fields (seasonal-gate, signal-strength, score-floor)
      match_status: v2.match_status,
      signal_strength: v2.signal_strength,
      applied_score_floor: v2.applied_score_floor,
      parser_telemetry: parsed._telemetry ?? null,
      explainer_telemetry: explainerTelemetry,
      // v1 backward-compat fields
      ...v1,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Match failed";
    console.error("[tour-product/match v1.8] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
