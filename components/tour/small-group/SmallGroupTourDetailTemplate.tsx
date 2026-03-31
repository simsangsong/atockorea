'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState, type RefObject } from 'react';
import { useI18n, useTranslations } from '@/lib/i18n';
import { TourWeatherSection } from '@/components/tour-detail-template';
import { WEATHER_ANCHOR_EAST_SEONGSAN, resolveTourWeatherAnchor } from '@/lib/weather/tour-weather-anchor';
import type { TourDetailViewModel } from '@/src/types/tours';
import type { SmallGroupDetailContent } from './smallGroupDetailContent';
import { resolveEditorialPresentation } from './smallGroupDetailContent';
import SmallGroupHeroSection from './sections/SmallGroupHeroSection';
import SmallGroupQuickSnapshotSection from './sections/SmallGroupQuickSnapshotSection';
import SmallGroupWhyRouteWorksSection from './sections/SmallGroupWhyRouteWorksSection';
import SmallGroupSeasonalSection from './sections/SmallGroupSeasonalSection';
import SmallGroupPracticalInfoSection from './sections/SmallGroupPracticalInfoSection';
import SmallGroupBookWithConfidenceSection from './sections/SmallGroupBookWithConfidenceSection';
import SmallGroupFaqSection from './sections/SmallGroupFaqSection';
import SmallGroupRelatedToursSection from './sections/SmallGroupRelatedToursSection';
import SmallGroupCollapsibleItinerarySection from './sections/SmallGroupCollapsibleItinerarySection';
import type { BookingPanelSummary } from '@/components/tour/EnhancedBookingSidebar';
import { useCurrencyOptional } from '@/lib/currency';
import SmallGroupMobileBookingSheet from './SmallGroupMobileBookingSheet';
import { isEastSignatureNatureCoreTour } from './products/eastSignatureNatureCore';
import './small-group-premium.css';

const EnhancedBookingSidebar = dynamic(
  () => import('@/components/tour/EnhancedBookingSidebar'),
  {
    loading: () => (
      <div
        className="animate-pulse sg-dp-glass-elevated rounded-[length:var(--sg-hero-radius)] h-[22rem] bg-white/50 border border-white/60"
        aria-hidden
      />
    ),
    ssr: false,
  }
);

export interface SmallGroupTourDetailTemplateProps {
  tour: TourDetailViewModel;
  content: SmallGroupDetailContent;
  bookingRef: RefObject<HTMLDivElement | null>;
  onDateSelect: (date: Date | null) => void;
  formatPrice: (amount: number) => string;
}

/**
 * Small-group (join) tour detail — Detailpage (v0) editorial layout + live booking rail.
 */
