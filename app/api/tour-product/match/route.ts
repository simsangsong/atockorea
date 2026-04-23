import { NextRequest, NextResponse } from "next/server";
import { getStaticTourProductBySlug } from "@/components/product-tour-static/catalog/staticTourProductRegistry";
import { mergeDeterministicIntentBoost } from "@/lib/tour-product-match/deterministic-boost";
import { loadMatchingProfilesForMatch } from "@/lib/tour-product-match/fetch-matching-profiles";
import { generateMatchExplanationWithGemini } from "@/lib/tour-product-match/gemini-match-explanation";
import { parseTravelerIntentWithGemini } from "@/lib/tour-product-match/gemini-parse-intent";
import { computeTourMatchOutcomeMeta, snapshotFromProductTypeIntent } from "@/lib/tour-product-match/match-outcome";
import { emptyTravelerIntent } from "@/lib/tour-product-match/normalize-intent";
import { capMatchedProductsForApi, capRankedForApi } from "@/lib/tour-product-match/scored-product-api";
import {
  parseProductTypeIntent,
  resolveProductTypeIntent,
  scoreIntentAgainstProfiles,
} from "@/lib/tour-product-match/score-tour-products";
import type { ScoredProduct, TourMatchApiResponse } from "@/lib/tour-product-match/types";
import { getMatchWeightsFromEnv } from "@/lib/tour-product-match/weights";

function topChannelDebugRows(valid: ScoredProduct[], ranked: ScoredProduct[], n = 3): unknown[] {
  const pool = valid.length > 0 ? valid : ranked;
  return pool.slice(0, n).map((r) => ({
    product_id: r.product_id,
    excluded: r.excluded,
    excludeReason: r.excludeReason,
    score: r.score,
    breakdown: r.breakdown,
  }));
}

function logTourMatchSummary(payload: {
  matchOutcome: string;
  noMatchReason: string | null;
  validCount: number;
  resolvedProductTypeIntent: ReturnType<typeof snapshotFromProductTypeIntent>;
  textParserProductTypeIntent: ReturnType<typeof snapshotFromProductTypeIntent>;
  gemini_ms: number;
  db_ms: number;
  scoring_ms: number;
  explanation_ms: number;
  total_ms: number;
}): void {
  console.info(
    JSON.stringify({
      tag: "[tour-product/match]",
      outcome: payload.matchOutcome,
      noMatchReason: payload.noMatchReason,
      validCount: payload.validCount,
      resolved: payload.resolvedProductTypeIntent,
      parserOnly: payload.textParserProductTypeIntent,
      gemini_ms: payload.gemini_ms,
      db_ms: payload.db_ms,
      scoring_ms: payload.scoring_ms,
      explanation_ms: payload.explanation_ms,
      total_ms: payload.total_ms,
    }),
  );
}

