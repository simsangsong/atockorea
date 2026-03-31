/**
 * Deterministic route preference coefficients from structured parser slots + merged values.
 * No new user fields — only maps existing keys (e.g. long_drive_tolerance from merged pool).
 */
import type { ParsedRequestSlots } from '@/lib/itinerary/parser/types';

export type RoutePreferenceProfile = {
  mode: 'compact' | 'balanced' | 'detour_ok';
  drivePenaltyPerMinute: number;
  crossRegionPenalty: number;
  endpointDistanceWeight: number;
  softMaxSingleLegMinutes: number;
  softMaxDayDriveMinutes: number;
  compactnessBias: number;
  iconicDetourAllowance: number;
};

type StructuredLike = {
  longDriveTolerance?: number | null;
  withSeniors?: boolean | null;
  withChildren?: boolean | null;
  ageBand?: string | null;
  quickPhotoMode?: boolean | null;
  firstVisit?: boolean | null;
  iconicSpotPriority?: number | null;
  maxWalkingLevel?: string | null;
};

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, n));
}

function boolFromUnknown(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  return false;
}

function numFromMerged(merged: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!merged) return null;
  const v = merged[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Merges parser slots + SQL merge record into a single view for profile derivation.
 */
export function mergeRoutePreferenceFields(
  parsed: ParsedRequestSlots | null | undefined,
  merged: Record<string, unknown> | null | undefined,
): StructuredLike {
  const m = merged ?? {};
  const longDriveTolerance =
    numFromMerged(m, 'long_drive_tolerance') ??
    numFromMerged(m, 'longDriveTolerance') ??
    null;

  const withSeniors =
    parsed?.withSeniors != null ? parsed.withSeniors : typeof m['with_seniors'] === 'boolean' ? m['with_seniors'] : null;

  const withChildren =
    parsed?.withChildren != null
      ? parsed.withChildren
      : typeof m['with_children'] === 'boolean'
        ? m['with_children']
        : null;

  const ageBand =
    (typeof m['age_band'] === 'string' ? m['age_band'] : null) ??
    (typeof m['ageBand'] === 'string' ? m['ageBand'] : null);

  const quickPhotoMode = boolFromUnknown(m['quick_photo_mode']) || boolFromUnknown(m['quickPhotoMode']);

  const iconicSpotPriority =
    numFromMerged(m, 'iconic_spot_priority') ?? parsed?.iconicPriority ?? null;

  return {
    longDriveTolerance: longDriveTolerance ?? undefined,
    withSeniors: withSeniors ?? undefined,
    withChildren: withChildren ?? undefined,
    ageBand: ageBand ?? undefined,
    quickPhotoMode: quickPhotoMode || undefined,
    firstVisit: parsed?.firstVisit ?? undefined,
    iconicSpotPriority: iconicSpotPriority ?? undefined,
    maxWalkingLevel: parsed?.maxWalkingLevel ?? undefined,
  };
}

export function deriveRoutePreferenceProfile(
  req: StructuredLike | null | undefined,
): RoutePreferenceProfile {
  const driveTol = clampNumber(req?.longDriveTolerance, 3, 1, 5);
  const seniors = Boolean(req?.withSeniors);
  const children = Boolean(req?.withChildren);
  const ageBand = req?.ageBand != null ? String(req.ageBand).toLowerCase() : '';
  const seniorsFromAge =
    ageBand !== '' &&
    (/\b(senior|elder|60|70|80)\b/.test(ageBand) || ageBand.includes('senior'));
  const effectiveSeniors = seniors || seniorsFromAge;

  const quickPhoto = Boolean(req?.quickPhotoMode);
  const firstVisit = Boolean(req?.firstVisit);
  const iconic = clampNumber(req?.iconicSpotPriority, 3, 0, 10);
  const easyWalk = req?.maxWalkingLevel === 'easy';

  let drivePenaltyPerMinute = 0.045;
  let crossRegionPenalty = 10;
  let endpointDistanceWeight = 1;
  let softMaxSingleLegMinutes = 55;
  let softMaxDayDriveMinutes = 180;
  let compactnessBias = 1;
  let iconicDetourAllowance = 0;

  if (driveTol <= 2) {
    drivePenaltyPerMinute += 0.025;
    crossRegionPenalty += 8;
    softMaxSingleLegMinutes -= 10;
    softMaxDayDriveMinutes -= 30;
    compactnessBias += 0.35;
  } else if (driveTol >= 4) {
    drivePenaltyPerMinute -= 0.015;
    crossRegionPenalty -= 3;
    softMaxSingleLegMinutes += 10;
    softMaxDayDriveMinutes += 25;
    iconicDetourAllowance += 0.25;
  }

  if (effectiveSeniors || children || easyWalk) {
    drivePenaltyPerMinute += 0.015;
    crossRegionPenalty += 6;
    softMaxSingleLegMinutes -= 8;
    softMaxDayDriveMinutes -= 20;
    compactnessBias += 0.2;
  }

  if (quickPhoto) {
    drivePenaltyPerMinute += 0.01;
    compactnessBias += 0.2;
    softMaxDayDriveMinutes -= 15;
  }

  if (firstVisit && iconic >= 4) {
    iconicDetourAllowance += 0.2;
    drivePenaltyPerMinute -= 0.005;
  }

  const mode =
    drivePenaltyPerMinute >= 0.07
      ? 'compact'
      : drivePenaltyPerMinute <= 0.03
        ? 'detour_ok'
        : 'balanced';

  return {
    mode,
    drivePenaltyPerMinute,
    crossRegionPenalty,
    endpointDistanceWeight,
    softMaxSingleLegMinutes,
    softMaxDayDriveMinutes,
    compactnessBias,
    iconicDetourAllowance,
  };
}

export function deriveRoutePreferenceProfileFromSlots(
  parsed: ParsedRequestSlots | null | undefined,
  mergedValues: Record<string, unknown> | null | undefined,
): RoutePreferenceProfile {
  return deriveRoutePreferenceProfile(mergeRoutePreferenceFields(parsed, mergedValues));
}

export function computeIconicDetourCredit(
  score: number,
  parsed: ParsedRequestSlots,
  profile: RoutePreferenceProfile,
): number {
  const tier = Math.min(1, Math.max(0, parsed.iconicPriority / 10));
  return profile.iconicDetourAllowance * tier * Math.min(1.5, Math.max(0, score) / 40);
}
