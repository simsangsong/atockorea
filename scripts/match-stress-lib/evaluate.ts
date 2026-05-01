/**
 * Evaluates a single scenario's expectations against a live MatchResponseV2.
 *
 * Returns an array of failure reasons (empty = pass).
 */

import { SEASON_SLUG_HINTS, SEASON_TAGS } from "@/lib/tour-match-v2/data/scenarios/SEASON_TAGS";
import type { Scenario } from "@/lib/tour-match-v2/data/scenarios/types";
import type { MatchResponseV2 } from "@/lib/tour-match-v2/types";

export type EvaluationResult = {
  scenario_id: string;
  pass: boolean;
  failures: string[];
  /** True when any seasonal tag/slug leaked into top_matches. */
  seasonal_leak: boolean;
};

export function evaluateScenario(
  scenario: Scenario,
  response: MatchResponseV2,
): EvaluationResult {
  const failures: string[] = [];
  const exp = scenario.expectations;
  const top = response.top_matches;

  // must_not_include_tags
  if (exp.must_not_include_tags?.length) {
    for (const m of top) {
      const tags = [...m.primary_themes];
      for (const tag of tags) {
        if (exp.must_not_include_tags.includes(tag)) {
          failures.push(`tag '${tag}' leaked in slug='${m.slug}'`);
        }
      }
    }
  }

  // must_not_include_slugs
  if (exp.must_not_include_slugs?.length) {
    for (const m of top) {
      for (const s of exp.must_not_include_slugs) {
        if (m.slug === s || m.slug.startsWith(s)) {
          failures.push(`forbidden slug '${m.slug}'`);
        }
      }
    }
  }

  // must_include_one_of_tags
  if (exp.must_include_one_of_tags?.length) {
    const allTags = new Set(top.flatMap((m) => m.primary_themes));
    const hit = exp.must_include_one_of_tags.some((t) => allTags.has(t));
    if (!hit) {
      failures.push(
        `none of ${JSON.stringify(exp.must_include_one_of_tags)} found in top primary_themes (got ${JSON.stringify([...allTags])})`,
      );
    }
  }

  // must_include_one_of_slugs
  if (exp.must_include_one_of_slugs?.length) {
    const slugs = new Set(top.map((m) => m.slug));
    const hit = exp.must_include_one_of_slugs.some((s) => slugs.has(s));
    if (!hit) {
      failures.push(
        `none of ${JSON.stringify(exp.must_include_one_of_slugs)} found in top slugs (got ${JSON.stringify([...slugs])})`,
      );
    }
  }

  if (typeof exp.min_results === "number" && top.length < exp.min_results) {
    failures.push(`min_results=${exp.min_results} but got ${top.length}`);
  }
  if (typeof exp.max_results === "number" && top.length > exp.max_results) {
    failures.push(`max_results=${exp.max_results} but got ${top.length}`);
  }

  if (exp.response_status && response.match_status !== exp.response_status) {
    failures.push(
      `response_status=${response.match_status} ≠ expected ${exp.response_status}`,
    );
  }

  if (exp.notes_must_contain?.length) {
    const haystack = (response.notes ?? []).join(" ");
    for (const needle of exp.notes_must_contain) {
      if (!haystack.includes(needle)) {
        failures.push(`notes missing required substring '${needle}'`);
      }
    }
  }

  if (exp.top1_predicate) {
    const reason = exp.top1_predicate(top[0], top);
    if (reason) failures.push(`top1_predicate: ${reason}`);
  }

  return {
    scenario_id: scenario.id,
    pass: failures.length === 0,
    failures,
    seasonal_leak: detectSeasonalLeak(top),
  };
}

function detectSeasonalLeak(top: MatchResponseV2["top_matches"]): boolean {
  for (const m of top) {
    for (const t of m.primary_themes) {
      if (SEASON_TAGS.includes(t)) return true;
    }
    const slug = m.slug.toLowerCase();
    for (const hint of SEASON_SLUG_HINTS) {
      if (slug.includes(hint)) return true;
    }
  }
  return false;
}