function logTourMatchTraceVerbose(payload: {
  rawText: string;
  intentGeminiProductType: { desired: string | null; strength: string | null };
  intentAfterBoostProductType: { desired: string | null; strength: string | null };
  textParserProductTypeIntent: ReturnType<typeof snapshotFromProductTypeIntent>;
  resolvedProductTypeIntent: ReturnType<typeof snapshotFromProductTypeIntent>;
  topChannelRows: unknown[];
}): void {
  console.info(
    JSON.stringify({
      tag: "[tour-product/match] trace",
      rawText: payload.rawText,
      geminiStructuredProductType: payload.intentGeminiProductType,
      normalizedAfterBoostProductType: payload.intentAfterBoostProductType,
      textParserProductTypeIntent: payload.textParserProductTypeIntent,
      resolvedProductTypeIntent: payload.resolvedProductTypeIntent,
      topChannelRows: payload.topChannelRows,
    }),
  );
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const locale = typeof body.locale === "string" ? body.locale : "en";
    if (!text || text.length > 8000) {
      return NextResponse.json({ error: "Invalid text" }, { status: 400 });
    }

    let intentGemini = emptyTravelerIntent();
    const tGemini0 = Date.now();
    let geminiMs = 0;
    try {
      intentGemini = await parseTravelerIntentWithGemini({ rawText: text, locale });
    } catch (e) {
      console.error("[tour-product/match] Gemini intent failed; using deterministic-only intent", e);
      intentGemini = emptyTravelerIntent();
    }
    geminiMs = Date.now() - tGemini0;

    const intent = mergeDeterministicIntentBoost(text, intentGemini);

    const textParserPti = parseProductTypeIntent(text);
    const resolvedPti = resolveProductTypeIntent(intent, text);
    const textParserProductTypeIntent = snapshotFromProductTypeIntent(textParserPti);
    const resolvedProductTypeIntent = snapshotFromProductTypeIntent(resolvedPti);

    const tDb0 = Date.now();
    const { rows, source } = await loadMatchingProfilesForMatch();
    const dbMs = Date.now() - tDb0;

    const weights = getMatchWeightsFromEnv();
    const weightSet = (process.env.TOUR_MATCH_WEIGHT_SET ?? "default").trim();

    const tScore0 = Date.now();
    const ranked = scoreIntentAgainstProfiles(text, intent, rows, weights);
    const scoringMs = Date.now() - tScore0;

    const matchedProducts = ranked.filter((r) => !r.excluded);
    const { matchOutcome, noMatchReason, fallbackAvailable } = computeTourMatchOutcomeMeta(ranked, matchedProducts);
    const winner = matchedProducts[0] ?? null;

    const traceEnabled = process.env.TOUR_MATCH_TRACE_LOG === "1";
    if (traceEnabled) {
      logTourMatchTraceVerbose({
        rawText: text,
        intentGeminiProductType: {
          desired: intentGemini.desired_product_type,
          strength: intentGemini.product_type_intent_strength,
        },
        intentAfterBoostProductType: {
          desired: intent.desired_product_type,
          strength: intent.product_type_intent_strength,
        },
        textParserProductTypeIntent,
        resolvedProductTypeIntent,
        topChannelRows: topChannelDebugRows(matchedProducts, ranked),
      });
    }

    const winnerProfile = winner ? rows.find((r) => r.product_id === winner.product_id) : undefined;
    const staticProduct = winner ? getStaticTourProductBySlug(winner.product_id) : undefined;
    const winnerTitle = staticProduct?.title ?? winner?.product_id ?? "";

    let matchExplanation: string | null = null;
    let explanationMs = 0;
    if (winner && winnerProfile) {
      const tExp0 = Date.now();
      try {
        matchExplanation = await generateMatchExplanationWithGemini({
          rawText: text,
          locale,
          intent,
          winnerProductId: winner.product_id,
          winnerTitle,
          profile: winnerProfile,
        });
      } catch (e) {
        console.error("[tour-product/match] explanation generation failed", e);
        matchExplanation = intent.summary_one_line?.trim() ?? null;
      }
      explanationMs = Date.now() - tExp0;
    }

    const totalMs = Date.now() - t0;

    logTourMatchSummary({
      matchOutcome,
      noMatchReason,
      validCount: matchedProducts.length,
      resolvedProductTypeIntent,
      textParserProductTypeIntent,
      gemini_ms: geminiMs,
      db_ms: dbMs,
      scoring_ms: scoringMs,
      explanation_ms: explanationMs,
      total_ms: totalMs,
    });

    const payload: TourMatchApiResponse = {
      intent,
      winner: winner ? capMatchedProductsForApi([winner])[0] ?? null : null,
      matchedProducts: capMatchedProductsForApi(matchedProducts),
      ranked: capRankedForApi(ranked),
      matchOutcome,
      noMatchReason,
      resolvedProductTypeIntent,
      textParserProductTypeIntent,
      fallbackAvailable,
      profileSource: source,
      weightSet,
      matchExplanation,
    };

    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Match failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
