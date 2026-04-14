import type { TourDetailViewModel } from '@/src/types/tours';
import type { SmallGroupDetailContent } from '@/components/tour/small-group/smallGroupDetailContent';
import { resolveEditorialPresentation } from '@/components/tour/small-group/smallGroupDetailContent';
import type { EastStickyPricePresentation } from '@/hooks/tour-detail/east/useEastStickyPricePresentation';
import { legacyRouteStopsToV0EastItineraryStops } from '@/lib/tour-detail/east/adapters/legacy-to-v0-itinerary';
import type { V0EastItineraryStopModel } from '@/lib/tour-detail/east/adapters/v0-ui-types';
import type { V0EastStickyLiveExtras } from '@/lib/tour-detail/east/adapters/v0-sticky-live-extras';
import type {
  V0BookingTrustCard,
  V0FaqQuestion,
  V0PracticalAccordionItem,
  V0SeasonalVariationCard,
  V0SupportTimelineStep,
} from '@/lib/tour-detail/east/adapters/v0-support-product-slice';

/** v0 itinerary section stop shape (mirrors `itinerary-section.tsx`). */
export type V0CoreItineraryStop = V0EastItineraryStopModel;

export type V0CoreGalleryItem = {
  id: number;
  type: 'photo' | 'video';
  src: string;
  location: string;
  atmosphere: string;
  alt: string;
};

export type V0CoreDecisionCell = {
  label: string;
  value: string;
  tier: 'primary' | 'secondary';
};

export type V0CoreStickyBarStrings = {
  fromLabel: string;
  amount: string;
  currency: string;
  unitSuffix: string;
  ctaLabel: string;
};

export type V0EastCoreProductView = {
  hero: {
    titleLine1: string;
    titleLine2: string;
    subtitle: string;
    backgroundImageUrl: string;
    pill1: string;
    pill2: string;
    durationLabel: string;
    regionLabel: string;
    stopCountLabel: string;
    ratingNumeric: string;
    fullStars: number;
    reviewsLine?: string | null;
  };
  decisionCells: V0CoreDecisionCell[];
  galleryItems: V0CoreGalleryItem[];
  itineraryStops: V0CoreItineraryStop[];
  stickyBar: V0CoreStickyBarStrings;
  /** Filled by route shell (East v2) — availability / totals under the primary price row */
  stickyLive?: V0EastStickyLiveExtras | null;
  pickupPreview: string;
  importantNotice: string;
  guidedLanguageLine: string;
  /** Live support layer — same sources as `SmallGroupDetailContent` when merged in East v2 */
  practicalAccordionItems?: V0PracticalAccordionItem[] | null;
  practicalSectionSubtitle?: string | null;
  seasonalVariations?: V0SeasonalVariationCard[] | null;
  faqMain?: V0FaqQuestion[] | null;
  faqMore?: V0FaqQuestion[] | null;
  faqSectionSubtitle?: string | null;
  faqEmptyMessage?: string | null;
  trustCards?: V0BookingTrustCard[] | null;
  supportTimelineSteps?: V0SupportTimelineStep[] | null;
  contactHref?: string | null;
  weatherLatitude?: number | null;
  weatherLongitude?: number | null;
  weatherAreaLabel?: string | null;
};

function snapshotValue(content: SmallGroupDetailContent, id: string): string {
  return content.quickSnapshot.find((r) => r.id === id)?.value?.trim() ?? '';
}

function firstSentence(text: string, maxLen: number): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const cut = s.split(/(?<=[.!?])\s+/)[0]?.trim() ?? s;
  if (cut.length <= maxLen) return cut;
  return `${s.slice(0, maxLen - 1).trim()}…`;
}

function pickupSummaryFromContent(content: SmallGroupDetailContent, tour: TourDetailViewModel): string {
  const area = (tour.pickup?.areaLabel ?? '').trim();
  if (area) return area;
  const body = content.practicalBlocks.find((b) => b.id === 'pickupDrop')?.body?.trim() ?? '';
  if (!body) return '';
  return firstSentence(body, 120);
}

function importantNoticeFromTour(tour: TourDetailViewModel): string {
  const h = (tour.highlight ?? '').trim();
  if (h) return firstSentence(h, 220);
  const hi = tour.highlights?.map((x) => String(x).trim()).find(Boolean);
  if (hi) return firstSentence(hi, 220);
  const c = (tour.cancellationPolicy ?? '').trim();
  if (c) return firstSentence(c, 220);
  return '';
}

function guidedLanguageLineForLocale(locale: string): string {
  const map: Record<string, string> = {
    en: 'Guided in English',
    ko: 'Guided in Korean',
    zh: 'Guided in Chinese',
    'zh-TW': 'Guided in Chinese (Traditional)',
    ja: 'Guided in Japanese',
    es: 'Guided in Spanish',
  };
  return map[locale] ?? 'Guided in English';
}

function buildGalleryItems(
  tour: TourDetailViewModel,
  content: SmallGroupDetailContent
): V0CoreGalleryItem[] {
  const urls = content.hero.galleryImageUrls.filter((u) => u.trim().length > 0);
  if (urls.length === 0) return [];
  const stops = content.routeStops;
  return urls.map((src, i) => {
    const stop = stops[i];
    const location = stop?.title?.trim() || `Stop ${i + 1}`;
    const atmosphere =
      stop?.highlightLabel?.trim() || stop?.cardSummary?.trim() || tour.title;
    return {
      id: i + 1,
      type: 'photo' as const,
      src,
      location,
      atmosphere: atmosphere.slice(0, 80),
      alt: `${tour.title} — ${location}`,
    };
  });
}

