/**
 * Deterministic app-layer scoring on top of SQL-ranked lean candidates + reco features.
 * Tie-break: score DESC, region ASC, content_id ASC.
 */
import type { ParsedRequestSlots } from '@/lib/itinerary/parser/types';
import type { ItineraryUserInput } from '@/lib/itinerary/types';
import type { LeanPoiCandidate } from '@/lib/itinerary/reco/get-poi-candidates';
import type { PoiRecoFeaturesRow } from '@/lib/itinerary/reco/fetch-reco-features';

export type CandidateScoreInput = {
  candidates: LeanPoiCandidate[];
  recoByPoiId: Map<number, PoiRecoFeaturesRow>;
  parsed: ParsedRequestSlots;
  parserConfidence: number;
  durationDays: number;
  mergedValues: Record<string, unknown>;
  input: ItineraryUserInput;
};

export type ScoredCandidate = LeanPoiCandidate & {
  score: number;
  scoreBreakdown: {
    regionFit: number;
    walkingFit: number;
    indoorRainFit: number;
    firstVisitFit: number;
    photoFit: number;
    hiddenGemFit: number;
    iconicFit: number;
    categoryFit: number;
    timeOfDayFit: number;
    touristyPenalty: number;
    safetyPenalty: number;
    confidenceAdjustment: number;
  };
};

function clamp(n: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, n));
}

function softWeight(weight: number, parserConfidence: number): number {
  if (parserConfidence >= 0.8) return weight;
  if (parserConfidence >= 0.55) return weight * 0.7;
  return weight * 0.4;
}

function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return false;
}

function walkingFit(
  maxLevel: ParsedRequestSlots['maxWalkingLevel'],
  poiDifficulty: string | null,
): number {
  const order = { easy: 0, moderate: 1, hard: 2 };
  const p = poiDifficulty && poiDifficulty in order ? order[poiDifficulty as keyof typeof order] : 1;
  if (maxLevel == null) return 0.5;
  if (maxLevel === 'easy') {
    if (p <= 0) return 1;
    if (p === 1) return 0.45;
    return 0.15;
  }
  if (maxLevel === 'moderate') {
    if (p <= 1) return 1;
    return 0.4;
  }
  return 1;
}

export function scoreCandidates(ctx: CandidateScoreInput): ScoredCandidate[] {
  const { candidates, recoByPoiId, parsed, parserConfidence, mergedValues, input } = ctx;
  const rainy = input.rainyDay === true || parsed.needIndoorIfRain === true;
  const morningPref = bool(mergedValues['morning_preference']);
  const sunsetPref = bool(mergedValues['sunset_preference']);
  const avoidTouristy = bool(mergedValues['avoid_overly_touristy']);

  const out: ScoredCandidate[] = [];

  for (const c of candidates) {
    const rf = recoByPoiId.get(c.poi_id) ?? null;

    const regionFit =
      parsed.regionPreference && c.region === parsed.regionPreference ? 1 : 0;

    const wFit = walkingFit(parsed.maxWalkingLevel, c.walking_difficulty);

    let indoorRainFit = 0.35;
    if (rainy) {
      indoorRainFit =
        c.indoor_outdoor === 'indoor'
          ? (rf?.indoor_score ?? 0.5) + (rf?.rain_fallback_score ?? 0)
          : c.indoor_outdoor === 'mixed'
            ? (rf?.rain_fallback_score ?? 0) + 0.25
            : (rf?.rain_fallback_score ?? 0) * 0.5;
      indoorRainFit = clamp(indoorRainFit);
    } else {
      indoorRainFit = 0.35 + (rf?.rain_fallback_score ?? 0) * 0.1;
    }

    const firstVisitFit =
      parsed.firstVisit === true ? rf?.first_timer_score ?? 0.3 : rf?.revisit_score ?? 0.2;

    const photoW = softWeight((parsed.photoPriority || 0) / 10, parserConfidence);
    const photoFit = ((rf?.photo_score ?? 0) + (c.quick_photo_stop_ok ? 0.08 : 0)) * photoW;

    const hidW = softWeight((parsed.hiddenGemPriority || 0) / 10, parserConfidence);
    const hiddenGemFit = (rf?.hidden_gem_score ?? 0) * hidW;

    const icoW = softWeight((parsed.iconicPriority || 0) / 10, parserConfidence);
    const iconicFit = (rf?.iconic_score ?? 0) * icoW;

    const categoryFit =
      ((rf?.nature_score ?? 0) * ((parsed.naturePriority || 0) / 10)) +
      ((rf?.culture_score ?? 0) * ((parsed.culturePriority || 0) / 10)) +
      ((rf?.food_score ?? 0) * ((parsed.foodPriority || 0) / 10)) +
      ((rf?.cafe_score ?? 0) * ((parsed.cafePriority || 0) / 10)) +
      ((rf?.shopping_score ?? 0) * ((parsed.shoppingPriority || 0) / 10));

    let timeOfDayFit = 0;
    if (morningPref) timeOfDayFit += (rf?.morning_score ?? 0) * 0.5;
    if (sunsetPref) timeOfDayFit += (rf?.sunset_score ?? 0) * 0.5;

    let touristyPenalty = 0;
    if (avoidTouristy) {
      touristyPenalty = (rf?.overly_touristy_score ?? 0) * 8;
    }

    // Higher senior_score / family_score in DB = better fit — penalize low fit.
    const safetyPenalty =
      (parsed.withSeniors === true ? (1 - (rf?.senior_score ?? 0.5)) * 0.55 : 0) +
      (parsed.withChildren === true ? (1 - (rf?.family_score ?? 0.5)) * 0.45 : 0);

    const confidenceAdjustment =
      parserConfidence < 0.55 && (rf?.base_rank_score ?? 0) > 0
        ? Math.min(1, (rf?.base_rank_score ?? 0) / 100)
        : 0;

    const score =
      regionFit * 22 +
      wFit * 16 +
      indoorRainFit * 10 +
      firstVisitFit * 9 +
      photoFit * 12 +
      hiddenGemFit * 10 +
      iconicFit * 10 +
      categoryFit * 14 +
      timeOfDayFit * 6 +
      confidenceAdjustment * 10 -
      touristyPenalty -
      safetyPenalty * 12 +
      (c.final_score ?? 0) * 0.01;

    out.push({
      ...c,
      score,
      scoreBreakdown: {
        regionFit,
        walkingFit: wFit,
        indoorRainFit,
        firstVisitFit,
        photoFit,
        hiddenGemFit,
        iconicFit,
        categoryFit,
        timeOfDayFit,
        touristyPenalty,
        safetyPenalty,
        confidenceAdjustment,
      },
    });
  }

  return out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((a.region ?? '') !== (b.region ?? '')) {
      return String(a.region ?? '').localeCompare(String(b.region ?? ''));
    }
    return String(a.content_id).localeCompare(String(b.content_id));
  });
}
