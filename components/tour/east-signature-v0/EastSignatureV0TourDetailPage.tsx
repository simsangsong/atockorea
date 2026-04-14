'use client';

import { Geist, Playfair_Display } from 'next/font/google';
import './east-signature-v0-tour-detail.css';
import { HeroSection } from './hero-section';
import { StickySubnav } from './sticky-subnav';
import { DecisionSummary } from './decision-summary';
import { RouteGallery } from './route-gallery';
import { ItinerarySection } from './itinerary-section';
import { RouteShape } from './route-shape';
import { ExperienceSection } from './experience-section';
import { PracticalDetails } from './practical-details';
import { BookingSupport } from './booking-support';
import { QuestionsSection } from './questions-section';
import { RecommendationsSection } from './recommendations-section';
import { StickyBookingBar } from './sticky-booking-bar';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-v0',
  weight: ['400', '500', '600', '700'],
});

/**
 * v0 East detail main column + sticky booking bar.
 * Site chrome (Header/Footer) is provided by `app/tour/[id]/page.tsx`.
 * v0 `SiteHeader` is intentionally omitted per migration rules.
 */
export default function EastSignatureV0TourDetailPage() {
  return (
    <div
      className={`${geistSans.variable} ${playfair.variable} east-signature-v0-detail min-h-screen bg-background antialiased`}
    >
      <main>
        <HeroSection />
        <StickySubnav />

        <section id="overview" className="bg-warm-ivory">
          <div className="mx-auto max-w-xl px-5 py-10">
            <DecisionSummary />
          </div>
        </section>

        <section className="bg-soft-pearl">
          <div className="mx-auto max-w-xl px-5 py-12">
            <RouteGallery />
          </div>
        </section>

        <section id="itinerary" className="bg-mist-blue">
          <div className="mx-auto max-w-xl px-5 py-12">
            <ItinerarySection />
          </div>
        </section>

        <section className="bg-cloud-gray">
          <div className="mx-auto max-w-xl px-5 py-12">
            <RouteShape />
          </div>
        </section>

        <section id="details" className="bg-sand-blush">
          <div className="mx-auto max-w-xl px-5 py-12">
            <ExperienceSection />
          </div>
        </section>

        <section className="bg-soft-pearl">
          <div className="mx-auto max-w-xl px-5 py-12">
            <PracticalDetails />
          </div>
        </section>

        <section className="bg-mist-blue">
          <div className="mx-auto max-w-xl px-5 py-12">
            <BookingSupport />
          </div>
        </section>

        <section id="faq" className="bg-warm-ivory">
          <div className="mx-auto max-w-xl px-5 py-12">
            <QuestionsSection />
          </div>
        </section>

        <section className="overflow-hidden bg-sand-blush">
          <div className="py-14">
            <RecommendationsSection />
          </div>
        </section>
      </main>

      <StickyBookingBar />
    </div>
  );
}
