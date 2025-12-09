'use client';

import { useRef } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import HeroImage from '@/components/tour/HeroImage';
import KeyInfoBar from '@/components/tour/KeyInfoBar';
import QuickFacts from '@/components/tour/QuickFacts';
import GalleryGrid from '@/components/tour/GalleryGrid';
import VisualItinerary from '@/components/tour/VisualItinerary';
import MeetingPoint from '@/components/tour/MeetingPoint';
import ActionButtons from '@/components/tour/ActionButtons';
import EnhancedBookingSidebar from '@/components/tour/EnhancedBookingSidebar';

// Sample tour data (in production, fetch from API)
const tourData = {
  id: 1,
  title: 'Gamcheon Culture Village + Haeundae',
  tagline: 'Explore colorful art district and relax at Korea\'s most famous beach',
  location: 'Busan',
  rating: 4.8,
  reviewCount: 234,
  badges: ['Popular', 'Small-group'],
  price: 79,
  originalPrice: 99,
  priceType: 'person' as const,
  availableSpots: 5,
  duration: '8 hours',
  difficulty: 'Easy',
  groupSize: 'Max 12',
  highlight: 'Waterfall Visit',
  images: [
    {
      url: 'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=1200&q=80',
      title: 'Gamcheon Culture Village',
      description: 'Explore the colorful art district known as "Korea\'s Santorini". This hillside village features vibrant murals, art galleries, and charming cafes. Walk through narrow alleys decorated with colorful houses and discover local art installations.',
    },
    {
      url: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=1200&q=80',
      title: 'Haeundae Beach',
      description: 'Relax at Korea\'s most famous beach. Enjoy the pristine white sand, crystal-clear waters, and various water activities. The beach is perfect for swimming, sunbathing, or simply taking a leisurely stroll along the shore.',
    },
    {
      url: 'https://images.unsplash.com/photo-1504817343863-5092a923803e?w=1200&q=80',
      title: 'Dongbaek Island',
      description: 'Take a scenic walk along the coastal path on Dongbaek Island. This beautiful natural area offers stunning ocean views, lush greenery, and the famous Nurimaru APEC House. Perfect for photography and peaceful contemplation.',
    },
    {
      url: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1200&q=80',
      title: 'Traditional Korean Lunch',
      description: 'Experience authentic Korean cuisine at a local restaurant. Enjoy a variety of traditional dishes including kimchi, bulgogi, and fresh seafood. Our carefully selected restaurants offer the best local flavors.',
    },
    {
      url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80',
      title: 'Busan City Views',
      description: 'Capture panoramic views of Busan from various scenic spots. The city\'s unique blend of mountains, sea, and urban landscape creates breathtaking vistas that showcase the beauty of Korea\'s second-largest city.',
    },
  ],
  quickFacts: [
    'Small group tour with maximum 12 participants',
    'Professional English-speaking guide included',
    'Hotel pickup and drop-off service',
    'Traditional Korean lunch included',
  ],
  itinerary: [
    { time: '09:00', title: 'Hotel Pickup', description: 'Pickup from your hotel in Busan', icon: '🚗' },
    { time: '09:30', title: 'Gamcheon Culture Village', description: 'Explore the colorful village, visit art galleries and cafes', icon: '🏯' },
    { time: '12:00', title: 'Lunch Break', description: 'Enjoy local Korean cuisine', icon: '🍜' },
    { time: '13:30', title: 'Haeundae Beach', description: 'Relax at the beach, enjoy water activities', icon: '🏖️' },
    { time: '16:00', title: 'Dongbaek Island', description: 'Scenic walk along the coastal path', icon: '🌊' },
    { time: '17:30', title: 'Return to Hotel', description: 'Drop-off at your hotel', icon: '🏨' },
  ],
  inclusions: [
    'Hotel pickup and drop-off',
    'Professional English-speaking guide',
    'Entrance fees to all attractions',
    'Lunch included',
    'Transportation in air-conditioned vehicle',
  ],
  exclusions: [
    'Personal expenses',
    'Optional activities',
    'Tips for guide and driver',
  ],
  pickupPoints: [
    { id: 1, name: 'Busan Station', address: 'Busan Station, Busan', lat: 35.1156, lng: 129.0422 },
    { id: 2, name: 'Haeundae Station', address: 'Haeundae Station, Busan', lat: 35.1631, lng: 129.1636 },
    { id: 3, name: 'Seomyeon Station', address: 'Seomyeon Station, Busan', lat: 35.1581, lng: 129.0594 },
    { id: 4, name: 'Gwangalli Beach', address: 'Gwangalli Beach, Busan', lat: 35.1532, lng: 129.1186 },
  ],
};

export default function TourDetailPage() {
  const params = useParams();
  const tourId = params?.id;
  const bookingRef = useRef<HTMLDivElement>(null);

  // In production, fetch tour data based on tourId
  // For now, use sample data
  const tour = tourData;

  // Debug: Log tourId to console
  if (typeof window !== 'undefined') {
    console.log('Tour ID:', tourId);
  }

  const keyInfoItems = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'Duration',
      value: tour.duration,
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'Difficulty',
      value: tour.difficulty,
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      label: 'Group Size',
      value: tour.groupSize,
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      label: 'Highlight',
      value: tour.highlight,
    },
  ];

  const handleCheckAvailability = () => {
    bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: tour.title,
        text: tour.tagline,
        url: window.location.href,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <Header />
      <main className="pb-32 md:pb-0">
        {/* 1. Hero Image */}
        <HeroImage images={tour.images} />

        {/* Title and Tagline Section - Modern Typography */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <div className="max-w-4xl">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold bg-gradient-to-r from-gray-900 via-indigo-800 to-gray-900 bg-clip-text text-transparent mb-4 leading-tight tracking-tight">
              {tour.title}
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-600 font-medium leading-relaxed">
              {tour.tagline}
            </p>
          </div>
        </section>

        {/* 2. Key Info Bar */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <KeyInfoBar items={keyInfoItems} />
        </section>

        {/* Main Content - Single Column Layout */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-8">
          {/* 3. Quick Facts */}
          <QuickFacts facts={tour.quickFacts} />

          {/* 4. Gallery Grid */}
          <GalleryGrid images={tour.images} />

          {/* Desktop: Booking Sidebar (hidden on mobile) */}
          <div className="hidden lg:block lg:absolute lg:right-8 lg:top-[60vh] lg:w-96">
            <div className="lg:sticky lg:top-20">
              <EnhancedBookingSidebar tour={tour} />
            </div>
          </div>

          {/* 5. Itinerary */}
          <VisualItinerary items={tour.itinerary} />

          {/* 6. Inclusions/Exclusions */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">What's Included</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-green-600 text-2xl">✓</span>
                  Included
                </h3>
                <ul className="space-y-3">
                  {tour.inclusions.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-red-600 text-2xl">✗</span>
                  Not Included
                </h3>
                <ul className="space-y-3">
                  {tour.exclusions.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 7. Meeting Point */}
          <MeetingPoint points={tour.pickupPoints} />

          {/* Mobile: Booking Section (scroll target) */}
          <div ref={bookingRef} className="lg:hidden">
            <EnhancedBookingSidebar tour={tour} />
          </div>
        </div>

        {/* Action Buttons - Fixed on mobile, normal on desktop */}
        <ActionButtons
          onCheckAvailability={handleCheckAvailability}
          onShare={handleShare}
        />
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}
