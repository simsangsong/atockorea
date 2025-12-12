'use client';

import { useRef, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
import ReviewList from '@/components/reviews/ReviewList';
import ReviewForm from '@/components/reviews/ReviewForm';
import PaymentMethodsBanner from '@/components/PaymentMethodsBanner';

// Sample tour data (fallback)
const sampleTourData = {
  id: 1,
  title: 'Jeju: Eastern Jeju UNESCO Spots Day Tour',
  tagline: 'Explore UNESCO sites and experience history, culture, and the nature of the Eastern and Northern parts of Jeju Island. Learn about the island\'s legendary Haenyeo and discover Micheongul Cave.',
  location: 'Jeju',
  rating: 4.9,
  reviewCount: 991,
  badges: ['Top rated'],
  price: 46,
  originalPrice: 0,
  priceType: 'person' as const,
  availableSpots: 12,
  duration: '10 hours',
  difficulty: 'Easy',
  groupSize: 'Max 12',
  highlight: 'UNESCO World Heritage Sites',
  images: [
    {
      url: 'https://images.unsplash.com/photo-1504817343863-5092a923803e?w=1200&q=80',
      title: 'Hamdeok Beach',
      description: 'One of Jeju\'s top three beaches, famous for its dazzling ocean colors. In spring, rapeseed flowers bloom beautifully along the coast.',
    },
    {
      url: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=1200&q=80',
      title: 'Seongsan Ilchulbong',
      description: 'A UNESCO World Natural Heritage Site, this iconic volcanic tuff cone offers spectacular views and is a beloved landmark of Jeju Island.',
    },
    {
      url: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1200&q=80',
      title: 'Haenyeo Museum',
      description: 'Learn about Jeju\'s legendary "Haenyeo"—female divers who collect seafood from the ocean floor. Their culture is recognized by UNESCO as an Intangible Cultural Heritage.',
    },
    {
      url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80',
      title: 'Michiangul Cave at Ilchul Land',
      description: 'Explore a fascinating lava tube system, a rare geological treasure. This cave system showcases the volcanic history of Jeju Island.',
    },
    {
      url: 'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=1200&q=80',
      title: 'Seongeup Folk Village',
      description: 'Step back in time and discover the history and culture of Jeju Island. This preserved traditional village offers insights into the island\'s unique heritage.',
    },
  ],
  quickFacts: [
    'Free cancellation up to 24 hours in advance for a full refund',
    'Reserve now & pay later - Keep your travel plans flexible',
    'All admission fees included in one booking',
    'Professional English-speaking guide included',
    '4 convenient pickup locations across Jeju City',
  ],
  itinerary: [
    { time: '08:30', title: 'Pickup - Ocean Suites Jeju Hotel', description: 'Pickup from Ocean Suites Jeju Hotel', icon: '🚗' },
    { time: '08:45', title: 'Pickup - Jeju International Airport', description: 'Jeju Airport 3rd Floor, Gate 3 (Domestic Departures)', icon: '✈️' },
    { time: '08:55', title: 'Pickup - LOTTE City Hotel Jeju', description: 'LOTTE City Hotel Jeju', icon: '🏨' },
    { time: '09:05', title: 'Pickup - Shilla Duty-Free Jeju Store', description: 'Shilla Duty-Free Jeju Store', icon: '🛍️' },
    { time: '10:25', title: 'Hamdeok Beach', description: 'Break time, Photo stop, Guided tour, Free time, Sightseeing, Walk, Scenic views (1 hour)', icon: '🏖️' },
    { time: '11:45', title: 'Haenyeo Museum', description: 'Photo stop, Visit, Guided tour, Sightseeing, Arts & crafts market visit (50 minutes)', icon: '🏛️' },
    { time: '13:00', title: 'Local Restaurant', description: 'Lunch (1 hour) Extra fee', icon: '🍜' },
    { time: '14:30', title: 'Seongsan Ilchulbong', description: 'Photo stop, Visit, Guided tour, Free time, Sightseeing, Walk (1 hour)', icon: '🌋' },
    { time: '15:45', title: 'Ilchul Land (Michiangul Cave)', description: 'Photo stop, Guided tour, Free time, Sightseeing, Walk (1 hour)', icon: '🕳️' },
    { time: '17:00', title: 'Seongeup Folk Village', description: 'Photo stop, Visit, Guided tour, Free time, Sightseeing, Class (1 hour)', icon: '🏘️' },
    { time: '18:30', title: 'Dongmun Traditional Market (Optional)', description: 'Hop-on Hop-off stop (5 minutes) Optional', icon: '🛒' },
    { time: '18:35', title: 'Drop-off', description: 'Return to pickup locations or Jeju Dongmun Traditional Market', icon: '🏁' },
  ],
  inclusions: [
    'Admission to all admission fees',
    'English-speaking professional guide',
    'A vehicle (Van or Bus) & Driver',
    'Toll fees',
    'Parking fees',
    'Fuel fees',
    'No Shopping',
  ],
  exclusions: [
    'Lunch (food) Fees',
    'Personal expenses',
    'Tips or additional fees',
    'Personal travel insurance',
  ],
  pickupPoints: [
    { id: 1, name: 'Ocean Suites Jeju Hotel', address: 'Ocean Suites Jeju Hotel, Jeju', lat: 33.4996, lng: 126.5312 },
    { id: 2, name: 'Jeju International Airport', address: 'Jeju Airport 3rd Floor, Gate 3 (Domestic Departures)', lat: 33.5113, lng: 126.4928 },
    { id: 3, name: 'LOTTE City Hotel Jeju', address: 'LOTTE City Hotel Jeju, Jeju', lat: 33.5113, lng: 126.4928 },
    { id: 4, name: 'Shilla Duty-Free Jeju Store', address: 'Shilla Duty-Free Jeju Store, Jeju', lat: 33.4996, lng: 126.5312 },
  ],
};

export default function TourDetailPage() {
  const params = useParams();
  const tourId = params?.id;
  const bookingRef = useRef<HTMLDivElement>(null);
  
  const [tour, setTour] = useState<any>(sampleTourData);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userBookingId, setUserBookingId] = useState<string | null>(null);

  // Fetch tour data and reviews
  useEffect(() => {
    if (tourId) {
      fetchTourData();
      fetchReviews();
      checkUserBooking();
    }
  }, [tourId]);

  const fetchTourData = async () => {
    try {
      const response = await fetch(`/api/tours/${tourId}`);
      if (response.ok) {
        const data = await response.json();
        setTour(data.tour);
      }
    } catch (error) {
      console.error('Error fetching tour:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await fetch(`/api/reviews?tourId=${tourId}`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const checkUserBooking = async () => {
    try {
      const response = await fetch(`/api/bookings?tourId=${tourId}&status=completed`);
      if (response.ok) {
        const data = await response.json();
        if (data.bookings && data.bookings.length > 0) {
          const reviewedResponse = await fetch(`/api/reviews?tourId=${tourId}`);
          if (reviewedResponse.ok) {
            const reviewedData = await reviewedResponse.json();
            const userReviewed = reviewedData.reviews?.some((r: any) => r.userId === data.bookings[0].user_id);
            if (!userReviewed) {
              setUserBookingId(data.bookings[0].id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking user booking:', error);
    }
  };

  const handleReviewSubmit = async (reviewData: {
    rating: number;
    title: string;
    comment: string;
    photos: string[];
    isAnonymous: boolean;
  }) => {
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tourId,
          bookingId: userBookingId,
          ...reviewData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit review');
      }

      const data = await response.json();
      setReviews([data.review, ...reviews]);
      setShowReviewForm(false);
      alert('评价提交成功！');
      
      // Refresh tour data to update rating
      fetchTourData();
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('提交失败，请重试');
    }
  };

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

        {/* Title and Tagline Section - Refined Typography */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <div className="max-w-4xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-gray-900 mb-3 leading-snug tracking-normal">
              {tour.title}
            </h1>
            <p className="text-base sm:text-lg text-gray-600 font-normal leading-relaxed">
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

          {/* Payment Methods */}
          <PaymentMethodsBanner variant="card" />

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
                  {tour.inclusions.map((item: string, index: number) => (
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
                  {tour.exclusions.map((item: string, index: number) => (
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
