/**
 * Merge-ready gallery selection: dedupe (galContentId → imageUrl), cap at targetPhotoCount, preserve order.
 * Importer-managed photos use one stable group key/title so reruns stay deterministic (no append-only groups).
 */

import { extractItineraryPhotoGalleryItems } from '@/lib/itinerary/photo-gallery-from-poi';
import type { ItineraryPhotoGalleryItem } from '@/lib/itinerary/photo-gallery-from-poi';
import type { JejuGalleryCandidate } from '@/lib/jeju-photo-gallery/gallery-candidate-types';
import type { JejuGalleryScoreBreakdown } from '@/lib/jeju-photo-gallery/gallery-candidate-types';

/** Single stable importer group — merge into this on every run (strip old copies by key/title first). */
export const JEJU_PHOTO_GALLERY_IMPORTER_GROUP_KEY = 'atockorea_jeju_tour_api_v1';
export const JEJU_PHOTO_GALLERY_IMPORTER_GROUP_TITLE = 'Tour API PhotoGallery (KorService1)';

export function isJejuImporterManagedGalleryGroup(g: Record<string, unknown>): boolean {
  const key = typeof g.galleryGroupKey === 'string' ? g.galleryGroupKey.trim() : '';
  if (key === JEJU_PHOTO_GALLERY_IMPORTER_GROUP_KEY) return true;
  const title = typeof g.galleryGroupTitle === 'string' ? g.galleryGroupTitle.trim() : '';
  return title === JEJU_PHOTO_GALLERY_IMPORTER_GROUP_TITLE;
}

export type ScoredCandidate = {
  candidate: JejuGalleryCandidate;
  score: JejuGalleryScoreBreakdown;
};

function normalizeUrlKey(url: string): string {
  return url.trim();
}

/**
 * Dedupe existing stored items: `galContentId` first (when present), then `imageUrl`.
 * Order: first occurrence wins (stable).
 */
export function dedupeStoredGalleryItems(items: ItineraryPhotoGalleryItem[]): ItineraryPhotoGalleryItem[] {
  const seenCid = new Set<string>();
  const seenUrl = new Set<string>();
  const out: ItineraryPhotoGalleryItem[] = [];
  for (const it of items) {
    const cid = it.galContentId?.trim();
    if (cid) {
      if (seenCid.has(cid)) continue;
      seenCid.add(cid);
      seenUrl.add(normalizeUrlKey(it.imageUrl));
      out.push(it);
      continue;
    }
    const u = normalizeUrlKey(it.imageUrl);
    if (seenUrl.has(u)) continue;
    seenUrl.add(u);
    out.push(it);
  }
  return out;
}

export function itineraryItemToStoredPhoto(it: ItineraryPhotoGalleryItem): Record<string, unknown> {
  return {
    imageUrl: it.imageUrl,
    thumbUrl: it.thumbUrl,
    galTitle: it.galTitle,
    galContentId: it.galContentId,
    photographyMonth: it.photographyMonth,
    photographyLocation: it.photographyLocation,
  };
}

function candidateToStoredPhoto(c: JejuGalleryCandidate): Record<string, unknown> {
  return {
    imageUrl: c.imageUrl,
    thumbUrl: c.thumbUrl,
    galTitle: c.galTitle,
    galContentId: c.galContentId,
    photographyMonth: c.photographyMonth,
    photographyLocation: c.photographyLocation,
  };
}

function candidateToItineraryItem(c: JejuGalleryCandidate): ItineraryPhotoGalleryItem {
  return {
    imageUrl: c.imageUrl,
    thumbUrl: c.thumbUrl,
    galTitle: c.galTitle,
    galContentId: c.galContentId,
    photographyMonth: c.photographyMonth,
    photographyLocation: c.photographyLocation,
    galleryGroupTitle: null,
  };
}

function itemInPool(it: ItineraryPhotoGalleryItem, pool: ItineraryPhotoGalleryItem[]): boolean {
  const cid = it.galContentId?.trim();
  for (const p of pool) {
    const pc = p.galContentId?.trim();
    if (cid && pc && cid === pc) return true;
    if (normalizeUrlKey(it.imageUrl) === normalizeUrlKey(p.imageUrl)) return true;
  }
  return false;
}

export type MergeGallerySelectionResult = {
  mergedGallery: Record<string, unknown>;
  selectedNewItems: JejuGalleryCandidate[];
  skippedDuplicates: number;
  finalCount: number;
  /** Deduped existing count before merge. */
  existingDedupedCount: number;
};

