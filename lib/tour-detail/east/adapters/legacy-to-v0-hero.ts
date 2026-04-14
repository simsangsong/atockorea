import type { TourDetailViewModel } from '@/src/types/tours';
import type { SmallGroupDetailContent, SmallGroupResolvedEditorial } from '@/components/tour/small-group/smallGroupDetailContent';
import type { V0EastHeroAdapterModel } from './v0-ui-types';

function firstSnapshotValue(content: SmallGroupDetailContent, id: string): string | undefined {
  const v = content.quickSnapshot.find((r) => r.id === id)?.value?.trim();
  return v || undefined;
}

/**
 * Maps legacy small-group / East editorial content into v0 hero props (no JSX).
 */
export function legacySmallGroupToV0EastHero(
  tour: TourDetailViewModel,
  content: SmallGroupDetailContent,
  ed: SmallGroupResolvedEditorial
): V0EastHeroAdapterModel {
  const gallery = content.hero.galleryImageUrls;
  const backgroundImageUrl = gallery[0]?.trim() || '';

  const eyebrow = ed.heroEyebrow?.trim() || content.hero.badges[0]?.label?.trim() || '';
  const badgePills = content.hero.badges
    .map((b) => b.label.trim())
    .filter(Boolean)
    .slice(0, 2);

  const durationLabel =
    firstSnapshotValue(content, 'duration') || tour.duration?.trim() || content.hero.summaryFacts.find((f) => f.id === 'duration')?.value;

  const regionLabel =
    (tour.pickup?.areaLabel ?? '').trim() || tour.city?.trim() || undefined;

  return {
    backgroundImageUrl,
    title: (tour.title || content.hero.title).trim(),
    subtitle: (content.hero.subtitle || content.hero.positioningLine || '').trim(),
    regionPill: regionLabel || eyebrow || 'East Jeju',
    badgePills,
    meta: {
      durationLabel: durationLabel?.trim() || undefined,
      regionLabel,
      stopCount: content.routeStops.length > 0 ? content.routeStops.length : undefined,
      rating: tour.rating != null && !Number.isNaN(Number(tour.rating)) ? Number(tour.rating) : undefined,
      reviewCount: tour.reviewCount != null && tour.reviewCount > 0 ? tour.reviewCount : undefined,
    },
  };
}
