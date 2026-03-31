import type { TourDetailViewModel } from '@/src/types/tours';
import type { ItineraryDetail } from '@/types/tour';
import type { SmallGroupRouteStop } from './smallGroupDetailContent';

const PLACEHOLDER = '—';

function isPickupItem(
  title: string,
  description: string | undefined,
  pickupPoints: TourDetailViewModel['pickupPoints']
): boolean {
  const t = (title || '').trim();
  const tLower = t.toLowerCase();
  const d = (description || '').trim().toLowerCase();
  const pickupTitleEnKo =
    /^pickup\s*[-–—:]|픽업\s*[-–—:]?|pickup\s*point/i.test(tLower) ||
    pickupPoints?.some((p) => tLower.includes((p.name || '').toLowerCase()));
  const pickupTitleZh = /接送地點|接送地点|接機|接机|取貨地點|取货地点|接車|接车/i.test(t);
  const pickupDesc = /first\s*pickup|second\s*pickup|third\s*pickup|fourth\s*pickup|pickup\s*point/i.test(d);
  return pickupTitleEnKo || pickupTitleZh || pickupDesc;
}

/**
 * Maps tour itinerary to route stop cards. Extended stop fields are placeholders until CMS provides them.
 */
export function mapTourToRouteStopCards(tour: TourDetailViewModel): SmallGroupRouteStop[] {
  const raw: Array<{ time: string; title: string; description: string; images?: string[] }> =
    tour.itineraryDetails?.length && tour.itineraryDetails.length > 0
      ? tour.itineraryDetails.map((d: ItineraryDetail) => ({
          time: d.time,
          title: d.activity,
          description: d.description || '',
          images: d.images,
        }))
      : (tour.itinerary || []).map((i) => ({
          time: i.time || '',
          title: i.title || '',
          description: i.description || '',
          images: i.images,
        }));

  const destinationItems = raw.filter(
    (item) => !isPickupItem(item.title, item.description, tour.pickupPoints)
  );

  const gallery = (tour.images || [])
    .map((img) => (typeof img === 'string' ? img : img?.url))
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  return destinationItems.map((item, index) => ({
    id: `stop-${index}`,
    title: item.title || PLACEHOLDER,
    description: [item.time ? `${item.time} — ` : '', item.description || '']
      .join('')
      .trim() || PLACEHOLDER,
    whyIncluded: PLACEHOLDER,
    stayDuration: PLACEHOLDER,
    walkingLevel: PLACEHOLDER,
    photoTip: PLACEHOLDER,
    restroom: PLACEHOLDER,
    weatherNote: PLACEHOLDER,
    delayNote: PLACEHOLDER,
    imageUrl:
      item.images?.[0] ||
      (gallery.length > 0 ? gallery[index % gallery.length] : undefined),
  }));
}