/**
 * `newCandidatesOrdered` should be pre-sorted (e.g. by score desc). Fills only until `targetPhotoCount`.
 */
export function mergeGallerySelection(args: {
  existingPhotoGalleryJson: unknown;
  newCandidatesOrdered: ScoredCandidate[];
  targetPhotoCount: number;
  /** Kept for API compatibility; stored gallery uses stable importer title/key instead. */
  newGroupGalleryTitle: string;
}): MergeGallerySelectionResult {
  void args.newGroupGalleryTitle;
  const extracted = extractItineraryPhotoGalleryItems({ photo_gallery_detail_json: args.existingPhotoGalleryJson });
  const existingDeduped = dedupeStoredGalleryItems(extracted);

  const seenCid = new Set<string>();
  const seenUrl = new Set<string>();
  for (const it of existingDeduped) {
    const cid = it.galContentId?.trim();
    if (cid) seenCid.add(cid);
    seenUrl.add(normalizeUrlKey(it.imageUrl));
  }

  const selectedNew: JejuGalleryCandidate[] = [];
  let skippedDuplicates = 0;
  const cap = args.targetPhotoCount;
  const baseCount = existingDeduped.length;

  for (const sc of args.newCandidatesOrdered) {
    if (baseCount + selectedNew.length >= cap) break;
    const c = sc.candidate;
    const cid = c.galContentId?.trim();
    if (cid) {
      if (seenCid.has(cid)) {
        skippedDuplicates += 1;
        continue;
      }
      seenCid.add(cid);
      seenUrl.add(normalizeUrlKey(c.imageUrl));
      selectedNew.push(c);
      continue;
    }
    const u = normalizeUrlKey(c.imageUrl);
    if (seenUrl.has(u)) {
      skippedDuplicates += 1;
      continue;
    }
    seenUrl.add(u);
    selectedNew.push(c);
  }

  const finalCount = Math.min(cap, baseCount + selectedNew.length);

  const base =
    args.existingPhotoGalleryJson &&
    typeof args.existingPhotoGalleryJson === 'object' &&
    'groups' in (args.existingPhotoGalleryJson as object)
      ? (JSON.parse(JSON.stringify(args.existingPhotoGalleryJson)) as Record<string, unknown>)
      : { version: 1, groups: [] as unknown[] };
  if (!Array.isArray(base.groups)) base.groups = [];

  if (selectedNew.length === 0) {
    return {
      mergedGallery: base,
      selectedNewItems: selectedNew,
      skippedDuplicates,
      finalCount,
      existingDedupedCount: baseCount,
    };
  }

  const groupsRaw = base.groups as unknown[];
  const nonImporterGroups: unknown[] = [];
  for (const g of groupsRaw) {
    if (g == null || typeof g !== 'object') {
      nonImporterGroups.push(g);
      continue;
    }
    if (isJejuImporterManagedGalleryGroup(g as Record<string, unknown>)) continue;
    nonImporterGroups.push(g);
  }

  const nonImporterItems = dedupeStoredGalleryItems(
    extractItineraryPhotoGalleryItems({ photo_gallery_detail_json: { groups: nonImporterGroups } }),
  );

  const importerFromExisting = existingDeduped.filter((it) => !itemInPool(it, nonImporterItems));
  const selectedAsItems = selectedNew.map(candidateToItineraryItem);
  const importerCombined = dedupeStoredGalleryItems([...importerFromExisting, ...selectedAsItems]);
  const importerCap = Math.max(0, cap - nonImporterItems.length);
  const importerPhotos = importerCombined.slice(0, importerCap);

  base.version = 1;
  base.source = 'PhotoGalleryService1';
  base.groups = [...nonImporterGroups] as unknown[];
  if (importerPhotos.length > 0) {
    (base.groups as unknown[]).push({
      galleryGroupTitle: JEJU_PHOTO_GALLERY_IMPORTER_GROUP_TITLE,
      galleryGroupKey: JEJU_PHOTO_GALLERY_IMPORTER_GROUP_KEY,
      photos: importerPhotos.map(itineraryItemToStoredPhoto),
    });
  }

  return {
    mergedGallery: base,
    selectedNewItems: selectedNew,
    skippedDuplicates,
    finalCount,
    existingDedupedCount: baseCount,
  };
}

export function sortScoredCandidatesDesc(rows: ScoredCandidate[]): ScoredCandidate[] {
  return [...rows].sort((a, b) => b.score.total - a.score.total);
}
