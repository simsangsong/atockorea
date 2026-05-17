/**
 * Look up a precedent price from `quote_memory` for out-of-scope requests.
 *
 * Strategy:
 *   1. Exact fingerprint match in the last 365 days — median of up to 5
 *      most recent rows. Confidence = "exact".
 *   2. Fallback: same region + track in the last 180 days — mean of up to
 *      10 most recent rows. Confidence = "loose".
 *   3. No precedent → null.
 *
 * Ops Slack message should always show the precedent confidence + sample
 * size so they don't auto-apply a stale or single-sample number (R9).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PrecedentMatch } from "./types";

export async function lookupPrecedent(
  supabase: SupabaseClient,
  fingerprint: string,
  region: string,
  track: string
): Promise<PrecedentMatch | null> {
  // 1) Exact fingerprint
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  const { data: exact, error: exactErr } = await supabase
    .from("quote_memory")
    .select("id, manual_amount_krw, created_at")
    .eq("condition_fingerprint", fingerprint)
    .gte("created_at", oneYearAgo)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!exactErr && exact && exact.length > 0) {
    const amounts = exact.map((r) => Number(r.manual_amount_krw)).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    return {
      amount_krw: median,
      confidence: "exact",
      sample_size: amounts.length,
      precedent_id: exact[0].id as string,
    };
  }

  // 2) Loose: region + track in last 180 days
  const halfYearAgo = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString();
  const { data: loose, error: looseErr } = await supabase
    .from("quote_memory")
    .select("id, manual_amount_krw, created_at")
    .eq("region", region)
    .eq("track", track)
    .gte("created_at", halfYearAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!looseErr && loose && loose.length > 0) {
    const amounts = loose.map((r) => Number(r.manual_amount_krw));
    const mean = Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length);
    return {
      amount_krw: mean,
      confidence: "loose",
      sample_size: amounts.length,
      precedent_id: loose[0].id as string,
    };
  }

  return null;
}
