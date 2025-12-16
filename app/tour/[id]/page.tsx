'use client';

import { useRef, useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
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
import CollapsibleSection from '@/components/tour/CollapsibleSection';
import { useTranslations } from '@/lib/i18n';

// Lazy load heavy components
const EnhancedBookingSidebar = dynamic(
  () => import('@/components/tour/EnhancedBookingSidebar'),
  { 
    loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-96" />,
    ssr: false 
  }
);

const InteractiveMap = dynamic(
  () => import('@/components/maps/InteractiveMap'),
  { 
    loading: () => <div className="animate-pulse bg-gray-200 rounded-lg h-96" />,
    ssr: false 
  }
);

interface Tour {
  id: string;
  title: string;
  tagline: string;
  location: string;
  city: string;
  rating: number;
  reviewCount: number;
  badges: string[];
  price: number;
  originalPrice: number | null;
  priceType: 'person' | 'group';
  availableSpots: number;
  depositAmountUSD: number;
  balanceAmountKRW: number;
  duration: string;
  difficulty: string;
  groupSize: string;
  highlight: string;
  images: Array<{ url: string; title: string; description: string }>;
  quickFacts: string[];
  itinerary: Array<{ time: string; title: string; description: string; icon?: string }>;
  inclusions: Array<string | { icon: string; text: string }>;
  exclusions: Array<string | { icon: string; text: string }>;
  pickupPoints: Array<{ id: string; name: string; address: string; lat: number; lng: number }>;
  overview?: string;
}

export default function TourDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const tourId = params?.id as string;
  const bookingRef = useRef<HTMLDivElement>(null);
  
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tourId) {
      setError('Tour ID is required');
      setLoading(false);
      return;
    }

    const fetchTour = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tours/${tourId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Tour not found');
          } else {
            const data = await response.json();
            setError(data.error || 'Failed to fetch tour');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        
        // Transform API data to match component expectations
        const transformedTour: Tour = {
          ...data.tour,
          // Ensure default values for missing data
          quickFacts: data.tour.quickFacts || [
            data.tour.groupSize ? `Group size: ${data.tour.groupSize}` : '',
            data.tour.difficulty ? `Difficulty: ${data.tour.difficulty}` : '',
            data.tour.duration ? `Duration: ${data.tour.duration}` : '',
          ].filter(Boolean),
          itinerary: data.tour.itinerary || [],
          inclusions: data.tour.inclusions || [],
          exclusions: data.tour.exclusions || [],
          pickupPoints: data.tour.pickupPoints || [],
        };

        setTour(transformedTour);
      } catch (err: any) {
        console.error('Error fetching tour:', err);
        setError('Failed to load tour. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTour();
  }, [tourId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading tour...</p>
            </div>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <p className="text-red-600 text-lg mb-4">{error || t('tour.tourNotFound')}</p>
              <button
                onClick={() => router.push('/tours')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('tour.backToTours')}
              </button>
            </div>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  const keyInfoItems = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: t('tour.duration'),
      value: tour.duration,
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: t('tour.difficulty'),
      value: tour.difficulty,
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      label: t('tour.groupSize'),
      value: tour.groupSize,
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      label: t('tour.highlight'),
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
      <Header />
      <main className="pb-20 md:pb-0">
        {/* 1. Hero Image */}
        <HeroImage images={tour.images} />

        {/* Title Section - Modern Typography */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <div className="max-w-4xl">
            <h1 className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-bold text-gray-800 mb-3 leading-tight tracking-normal">
              {tour.title}
            </h1>
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

          {/* 5. Description (collapsible) */}
          {tour.overview && (
            <CollapsibleSection title="Description">
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {tour.overview}
              </div>
            </CollapsibleSection>
          )}

          {/* 6. Itinerary (collapsible) */}
          <CollapsibleSection title="Itinerary">
            <VisualItinerary items={tour.itinerary} pickupPoints={tour.pickupPoints} />
          </CollapsibleSection>

          {/* 7. What's Included (collapsible) */}
          {(tour.inclusions.length > 0 || tour.exclusions.length > 0) && (
            <CollapsibleSection title="What's Included">
              <div className="grid md:grid-cols-2 gap-8">
                {tour.inclusions.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-green-600 text-2xl">✓</span>
                      Included
                    </h3>
                    <ul className="space-y-3">
                      {tour.inclusions.map((item, index) => {
                        const text = typeof item === 'string' ? item : item.text || '';
                        return (
                          <li key={index} className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-gray-700">{text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {tour.exclusions.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-red-600 text-2xl">✗</span>
                      Not Included
                    </h3>
                    <ul className="space-y-3">
                      {tour.exclusions.map((item, index) => {
                        const text = typeof item === 'string' ? item : item.text || '';
                        return (
                          <li key={index} className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span className="text-gray-700">{text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* 7. Meeting Point */}
          <MeetingPoint points={tour.pickupPoints} />

          {/* Mobile: Booking Section (scroll target) */}
          <div ref={bookingRef} className="lg:hidden">
            <EnhancedBookingSidebar tour={tour} />
          </div>
        </div>

        {/* Action Buttons - Fixed on mobile, normal on desktop */}
        <ActionButtons
          tourId={tour.id}
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
