/**
 * Single normalized route preference source for assembly, validation, reuse, and polish.
 * Merges parser/fixedPool merged values with direct request fallbacks when parser data is weak or absent.
 */
import type { ParsedRequestSlots } from '@/lib/itinerary/parser/types';
import type { FixedCandidatePoolResult } from '@/lib/itinerary/reco/build-fixed-candidate-pool';
import type { ItineraryUserInput } from '@/lib/itinerary/types';
import type { RoutePreferenceReorderContext } from '@/lib/itinerary/route-feasibility';

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Build snake_case merged-style values from validated API input when parser merge is missing.
 */
export function buildMergedValuesFallbackFromInput(input: ItineraryUserInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lt = (input as { longDriveTolerance?: number | null }).longDriveTolerance;
  if (typeof lt === 'number' && Number.isFinite(lt)) out['long_drive_tolerance'] = lt;
  const fv = (input as { firstVisit?: boolean | null }).firstVisit;
  if (typeof fv === 'boolean') out['first_visit'] = fv;
  const ip = (input as { iconicSpotPriority?: number | null }).iconicSpotPriority;
  if (typeof ip === 'number' && Number.isFinite(ip)) out['iconic_spot_priority'] = ip;
  const hg = (input as { hiddenGemPriority?: number | null }).hiddenGemPriority;
  if (typeof hg === 'number' && Number.isFinite(hg)) out['hidden_gem_priority'] = hg;
  for (const [k, v] of Object.entries({
    region_preference: (input as { regionPreference?: string | null }).regionPreference,
    subregion_preference: (input as { subregionPreference?: string | null }).subregionPreference,
    with_seniors: input.seniors,
    with_children: input.withChildren,
    max_walking_level: (input as { maxWalkingLevel?: string | null }).maxWalkingLevel,
    quick_photo_mode: input.quickPhotoMode,
    need_indoor_if_rain: (input as { needIndoorIfRain?: boolean | null }).needIndoorIfRain,
    rain_aware: input.rainyDay === true,
    nature_priority: (input as { naturePriority?: number | null }).naturePriority,
    culture_priority: (input as { culturePriority?: number | null }).culturePriority,
    food_priority: (input as { foodPriority?: number | null }).foodPriority,
    cafe_priority: (input as { cafePriority?: number | null }).cafePriority,
    shopping_priority: (input as { shoppingPriority?: number | null }).shoppingPriority,
    photo_priority: (input as { photoPriority?: number | null }).photoPriority,
    age_band: (input as { ageBand?: string | null }).ageBand,
  })) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

function mergeSlotsWithFallback(
  primary: ParsedRequestSlots | null | undefined,
  fallback: ParsedRequestSlots | null | undefined,
): ParsedRequestSlots {
  const p = primary ?? ({} as ParsedRequestSlots);
  const f = fallback ?? ({} as ParsedRequestSlots);
  return {
    regionPreference: p.regionPreference ?? f.regionPreference ?? null,
    subregionPreference: p.subregionPreference ?? f.subregionPreference ?? null,
    withSeniors: p.withSeniors ?? f.withSeniors ?? null,
    withChildren: p.withChildren ?? f.withChildren ?? null,
    firstVisit: p.firstVisit ?? f.firstVisit ?? null,
    maxWalkingLevel: p.maxWalkingLevel ?? f.maxWalkingLevel ?? null,
    needIndoorIfRain: p.needIndoorIfRain ?? f.needIndoorIfRain ?? null,
    rainAware: p.rainAware ?? f.rainAware ?? null,
    photoPriority: p.photoPriority ?? f.photoPriority ?? 0,
    hiddenGemPriority: p.hiddenGemPriority ?? f.hiddenGemPriority ?? 0,
    iconicPriority: p.iconicPriority ?? f.iconicPriority ?? 0,
    naturePriority: p.naturePriority ?? f.naturePriority ?? 0,
    culturePriority: p.culturePriority ?? f.culturePriority ?? 0,
    foodPriority: p.foodPriority ?? f.foodPriority ?? 0,
    cafePriority: p.cafePriority ?? f.cafePriority ?? 0,
    shoppingPriority: p.shoppingPriority ?? f.shoppingPriority ?? 0,
  };
}

/** Bridge minimal input-only hints into ParsedRequestSlots when no parser slots exist. */
export function slotsFallbackFromInput(input: ItineraryUserInput): ParsedRequestSlots {
  return {
    regionPreference: str(input.pickupArea) ?? str((input as { regionPreference?: string }).regionPreference),
    subregionPreference: str((input as { subregionPreference?: string }).subregionPreference),
    withSeniors: input.seniors,
    withChildren: input.withChildren,
    firstVisit: (input as { firstVisit?: boolean | null }).firstVisit ?? null,
    maxWalkingLevel:
      (input as { maxWalkingLevel?: 'easy' | 'moderate' | 'hard' | null }).maxWalkingLevel ?? null,
    needIndoorIfRain:
      (input as { needIndoorIfRain?: boolean | null }).needIndoorIfRain ??
      (input.rainyDay === true ? true : null),
    rainAware: input.rainyDay === true ? true : null,
    photoPriority: num((input as { photoPriority?: number }).photoPriority) ?? 0,
    hiddenGemPriority: num((input as { hiddenGemPriority?: number }).hiddenGemPriority) ?? 0,
    iconicPriority: num((input as { iconicSpotPriority?: number }).iconicSpotPriority) ?? 0,
    naturePriority: num((input as { naturePriority?: number }).naturePriority) ?? 0,
    culturePriority: num((input as { culturePriority?: number }).culturePriority) ?? 0,
    foodPriority: num((input as { foodPriority?: number }).foodPriority) ?? 0,
    cafePriority: num((input as { cafePriority?: number }).cafePriority) ?? 0,
    shoppingPriority: num((input as { shoppingPriority?: number }).shoppingPriority) ?? 0,
  };
}

function mergeMergedValues(
  primary: Record<string, unknown> | null | undefined,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...fallback, ...(primary ?? {}) };
  for (const [k, v] of Object.entries(fallback)) {
    if (out[k] === undefined || out[k] === null) {
      if (v !== undefined && v !== null) out[k] = v;
    }
  }
  return out;
}

export function normalizeRoutePreferenceContext(args: {
  fixedPool: FixedCandidatePoolResult | null;
  input: ItineraryUserInput;
}): RoutePreferenceReorderContext {
  const { fixedPool, input } = args;
  const fallbackMerged = buildMergedValuesFallbackFromInput(input);
  const fallbackSlots = slotsFallbackFromInput(input);

  if (!fixedPool) {
    return {
      parsedSlots: fallbackSlots,
      mergedValues: fallbackMerged,
    };
  }

  const mergedValues = mergeMergedValues(fixedPool.mergedParserResult.values, fallbackMerged);
  const parsedSlots = mergeSlotsWithFallback(fixedPool.parsed.slots, fallbackSlots);

  return {
    parsedSlots,
    mergedValues,
  };
}
