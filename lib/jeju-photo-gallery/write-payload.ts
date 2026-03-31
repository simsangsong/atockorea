/**
 * Merge-ready DB payload for Step 6 (writes stay off by default in Step 4).
 */

import type { JejuGalleryCandidate } from '@/lib/jeju-photo-gallery/gallery-candidate-types';

export type JejuPhotoGalleryWritePayload = {
  poiId: number;
  contentId: string;
  contentTypeId: number;
  title: string | null;
  photo_gallery_detail_json: Record<string, unknown>;
  photo_gallery_fetched_at: string;
  /** New photos that would be persisted (subset of merge). */
  selectedNewPhotos: JejuGalleryCandidate[];
};

export function buildJejuPhotoGalleryWritePayload(args: {
  poiId: number;
  contentId: string;
  contentTypeId: number;
  title: string | null;
  mergedGallery: Record<string, unknown>;
  selectedNewPhotos: JejuGalleryCandidate[];
  fetchedAtIso?: string;
}): JejuPhotoGalleryWritePayload {
  return {
    poiId: args.poiId,
    contentId: args.contentId,
    contentTypeId: args.contentTypeId,
    title: args.title,
    photo_gallery_detail_json: args.mergedGallery,
    photo_gallery_fetched_at: args.fetchedAtIso ?? new Date().toISOString(),
    selectedNewPhotos: args.selectedNewPhotos,
  };
}
