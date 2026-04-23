import type {
  HardConstraintsJson,
  MatchWeightsV1,
  ScoredProduct,
  TourMatchingProfileRow,
  TravelerIntentV1,
} from "@/lib/tour-product-match/types";

/** Channel mix for soft score (after hard filters). indoor_ratio is NOT mixed into fitScore. */
export const TOUR_MATCH_CHANNEL_WEIGHTS = {
  typeScore: 0.2,
  fitScore: 0.55,
  indoorWeatherScore: 0.15,
  keywordBoost: 0.1,
} as const;

/** 1–5 profile dimensions used in fitScore only (excludes indoor_ratio; weather_sensitivity uses indoor/weather channel). */
export const FIT_DIMENSION_KEYS = [
  "pace_level",
  "walking_level",
  "scenic_level",
  "photo_level",
  "culture_level",
  "relax_level",
  "first_time_fit",
  "family_fit",
  "senior_fit",
  "couple_fit",
  "active_traveler_fit",
  "one_day_fit",
  "same_day_flight_fit",
  "rain_fit",
  "value_for_money_fit",
  "iconic_landmark_fit",
  "cafe_fit",
  "adult_family_fit",
  "young_kids_fit",
  "senior_active_fit",
  "senior_general_fit",
  "mobility_friendly_fit",
  "stroller_fit",
  "local_culture_fit",
  "shopping_fit",
  "storytelling_fit",
  "comfort_level",
  "budget_fit",
  "premium_fit",
  "small_group_fit",
  "private_fit",
  "bus_fit",
] as const;

export type FitDimensionKey = (typeof FIT_DIMENSION_KEYS)[number];

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** Normalize 1–5 fit dimensions to 0–1. Never use for indoor_ratio. */
export function norm1to5(value: number): number {
  return clamp((value - 1) / 4);
}

/** Normalize 0–100 indoor_ratio to 0–1. Kept separate from 1–5 axes. */
export function normIndoorRatioPercent(value: number): number {
  return clamp(value / 100);
}

