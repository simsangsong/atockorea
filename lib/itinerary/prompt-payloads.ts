import type { ItineraryUserInput } from './types';

/** Wire shape for {{USER_REQUEST_JSON}} — matches product-facing traveler object. */
export type TravelerRequestPayload = {
  destination: string;
  pickupArea?: string | null;
  groupType?: string | null;
  travelStyle?: string | null;
  withSeniors: boolean;
  withChildren: boolean;
  isCouple: boolean;
  rainyDay: boolean;
  indoorPreference: 'indoor' | 'outdoor' | 'mixed' | 'both' | 'any';
  availableHours: number;
  mustSeeKeywords: string[];
  language: 'ko' | 'en';
  theme?: string | null;
};

/** Wire shape for {{PLANNING_CONSTRAINTS_JSON}} — server-side planning knobs. */
export type PlanningConstraintsPayload = {
  maxStops: number;
  minStops: number;
  avoidDuplicateRegionHopping: boolean;
  preferRecommendedDuration: boolean;
  excludeManualHidden: boolean;
  preferHighBaseScore: boolean;
  preferHighManualPriority: boolean;
  durationDays: number;
  availableHours: number;
};

function indoorPreferenceForPayload(
  input: ItineraryUserInput,
): TravelerRequestPayload['indoorPreference'] {
  const io = input.indoorOutdoor;
  if (io === 'both') return 'mixed';
  return io;
}

function mustSeeKeywordsForPayload(input: ItineraryUserInput): string[] {
  if (input.mustSeeKeywords?.length) return input.mustSeeKeywords;
  const raw = input.mustSee?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildTravelerRequestPayload(input: ItineraryUserInput): TravelerRequestPayload {
  return {
    destination: String(input.destination ?? 'jeju').toLowerCase(),
    pickupArea: input.pickupArea ?? null,
    groupType: input.groupType ?? null,
    travelStyle: input.travelStyle ?? null,
    withSeniors: input.seniors ?? false,
    withChildren: input.withChildren ?? false,
    isCouple: input.couple ?? false,
    rainyDay: input.rainyDay ?? false,
    indoorPreference: indoorPreferenceForPayload(input),
    availableHours: input.availableHours ?? 8,
    mustSeeKeywords: mustSeeKeywordsForPayload(input),
    language: input.locale === 'en' ? 'en' : 'ko',
    theme: input.theme ?? null,
  };
}

export function buildTravelerRequestJson(input: ItineraryUserInput): string {
  return JSON.stringify(buildTravelerRequestPayload(input));
}

/** Heuristic cap for one-day Jeju routing; clamped to [3, 5]. */
export function deriveMaxStops(availableHours: number): number {
  const h = Math.max(1, availableHours);
  const n = Math.floor(h / 1.75);
  return Math.min(5, Math.max(3, n));
}

export function buildPlanningConstraintsPayload(input: ItineraryUserInput): PlanningConstraintsPayload {
  const availableHours = input.availableHours ?? 8;
  const durationDays = input.durationDays ?? 1;
  return {
    maxStops: deriveMaxStops(availableHours),
    minStops: 3,
    avoidDuplicateRegionHopping: true,
    preferRecommendedDuration: true,
    excludeManualHidden: true,
    preferHighBaseScore: true,
    preferHighManualPriority: true,
    durationDays,
    availableHours,
  };
}

export function buildPlanningConstraintsJson(input: ItineraryUserInput): string {
  return JSON.stringify(buildPlanningConstraintsPayload(input));
}