function buildDecisionCells(content: SmallGroupDetailContent): V0CoreDecisionCell[] {
  const photo = snapshotValue(content, 'photoValue');
  const scenic = snapshotValue(content, 'scenicIntensity');
  const walk = snapshotValue(content, 'walkingLevel');
  const rain = snapshotValue(content, 'rainSafety');
  const family = snapshotValue(content, 'familyFit');
  const balance = snapshotValue(content, 'outdoorIndoorBalance');

  const cells: V0CoreDecisionCell[] = [
    { label: 'Photo Value', value: photo || 'High', tier: 'primary' },
    { label: 'Scenic', value: scenic || 'High', tier: 'primary' },
    { label: 'Walking', value: walk || 'Moderate', tier: 'secondary' },
    { label: 'Rain Safety', value: rain || 'Medium', tier: 'secondary' },
    { label: 'Family Fit', value: family || 'Good', tier: 'secondary' },
    { label: 'Balance', value: balance || 'Mixed', tier: 'secondary' },
  ];
  return cells;
}

function heroRatingStars(rating: number): number {
  return Math.min(5, Math.floor(rating) + (rating % 1 >= 0.5 ? 1 : 0));
}

function stripWonPrefix(formatted: string | undefined | null): string {
  return String(formatted ?? '').replace(/^\s*₩\s*/, '').trim();
}

function buildStickyBarStrings(
  tour: TourDetailViewModel,
  sticky: EastStickyPricePresentation,
  formatPrice: (n: number) => string,
  labels: { stickyFrom: string; bookNow: string; perPerson: string; perGroup: string }
): V0CoreStickyBarStrings {
  const unit = ` / ${tour.priceType === 'person' ? labels.perPerson : labels.perGroup}`;
  if (sticky.isEastUsdAnchor) {
    if (sticky.currencyIsKrw) {
      return {
        fromLabel: labels.stickyFrom,
        amount: stripWonPrefix(sticky.stickyEastKrwFormatted),
        currency: 'KRW',
        unitSuffix: unit,
        ctaLabel: labels.bookNow,
      };
    }
    return {
      fromLabel: labels.stickyFrom,
      amount: String(sticky.eastAnchorUsd),
      currency: 'USD',
      unitSuffix: unit,
      ctaLabel: labels.bookNow,
    };
  }
  if (sticky.currencyIsKrw) {
    return {
      fromLabel: labels.stickyFrom,
      amount: stripWonPrefix(formatPrice(sticky.stickyUnitKrw)),
      currency: 'KRW',
      unitSuffix: unit,
      ctaLabel: labels.bookNow,
    };
  }
  return {
    fromLabel: labels.stickyFrom,
    amount: String(sticky.stickyUsdFromDbKrw),
    currency: 'USD',
    unitSuffix: unit,
    ctaLabel: labels.bookNow,
  };
}

/**
 * Maps live tour + small-group content into v0-oriented core product view (display only).
 */
export function buildV0EastCoreProductView(input: {
  tour: TourDetailViewModel;
  content: SmallGroupDetailContent;
  locale: string;
  sticky: EastStickyPricePresentation;
  formatPrice: (n: number) => string;
  labels: {
    stickyFrom: string;
    bookNow: string;
    perPerson: string;
    perGroup: string;
  };
}): V0EastCoreProductView {
  const { tour, content, locale, sticky, formatPrice, labels } = input;
  const ed = resolveEditorialPresentation(content);

  /** v0 hero: fixed concise two-line title + tagline (do not replace with long CMS tour title/subtitle). */
  const titleLine1 = 'East Signature';
  const titleLine2 = 'Nature Core';
  const subtitle = 'Geology to coast. Cave to village to sea.';

  const bg =
    content.hero.galleryImageUrls.find((u) => u.trim().length > 0)?.trim() ||
    'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1920&q=80';

  const badges = content.hero.badges.map((b) => b.label.trim()).filter(Boolean);
  const pill1 = badges[0] || ed.heroEyebrow?.trim() || 'First-Time Friendly';
  const pill2 = (tour.city || '').trim() || 'East Jeju';

  const durationLabel =
    snapshotValue(content, 'duration') ||
    content.hero.summaryFacts.find((f) => f.id === 'duration')?.value ||
    tour.duration ||
    '8 hrs';

  const regionLabel =
    (tour.pickup?.areaLabel ?? '').trim() || tour.city?.trim() || 'East Jeju';

  const nStops = content.routeStops.length;
  const stopCountLabel = nStops > 0 ? `${nStops} stops` : '6 stops';

  const ratingNum = tour.rating != null && !Number.isNaN(Number(tour.rating)) ? Number(tour.rating) : 4.8;
  const ratingNumeric = ratingNum.toFixed(1);
  const fullStars = heroRatingStars(ratingNum);

  const galleryItems = buildGalleryItems(tour, content);
  const itineraryStops = legacyRouteStopsToV0EastItineraryStops(content.routeStops);
  const decisionCells = buildDecisionCells(content);

  return {
    hero: {
      titleLine1,
      titleLine2,
      subtitle,
      backgroundImageUrl: bg,
      pill1,
      pill2,
      durationLabel,
      regionLabel,
      stopCountLabel,
      ratingNumeric,
      fullStars,
    },
    decisionCells,
    galleryItems,
    itineraryStops,
    stickyBar: buildStickyBarStrings(tour, sticky, formatPrice, labels),
    pickupPreview: pickupSummaryFromContent(content, tour),
    importantNotice: importantNoticeFromTour(tour),
    guidedLanguageLine: guidedLanguageLineForLocale(locale),
  };
}