export default function SmallGroupTourDetailTemplate({
  tour,
  content,
  bookingRef,
  onDateSelect,
  formatPrice,
}: SmallGroupTourDetailTemplateProps) {
  const t = useTranslations();
  const { locale } = useI18n();
  const currencyCtx = useCurrencyOptional();
  const ed = useMemo(() => resolveEditorialPresentation(content), [content]);
  const [bookingSummary, setBookingSummary] = useState<BookingPanelSummary | null>(null);
  const [mobileBookingOpen, setMobileBookingOpen] = useState(false);

  const handleBookingSummaryChange = useCallback((summary: BookingPanelSummary) => {
    setBookingSummary(summary);
  }, []);

  const sidebarTour = {
    id: tour.id,
    title: tour.title,
    price: tour.price,
    originalPrice: tour.originalPrice,
    priceType: tour.priceType,
    pickupPoints: tour.pickupPoints,
    recentBookings24h: tour.recentBookings24h ?? null,
  };

  const perUnitSuffix =
    tour.priceType === 'person' ? t('tour.perPersonShort') : t('tour.perGroupShort');

  /** Listed unit in KRW (DB); when a date is chosen, sidebar passes availability-aware unit. */
  const listedUnitKrw = tour.price;
  const stickyUnitKrw = bookingSummary?.unitPriceKRW ?? listedUnitKrw;

  const FALLBACK_KRW_PER_USD = 1350;
  /** East Jeju SKU: marketing anchor is USD 58 — KRW line comes from live rate × 58, not DB KRW. */
  const EAST_SIGNATURE_ANCHOR_USD = 58;
  const isEastUsdAnchor = isEastSignatureNatureCoreTour(tour);

  const stickyKrwFromEastAnchor = Math.round(
    currencyCtx
      ? currencyCtx.convertToKRW(EAST_SIGNATURE_ANCHOR_USD)
      : EAST_SIGNATURE_ANCHOR_USD * FALLBACK_KRW_PER_USD
  );
  const stickyEastKrwFormatted = `₩${stickyKrwFromEastAnchor.toLocaleString('ko-KR')}`;

  const stickyUsdFromDbKrw = Math.round(
    currencyCtx ? currencyCtx.convertToUSD(stickyUnitKrw) : stickyUnitKrw / FALLBACK_KRW_PER_USD
  );

  const currencyIsKrw = currencyCtx?.currency === 'KRW';

  const eyebrow =
    ed.heroEyebrow?.trim() ||
    content.hero.badges[0]?.label ||
    '';

  const chrome = content.templateSectionChrome;
  const checkoutPath = `/tour/${encodeURIComponent(String(tour.id))}/checkout`;

  const resolvedWeather = useMemo(() => {
    const a = resolveTourWeatherAnchor({ slug: tour.slug, city: tour.city });
    return {
      latitude: a.latitude,
      longitude: a.longitude,
      areaLabel: a.areaLabel,
    };
  }, [tour.slug, tour.city]);

  const weatherForecastAreaLabel = useMemo(() => {
    if (locale === 'ko') {
      const { latitude, longitude } = resolvedWeather;
      const nearEastSeongsan =
        Math.abs(latitude - WEATHER_ANCHOR_EAST_SEONGSAN.latitude) < 0.02 &&
        Math.abs(longitude - WEATHER_ANCHOR_EAST_SEONGSAN.longitude) < 0.02;
      if (nearEastSeongsan) return '제주 동쪽 날씨';
    }
    return resolvedWeather.areaLabel;
  }, [locale, resolvedWeather]);

  return (
    <div className="tour-detail-premium sg-dp-theme min-h-screen min-w-0 max-w-full overflow-x-hidden">
      <main className="min-h-screen min-w-0">
        <div className="min-w-0 lg:mx-auto lg:grid lg:max-w-[1400px] lg:grid-cols-[1fr_400px] lg:gap-10">
          <div className="min-w-0">
            <div className="sg-dp-product-intro-system sg-dp-major-selling-intro">
              <div className="sg-reveal">
                <SmallGroupHeroSection
                  hero={content.hero}
                  tourTitle={tour.title}
                  eyebrow={eyebrow}
                  stopCount={content.routeStops.length}
                  difficulty={tour.difficulty}
                  pickupAreaLabel={tour.pickup?.areaLabel}
                  rating={tour.rating}
                  reviewCount={tour.reviewCount}
                />
              </div>

              <SmallGroupCollapsibleItinerarySection
                stops={content.routeStops}
                metaLabels={content.routeStopMetaLabels}
                sectionTitle={chrome?.routeTimelineTitle}
                sectionSubtitle={chrome?.routeTimelineSubtitle}
                sectionCardHint={chrome?.routeTimelineCardHint}
              />
              <SmallGroupQuickSnapshotSection cards={ed.atAGlance} sectionClassName="sg-dp-glance--product-intro" />
            </div>
            <div className="sg-dp-mid-scroll-rhythm">
              <div className="sg-dp-narrative-chapter-major">
                <SmallGroupWhyRouteWorksSection
                  ideal={ed.bestForIdeal}
                  notIdeal={ed.bestForNotIdeal}
                  reasons={ed.flowReasons}
                  adjustments={ed.flowAdjustments}
                  whyOrderBody={content.whyOrderWorks}
                  supplementalBody={content.whyOrderWorks}
                />
              </div>
              <div className="sg-dp-narrative-cluster-conditions">
                <div className="sg-dp-cluster-weather-slot sg-dp-cluster-weather-slot--paced sg-dp-page-gutter bg-transparent py-2 font-sans antialiased md:py-2.5">
                  <div className="sg-dp-page-column">
                    <TourWeatherSection
                      className="px-0 pb-0"
                      appearance="premium"
                      areaLabel={weatherForecastAreaLabel}
                      latitude={resolvedWeather.latitude}
                      longitude={resolvedWeather.longitude}
                    />
                  </div>
                </div>
                <SmallGroupSeasonalSection
                  tabs={ed.seasonalTabs}
                  sectionSubtitle={chrome?.seasonalSubtitle}
                />
              </div>
              <SmallGroupPracticalInfoSection
                blocks={content.practicalBlocks}
                practicalIntro={content.practicalIntro}
                sectionSubtitle={chrome?.practicalSubtitle}
              />
              <SmallGroupBookWithConfidenceSection
                points={ed.trustPoints}
                reviews={ed.trustReviews}
                aggregateRating={tour.rating != null && !Number.isNaN(Number(tour.rating)) ? tour.rating : null}
                reviewCount={tour.reviewCount != null && tour.reviewCount > 0 ? tour.reviewCount : null}
                leadSubtitle={chrome?.trustSubtitle}
                afterSteps={ed.afterSteps}
                afterSubtitle={chrome?.afterBookSubtitle}
              />
              <SmallGroupFaqSection
                items={content.faqs}
                sectionSubtitle={chrome?.faqSubtitle}
                emptyStateMessage={chrome?.faqEmptyState}
              />
            </div>
          </div>

          <aside
            ref={bookingRef}
            id="small-group-booking"
            className="hidden lg:block lg:pt-[calc(65vh-10rem)] lg:pr-8"
            aria-label="Booking"
          >
            <div className="sticky top-8">
              <div className="sg-dp-glass-elevated sg-dp-booking-rail-inner rounded-[length:var(--sg-hero-radius)] p-6 lg:p-7">
                <EnhancedBookingSidebar
                  tour={sidebarTour}
                  onDateSelect={onDateSelect}
                  onBookingSummaryChange={handleBookingSummaryChange}
                  bookingShell="smallGroup"
                />
              </div>
            </div>
          </aside>
        </div>

        <SmallGroupRelatedToursSection cards={content.relatedTours} formatPrice={formatPrice} />
      </main>

      <SmallGroupMobileBookingSheet
        open={mobileBookingOpen}
        onOpenChange={setMobileBookingOpen}
        tour={{
          id: tour.id,
          title: tour.title,
          price: tour.price,
          originalPrice: tour.originalPrice,
          priceType: tour.priceType,
          pickupPoints: tour.pickupPoints ?? [],
        }}
        checkoutPath={checkoutPath}
        onDateSelect={onDateSelect}
      />

      {/* Mobile sticky booking — above BottomNav (h-16); bar matches page surface + card tokens */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-[60]">
        <div className="sg-dp-sticky-bar">
          <div className="sg-dp-sticky-bar-inner sg-dp-page-gutter">
            <div className="flex min-w-0 items-end justify-between gap-2.5 sm:gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
                <>
                  {isEastUsdAnchor ? (
                    currencyIsKrw ? (
                      <p
                        className="m-0 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5"
                        aria-label={`${t('tour.stickyPriceFrom')} ${stickyEastKrwFormatted} ${perUnitSuffix.trim()}`}
                      >
                        <span className="sg-dp-sticky-label w-full sm:w-auto">{t('tour.stickyPriceFrom')}</span>
                        <span className="min-w-0 tabular-nums text-[var(--dp-fg)]">
                          <span className="sg-dp-sticky-price">{stickyEastKrwFormatted}</span>
                          <span className="sg-dp-sticky-meta font-medium"> {perUnitSuffix}</span>
                        </span>
                      </p>
                    ) : (
                      <p
                        className="m-0 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5"
                        aria-label={`${t('tour.stickyPriceFrom')} $${EAST_SIGNATURE_ANCHOR_USD} USD ${perUnitSuffix.trim()}`}
                      >
                        <span className="sg-dp-sticky-label w-full sm:w-auto">{t('tour.stickyPriceFrom')}</span>
                        <span className="min-w-0 tabular-nums text-[var(--dp-fg)]">
                          <span className="sg-dp-sticky-price">
                            ${EAST_SIGNATURE_ANCHOR_USD.toLocaleString('en-US')}
                          </span>
                          <span className="sg-dp-sticky-meta font-medium"> {perUnitSuffix}</span>
                        </span>
                      </p>
                    )
                  ) : currencyIsKrw ? (
                    <p
                      className="m-0 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5"
                      aria-label={`${t('tour.stickyPriceFrom')} ${formatPrice(stickyUnitKrw)} ${perUnitSuffix.trim()}`}
                    >
                      <span className="sg-dp-sticky-label w-full sm:w-auto">{t('tour.stickyPriceFrom')}</span>
                      <span className="min-w-0 tabular-nums text-[var(--dp-fg)]">
                        <span className="sg-dp-sticky-price">{formatPrice(stickyUnitKrw)}</span>
                        <span className="sg-dp-sticky-meta font-medium"> {perUnitSuffix}</span>
                      </span>
                    </p>
                  ) : (
                    <p
                      className="m-0 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5"
                      aria-label={`${t('tour.stickyPriceFrom')} $${stickyUsdFromDbKrw} ${perUnitSuffix.trim()}`}
                    >
                      <span className="sg-dp-sticky-label w-full sm:w-auto">{t('tour.stickyPriceFrom')}</span>
                      <span className="min-w-0 tabular-nums text-[var(--dp-fg)]">
                        <span className="sg-dp-sticky-price">${stickyUsdFromDbKrw.toLocaleString('en-US')}</span>
                        <span className="sg-dp-sticky-meta font-medium"> {perUnitSuffix}</span>
                      </span>
                    </p>
                  )}
                </>
                {bookingSummary?.hasDate && bookingSummary.totalFormatted ? (
                  <div className="sg-dp-sticky-total-row">
                    <p className="sg-dp-sticky-total m-0 tabular-nums">
                      {bookingSummary.priceType === 'person' ? (
                        <>
                          Total for {bookingSummary.guestCount}{' '}
                          {bookingSummary.guestCount === 1 ? 'guest' : 'guests'} · {bookingSummary.totalFormatted}
                        </>
                      ) : (
                        <>Total · {bookingSummary.totalFormatted}</>
                      )}
                    </p>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setMobileBookingOpen(true)}
                className="sg-dp-sticky-cta shrink-0 touch-manipulation text-[13px] font-semibold tracking-wide text-white focus:outline-none"
              >
                {t('tour.bookNow')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer: sticky bar + BottomNav + safe area */}
      <div
        className="h-[min(22vh,8.75rem)] shrink-0 lg:hidden pb-[env(safe-area-inset-bottom,0px)]"
        aria-hidden
      />
    </div>
  );
}
