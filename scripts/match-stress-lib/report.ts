/**
 * Renders a stress run as Markdown + writes a machine-readable JSON snapshot.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AggregateMetrics, ScenarioRun } from "./runner";

const RESULTS_DIR = join(process.cwd(), "scripts", "match-stress-lib", "results");

function ensureDir(): void {
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
}

function pct(x: number): string {
  return (x * 100).toFixed(1) + "%";
}

export function renderConsoleSummary(metrics: AggregateMetrics, runs: ScenarioRun[]): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("─".repeat(70));
  lines.push(` Match Engine Stress Test — ${runs.length} scenarios `);
  lines.push("─".repeat(70));
  lines.push(` Pass rate:                          ${metrics.passed}/${metrics.total}  (${pct(metrics.pass_rate)})`);
  lines.push(` Seasonal leak rate (B+D):           ${pct(metrics.seasonal_leak_rate)}    [target: 0%]`);
  lines.push(` Contradiction leaks (D, hardcoded): ${metrics.contradiction_leak_count}    [target: 0]`);
  lines.push(` Explicit-season top-1 accuracy (C): ${pct(metrics.explicit_season_top1_hit_rate)}    [target: ≥80%]`);
  lines.push(` Latency p50/p95/p99:                ${metrics.latency_p50}/${metrics.latency_p95}/${metrics.latency_p99} ms`);
  lines.push("");
  lines.push(" Category pass rates:");
  for (const [cat, b] of Object.entries(metrics.by_category)) {
    lines.push(`   ${cat.padEnd(28)}  ${b.passed}/${b.total}  (${pct(b.pass_rate)})`);
  }
  lines.push("─".repeat(70));
  return lines.join("\n");
}

export function renderMarkdownReport(metrics: AggregateMetrics, runs: ScenarioRun[]): string {
  const lines: string[] = [];
  lines.push(`# Match Engine Stress Test Report`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`| Metric | Value | Target |`);
  lines.push(`|---|---|---|`);
  lines.push(`| Total scenarios | ${metrics.total} | — |`);
  lines.push(`| Passed | ${metrics.passed} (${pct(metrics.pass_rate)}) | — |`);
  lines.push(`| Failed | ${metrics.failed} | 0 |`);
  lines.push(`| **Seasonal leak rate (B+D)** | **${pct(metrics.seasonal_leak_rate)}** | 0% |`);
  lines.push(`| **Contradiction leaks (D, hardcoded)** | **${metrics.contradiction_leak_count}** | 0 |`);
  lines.push(`| Explicit-season top-1 accuracy (C) | ${pct(metrics.explicit_season_top1_hit_rate)} | ≥80% |`);
  lines.push(`| Latency p50 / p95 / p99 | ${metrics.latency_p50} / ${metrics.latency_p95} / ${metrics.latency_p99} ms | — |`);
  lines.push("");
  lines.push(`## Category breakdown`);
  lines.push("");
  lines.push(`| Category | Pass | Total | Pass rate |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const [cat, b] of Object.entries(metrics.by_category)) {
    lines.push(`| ${cat} | ${b.passed} | ${b.total} | ${pct(b.pass_rate)} |`);
  }
  lines.push("");
  const failed = runs.filter((r) => !r.evaluation.pass);
  if (failed.length) {
    lines.push(`## Failed scenarios (${failed.length})`);
    lines.push("");
    for (const r of failed) {
      lines.push(`### ${r.scenario.id} — ${r.scenario.category}`);
      lines.push("");
      lines.push(`- **Query**: \`${r.scenario.query}\` (locale=${r.scenario.locale})`);
      if (r.scenario.today) lines.push(`- **today**: ${r.scenario.today.year}-${String(r.scenario.today.month).padStart(2, "0")}`);
      lines.push(`- **Rationale**: ${r.scenario.rationale}`);
      lines.push(`- **Response status**: \`${r.response.match_status}\`, signal=\`${r.response.signal_strength}\`, floor=${r.response.applied_score_floor.toFixed(2)}`);
      lines.push(`- **Top matches** (${r.response.top_matches.length}):`);
      for (const m of r.response.top_matches) {
        const themes = m.primary_themes.length ? `themes=[${m.primary_themes.join(",")}]` : "themes=[]";
        lines.push(`  - \`${m.slug}\` score=${m.total_score} ${themes}`);
      }
      lines.push(`- **Failures**:`);
      for (const f of r.evaluation.failures) lines.push(`  - ${f}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function writeArtifacts(metrics: AggregateMetrics, runs: ScenarioRun[]): { reportPath: string; jsonPath: string } {
  ensureDir();
  const md = renderMarkdownReport(metrics, runs);
  const reportPath = join(RESULTS_DIR, "REPORT.md");
  writeFileSync(reportPath, md);

  const jsonPayload = {
    generated_at: new Date().toISOString(),
    metrics,
    runs: runs.map((r) => ({
      id: r.scenario.id,
      category: r.scenario.category,
      query: r.scenario.query,
      locale: r.scenario.locale,
      today: r.scenario.today ?? null,
      pass: r.evaluation.pass,
      failures: r.evaluation.failures,
      seasonal_leak: r.evaluation.seasonal_leak,
      response: {
        match_status: r.response.match_status,
        signal_strength: r.response.signal_strength,
        applied_score_floor: r.response.applied_score_floor,
        candidates_passed_hard_filter: r.response.candidates_passed_hard_filter,
        candidates_rejected_count: r.response.candidates_rejected_count,
        notes: r.response.notes,
        top_matches: r.response.top_matches.map((m) => ({
          slug: m.slug,
          total_score: m.total_score,
          primary_themes: m.primary_themes,
          available_months: m.available_months,
          is_seasonal_product: m.is_seasonal_product,
        })),
      },
      elapsed_ms: r.elapsed_ms,
    })),
  };
  const jsonPath = join(RESULTS_DIR, "latest.json");
  writeFileSync(jsonPath, JSON.stringify(jsonPayload, null, 2));
  return { reportPath, jsonPath };
}
