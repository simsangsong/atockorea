/**
 * Runs the full stress-test corpus and produces aggregate metrics + per-scenario results.
 */

import { ALL_SCENARIOS } from "@/lib/tour-match-v2/data/scenarios";
import type { Scenario, ScenarioCategory } from "@/lib/tour-match-v2/data/scenarios/types";
import { matchTours } from "@/lib/tour-match-v2/matcher";
import { ruleParse } from "@/lib/tour-match-v2/parser-rule";
import { haikuParse } from "@/lib/tour-match-v2/parser-haiku";
import type { MatchResponseV2, ParsedQueryV2 } from "@/lib/tour-match-v2/types";
import { evaluateScenario, type EvaluationResult } from "./evaluate";
import { loadAllTours } from "./load-tours";
import { readParseCache, writeParseCache } from "./parse-cache";

export type ParserMode = "rule" | "haiku";

export type ScenarioRun = {
  scenario: Scenario;
  parsed: ParsedQueryV2;
  response: MatchResponseV2;
  evaluation: EvaluationResult;
  elapsed_ms: number;
};

export type StressOptions = {
  parser: ParserMode;
  categories?: ScenarioCategory[];
  onlyIds?: string[];
  topK?: number;
  /** Pin this date for ALL scenarios that don't override `today`. */
  defaultToday?: { year: number; month: number };
  /** Skip scenarios that already passed in the previous snapshot — for `--only-failed`. */
  onlyFailed?: { failedIds: Set<string> };
  /** Force re-parse even when cache hit (Haiku mode only). */
  refreshParse?: boolean;
};

export async function runStress(opts: StressOptions): Promise<ScenarioRun[]> {
  const tours = await loadAllTours("en");

  let scenarios: Scenario[] = ALL_SCENARIOS;
  if (opts.categories?.length) {
    const set = new Set(opts.categories);
    scenarios = scenarios.filter((s) => set.has(s.category));
  }
  if (opts.onlyIds?.length) {
    const set = new Set(opts.onlyIds);
    scenarios = scenarios.filter((s) => set.has(s.id));
  }
  if (opts.onlyFailed) {
    scenarios = scenarios.filter((s) => opts.onlyFailed!.failedIds.has(s.id));
  }

  const runs: ScenarioRun[] = [];
  for (const scenario of scenarios) {
    const t0 = Date.now();
    let parsed: ParsedQueryV2;
    if (opts.parser === "haiku") {
      const cached = !opts.refreshParse ? readParseCache(scenario.query) : null;
      if (cached) {
        parsed = cached;
      } else {
        try {
          parsed = await haikuParse(scenario.query);
          writeParseCache(scenario.query, parsed);
        } catch (err) {
          // Fall back to rule parser when Haiku is unavailable so the run still completes.
          parsed = ruleParse(scenario.query);
          parsed.parser_notes =
            (parsed.parser_notes ?? "") +
            ` [haiku-fallback: ${(err as Error).message}]`;
        }
      }
    } else {
      parsed = ruleParse(scenario.query);
    }

    const today =
      scenario.today ??
      opts.defaultToday ?? {
        year: new Date().getUTCFullYear(),
        month: new Date().getUTCMonth() + 1,
      };

    const response = matchTours(parsed, tours, opts.topK ?? 5, false, today);
    const evaluation = evaluateScenario(scenario, response);
    const elapsed_ms = Date.now() - t0;

    runs.push({ scenario, parsed, response, evaluation, elapsed_ms });
  }
  return runs;
}

export type AggregateMetrics = {
  total: number;
  passed: number;
  failed: number;
  pass_rate: number;
  by_category: Record<ScenarioCategory, { total: number; passed: number; pass_rate: number }>;
  /** B+D categories: ratio of runs where seasonal_leak=true. Goal 0%. */
  seasonal_leak_rate: number;
  /** D category: how many runs had a seasonal tag in top results. Goal 0 (hardcoded). */
  contradiction_leak_count: number;
  /** C category: how many top-1 matched the expected tag. */
  explicit_season_top1_hit_rate: number;
  latency_p50: number;
  latency_p95: number;
  latency_p99: number;
};

export function aggregate(runs: ScenarioRun[]): AggregateMetrics {
  const total = runs.length;
  const passed = runs.filter((r) => r.evaluation.pass).length;
  const failed = total - passed;

  const byCat: Record<string, { total: number; passed: number; pass_rate: number }> = {};
  for (const r of runs) {
    const c = r.scenario.category;
    if (!byCat[c]) byCat[c] = { total: 0, passed: 0, pass_rate: 0 };
    byCat[c].total += 1;
    if (r.evaluation.pass) byCat[c].passed += 1;
  }
  for (const c of Object.keys(byCat)) {
    byCat[c].pass_rate = byCat[c].total ? byCat[c].passed / byCat[c].total : 0;
  }

  const leakSubset = runs.filter(
    (r) => r.scenario.category === "season_leak" || r.scenario.category === "season_explicit_mismatch",
  );
  const seasonalLeakCount = leakSubset.filter((r) => r.evaluation.seasonal_leak).length;
  const seasonal_leak_rate = leakSubset.length ? seasonalLeakCount / leakSubset.length : 0;

  const contradictionRuns = runs.filter((r) => r.scenario.category === "season_explicit_mismatch");
  const contradiction_leak_count = contradictionRuns.filter((r) => r.evaluation.seasonal_leak).length;

  const explicitMatch = runs.filter((r) => r.scenario.category === "season_explicit_match");
  const top1HitC = explicitMatch.filter((r) => r.evaluation.pass).length;
  const explicit_season_top1_hit_rate = explicitMatch.length ? top1HitC / explicitMatch.length : 0;

  const lat = runs.map((r) => r.elapsed_ms).sort((a, b) => a - b);
  const p = (q: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * q))] : 0);

  return {
    total,
    passed,
    failed,
    pass_rate: total ? passed / total : 0,
    by_category: byCat as AggregateMetrics["by_category"],
    seasonal_leak_rate,
    contradiction_leak_count,
    explicit_season_top1_hit_rate,
    latency_p50: p(0.5),
    latency_p95: p(0.95),
    latency_p99: p(0.99),
  };
}
