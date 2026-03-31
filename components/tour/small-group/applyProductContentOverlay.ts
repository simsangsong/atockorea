import type { TourDetailViewModel } from '@/src/types/tours';
import type { SmallGroupDetailContent } from './smallGroupDetailContent';
import { mergeEastSignatureNatureCoreContent } from './products/eastSignatureNatureCore';

/**
 * Injects curated product copy when `tour` matches a known small-group SKU.
 * Unknown tours keep the generic `buildSmallGroupDetailContent` output.
 */
export function applySmallGroupProductOverlay(
  tour: TourDetailViewModel,
  base: SmallGroupDetailContent
): SmallGroupDetailContent {
  const east = mergeEastSignatureNatureCoreContent(tour, base);
  if (east) return east;
  return base;
}
