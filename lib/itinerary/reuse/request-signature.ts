/**
 * Deterministic reusable request signature for run/template matching.
 */
import type { ParsedRequestSlots } from '@/lib/itinerary/parser/types';
import type { RoutePlanningContext } from '@/lib/itinerary/reco/planning-context';

export type ReusableRequestSignature = {
  dayCount: number | null;
  regionPreference: string | null;
  subregionPreference: string | null;
  startRegionGroup: string | null;
  endRegionGroup: string | null;
  includeReturnToEndLocation: boolean;
  withSeniors: boolean;
  withChildren: boolean;
  ageBand: string | null;
  maxWalkingLevel: string | null;
  quickPhotoMode: boolean;
  firstVisit: boolean;
  needIndoorIfRain: boolean;
  rainAware: boolean;
  iconicPriority: number | null;
  hiddenGemPriority: number | null;
  naturePriority: number | null;
  culturePriority: number | null;
  foodPriority: number | null;
  cafePriority: number | null;
  shoppingPriority: number | null;
};

function coalesceString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function coalesceInt(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function buildReusableRequestSignature(input: {
  parsedSlots?: ParsedRequestSlots | null;
  mergedValues?: Record<string, unknown> | null;
  body?: Record<string, unknown> | null;
  durationDays: number;
  routePlanning?: RoutePlanningContext | null;
}): ReusableRequestSignature {
  const v = input.mergedValues ?? {};
  const s = input.parsedSlots ?? null;
  const b = input.body ?? {};

  return {
    dayCount: input.durationDays,
    regionPreference: coalesceString(v['region_preference'], s?.regionPreference, b['region']),
    subregionPreference: coalesceString(v['subregion_preference'], s?.subregionPreference, b['subregion']),
    startRegionGroup: coalesceString(
      input.routePlanning?.startLocation?.regionGroup,
      b['pickupRegion'],
      b['hotelRegion'],
    ),
    endRegionGroup: coalesceString(input.routePlanning?.endLocation?.regionGroup, b['dropoffRegion']),
    includeReturnToEndLocation: Boolean(input.routePlanning?.includeReturnToEndLocation),
    withSeniors: Boolean(v['with_seniors'] ?? s?.withSeniors ?? b['withSeniors'] ?? b['seniors']),
    withChildren: Boolean(v['with_children'] ?? s?.withChildren ?? b['withChildren']),
    ageBand: coalesceString(v['age_band'], b['ageBand']),
    maxWalkingLevel: coalesceString(v['max_walking_level'], s?.maxWalkingLevel, b['maxWalkingLevel']),
    quickPhotoMode: Boolean(v['quick_photo_mode'] ?? b['quickPhotoMode']),
    firstVisit: Boolean(v['first_visit'] ?? s?.firstVisit ?? b['firstVisit']),
    needIndoorIfRain: Boolean(v['need_indoor_if_rain'] ?? s?.needIndoorIfRain ?? b['needIndoorIfRain']),
    rainAware: Boolean(v['rain_aware'] ?? s?.rainAware ?? b['rainyDay']),
    iconicPriority: coalesceInt(v['iconic_spot_priority'], s?.iconicPriority, b['iconicSpotPriority']),
    hiddenGemPriority: coalesceInt(v['hidden_gem_priority'], s?.hiddenGemPriority, b['hiddenGemPriority']),
    naturePriority: coalesceInt(v['nature_priority'], s?.naturePriority, b['naturePriority']),
    culturePriority: coalesceInt(v['culture_priority'], s?.culturePriority, b['culturePriority']),
    foodPriority: coalesceInt(v['food_priority'], s?.foodPriority, b['foodPriority']),
    cafePriority: coalesceInt(v['cafe_priority'], s?.cafePriority, b['cafePriority']),
    shoppingPriority: coalesceInt(v['shopping_priority'], s?.shoppingPriority, b['shoppingPriority']),
  };
}
