'use client';

import { useRef, useState, useEffect, Suspense, useMemo, useCallback } from 'react';
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
  keywords?: string[];
  images: Array<{ url: string; title: string; description: string }>;
  quickFacts: string[];
  itinerary: Array<{ time: string; title: string; description: string; icon?: string }>;
  inclusions: Array<string | { icon: string; text: string }>;
  exclusions: Array<string | { icon: string; text: string }>;
  pickupPoints: Array<{ id: string; name: string; address: string; lat: number; lng: number }>;
  overview?: string;
  highlights?: string[];
  faqs?: Array<{ question: string; answer: string }>;
}

export default function TourDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  
  // Memoize tourId to prevent unnecessary re-renders
  const tourId = useMemo(() => {
    const id = params?.id;
    return typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  }, [params?.id]);
  
  const bookingRef = useRef<HTMLDivElement>(null);
  
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevTourIdRef = useRef<string | null>(null);
  const fetchingRef = useRef(false); // Prevent concurrent fetches

  useEffect(() => {
    // Prevent duplicate fetches for the same tourId
    if (!tourId) {
      setError('Tour ID is required');
      setLoading(false);
      fetchingRef.current = false;
      prevTourIdRef.current = null;
      return;
    }
    
    // Reset previous tour when tourId changes
    if (prevTourIdRef.current !== tourId) {
      setTour(null);
      setError(null);
      prevTourIdRef.current = tourId;
    } else {
      // If same tourId and already fetching, don't fetch again
      if (fetchingRef.current) {
        return;
      }
    }
    
    fetchingRef.current = true;

    let isMounted = true; // Track if component is still mounted

    const fetchTour = async () => {
      try {
        setLoading(true);
        setError(null); // Clear previous errors
        const apiUrl = typeof window !== 'undefined' 
          ? `${window.location.origin}/api/tours/${encodeURIComponent(tourId)}`
          : `/api/tours/${encodeURIComponent(tourId)}`;
        
        const response = await fetch(apiUrl, {
          cache: 'no-store', // Prevent caching
        });
        
        if (!isMounted) {
          fetchingRef.current = false;
          return; // Don't update state if component unmounted
        }
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Tour not found');
          } else {
            try {
              const errorData = await response.json();
              setError(errorData.error || 'Failed to fetch tour');
            } catch {
              setError(`Failed to fetch tour (${response.status})`);
            }
          }
          setLoading(false);
          fetchingRef.current = false;
          return;
        }

        const data = await response.json();
        
        if (!isMounted) {
          fetchingRef.current = false;
          return; // Don't update state if component unmounted
        }
        
        if (!data.tour) {
          setError('Tour data not found in response');
          setLoading(false);
          fetchingRef.current = false;
          return;
        }
        
        // Helper function to remove recommended routes from any text field
        const removeRoutes = (text: string | null | undefined): string => {
          if (!text) return '';
          let cleaned = String(text);
          
          // Remove everything from "Recommended Routes" onwards
          const routePatterns = [
            /\*\*Recommended Routes?:\*\*[\s\S]*/i,
            /\*\*추천 루트:\*\*[\s\S]*/i,
            /Recommended Routes?:[\s\S]*/i,
            /추천 루트:[\s\S]*/i,
            /\*\*(East|West|South) Route:\*\*[\s\S]*/i,
            /\*\*동부 루트:[\s\S]*/i,
            /\*\*서부 루트:[\s\S]*/i,
            /\*\*남부 루트:[\s\S]*/i,
          ];
          
          for (const pattern of routePatterns) {
            const match = cleaned.search(pattern);
            if (match !== -1) {
              cleaned = cleaned.substring(0, match).trim();
              break;
            }
          }
          
          return cleaned;
        };
        
        // Transform gallery_images to images format
        const transformImages = (gallery: any[]): Array<{ url: string; title: string; description: string }> => {
          if (!gallery || gallery.length === 0) return [];
          return gallery.map((img, index) => {
            if (typeof img === 'string') {
              return { url: img, title: `Image ${index + 1}`, description: '' };
            }
            return {
              url: img.url || img,
              title: img.title || `Image ${index + 1}`,
              description: img.description || '',
            };
          });
        };

        // Transform API data to match component expectations
        const transformedTour: Tour = {
          ...data.tour,
          title: removeRoutes(data.tour.title),
          tagline: removeRoutes(data.tour.tagline || data.tour.subtitle),
          overview: removeRoutes(data.tour.overview || data.tour.description),
          images: transformImages(data.tour.gallery_images || data.tour.images || []),
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
          highlights: data.tour.highlights || [],
          faqs: data.tour.faqs || [],
        };

        if (isMounted) {
          setTour(transformedTour);
          setLoading(false);
          fetchingRef.current = false;
        }
      } catch (err: any) {
        console.error('Error fetching tour:', err);
        if (isMounted) {
          setError('Failed to load tour. Please try again later.');
          setLoading(false);
          fetchingRef.current = false;
        } else {
          // Ensure ref is reset even if unmounted
          fetchingRef.current = false;
        }
      }
    };

    fetchTour();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
      fetchingRef.current = false;
    };
  }, [tourId]);

  // Parse keywords from tour data (memoized to prevent infinite loops)
  // MUST be called before any early returns to follow React Hooks rules
  const keyInfoItems = useMemo(() => {
    if (!tour) return [];
    
    const keywords = (tour as any).keywords;
    
    if (!keywords || keywords.length === 0) {
      // Fallback to default items if no keywords (excluding duration)
      return [
        {
          icon: (
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          label: t('tour.difficulty'),
          value: tour.difficulty || '',
        },
        {
          icon: (
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          label: t('tour.groupSize'),
          value: tour.groupSize || '',
        },
      ].filter(item => item.value);
    }

    // Map keywords to icon based on label
    const getIcon = (label: string) => {
      const lowerLabel = label.toLowerCase();
      if (lowerLabel.includes('duration') || lowerLabel.includes('time')) {
        return (
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      }
      if (lowerLabel.includes('difficulty')) {
        return (
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      }
      if (lowerLabel.includes('group') || lowerLabel.includes('size')) {
        return (
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      }
      // Default icon
      return (
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      );
    };

    return keywords.map((keyword: string) => {
      // Parse "Label: Value" format
      const parts = keyword.split(':').map((p: string) => p.trim());
      const label = parts[0] || '';
      const value = parts.length > 1 ? parts.slice(1).join(':').trim() : keyword;

      return {
        icon: getIcon(label),
        label,
        value,
      };
    }).filter((item: { icon: React.ReactNode; label: string; value: string }) => {
      // Filter out duration/time related items
      if (!item.value) return false;
      const lowerLabel = item.label.toLowerCase();
      const lowerValue = item.value.toLowerCase();
      if (lowerLabel.includes('duration') || lowerLabel.includes('time') || 
          lowerValue.includes('hour') || lowerValue.includes('시간')) {
        return false;
      }
      return true;
    });
  }, [tour, t]);

  // Update page title - MUST be before any conditional returns to follow React Hooks rules
  useEffect(() => {
    if (tour) {
      document.title = tour.title || 'Tour Details';
    } else if (error) {
      document.title = 'Tour Not Found';
    } else {
      document.title = 'Loading Tour...';
    }
  }, [tour, error]);

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

  if (error || (!loading && !tour)) {
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

  const handleCheckAvailability = () => {
    bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleShare = () => {
    if (!tour) return;
    
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

  // TypeScript guard: tour should not be null at this point
  if (!tour) {
    return null; // This should never happen due to earlier checks, but TypeScript needs it
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pb-20 md:pb-0">
        {/* 1. Hero Image */}
        <HeroImage images={tour.images} />

        {/* Title Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <div className="max-w-4xl">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 leading-tight">
                  {tour.title}
                </h1>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                    </svg>
                    <span className="font-semibold text-gray-900">
                      {tour.rating.toFixed(1)}
                    </span>
                    <span className="text-gray-500">
                      ({tour.reviewCount} reviews)
                    </span>
                  </div>
                  {tour.badges && tour.badges.length > 0 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                      {tour.badges[0]}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
                <button 
                  onClick={handleShare}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. About this activity */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="max-w-4xl rounded-xl bg-gradient-to-br from-blue-50 via-indigo-50/50 to-purple-50/30 border-2 border-blue-200 shadow-lg p-4 sm:p-5">
            <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              About this activity
            </h2>
            <div className="grid sm:grid-cols-2 gap-2.5">
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/80 border border-blue-100 shadow-sm">
                <div className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 mb-0.5">Free cancellation</div>
                  <div className="text-xs text-gray-600 leading-relaxed">Cancel up to 24 hours in advance for a full refund</div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/80 border border-blue-100 shadow-sm">
                <div className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 mb-0.5">Reserve now & pay later</div>
                  <div className="text-xs text-gray-600 leading-relaxed">Keep your travel plans flexible</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Key Info Bar */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <KeyInfoBar items={keyInfoItems} />
        </section>

        {/* Main Content */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-8 lg:grid lg:grid-cols-[1fr_400px] lg:gap-8 lg:items-start">
          {/* Left Column: Content */}
          <div className="space-y-3 sm:space-y-4">
            {/* 3. Quick Facts */}
            <QuickFacts facts={tour.quickFacts} />

            {/* 4. Gallery Grid */}
            <GalleryGrid images={tour.images} />

            {/* 5. Description (collapsible) */}
            {tour.overview && (
              <CollapsibleSection title="Full Description">
                <div className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">
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
                  <div className="grid md:grid-cols-2 gap-6">
                    {tour.inclusions.length > 0 && (
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Included
                        </h3>
                        <ul className="space-y-2.5">
                          {tour.inclusions.map((item, index) => {
                            const text = typeof item === 'string' ? item : item.text || '';
                            return (
                              <li key={index} className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-sm text-gray-700">{text}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {tour.exclusions.length > 0 && (
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Not Included
                        </h3>
                        <ul className="space-y-2.5">
                          {tour.exclusions.map((item, index) => {
                            const text = typeof item === 'string' ? item : item.text || '';
                            return (
                              <li key={index} className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span className="text-sm text-gray-700">{text}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
            )}

            {/* Highlights */}
            {tour.highlights && tour.highlights.length > 0 && (
              <CollapsibleSection title="Highlights" defaultOpen={true}>
                <ul className="space-y-3 text-sm sm:text-base text-gray-700">
                  {tour.highlights.map((highlight, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* FAQ */}
            {tour.faqs && tour.faqs.length > 0 && (
              <CollapsibleSection title="Frequently Asked Questions" defaultOpen={false}>
                <div className="divide-y divide-gray-200">
                  {tour.faqs.map((faq, idx) => (
                    <details
                      key={idx}
                      className="py-4 first:pt-0"
                      open={idx === 0}
                    >
                      <summary className="cursor-pointer list-none font-semibold text-gray-900 hover:text-blue-600 transition-colors flex items-center justify-between">
                        <span>{faq.question}</span>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <p className="mt-3 text-sm text-gray-700 leading-relaxed pl-6">
                        {faq.answer}
                      </p>
                    </details>
                  ))}
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

          {/* Right Column: Desktop Booking Sidebar (sticky on scroll) */}
          <div className="hidden lg:block">
            <div className="lg:sticky lg:top-24">
              <EnhancedBookingSidebar tour={tour} />
            </div>
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
