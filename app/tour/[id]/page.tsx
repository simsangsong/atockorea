'use client';

import { useRef, useState, useEffect, Suspense, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import HeroImage from '@/components/tour/HeroImage';
import KeyInfoBar from '@/components/tour/KeyInfoBar';
import GalleryGrid from '@/components/tour/GalleryGrid';
import VisualItinerary from '@/components/tour/VisualItinerary';
import MeetingPoint from '@/components/tour/MeetingPoint';
import ActionButtons from '@/components/tour/ActionButtons';
import CollapsibleSection from '@/components/tour/CollapsibleSection';
import TourOverviewContent from '@/components/tour/TourOverviewContent';
import FaqAccordion from '@/components/tour/FaqAccordion';
import ItineraryTimeline from '@/components/tour/ItineraryTimeline';
import { useTranslations, useI18n } from '@/lib/i18n';
import { formatChildEligibilityRule, CHILD_SEAT_OPTIONS, STROLLER_WHEELCHAIR_OPTIONS } from '@/lib/participant-rules';
import TourReviewsSection from '@/components/tour/TourReviewsSection';
import { useCurrencyOptional } from '@/lib/currency';

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

import type { TourDetail } from '@/types/tour';

type Tour = TourDetail & {
  availableSpots?: number;
  depositAmountUSD?: number;
  balanceAmountKRW?: number;
};

export default function TourDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useI18n();
  const currencyCtx = useCurrencyOptional();
  
  // Extract tourId directly from params - use useMemo to stabilize the value
  const tourId = useMemo(() => {
    const id = params?.id;
    if (typeof id === 'string') return id;
    if (Array.isArray(id) && id.length > 0) return id[0];
    return '';
  }, [params?.id]);
  
  const bookingRef = useRef<HTMLDivElement>(null);
  
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevTourIdRef = useRef<string | null>(null);
  const fetchingRef = useRef(false); // Prevent concurrent fetches
  const hasFetchedRef = useRef<string | null>(null); // Track which tourId has been fetched

  useEffect(() => {
    // Prevent duplicate fetches for the same tourId
    if (!tourId) {
      if (error !== 'Tour ID is required') {
        setError('Tour ID is required');
        setLoading(false);
      }
      fetchingRef.current = false;
      prevTourIdRef.current = null;
      hasFetchedRef.current = null;
      return;
    }
    
    // Refetch when tourId or locale changes (so we get the right translation)
    const fetchKey = `${tourId}:${locale}`;
    if (hasFetchedRef.current === fetchKey) {
      return;
    }
    
    // Reset previous tour when tourId or locale changes
    const tourIdChanged = prevTourIdRef.current !== tourId;
    const localeChanged = prevTourIdRef.current !== null && hasFetchedRef.current !== null && hasFetchedRef.current !== fetchKey;
    
    if (tourIdChanged || localeChanged) {
      if (tourIdChanged && prevTourIdRef.current !== null) {
        setTour(null);
        setError(null);
      }
      setLoading(true);
      prevTourIdRef.current = tourId;
      hasFetchedRef.current = null;
    }
    
    // If already fetching, don't fetch again
    if (fetchingRef.current) {
      return;
    }
    
    fetchingRef.current = true;

    let isMounted = true; // Track if component is still mounted

    const fetchTour = async () => {
      try {
        setLoading(true);
        setError(null); // Clear previous errors
        const apiUrl = typeof window !== 'undefined' 
          ? `${window.location.origin}/api/tours/${encodeURIComponent(tourId)}?locale=${encodeURIComponent(locale)}`
          : `/api/tours/${encodeURIComponent(tourId)}?locale=${encodeURIComponent(locale)}`;
        
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
          hasFetchedRef.current = `${tourId}:${locale}`; // Mark this tour+locale as fetched
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
    // Refetch when tourId or locale changes so content language updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId, locale]);

  // 제주 프라이빗 / 부산 프라이빗만 Highlights에 'Hotel pickup & drop-off' 표시
  const isJejuOrBusanPrivate = useMemo(() => {
    if (!tour?.badges?.some((b: string) => /private/i.test(b))) return false;
    const city = (tour.city || '').toLowerCase();
    const title = (tour.title || '').toLowerCase();
    if (/jeju|제주/.test(city) || /jeju|제주/.test(title)) return true;
    if (/busan|부산/.test(city) || /busan|부산/.test(title)) return true;
    return false;
  }, [tour?.badges, tour?.city, tour?.title]);

  const highlightsToShow = useMemo(() => {
    if (!tour?.highlights?.length) return [];
    const pickupDropoffPattern = /hotel\s*pickup|pickup\s*&\s*drop-?off|drop-?off\s*included|픽업|드롭오프|接车|接送|ピックアップ/i;
    if (isJejuOrBusanPrivate) return tour.highlights;
    return tour.highlights.filter((h: string) => !pickupDropoffPattern.test(h));
  }, [tour?.highlights, isJejuOrBusanPrivate]);

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
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-300 border-t-blue-500 mx-auto mb-4" />
              <p className="text-sm text-slate-600 font-medium">Loading tour...</p>
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

  const formatPrice = (n: number) =>
    currencyCtx ? currencyCtx.formatPrice(n) : `₩${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(n)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
      <Header />
      <main className="pb-28 md:pb-0">
        {/* Hero — 메인처럼 데스크톱에서 둥근 카드 + 그림자 */}
        <section className="px-4 sm:px-6 lg:px-8 pt-4 md:pt-6">
          <div className="container mx-auto max-w-6xl">
            <div className="rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_8px_rgba(0,0,0,0.04)] md:shadow-xl">
              <HeroImage images={tour.images} />
            </div>
          </div>
        </section>

        {/* 제목·평점·트러스트 — 메인 TrustBar 스타일 카드 */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-2 md:-mt-4 max-w-6xl relative z-10">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-[0_2px_20px_rgba(0,0,0,0.08),0_1px_8px_rgba(0,0,0,0.04)] p-4 sm:p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-tight tracking-tight">
                  {tour.title}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1 font-medium">
                    <svg className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>
                    {tour.rating.toFixed(1)}
                  </span>
                  <span>{tour.reviewCount} {t('tour.reviews') || 'reviews'}</span>
                  {tour.badges?.[0] && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200/60">
                      {tour.badges[0]}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <ActionButtons compact variant="default" tourId={tour.id} onCheckAvailability={() => {}} onShare={handleShare} />
              </div>
            </div>
            {/* Trust strip — 클룩/애플 스타일 간결 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-4 border-t border-gray-100">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Free cancellation
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Reserve now & pay later
              </span>
            </div>
            <div className="mt-4">
              <KeyInfoBar items={keyInfoItems} />
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-8 lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start max-w-6xl">
          {/* Left Column: Content — 카드 간격 통일 */}
          <div className="space-y-4 md:space-y-5">
            {/* Gallery */}
            <div className="rounded-2xl overflow-hidden border border-gray-200/50 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06),0_1px_6px_rgba(0,0,0,0.03)] p-4 sm:p-5">
              <GalleryGrid images={tour.images} />
            </div>

            {/* 5. Description (collapsible) */}
            {tour.overview && (
              <CollapsibleSection title={t('tour.fullDescription')}>
                <TourOverviewContent content={tour.overview} />
              </CollapsibleSection>
            )}

            {/* 6. Itinerary (collapsible): itinerary_details 타임라인 또는 기존 schedule */}
            <CollapsibleSection title={t('tour.itinerary')}>
              {tour.itineraryDetails && tour.itineraryDetails.length > 0 ? (
                <ItineraryTimeline items={tour.itineraryDetails} />
              ) : (
                <VisualItinerary items={tour.itinerary} pickupPoints={tour.pickupPoints} />
              )}
            </CollapsibleSection>

            {/* 7. What's Included (collapsible) */}
            {(tour.inclusions.length > 0 || tour.exclusions.length > 0) && (
              <CollapsibleSection title={t('tour.whatsIncluded')}>
                  <div className="grid sm:grid-cols-2 gap-6">
                    {tour.inclusions.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                            <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </span>
                          {t('tour.included')}
                        </h3>
                        <ul className="space-y-1.5">
                          {tour.inclusions.map((item, index) => {
                            const text = typeof item === 'string' ? item : item.text || '';
                            return (
                              <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                                <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                                {text}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {tour.exclusions.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </span>
                          {t('tour.notIncluded')}
                        </h3>
                        <ul className="space-y-1.5">
                          {tour.exclusions.map((item, index) => {
                            const text = typeof item === 'string' ? item : item.text || '';
                            return (
                              <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                                <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                                {text}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
            )}

            {/* Highlights (제주/부산 프라이빗만 'Hotel pickup & drop-off' 항목 표시) */}
            {highlightsToShow.length > 0 && (
              <CollapsibleSection title={t('tour.highlights')} defaultOpen={true}>
                <ul className="space-y-2 text-sm text-gray-600">
                  {highlightsToShow.map((highlight, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* FAQ (아코디언) */}
            {tour.faqs && tour.faqs.length > 0 && (
              <CollapsibleSection title={t('tour.faq')} defaultOpen={false}>
                <FaqAccordion items={tour.faqs} />
              </CollapsibleSection>
            )}

            {/* 아동 자격 / Children's eligibility */}
            {tour.childEligibility && tour.childEligibility.length > 0 && (
              <CollapsibleSection title="儿童资格 / Child eligibility" defaultOpen={false}>
                <ul className="space-y-2 text-sm text-gray-700">
                  {tour.childEligibility.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                      {formatChildEligibilityRule(rule, 'ko')}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* 권장 휴대품 / Suggested to bring */}
            {tour.suggestedToBring && tour.suggestedToBring.length > 0 && (
              <CollapsibleSection title="建议携带 / Suggested to bring" defaultOpen={false}>
                <ul className="space-y-2 text-sm text-gray-700">
                  {tour.suggestedToBring.filter(Boolean).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* 접근성 시설 / Accessibility */}
            {tour.accessibilityFacilities && (tour.accessibilityFacilities.note_children_counted || tour.accessibilityFacilities.child_seat || tour.accessibilityFacilities.stroller_wheelchair) && (
              <CollapsibleSection title="无障碍设施 / Accessibility" defaultOpen={false}>
                <div className="space-y-3 text-sm text-gray-700">
                  {tour.accessibilityFacilities.note_children_counted && (
                    <p className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      注意:婴幼儿和儿童将被计为乘客人数
                    </p>
                  )}
                  {tour.accessibilityFacilities.child_seat && (
                    <p className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      {CHILD_SEAT_OPTIONS.find((o) => o.value === tour.accessibilityFacilities?.child_seat)?.labelKo ||
                        tour.accessibilityFacilities.child_seat}
                      {tour.accessibilityFacilities.child_seat === 'custom' && tour.accessibilityFacilities.child_seat_custom && (
                        <span>
                          {' '}({tour.accessibilityFacilities.child_seat_custom.num1}–{tour.accessibilityFacilities.child_seat_custom.num2}岁, 身高{tour.accessibilityFacilities.child_seat_custom.num3}cm以下)
                        </span>
                      )}
                    </p>
                  )}
                  {tour.accessibilityFacilities.stroller_wheelchair && (
                    <p className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      {STROLLER_WHEELCHAIR_OPTIONS.find((o) => o.value === tour.accessibilityFacilities?.stroller_wheelchair)?.labelKo ||
                        tour.accessibilityFacilities.stroller_wheelchair}
                    </p>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Reviews */}
            <div className="rounded-2xl border border-gray-200/50 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06),0_1px_6px_rgba(0,0,0,0.03)] p-4 sm:p-5">
              <TourReviewsSection tourId={tour.id} tourTitle={tour.title} />
            </div>

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

        {/* Mobile: Sticky price bar — 클룩/애플 스타일 */}
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex items-center justify-between gap-4 px-4 py-3.5 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] safe-area-pb">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">From</p>
            <p className="text-lg font-bold text-gray-900 tracking-tight">
              {formatPrice(tour.originalPrice && tour.originalPrice > tour.price ? tour.price : tour.price)}
              {tour.originalPrice != null && tour.originalPrice > tour.price && (
                <span className="ml-2 text-sm font-normal text-gray-400 line-through">{formatPrice(tour.originalPrice)}</span>
              )}
            </p>
          </div>
          <button
            onClick={handleCheckAvailability}
            className="flex-1 max-w-[200px] py-3.5 px-5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg"
          >
            {t('tour.checkAvailability')}
          </button>
        </div>

        {/* Desktop: Action buttons */}
        <div className="hidden md:block">
          <ActionButtons
            tourId={tour.id}
            onCheckAvailability={handleCheckAvailability}
            onShare={handleShare}
          />
        </div>
      </main>
        <Footer />
        <BottomNav />
      <div className="h-24 md:h-20 md:hidden" />
    </div>
  );
}
