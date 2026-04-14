'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState, type RefObject } from 'react';
import { useI18n, useTranslations } from '@/lib/i18n';
import type { TourDetailViewModel } from '@/src/types/tours';
import type { SmallGroupDetailContent } from './smallGroupDetailContent';
import { resolveEditorialPresentation } from './smallGroupDetailContent';
import { buildHeroDecisionStripFacts } from './heroDecisionStripFacts';
import SmallGroupHeroSection from './sections/SmallGroupHeroSection';
import SmallGroupQuickSnapshotSection from './sections/SmallGroupQuickSnapshotSection';
import SmallGroupStickySectionNav from './sections/SmallGroupStickySectionNav';
import SmallGroupRouteFlowStripSection from './sections/SmallGroupRouteFlowStripSection';
import SmallGroupWhyTourWorksMergedSection from './sections/SmallGroupWhyTourWorksMergedSection';
import SmallGroupTourConditionsSupport from './sections/SmallGroupTourConditionsSupport';
import SmallGroupPracticalInfoSection from './sections/SmallGroupPracticalInfoSection';
import SmallGroupBookWithConfidenceSection from './sections/SmallGroupBookWithConfidenceSection';
import SmallGroupFaqSection from './sections/SmallGroupFaqSection';
import SmallGroupRelatedToursSection from './sections/SmallGroupRelatedToursSection';
import SmallGroupCollapsibleItinerarySection from './sections/SmallGroupCollapsibleItinerarySection';
import type { BookingPanelSummary } from '@/components/tour/EnhancedBookingSidebar';
import SmallGroupMobileBookingSheet from './SmallGroupMobileBookingSheet';
import { useEastDetailWeatherPresentation } from '@/hooks/tour-detail/east/useEastDetailWeatherPresentation';
import { useEastStickyPricePresentation } from '@/hooks/tour-detail/east/useEastStickyPricePresentation';
import {
  toEnhancedBookingSidebarTourInput,
  tourCheckoutRelativePath,
} from '@/lib/tour-detail/east/services/booking-rail';
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
 * Legacy East / small-group detail (pre–v2 shell).
 * Legacy small-group shell; East Signature on `/tour/[id]` now uses `EastSmallGroupTourV2Page` (kept for reference / reuse).
 */
export default function SmallGroupTourDetailTemplateLegacy({
  tour,
  content,
  bookingRef,
  onDateSelect,
  formatPrice,
}: SmallGroupTourDetailTemplateProps) {
  const t = useTranslations();
  const { locale } = useI18n();
  const ed = useMemo(() => resolveEditorialPresentation(content), [content]);
  const [bookingSummary, setBookingSummary] = useState<BookingPanelSummary | null>(null);
  const [mobileBookingOpen, setMobileBookingOpen] = useState(false);

  const handleBookingSummaryChange = useCallback((summary: BookingPanelSummary) => {
    setBookingSummary(summary);
  }, []);

  const sidebarTour = toEnhancedBookingSidebarTourInput(tour);

  const perUnitSuffix =
    tour.priceType === 'person' ? t('tour.perPersonShort') : t('tour.perGroupShort');

  const { stickyUnitUsd } = useEastStickyPricePresentation(tour, bookingSummary);

  const eyebrow =
    ed.heroEyebrow?.trim() ||
    content.hero.badges[0]?.label ||
    '';

  const chrome = content.templateSectionChrome;
  const checkoutPath = tourCheckoutRelativePath(tour.id);

  const {
    latitude: weatherLatitude,
    longitude: weatherLongitude,
    forecastAreaLabel: weatherForecastAreaLabel,
  } = useEastDetailWeatherPresentation(tour, locale);

  const heroDecisionStripFacts = useMemo(
    () => buildHeroDecisionStripFacts(content, ed, tour),
    [content, ed, tour],
  );

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
                  decisionStripFacts={heroDecisionStripFacts}
                />
              </div>
            </div>

            <SmallGroupStickySectionNav />

            <div className="sg-dp-mid-scroll-rhythm">
              <SmallGroupQuickSnapshotSection cards={ed.atAGlance} sectionClassName="sg-dp-glance--product-intro" />

              <section id="sg-itinerary" className="scroll-mt-[var(--sg-sticky-clear)]">
                <SmallGroupCollapsibleItinerarySection
                  stops={content.routeStops}
                  metaLabels={content.routeStopMetaLabels}
                  sectionTitle={chrome?.routeTimelineTitle}
                  sectionSubtitle={chrome?.routeTimelineSubtitle}
                  sectionCardHint={chrome?.routeTimelineCardHint}
                />
              </section>

              <SmallGroupRouteFlowStripSection
                stops={content.routeStops}
                eyebrow={chrome?.routeFlowStripEyebrow}
                title={chrome?.routeFlowStripTitle}
                lead={chrome?.routeFlowStripLead}
              />

              <SmallGroupWhyTourWorksMergedSection
                ideal={ed.bestForIdeal}
                notIdeal={ed.bestForNotIdeal}
                reasons={ed.flowReasons}
                adjustments={ed.flowAdjustments}
                whyOrderBody={content.whyOrderWorks}
                supplementalBody={content.whyOrderWorks}
                familyFitSummary={content.quickSnapshot.find((r) => r.id === 'familyFit')?.value}
                seniorFitSummary={content.quickSnapshot.find((r) => r.id === 'seniorFit')?.value}
              />

              <SmallGroupTourConditionsSupport
                weatherAreaLabel={weatherForecastAreaLabel}
                weatherLatitude={weatherLatitude}
                weatherLongitude={weatherLongitude}
                seasonalTabs={ed.seasonalTabs}
                seasonalSubtitle={chrome?.seasonalSubtitle}
              />

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
                <p
                  className="m-0 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5"
                  aria-label={`${t('tour.stickyPriceFrom')} ${formatPrice(stickyUnitUsd)} ${perUnitSuffix.trim()}`}
                >
                  <span className="sg-dp-sticky-label w-full sm:w-auto">{t('tour.stickyPriceFrom')}</span>
                  <span className="min-w-0 tabular-nums text-[var(--dp-fg)]">
                    <span className="sg-dp-sticky-price">{formatPrice(stickyUnitUsd)}</span>
                    <span className="sg-dp-sticky-meta font-medium"> {perUnitSuffix}</span>
                  </span>
                </p>
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
