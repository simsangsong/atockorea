/**
 * Env / config for Jeju photo backfill target-set resolution (no API calls here).
 */

export type JejuPhotoTargetSetConfig = {
  /** Ranked pool size after sorting (default 200). */
  topN: number;
  /** Cap on unique stored gallery photos per POI (default 8). */
  targetPhotoCount: number;
  /** Comma-separated titles → normalized exact match skip (default `우도,삼성혈`). */
  skipTitlesCsv: string;
  /** Comma-separated aliases → normalized exact match on full title (default `우도섬,제주삼성혈`). */
  skipAliasesCsv: string;
  /** Comma-separated `content_id`, `id:pk`, `content:cid`, `cid@type` — see `skip-rules.ts`. */
  skipPoiIdsCsv: string;
  /**
   * When true (default): after ranking, only POIs with `missingSlots > 0` remain in the final slice.
   * When false with `forceRefresh` false: same as including complete POIs in pool before slice — use `forceRefresh` to include full POIs in top-N.
   */
  onlyIncomplete: boolean;
  /**
   * When true: include POIs that already have `targetPhotoCount` photos in the top-N pool
   * (still computes `missingSlots` = 0). Use for metadata refresh / re-merge scenarios.
   */
  forceRefresh: boolean;
  /** Apply default Udo + Samseonghyeol `content_id` exclusions. */
  useDefaultIslandExclusions: boolean;
};

function envStr(env: Record<string, string | undefined>, key: string, fallback: string): string {
  const v = env[key]?.trim();
  return v ? v : fallback;
}

function envNum(env: Record<string, string | undefined>, key: string, fallback: number): number {
  const v = env[key]?.trim();
  if (!v) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseBoolEnv(
  env: Record<string, string | undefined>,
  key: string,
  defaultValue: boolean,
): boolean {
  const v = env[key]?.trim().toLowerCase();
  if (v === undefined || v === '') return defaultValue;
  if (v === '0' || v === 'false' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'yes') return true;
  return defaultValue;
}

const DEFAULTS = {
  topN: 200,
  targetPhotoCount: 8,
  skipTitles: '우도,삼성혈',
  skipAliases: '우도섬,제주삼성혈',
  skipPoiIds: '',
} as const;

/**
 * Parse config from `process.env` or an injected map (tests).
 *
 * Env keys:
 * - `JEJU_PHOTO_GALLERY_TOP_N` (default 200)
 * - `JEJU_PHOTO_GALLERY_TARGET_PHOTO_COUNT` (default 8)
 * - `JEJU_PHOTO_GALLERY_SKIP_TITLES`
 * - `JEJU_PHOTO_GALLERY_SKIP_ALIASES`
 * - `JEJU_PHOTO_GALLERY_SKIP_POI_IDS`
 * - `JEJU_PHOTO_GALLERY_ONLY_INCOMPLETE` (default 1) — only POIs needing slots enter final slice
 * - `JEJU_PHOTO_GALLERY_FORCE_REFRESH` (default 0) — include already-complete POIs in top-N
 * - `JEJU_PHOTO_GALLERY_USE_DEFAULT_EXCLUSIONS` (default 1) — Udo / Samseonghyeol content_id skips
 */
export function parseJejuPhotoTargetSetConfig(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): JejuPhotoTargetSetConfig {
  const onlyIncomplete = parseBoolEnv(env, 'JEJU_PHOTO_GALLERY_ONLY_INCOMPLETE', true);
  const forceRefresh = parseBoolEnv(env, 'JEJU_PHOTO_GALLERY_FORCE_REFRESH', false);
  const useDefaultIslandExclusions = parseBoolEnv(env, 'JEJU_PHOTO_GALLERY_USE_DEFAULT_EXCLUSIONS', true);

  return {
    topN: Math.max(1, Math.floor(envNum(env, 'JEJU_PHOTO_GALLERY_TOP_N', DEFAULTS.topN))),
    targetPhotoCount: Math.max(1, Math.floor(envNum(env, 'JEJU_PHOTO_GALLERY_TARGET_PHOTO_COUNT', DEFAULTS.targetPhotoCount))),
    skipTitlesCsv: envStr(env, 'JEJU_PHOTO_GALLERY_SKIP_TITLES', DEFAULTS.skipTitles),
    skipAliasesCsv: envStr(env, 'JEJU_PHOTO_GALLERY_SKIP_ALIASES', DEFAULTS.skipAliases),
    skipPoiIdsCsv: envStr(env, 'JEJU_PHOTO_GALLERY_SKIP_POI_IDS', DEFAULTS.skipPoiIds),
    onlyIncomplete,
    forceRefresh,
    useDefaultIslandExclusions,
  };
}
