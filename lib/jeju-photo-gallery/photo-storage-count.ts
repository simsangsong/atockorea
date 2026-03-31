import { extractItineraryPhotoGalleryItems } from '@/lib/itinerary/photo-gallery-from-poi';
import { dedupeStoredGalleryItems } from '@/lib/jeju-photo-gallery/merge-gallery-selection';

export type PhotoGalleryCountRow = {
  photo_gallery_detail_json?: unknown;
};

/**
 * Counts unique valid http(s) gallery images stored in `photo_gallery_detail_json`
 * (itinerary extraction, then galContentId → imageUrl dedupe — aligned with merge policy).
 */
export function countStoredGalleryPhotos(row: PhotoGalleryCountRow): number {
  return dedupeStoredGalleryItems(extractItineraryPhotoGalleryItems(row)).length;
}

export function isPoiGalleryComplete(
  row: PhotoGalleryCountRow,
  targetPhotoCount: number,
): boolean {
  return countStoredGalleryPhotos(row) >= targetPhotoCount;
}

/**
 * Slots still needed to reach `targetPhotoCount` (never negative).
 */
export function computeMissingGallerySlots(
  row: PhotoGalleryCountRow,
  targetPhotoCount: number,
): number {
  const n = countStoredGalleryPhotos(row);
  return Math.max(0, targetPhotoCount - n);
}