function stringArray(u: unknown): string[] {
  if (!Array.isArray(u)) return [];
  return u.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

/** Parsed from user text until Gemini exposes structured product-type intent. */
export type ProductTypeIntent = {
  desired: "small_group" | "private" | "bus" | null;
  /** `hard` → row excluded if `profile.product_type !== desired`; `soft` → typeGate 0.15 on mismatch. */
  strength: "soft" | "hard" | null;
};

/**
 * Expanded phrases: private / bus / small-group / shared tour / no shared / etc.
 * Order: hard private → hard bus → explicit small-group → soft private → weak hints.
 */
export function parseProductTypeIntent(rawText: string): ProductTypeIntent {
  const t = rawText.trim();

  if (
    /\b(only\s+private|private\s+only|must\s+be\s+private|exclusively\s+private|no\s+shared(\s+tour)?|not\s+a\s+shared(\s+tour)?|don'?t\s+want\s+(a\s+)?shared|don'?t\s+want\s+to\s+join(\s+strangers)?|no\s+strangers|our\s+own\s+(van|vehicle)\s+only|we\s+do\s+not\s+want\s+shared)\b/i.test(
      t,
    )
  ) {
    return { desired: "private", strength: "hard" };
  }

  if (/\b(only\s+bus|must\s+be\s+(a\s+)?bus|coach\s+only|large\s+bus\s+only)\b/i.test(t)) {
    return { desired: "bus", strength: "hard" };
  }

  if (
    /\b(small[\s-]?group|join\s+(a\s+)?(group\s+)?tour|shared\s+(day\s+)?tour|group\s+day\s+tour|day\s+tour\s+with\s+others)\b/i.test(
      t,
    ) ||
    /\b(not\s+private|don'?t\s+need\s+private|no\s+need\s+for\s+private)\b/i.test(t)
  ) {
    return { desired: "small_group", strength: "soft" };
  }

  if (/\b(prefer\s+private|ideally\s+private|private\s+would|rather\s+(have\s+)?private)\b/i.test(t)) {
    return { desired: "private", strength: "soft" };
  }

  if (
    /\b(private\s+tour|private\s+van|own\s+vehicle|our\s+own\s+van|just\s+us|only\s+our\s+group)\b/i.test(t)
  ) {
    return { desired: "private", strength: "soft" };
  }

  if (/\b(coach\s+tour|bus\s+tour|large\s+bus|bus\s+group)\b/i.test(t)) {
    return { desired: "bus", strength: "soft" };
  }

  return { desired: null, strength: null };
}

/**
 * Prefer structured Gemini fields on `intent`; otherwise parse `rawText`.
 * If `desired_product_type` is set and strength is omitted, treat as soft.
 */
export function resolveProductTypeIntent(intent: TravelerIntentV1, rawText: string): ProductTypeIntent {
  if (intent.desired_product_type != null) {
    return {
      desired: intent.desired_product_type,
      strength: intent.product_type_intent_strength ?? "soft",
    };
  }
  return parseProductTypeIntent(rawText);
}

function wantsStrictIndoor(rawText: string): boolean {
  return /\b(mostly indoor|indoor[- ]only|strictly indoor|only indoor|avoid outdoor|minimal outdoor)\b/i.test(
    rawText,
  );
}

/**
 * English phrasings that signal a strict step-free / stair-free request.
 * Kept intentionally strict so accidental mentions ("stairs at Seongsan are
 * the highlight") don't trigger the hard filter.
 */
const STEP_FREE_EN_REGEX =
  /\b(?:strict(?:ly)?\s+no\s+stairs?|no\s+stairs?\s+(?:at\s+all|please|required|allowed)|step[-\s]?free|wheelchair[-\s]?(?:only|accessible|bound|user)|can(?:'|no)t\s+(?:do|use|take|climb|manage|handle)\s+stairs?|avoid(?:\s+(?:all|any))?\s+stairs?|no\s+steps\s+(?:at\s+all|please|required)|barrier[-\s]?free|sin\s+escalones|sin\s+escaleras|silla\s+de\s+ruedas|accesible\s+para\s+silla\s+de\s+ruedas)\b/i;

/**
 * CJK / Korean phrasings. These scripts don't interact well with `\b` so the
 * match is anchored on the characteristic phrase itself.
 */
const STEP_FREE_CJK_REGEX =
  /(계단\s*(?:없는|없이|없어야|절대\s*안|불가|금지)|휠체어\s*(?:전용|접근|필수|가능)|段差(?:\s*(?:なし|ない|無い))|階段\s*(?:なし|不可|無理|なしで)|車椅子\s*(?:可|のみ|専用)|轮椅\s*(?:通行|专用|必需)|无障碍|无(?:台阶|阶梯|楼梯)\s*(?:路线|要求)?|輪椅\s*(?:通行|專用|必需)|無障礙|無(?:台階|階梯|樓梯)\s*(?:路線|要求)?)/i;

/**
 * Traveler explicitly requires a step-free / stair-free experience.
 *
 * TODO: when Gemini exposes a structured `no_stairs_request` boolean on
 * `TravelerIntentV1`, honor it here in addition to the regex.
 */
function wantsStepFreeAccess(_intent: TravelerIntentV1, rawText: string): boolean {
  return STEP_FREE_EN_REGEX.test(rawText) || STEP_FREE_CJK_REGEX.test(rawText);
}

/**
 * A profile opts-in as step-free by tagging itself explicitly. No current
 * catalog SKU is step-free, so this helper will return `false` for every
 * seeded profile and `wantsStepFreeAccess` effectively hard-excludes the
 * entire catalog. When a future product becomes truly step-free, add
 * `"step_free"` to its `theme_tags` to opt back in.
 */
function profileIsStepFree(profile: TourMatchingProfileRow): boolean {
  const themeTags = stringArray(profile.theme_tags);
  return themeTags.includes("step_free");
}

export function shouldHardExclude(
  intent: TravelerIntentV1,
  profile: TourMatchingProfileRow,
  rawText: string,
): string | null {
  const pti = resolveProductTypeIntent(intent, rawText);
  if (pti.strength === "hard" && pti.desired && profile.product_type !== pti.desired) {
    return pti.desired === "private" ? "product_type_private_only" : "product_type_mismatch";
  }

  const hc = profile.hard_constraints as HardConstraintsJson;
  const avoid = hc.avoidIf ?? [];
  const notIdeal = hc.notIdealFor ?? [];

  const pace = intent.pace_preference ?? 3;
  if (avoid.includes("needs_slow_pace") && pace <= 2) {
    return "needs_slow_pace";
  }

  if (intent.toddlers === true && notIdeal.includes("toddlers")) {
    return "toddlers";
  }
  if (intent.stroller_heavy === true && notIdeal.some((x) => x.includes("stroller"))) {
    return "stroller";
  }
  if (intent.mobility === "low" && notIdeal.includes("very_low_mobility")) {
    return "very_low_mobility";
  }

  if (
    (avoid.includes("tight_same_day_departure") || avoid.includes("strict_same_day_flight_schedule")) &&
    intent.same_day_flight === true
  ) {
    return "tight_same_day_departure";
  }
  if (avoid.includes("monday_departure_required") && /\bmonday\b/i.test(rawText)) {
    return "monday_departure_required";
  }

  if (avoid.includes("strictly_indoor_preference") && wantsStrictIndoor(rawText)) {
    return "strictly_indoor_preference";
  }

  /**
   * Hard filter for step-free / stair-free requests.
   *
   * Unlike the other `avoidIf`-gated branches, this check is inverted:
   * the traveler's intent is the trigger, and every profile is excluded
   * unless it explicitly opts-in as step-free (e.g. `theme_tags`
   * includes `"step_free"`). Today none of our itineraries are truly
   * step-free, so this effectively excludes the entire catalog whenever
   * the traveler makes a strict no-stairs request — producing a clean
   * "no_step_free_products" no-match outcome upstream.
   */
  if (wantsStepFreeAccess(intent, rawText) && !profileIsStepFree(profile)) {
    return "strict_no_stairs_request";
  }

  return null;
}

function buildFitWeights(intent: TravelerIntentV1, _weights: MatchWeightsV1): Partial<Record<FitDimensionKey, number>> {
  const w: Partial<Record<FitDimensionKey, number>> = {};
  const base = 0.65;
  for (const k of FIT_DIMENSION_KEYS) {
    w[k] = base;
  }

  const pace = intent.pace_preference ?? 3;
  if (pace <= 2) {
    w.pace_level = 0.45;
    w.relax_level = 1.35;
  } else if (pace >= 4) {
    w.pace_level = 1.35;
    w.one_day_fit = 1.15;
  }

  const walk = intent.walking_tolerance ?? 3;
  if (walk <= 2) {
    w.walking_level = -1.15;
    w.mobility_friendly_fit = 1.35;
    w.stroller_fit = 0.95;
  } else if (walk >= 4) {
    w.walking_level = 1.05;
    w.active_traveler_fit = 1.15;
  }

  const si = (intent.scenic_importance ?? 3) / 5;
  w.scenic_level = 0.5 + si * 1.1;
  w.photo_level = 0.5 + ((intent.photo_importance ?? 3) / 5) * 0.95;

  w.culture_level = 0.55 + ((intent.culture_importance ?? 3) / 5) * 0.9;
  w.relax_level = (w.relax_level ?? base) * (0.85 + ((intent.relax_importance ?? 3) / 5) * 0.5);

  if (intent.first_time_jeju === true) w.first_time_fit = 1.45;
  if (intent.with_family === true) {
    w.family_fit = 1.35;
    w.adult_family_fit = 1.2;
  }
  if (intent.with_seniors === true) {
    w.senior_fit = 1.3;
    w.senior_general_fit = 1.25;
    w.senior_active_fit = 1.1;
  }
  if (intent.with_kids === true) {
    w.young_kids_fit = 1.35;
    w.family_fit = (w.family_fit ?? base) * 1.1;
  }

  if (intent.one_day_only === true) w.one_day_fit = 1.25;
  if (intent.same_day_flight === true) w.same_day_flight_fit = 1.2;

  if (intent.rain_sensitive === true) {
    w.rain_fit = 1.35;
  }

  w.value_for_money_fit = 0.55 + ((intent.value_focus ?? 3) / 5) * 0.85;
  w.iconic_landmark_fit = 0.55 + ((intent.iconic_importance ?? 3) / 5) * 1.0;
  w.cafe_fit = 0.5 + ((intent.cafe_importance ?? 3) / 5) * 0.9;

  if (intent.mobility === "low") {
    w.mobility_friendly_fit = 1.45;
    w.walking_level = -1.35;
  }

  return w;
}

function computeFitScore(
  profile: TourMatchingProfileRow,
  intent: TravelerIntentV1,
  mw: MatchWeightsV1,
): number {
  const weights = buildFitWeights(intent, mw);
  let numerator = 0;
  let denominator = 0;

  for (const key of FIT_DIMENSION_KEYS) {
    const raw = profile[key as keyof TourMatchingProfileRow];
    const num = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(num)) continue;

    const normalized = norm1to5(num);
    const wt = weights[key] ?? 0.65;
    if (wt >= 0) {
      numerator += normalized * wt;
      denominator += wt;
    } else {
      numerator += (1 - normalized) * Math.abs(wt);
      denominator += Math.abs(wt);
    }
  }

  let fit = denominator > 0 ? numerator / denominator : 0.5;

  const reg = intent.region_affinity ?? "any";
  if (reg !== "any") {
    if (reg === profile.region_type) {
      fit *= 1 + mw.region_bonus * 0.35;
    } else {
      fit *= 1 - mw.region_mismatch_penalty * 0.9;
      fit = Math.max(0.08, fit);
    }
  }

  return clamp(fit, 0, 1);
}

function getTypeFit(profile: TourMatchingProfileRow, desired: "small_group" | "private" | "bus" | null): number {
  if (!desired) return 0.55;
  if (desired === "small_group") return norm1to5(profile.small_group_fit);
  if (desired === "private") return norm1to5(profile.private_fit);
  return norm1to5(profile.bus_fit);
}

function getTypeGate(
  profile: TourMatchingProfileRow,
  desired: "small_group" | "private" | "bus" | null,
  strength: "soft" | "hard" | null,
): number {
  if (!desired) return 1;
  if (profile.product_type === desired) return 1;
  if (strength === "hard") return 0;
  return 0.15;
}

function computeIndoorWeatherScore(profile: TourMatchingProfileRow, intent: TravelerIntentV1): number {
  const indoorRatioNorm = normIndoorRatioPercent(profile.indoor_ratio);
  const weatherSensitivityNorm = norm1to5(profile.weather_sensitivity);

  let score = 0.5;

  if (intent.rain_sensitive === true) {
    score += indoorRatioNorm * 0.32;
    score += (1 - weatherSensitivityNorm) * 0.28;
    /** High exposure (weather_sensitivity) caps rain-safety benefit even if indoor_ratio is high. */
    score -= weatherSensitivityNorm * indoorRatioNorm * 0.2;
  } else {
    score += 0.12 * (1 - indoorRatioNorm);
  }

  return clamp(score / 1.05);
}

function computeKeywordBoost(profile: TourMatchingProfileRow, rawText: string): number {
  const text = rawText.toLowerCase().trim();
  if (!text) return 0.32;

  const pool = [...stringArray(profile.keywords), ...stringArray(profile.synonym_hints)].map((x) =>
    x.toLowerCase(),
  );
  if (pool.length === 0) return 0.32;

  let hits = 0;
  for (const token of text.split(/\s+/)) {
    if (token.length < 2) continue;
    if (pool.some((entry) => entry.includes(token))) hits += 1;
  }

  const cappedHits = Math.min(hits, 5);
  return clamp(0.22 + cappedHits * 0.12);
}

/**
 * Deterministic ranking: hard filters first, then channel scores.
 * `indoor_ratio` is normalized as 0–100 → 0–1 only in the indoor/weather channel, never summed with 1–5 axes.
 */
export function scoreIntentAgainstProfiles(
  rawText: string,
  intent: TravelerIntentV1,
  profiles: TourMatchingProfileRow[],
  weights: MatchWeightsV1,
): ScoredProduct[] {
  const pti = resolveProductTypeIntent(intent, rawText);

  const scored: ScoredProduct[] = profiles.map((p): ScoredProduct => {
    const ex = shouldHardExclude(intent, p, rawText);
    if (ex) {
      return {
        product_id: p.product_id,
        score: -1e9,
        breakdown: { excluded: 1 },
        excluded: true,
        excludeReason: ex,
      };
    }

    const typeGate = getTypeGate(p, pti.desired, pti.strength);
    const typeScore = getTypeFit(p, pti.desired);
    const fitScore = computeFitScore(p, intent, weights);
    const indoorWeatherScore = computeIndoorWeatherScore(p, intent);
    const keywordBoost = computeKeywordBoost(p, rawText);

    const soft =
      TOUR_MATCH_CHANNEL_WEIGHTS.typeScore * typeScore +
      TOUR_MATCH_CHANNEL_WEIGHTS.fitScore * fitScore +
      TOUR_MATCH_CHANNEL_WEIGHTS.indoorWeatherScore * indoorWeatherScore +
      TOUR_MATCH_CHANNEL_WEIGHTS.keywordBoost * keywordBoost;

    let total = typeGate * soft;
    const conf = intent.confidence ?? 0.72;
    total *= 0.45 + 0.55 * conf;

    return {
      product_id: p.product_id,
      score: total,
      breakdown: {
        typeGate,
        typeScore,
        fitScore,
        indoorWeatherScore,
        keywordBoost,
        indoor_ratio_norm: normIndoorRatioPercent(p.indoor_ratio),
        weather_sensitivity_norm: norm1to5(p.weather_sensitivity),
        soft_pre_confidence: typeGate * soft,
      },
      excluded: false,
      excludeReason: null,
    };
  });

  return scored.sort((a, c) => c.score - a.score);
}
