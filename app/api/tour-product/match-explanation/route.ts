/**
 * Background explainer endpoint — second Haiku pass split out so /match
 * itself returns in 1–2s without the explainer's 1.5–3s tail.
 *
 * Contract:
 *   POST { query, locale, parsed_query, winner_slug }
 *     → { explanation: string }
 *
 * The client (HomeV2MatchProvider / /match page) fires this in the
 * background after receiving the match result, then merges the
 * explanation into its state when it arrives.
 *
 * Trust model: we re-fetch `match_tours` to get the winnerRow rather than
 * accepting it from the client. This means the client can't trick the
 * explainer into describing a fake tour.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchMatchTours } from "@/lib/tour-match-v2/fetch-tours";
import { explainTopMatch } from "@/lib/tour-match-v2/explainer-haiku";
import type { ParsedQueryV2, ScoredMatchV2 } from "@/lib/tour-match-v2/types";

export const runtime = "nodejs";
export const maxDuration = 30;

function makeSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase env vars missing");
  }
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const body = await req.json();
    const text = typeof body.query === "string" ? body.query.trim() : "";
    const locale = typeof body.locale === "string" ? body.locale : "en";
    const winnerSlug =
      typeof body.winner_slug === "string" ? body.winner_slug : null;
    const parsed = body.parsed_query as ParsedQueryV2 | undefined;

    if (!text || !winnerSlug || !parsed || typeof parsed !== "object") {
      return NextResponse.json(
        { error: "Missing required fields: query, winner_slug, parsed_query" },
        { status: 400 },
      );
    }

    if (process.env.TOUR_MATCH_EXPLAINER_DISABLED === "1") {
      return NextResponse.json({ explanation: null }, { status: 200 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ explanation: null }, { status: 200 });
    }

    const supabase = makeSupabaseClient();
    const tourRows = await fetchMatchTours(supabase, "en");
    const winnerRow = tourRows.find((r) => r.slug === winnerSlug);
    if (!winnerRow) {
      return NextResponse.json(
        { error: "Winner slug not found in match_tours" },
        { status: 404 },
      );
    }

    // Reconstruct the minimal ScoredMatchV2 the explainer needs. The full
    // breakdown isn't required — explainer reads slug/title/region/themes,
    // mostly from winnerRow, plus parsed_query.
    const minimalWinner: ScoredMatchV2 = {
      slug: winnerRow.slug,
      destination_region: winnerRow.destination_region,
      enrichment_batch: winnerRow.enrichment_batch,
      a_grade: winnerRow.a_grade,
      available_months: winnerRow.available_months,
      primary_themes: winnerRow.primary_themes,
      best_for: winnerRow.best_for,
      anchor_poi_keys: winnerRow.anchor_poi_keys,
      matching_profile_size: Object.keys(winnerRow.matching_profile).length,
      is_seasonal_product: false,
      total_score: 0,
      score_components: {},
      match_reasons: [],
    };

    const out = await explainTopMatch({
      query: text,
      locale,
      parsed,
      winner: minimalWinner,
      winnerRow,
    });

    const totalMs = Date.now() - t0;
    console.info(
      JSON.stringify({
        tag: "[tour-product/match-explanation]",
        winner_slug: winnerSlug,
        explain_ms: out.elapsed_ms,
        total_ms: totalMs,
      }),
    );

    return NextResponse.json({ explanation: out.explanation });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Explainer failed";
    console.error("[tour-product/match-explanation] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
