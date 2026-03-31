"use client"

import { useState } from "react"
import { StickyHeader } from "./sticky-header"
import { HeroSection } from "./hero-section"
import { QuickFacts } from "./quick-facts"
import { HighlightsSection } from "./highlights-section"
import { GallerySection } from "./gallery-section"
import { ItinerarySection } from "./itinerary-section"
import { RouteLogicSection } from "./route-logic-section"
import { TourSnapshot } from "./tour-snapshot"
import { MeetingSection } from "./meeting-section"
import { InclusionsSection } from "./inclusions-section"
import { TrustSection } from "./trust-section"
import { FAQSection } from "./faq-section"
import { BookingCard } from "./booking-card"

export function TourDetailPage() {
  const [bookingExpanded, setBookingExpanded] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header - Appears on scroll */}
      <StickyHeader />

      {/* Hero */}
      <HeroSection />

      {/* Quick Facts Strip */}
      <QuickFacts />

      {/* Main Content Area */}
      <div className="lg:grid lg:grid-cols-[1fr,400px] lg:gap-10 lg:px-8 xl:px-12 lg:py-8">
        {/* Left Column - Content */}
        <main className="lg:max-w-none">
          {/* Why This Tour */}
          <HighlightsSection />
          
          {/* Gallery */}
          <GallerySection />
          
          {/* Itinerary */}
          <ItinerarySection />
          
          {/* Route Logic - Why this order */}
          <RouteLogicSection />
          
          {/* At a Glance */}
          <TourSnapshot />
          
          {/* Meeting & Pickup */}
          <MeetingSection />
          
          {/* Inclusions */}
          <InclusionsSection />
          
          {/* Trust & Reviews */}
          <TrustSection />
          
          {/* FAQ */}
          <FAQSection />

          {/* Bottom spacer for mobile sticky bar */}
          <div className="h-28 lg:hidden" />
        </main>

        {/* Right Column - Booking Card (Desktop) */}
        <aside className="hidden lg:block">
          <BookingCard />
        </aside>
      </div>

      {/* Mobile Booking Bar */}
      <div className="lg:hidden">
        <BookingCard 
          isMobile 
          isExpanded={bookingExpanded}
          onToggle={() => setBookingExpanded(!bookingExpanded)}
        />
      </div>
    </div>
  )
}
