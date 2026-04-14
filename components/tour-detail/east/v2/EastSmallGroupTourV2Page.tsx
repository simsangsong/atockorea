'use client';

import { useCallback, useMemo, useState } from 'react';
import { Geist, Playfair_Display } from 'next/font/google';
import './east-v2-detail-scope.css';
import {
  EastV2LayoutIntegrationProvider,
  type EastV2LayoutIntegration,
} from './EastV2LayoutIntegrationContext';
import V0EastTourDetailBody from './V0EastTourDetailBody';
import type { TourDetailViewModel } from '@/src/types/tours';
import type { SmallGroupDetailContent } from '@/components/tour/small-group/smallGroupDetailContent';
import { useI18n, useTranslations } from '@/lib/i18n';
import { buildV0EastCoreProductView } from '@/lib/tour-detail/east/adapters/to-v0-core-product-view';
import { buildV0EastSupportProductSlice } from '@/lib/tour-detail/east/adapters/v0-support-product-slice';
import { buildV0EastStickyLiveExtras } from '@/lib/tour-detail/east/adapters/v0-sticky-live-extras';
import { useEastDetailWeatherPresentation } from '@/hooks/tour-detail/east/useEastDetailWeatherPresentation';
import { useEastStickyPricePresentation } from '@/hooks/tour-detail/east/useEastStickyPricePresentation';
import SmallGroupMobileBookingSheet from '@/components/tour/small-group/SmallGroupMobileBookingSheet';
import {
  toEnhancedBookingSidebarTourInput,
  tourCheckoutRelativePath,
} from '@/lib/tour-detail/east/services/booking-rail';
import type { BookingPanelSummary } from '@/components/tour/EnhancedBookingSidebar';
import type { JoinTourAvailabilityData } from '@/lib/tour-detail/join-tour/types';
import { parseDetailPageV2 } from '@/lib/tour-detail/v2/detail-page-v2';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-v0',
  weight: ['400', '500', '600', '700'],
});

export type EastSmallGroupTourV2PageProps = Partial<EastV2LayoutIntegration> & {
  /** When all three are set (live East route), v0 sections show real product data. */
  tour?: TourDetailViewModel | null;
  content?: SmallGroupDetailContent | null;
  formatPrice?: (n: number) => string;
};

type AvailSlice = {
  checkingAvailability: boolean;
  availabilityError: string | null;
  availability: JoinTourAvailabilityData | null;
  gateError: string | null;
};

const INITIAL_AVAIL: AvailSlice = {
  checkingAvailability: false,
  availabilityError: null,
  availability: null,
  gateError: null,
};

/**
 * East small-group tour detail (v0 visual layer).
 * Wrap with site `Header` / `Footer` from the route; v0 `SiteHeader` is not rendered here.
 * Optional layout props tune scroll/spy offsets when extra chrome (e.g. preview banner) sits under the header.
 */
export default function EastSmallGroupTourV2Page({
  tour,
  content,
  formatPrice,
  stickySubnavTopClass,
  scrollToSectionOffsetPx,
  scrollSpyViewportOffsetPx,
}: EastSmallGroupTourV2PageProps) {
  const { locale } = useI18n();
  const t = useTranslations();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bookingSummary, setBookingSummary] = useState<BookingPanelSummary | null>(null);
  const [availSlice, setAvailSlice] = useState<AvailSlice>(INITIAL_AVAIL);

  const stickyPresentation = useEastStickyPricePresentation(tour ?? null, bookingSummary);

  const weatherPres = useEastDetailWeatherPresentation(
    { slug: tour?.slug, city: tour?.city ?? '' },
    locale
  );

  const templateShell = useMemo(
    () => parseDetailPageV2(tour?.detailPageV2 ?? null).templateShell ?? null,
    [tour?.detailPageV2]
  );

  const coreProduct = useMemo(() => {
    if (!tour || !content || !formatPrice) return null;
    const base = buildV0EastCoreProductView({
      tour,
      content,
      locale,
      sticky: stickyPresentation,
      formatPrice,
      labels: {
        stickyFrom: t('tour.stickyPriceFrom'),
        bookNow: t('tour.bookNow'),
        perPerson: t('tour.perPersonShort'),
        perGroup: t('tour.perGroupShort'),
      },
    });
    const support = buildV0EastSupportProductSlice(content);
    const stickyLive = buildV0EastStickyLiveExtras({
      bookingSummary,
      checkingAvailability: availSlice.checkingAvailability,
      availabilityError: availSlice.availabilityError,
      availability: availSlice.availability,
      gateError: availSlice.gateError,
      sheetOpen,
      t,
    });
    return {
      ...base,
      ...support,
      hero: {
        ...base.hero,
        reviewsLine:
          tour.reviewCount != null && tour.reviewCount > 0
            ? `(${tour.reviewCount} ${t('tour.reviews')})`
            : null,
      },
      weatherLatitude: weatherPres.latitude,
      weatherLongitude: weatherPres.longitude,
      weatherAreaLabel: weatherPres.forecastAreaLabel,
      stickyLive,
    };
  }, [
    tour,
    content,
    formatPrice,
    locale,
    stickyPresentation,
    bookingSummary,
    availSlice,
    sheetOpen,
    t,
    weatherPres.latitude,
    weatherPres.longitude,
    weatherPres.forecastAreaLabel,
  ]);

  const handleBookingSummaryChange = useCallback((summary: BookingPanelSummary) => {
    setBookingSummary(summary);
  }, []);

  const handleBookingAvailabilitySync = useCallback(
    (state: {
      checkingAvailability: boolean;
      availabilityError: string | null;
      availability: JoinTourAvailabilityData | null;
      gateError: string | null;
    }) => {
      setAvailSlice(state);
    },
    []
  );

  const openBookingSheet = useCallback(() => setSheetOpen(true), []);

  const liveBookingEnabled = Boolean(tour && formatPrice);
  const mobileSheetTour = useMemo(() => {
    if (!tour) return null;
    return {
      ...toEnhancedBookingSidebarTourInput(tour),
      pickupPoints: tour.pickupPoints ?? [],
    };
  }, [
    tour?.id,
    tour?.title,
    tour?.price,
    tour?.originalPrice,
    tour?.priceType,
    tour?.pickupPoints,
    tour?.recentBookings24h,
  ]);

  return (
    <EastV2LayoutIntegrationProvider
      stickySubnavTopClass={stickySubnavTopClass}
      scrollToSectionOffsetPx={scrollToSectionOffsetPx}
      scrollSpyViewportOffsetPx={scrollSpyViewportOffsetPx}
    >
      <div
        className={`${geistSans.variable} ${playfair.variable} east-v2-detail-root relative z-0 min-h-screen bg-background antialiased`}
      >
        <V0EastTourDetailBody
          product={coreProduct}
          templateShell={templateShell}
          onStickyBookClick={liveBookingEnabled ? openBookingSheet : undefined}
        />
        {liveBookingEnabled && tour && mobileSheetTour ? (
          <SmallGroupMobileBookingSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            tour={mobileSheetTour}
            checkoutPath={tourCheckoutRelativePath(tour.id)}
            onBookingSummaryChange={handleBookingSummaryChange}
            onBookingAvailabilitySync={handleBookingAvailabilitySync}
          />
        ) : null}
      </div>
    </EastV2LayoutIntegrationProvider>
  );
}
