import type { SmallGroupRouteStop } from '@/components/tour/small-group/smallGroupDetailContent';
import type { V0EastItineraryStopModel } from './v0-ui-types';

const PLACEHOLDER = '—';

function isPlaceholder(s: string | undefined): boolean {
  const t = (s ?? '').trim();
  return !t || t === PLACEHOLDER;
}

function timeFromStop(stop: SmallGroupRouteStop): string {
  const dt = stop.displayTime?.trim();
  if (dt) return dt;
  const desc = stop.description?.trim() ?? '';
  const m = desc.match(/^([^—\-]+)\s*[—\-]\s*/);
  return m?.[1]?.trim() || '';
}

function stripTimePrefix(description: string): string {
  const d = description.trim();
  return d.replace(/^([^—\-]+)\s*[—\-]\s*/, '').trim() || d;
}

/**
 * Best-effort map from premium small-group route stops to v0 itinerary stop shape (rich card).
 * Empty strings where legacy used placeholders — v0 can keep hiding optional rows.
 */
export function legacyRouteStopsToV0EastItineraryStops(stops: SmallGroupRouteStop[]): V0EastItineraryStopModel[] {
  return stops.map((stop, index) => {
    const description = stop.description?.trim() || PLACEHOLDER;
    const mainDescription = stripTimePrefix(description) || stop.cardSummary?.trim() || description;

    const highlights = stop.detailLayer?.highlights?.length
      ? stop.detailLayer.highlights
      : !isPlaceholder(stop.whyIncluded)
        ? [stop.whyIncluded]
        : [];

    const timeUsed = stop.detailLayer?.experienceFlow?.length ? stop.detailLayer.experienceFlow : [];

    const pd = stop.detailLayer?.practicalDetails;

    return {
      number: index + 1,
      time: timeFromStop(stop) || PLACEHOLDER,
      duration: !isPlaceholder(stop.stayDuration) ? stop.stayDuration.trim() : PLACEHOLDER,
      name: stop.title.trim() || PLACEHOLDER,
      category:
        stop.highlightLabel?.trim() ||
        stop.tags?.find((x) => x.trim())?.trim() ||
        PLACEHOLDER,
      description: mainDescription,
      image: stop.imageUrl?.trim() || '',
      highlights,
      whyOnRoute: stop.detailLayer?.routeReason?.trim() || stop.whyIncluded?.trim() || PLACEHOLDER,
      timeUsed,
      visitBasics: {
        hours: pd?.officialHours?.trim() || PLACEHOLDER,
        closed: pd?.holiday?.trim() || PLACEHOLDER,
        admission: pd?.fee?.trim() || PLACEHOLDER,
        walking: !isPlaceholder(stop.walkingLevel) ? stop.walkingLevel.trim() : PLACEHOLDER,
      },
      convenience: {
        restroom: pd?.restroom?.trim() || stop.restroom?.trim() || PLACEHOLDER,
        parking: pd?.parking?.trim() || PLACEHOLDER,
      },
      smartNotes: {
        photo: stop.photoTip?.trim() || stop.detailLayer?.photoDetails?.trim() || PLACEHOLDER,
        facilities: stop.detailLayer?.facilityDetails?.trim() || PLACEHOLDER,
        tip: stop.detailLayer?.smartTip?.trim() || PLACEHOLDER,
      },
    };
  });
}
