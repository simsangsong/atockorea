import type { TourDetailViewModel } from '@/src/types/tours';
import { shouldCoerceEastSignatureNatureCoreJoin } from '@/src/lib/east-signature-nature-core-match';

/**
 * Whether this tour should use East Signature small-group detail behavior (slug/title/URL coercion).
 * Matches `isEastSignatureNatureCoreTour` in `products/eastSignatureNatureCore.ts`.
 */
export function isEastSignatureNatureCoreDetailTour(
  tour: Pick<TourDetailViewModel, 'slug' | 'title'>,
  routeTourId?: string | null
): boolean {
  return shouldCoerceEastSignatureNatureCoreJoin(routeTourId ?? undefined, tour.slug, tour.title);
}
