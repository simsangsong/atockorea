/**
 * Single source of truth for itinerary stop image display priority (UI + hydration).
 *
 * Order:
 * 1. **photoGallery** — full stored gallery from `photo_gallery_detail_json` (or persisted save); primary when non-empty.
 * 2. **image** — representative single URL from POI (`first_image` / `first_image2`), or first gallery frame when hydrating (`merge-poi-details`).
 * 3. **placeholder** — when neither yields a usable image.
 *
 * Do not treat `image` alone as proof of a multi-photo gallery; always prefer `photoGallery` when present.
 */

import type { GeneratedItineraryResponse } from './types';

export type ItineraryStop = GeneratedItineraryResponse['stops'][number];

export const ITINERARY_STOP_IMAGE_PRIORITY_ORDER = ['photoGallery', 'image', 'placeholder'] as const;

export function stopHasPrimaryGallery(
  stop: ItineraryStop,
): stop is ItineraryStop & { photoGallery: NonNullable<ItineraryStop['photoGallery']> } {
  return Array.isArray(stop.photoGallery) && stop.photoGallery.length > 0;
}

/** Representative URL for fallback layouts (legacy / no gallery array). */
export function stopRepresentativeImageUrl(stop: ItineraryStop): string | null {
  const u = stop.image?.trim();
  return u ? u : null;
}
