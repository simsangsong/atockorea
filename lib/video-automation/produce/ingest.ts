import type { VideoLicenseStatus, VideoLocalizedPoiContent } from '@/lib/video-automation/types';

/** Sources whose imagery is owned by AtoC Korea and auto-clears licensing (VP-D6). */
export const AUTO_CLEARED_SOURCES = new Set(['atoc-korea']);

/** Basename segment marker for generated imagery, e.g. `...-collage-ai.webp`. */
const AI_IMAGE_MARKER = /(^|[-_])ai(?=[-_.]|$)/i;

export interface SceneImagePlan {
  /** Exactly one image per scene (pool cycled when short). */
  selected: string[];
  /** Unique usable images, license-cleared entries first. */
  pool: string[];
  licenses: Record<string, { status: VideoLicenseStatus; source?: string }>;
  excludedAi: string[];
  missing: string[];
  /** Bulk-import (photo-NNN) images demoted because enough curated shots exist. */
  demotedBulk: string[];
  warnings: string[];
}

/** Bulk-imported filenames carry no subject guarantee (e.g. unrelated collages). */
export function isBulkImage(uri: string): boolean {
  return /(^|\/)photo-\d+\.[a-z0-9]+$/i.test(uri.split('?')[0] ?? uri);
}

function basename(uri: string): string {
  const clean = uri.split('?')[0] ?? uri;
  const parts = clean.split('/');
  return parts[parts.length - 1] ?? clean;
}

export function isGeneratedImage(uri: string): boolean {
  const name = basename(uri).replace(/\.[a-z0-9]+$/i, '');
  return AI_IMAGE_MARKER.test(name);
}

/**
 * Plans one still image per scene from the POI's local image set: dedupes,
 * drops generated (-ai) imagery, verifies files exist, judges license from
 * imageCredits, and prefers cleared images over unknown ones.
 */
export function planSceneImages(
  content: VideoLocalizedPoiContent | undefined,
  sceneCount: number,
  fileExists: (uri: string) => boolean,
): SceneImagePlan {
  const warnings: string[] = [];
  const excludedAi: string[] = [];
  const missing: string[] = [];
  const licenses: SceneImagePlan['licenses'] = {};

  const candidates = [...new Set([...(content?.images ?? []), ...(content?.image ? [content.image] : [])])];
  const creditBySource = new Map((content?.imageCredits ?? []).map((credit) => [credit.url, credit.source]));

  const usable: string[] = [];
  for (const uri of candidates) {
    if (isGeneratedImage(uri)) {
      excludedAi.push(uri);
      continue;
    }
    if (!fileExists(uri)) {
      missing.push(uri);
      continue;
    }
    const source = creditBySource.get(uri);
    licenses[uri] = {
      status: source && AUTO_CLEARED_SOURCES.has(source) ? 'cleared' : 'unknown',
      source,
    };
    usable.push(uri);
  }

  const rank = (uri: string): number =>
    (licenses[uri].status === 'cleared' ? 0 : 2) + (isBulkImage(uri) ? 1 : 0);
  let pool = [...usable].sort((a, b) => rank(a) - rank(b));

  // Curated (descriptively named) shots are subject-verified; when at least 3
  // exist, drop bulk photo-NNN images entirely rather than risk off-topic frames.
  const curated = pool.filter((uri) => !isBulkImage(uri));
  const demotedBulk = curated.length >= 3 ? pool.filter((uri) => isBulkImage(uri)) : [];
  if (demotedBulk.length > 0) {
    pool = curated;
    warnings.push(`${demotedBulk.length} bulk (photo-NNN) image(s) demoted; review them for subject match before reuse.`);
  }

  if (excludedAi.length > 0) warnings.push(`${excludedAi.length} generated (-ai) image(s) excluded from render.`);
  if (missing.length > 0) warnings.push(`${missing.length} referenced image file(s) missing on disk.`);
  if (pool.length === 0) {
    return { selected: [], pool, licenses, excludedAi, missing, demotedBulk, warnings };
  }
  if (pool.length < 3) warnings.push(`Only ${pool.length} usable image(s); scenes will repeat visuals.`);
  if (pool.some((uri) => licenses[uri].status !== 'cleared')) {
    warnings.push('Render uses images with unreviewed licenses; publication stays blocked until cleared.');
  }

  const selected = Array.from({ length: sceneCount }, (_, index) => pool[index % pool.length]);
  return { selected, pool, licenses, excludedAi, missing, demotedBulk, warnings };
}
