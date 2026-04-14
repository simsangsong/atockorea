'use client';

/**
 * v0 East detail body only: same section tree as v0 `app/page.tsx` but **without** `SiteHeader`.
 * v0 has no separate footer component. Sticky booking bar is included at the bottom.
 */
import type { V0EastCoreProductView } from '@/lib/tour-detail/east/adapters/to-v0-core-product-view';
import type { V2TemplateShell } from '@/lib/tour-detail/v2/detail-page-v2';
import { HeroSection } from './source/components/tour/hero-section';
import { StickySubnav } from './source/components/tour/sticky-subnav';
import { DecisionSummary } from './source/components/tour/decision-summary';
import { RouteGallery } from './source/components/tour/route-gallery';
import { ItinerarySection } from './source/components/tour/itinerary-section';
import { RouteShape } from './source/components/tour/route-shape';
import { ExperienceSection } from './source/components/tour/experience-section';
import { PracticalDetails } from './source/components/tour/practical-details';
import { BookingSupport } from './source/components/tour/booking-support';
import { QuestionsSection } from './source/components/tour/questions-section';
import { RecommendationsSection } from './source/components/tour/recommendations-section';
import { StickyBookingBar } from './source/components/tour/sticky-booking-bar';

export default function V0EastTourDetailBody({
  product,
  templateShell,
  onStickyBookClick,
}: {
  product?: V0EastCoreProductView | null;
  /** From `tours.detail_page_v2.templateShell` — optional CMS-driven v0 strips. */
  templateShell?: V2TemplateShell | null;
  /** Opens booking sheet / panel (join tour detail). */
  onStickyBookClick?: () => void;
}) {
  return (
    <>
      <main>
        <HeroSection product={product?.hero ?? null} />
        <StickySubnav />

        <section id="overview" className="bg-warm-ivory">
          <div className="mx-auto max-w-xl px-5 py-10">
            <DecisionSummary cells={product?.decisionCells ?? null} />
          </div>
        </section>

        <section className="bg-soft-pearl">
          <div className="mx-auto max-w-xl px-5 py-12">
            <RouteGallery items={product?.galleryItems ?? null} />
          </div>
        </section>

        <section id="itinerary" className="bg-mist-blue">
          <div className="mx-auto max-w-xl px-5 py-12">
            <ItinerarySection stops={product?.itineraryStops ?? null} />
          </div>
        </section>

        <section className="bg-cloud-gray">
          <div className="mx-auto max-w-xl px-5 py-12">
            <RouteShape data={templateShell?.routeShape ?? null} />
          </div>
        </section>

        <section id="details" className="bg-sand-blush">
          <div className="mx-auto max-w-xl px-5 py-12">
            <ExperienceSection data={templateShell?.experience ?? null} />
          </div>
        </section>

        <section className="bg-soft-pearl">
          <div className="mx-auto max-w-xl px-5 py-12">
            <PracticalDetails
              pickupPreview={product?.pickupPreview ?? null}
              importantNotice={product?.importantNotice ?? null}
              guidedLanguageLine={product?.guidedLanguageLine ?? null}
              practicalAccordionItems={product?.practicalAccordionItems ?? null}
              practicalSectionSubtitle={product?.practicalSectionSubtitle ?? null}
              seasonalVariations={product?.seasonalVariations ?? null}
              weatherLatitude={product?.weatherLatitude ?? null}
              weatherLongitude={product?.weatherLongitude ?? null}
              weatherAreaLabel={product?.weatherAreaLabel ?? null}
            />
          </div>
        </section>

        <section className="bg-mist-blue">
          <div className="mx-auto max-w-xl px-5 py-12">
            <BookingSupport
              trustCards={product?.trustCards ?? null}
              supportTimelineSteps={product?.supportTimelineSteps ?? null}
            />
          </div>
        </section>

        <section id="faq" className="bg-warm-ivory">
          <div className="mx-auto max-w-xl px-5 py-12">
            <QuestionsSection
              faqMain={product?.faqMain ?? null}
              faqMore={product?.faqMore ?? null}
              sectionSubtitle={product?.faqSectionSubtitle ?? null}
              emptyMessage={product?.faqEmptyMessage ?? null}
              contactHref={product?.contactHref ?? null}
            />
          </div>
        </section>

        <section className="overflow-hidden bg-sand-blush">
          <div className="py-14">
            <RecommendationsSection data={templateShell?.recommendations ?? null} />
          </div>
        </section>
      </main>

      <StickyBookingBar
        sticky={product?.stickyBar ?? null}
        stickyLive={product?.stickyLive ?? null}
        onBookClick={onStickyBookClick}
      />
    </>
  );
}
