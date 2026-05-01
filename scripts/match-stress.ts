/**
 * Stress-test runner CLI.
 *
 *   npm run match:stress                 # all 100 scenarios, rule parser
 *   npm run match:stress:haiku           # all 100 with Haiku parser (cached)
 *   npm run match:stress:failed          # rerun only scenarios that failed last run
 *   npm run match:stress -- --category=B,D
 *   npm run match:stress -- --only=S016,S031
 *   npm run match:stress -- --top-k=3 --refresh-parse
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aggregate,
  runStress,
  type ParserMode,
  type StressOptions,
} from "./match-stress-lib/runner";
import { renderConsoleSummary, writeArtifacts } from "./match-stress-lib/report";
import type { ScenarioCategory } from "@/lib/tour-match-v2/data/scenarios/types";

const CATEGORY_KEY: Record<string, ScenarioCategory> = {
  A: "empty_weak",
  B: "season_leak",
  C: "season_explicit_match",
  D: "season_explicit_mismatch",
  E: "season_keyword_only",
  F: "region_general",
  G: "persona_focus",
  H: "conflicting",
  I: "multilingual",
  J: "long_form",
  K: "adversarial",
};

function parseArg(name: string, fallback?: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === `--${name}`) return argv[i + 1] ?? fallback;
    if (a.startsWith(`--${name}=`)) return a.slice(name.length + 3);
  }
  return fallback;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseCategories(raw: string | undefined): ScenarioCategory[] | undefined {
  if (!raw) return undefined;
  const out: ScenarioCategory[] = [];
  for (const tok of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const upper = tok.toUpperCase();
    if (CATEGORY_KEY[upper]) {
      out.push(CATEGORY_KEY[upper]);
    } else if (Object.values(CATEGORY_KEY).includes(tok as ScenarioCategory)) {
      out.push(tok as ScenarioCategory);
    } else {
      throw new Error(`Unknown category '${tok}' (expected A-K or category key like 'season_leak')`);
    }
  }
  return out.length ? out : undefined;
}

async function main() {
  const parser = (parseArg("parser", "rule") as ParserMode) ?? "rule";
  if (parser !== "rule" && parser !== "haiku") {
    throw new Error(`--parser must be 'rule' or 'haiku', got '${parser}'`);
  }
  const categories = parseCategories(parseArg("category"));
  const onlyIds = parseArg("only")?.split(",").map((s) => s.trim()).filter(Boolean);
  const topK = parseArg("top-k") ? parseInt(parseArg("top-k")!, 10) : undefined;
  const refreshParse = hasFlag("refresh-parse");
  const onlyFailed = hasFlag("only-failed");

  let onlyFailedSet: StressOptions["onlyFailed"];
  if (onlyFailed) {
    const latest = join(process.cwd(), "scripts", "match-stress-lib", "results", "latest.json");
    if (!existsSync(latest)) {
      throw new Error("--only-failed requires a previous run; latest.json not found");
    }
    const raw = JSON.parse(readFileSync(latest, "utf8")) as {
      runs: Array<{ id: string; pass: boolean }>;
    };
    onlyFailedSet = {
      failedIds: new Set(raw.runs.filter((r) => !r.pass).map((r) => r.id)),
    };
  }

  console.log(
    `[match-stress] parser=${parser}` +
      (categories ? ` categories=${categories.join(",")}` : "") +
      (onlyIds ? ` only=${onlyIds.join(",")}` : "") +
      (topK ? ` top-k=${topK}` : "") +
      (refreshParse ? ` refresh-parse` : "") +
      (onlyFailed ? ` only-failed` : ""),
  );

  const t0 = Date.now();
  const runs = await runStress({
    parser,
    categories,
    onlyIds,
    topK,
    refreshParse,
    onlyFailed: onlyFailedSet,
  });
  const totalMs = Date.now() - t0;

  const metrics = aggregate(runs);
  const { reportPath, jsonPath } = writeArtifacts(metrics, runs);

  console.log(renderConsoleSummary(metrics, runs));
  console.log(`\n  REPORT.md   → ${reportPath}`);
  console.log(`  latest.json → ${jsonPath}`);
  console.log(`  Total elapsed: ${totalMs}ms\n`);

  // Exit code: non-zero on any seasonal_leak (so CI / local quickly notices regression).
  if (metrics.seasonal_leak_rate > 0 || metrics.contradiction_leak_count > 0) {
    process.exitCode = 2;
  } else if (metrics.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[match-stress] fatal:", err);
  process.exit(99);
});
