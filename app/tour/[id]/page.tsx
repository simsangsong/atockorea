'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Poppins } from 'next/font/google';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import TourOverviewContent from '@/components/tour/TourOverviewContent';
import FaqAccordion from '@/components/tour/FaqAccordion';
import ImportantNotesContent from '@/components/tour/ImportantNotesContent';
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
  () => import('@/components/maps/InteractiveMap').then((m) => m.default),
  { ssr: false, loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse" /> }
);

import type { TourDetail, ItineraryDetail } from '@/types/tour';
import { Star, Shield, Award, Users, Clock, Globe, Check, X, ChevronRight, MapPin, Navigation, AlertCircle, Plane, Banknote } from 'lucide-react';

const poppins = Poppins({ weight: ['300', '400', '500', '600', '700'], subsets: ['latin'] });

// 타임라인 마커 채색: 하늘색·주황 위주 (마커 수 줄여서 2개만 표시 시 사용)
const TIMELINE_PIN_COLORS = ['#0EA5E9', '#f97316'] as const;

// 제주 프라이빗 차 투어 상품 여부 (영어·한국어·중국어·일본어 등 제목 모두 인식)
function isJejuPrivateCarTour(title: string | undefined): boolean {
  if (!title || typeof title !== 'string') return false;
  const s = title.toLowerCase().trim();
  return (
    /jeju\s+private\s+car|private\s+car\s+charter/i.test(s) ||
    /제주\s*프라이빗\s*차|프라이빗\s*차\s*차터/i.test(s) ||
    /济州\s*私人\s*包车|济州\s*私人\s*汽车|私人\s*包车|私人\s*汽车/i.test(s) ||
    /濟州\s*私人\s*包車|私人\s*包車/i.test(s) ||
    /済州\s*プライベート|プライベート\s*チャーター|済州\s*貸切/i.test(s) ||
    /jeju\s+coche\s+privado|charter\s+privado/i.test(s)
  );
}

// Styled timeline card: 모바일 스타일(스쿠시, 이미지+그라데이션, 제목+시간 뱃지), View Details·팝업
function StyledTimelineCard({
  time,
  title,
  image,
  isLeft,
  details,
  pinColor,
  isFirst,
  showPin,
}: {
  time: string;
  title: string;
  image: string | undefined;
  isLeft: boolean;
  details: string;
  pinColor?: string;
  isFirst?: boolean;
  showPin?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className={`flex w-full mb-1 sm:mb-2 items-center ${isLeft ? 'flex-row' : 'flex-row-reverse'} ${!isFirst ? '-mt-20 sm:-mt-28' : ''}`}>
      <div className="w-[42%] sm:w-[45%] group relative">
        <div className="bg-white rounded-[1.75rem] sm:rounded-[1.8rem] shadow-lg shadow-black/5 overflow-visible transition-all duration-500 hover:shadow-xl border border-neutral-100 relative">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-[1.75rem] sm:rounded-t-[1.8rem]">
            {image ? (
              <Image src={image} alt={title} fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="(max-width:640px) 45vw, 400px" />
            ) : (
              <div className="w-full h-full bg-neutral-200" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>
          <div className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-white rounded-b-[1.75rem] sm:rounded-b-[1.8rem]">
            <div className="flex justify-between items-start gap-2 sm:gap-3 mb-0.5 sm:mb-1">
              <h3 className="font-black text-neutral-900 text-[13px] sm:text-[16px] tracking-tight leading-tight flex-1 min-w-0">{title}</h3>
              <span className="bg-[#F3F4F6] text-neutral-600 text-[11px] sm:text-[12px] font-bold px-2 py-0.5 sm:py-1 rounded-full border border-neutral-200 shrink-0">{time || '—'}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="flex items-center gap-0.5 text-sky-600 font-bold text-[8px] sm:text-[9px] uppercase tracking-wider hover:text-sky-800 transition-colors"
            >
              <span>View Details</span>
              <ChevronRight className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
        {showDetails && (
          <div
            className={`absolute top-0 z-30 w-[220px] sm:w-[380px] min-h-[140px] bg-white rounded-[1.75rem] shadow-xl border border-neutral-100 flex flex-col animate-in fade-in duration-200 ${isLeft ? 'left-full ml-2 sm:ml-3' : 'right-full mr-2 sm:mr-3'}`}
          >
            <div className="flex items-center justify-between p-2 sm:p-3 border-b border-neutral-100 shrink-0">
              <h4 className="text-[9px] sm:text-[10px] font-bold text-sky-500 uppercase tracking-widest">Detailed Information</h4>
              <button type="button" onClick={() => setShowDetails(false)} className="text-neutral-400 hover:text-neutral-900 p-0.5" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 sm:p-3">
              <p className="text-[10px] sm:text-[11px] text-neutral-700 font-medium leading-relaxed whitespace-pre-wrap">{details || '—'}</p>
            </div>
          </div>
        )}
      </div>
      <div className="w-[16%] sm:w-[10%] flex justify-center relative z-10 shrink-0">
        {showPin !== false && (
          <svg className="w-6 h-7 flex-shrink-0" viewBox="0 0 24 28" fill="none" aria-hidden>
            <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8z" fill={pinColor || TIMELINE_PIN_COLORS[0]} />
            <circle cx="12" cy="8" r="3" fill="white" />
          </svg>
        )}
      </div>
      <div className="w-[42%] sm:w-[45%]" />
    </div>
  );
}

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
  /** CRO: global "상세정보 펼쳐보기" expanded state; when true, details container is visible and individual buttons hidden */
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  /** CRO: which timeline description ids are expanded (Read more) */
  const [readMoreExpanded, setReadMoreExpanded] = useState<Record<string, boolean>>({});
  /** 하단 섹션(Highlights, Full Description, FAQ, Child eligibility) 접기/펼치기 */
  const [bottomSectionOpen, setBottomSectionOpen] = useState<Record<string, boolean>>({});

  const toggleBottomSection = useCallback((id: string) => {
    setBottomSectionOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const globalExpandAll = useCallback(() => {
    setDetailsExpanded((prev) => !prev);
  }, []);
  const toggleSection = useCallback((_sectionId: string) => {
    setDetailsExpanded(true);
    setTimeout(() => {
      const el = document.getElementById(_sectionId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);
  const toggleReadMore = useCallback((descId: string) => {
    setReadMoreExpanded((prev) => ({ ...prev, [descId]: !prev[descId] }));
  }, []);

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
      navigator.share({ title: tour.title, text: tour.tagline, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (!tour) return null;

  const formatPrice = (n: number) =>
    currencyCtx ? currencyCtx.formatPrice(n) : `₩${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(n)}`;

  /** 목적지 일정만 (픽업 제외). 픽업 항목은 상단 리스트로만 표시하고 타임라인 카드에서는 제거 */
  const isPickupItem = (title: string, description?: string) => {
    const t = (title || '').trim().toLowerCase();
    const d = (description || '').trim().toLowerCase();
    const pickupTitle = /^pickup\s*[-–—:]|픽업\s*[-–—:]?|pickup\s*point/i.test(t)
      || tour.pickupPoints?.some((p) => t.includes((p.name || '').toLowerCase()));
    const pickupDesc = /first\s*pickup|second\s*pickup|third\s*pickup|fourth\s*pickup|pickup\s*point/i.test(d);
    return pickupTitle || pickupDesc;
  };
  const rawDestinationItems: Array<{ time: string; title: string; description: string; image?: string }> = tour.itineraryDetails?.length
    ? tour.itineraryDetails.map((d: ItineraryDetail) => ({ time: d.time, title: d.activity, description: d.description || '', image: d.images?.[0] }))
    : (tour.itinerary || []).map((i) => ({ time: i.time || '', title: i.title || '', description: i.description || '', image: i.images?.[0] }));
  const destinationItems = rawDestinationItems.filter((item) => !isPickupItem(item.title, item.description));

  const images = tour.images || [];
  const mainImage = images[0]?.url || (typeof images[0] === 'string' ? images[0] : '');
  const sub1 = images[1]?.url || (typeof images[1] === 'string' ? images[1] : '');
  const sub2 = images[2]?.url || (typeof images[2] === 'string' ? images[2] : '');
  const nextGalleryImage = images[3]?.url || (typeof images[3] === 'string' ? images[3] : '') || sub2 || mainImage;

  const READ_MORE_LENGTH = 120;

  const fullStars = Math.min(5, Math.floor(tour.rating) + (tour.rating % 1 >= 0.5 ? 1 : 0));
  const starDisplay = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);

  const imageCount = images.length || 1;

  const timelineDotColors = ['#E85D22', '#0EA5E9', '#F59E0B'] as const;

  return (
    <div className={`tour-detail-cro min-h-screen bg-[#F9FAFB] text-neutral-900 pb-32 lg:pb-24 ${poppins.className}`}>
      <Header />
      <main className="bg-[#F9FAFB]">
        {/* ================= HERO (Full Width, Dark Overlay) ================= */}
        <div className="relative w-full h-[380px] sm:h-[450px] lg:h-[550px]">
          <div className="absolute inset-0 bg-cover bg-center" aria-hidden>
            {mainImage ? (
              <Image src={mainImage} alt="" fill className="object-cover" sizes="100vw" priority />
            ) : (
              <div className="w-full h-full bg-neutral-300" />
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pt-4 sm:pt-10">
            <span className="bg-[#E85D22] text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-3 sm:px-4 py-1.5 rounded-full mb-3 sm:mb-4 shadow-lg">
              Trusted by 50,000+ Travelers
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-md px-2 max-w-4xl leading-tight">
              {tour.title}
            </h1>
            <div className="flex items-center justify-center space-x-2 sm:space-x-3 text-white/90 drop-shadow-sm px-4">
              <div className="flex items-center space-x-1 text-amber-400">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={`w-4 h-4 sm:w-5 sm:h-5 ${i <= fullStars ? 'fill-current' : ''}`} />
                ))}
              </div>
              <span className="text-base sm:text-lg font-bold">{tour.rating != null ? Number(tour.rating).toFixed(1) : '—'}</span>
              <span className="text-xs sm:text-sm font-medium opacity-90">({tour.reviewCount ?? 0} {t('tour.reviews')})</span>
            </div>
          </div>
        </div>

        {/* ================= MAIN CONTENT & SIDEBAR (Overlap Hero) ================= */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 -mt-16 sm:-mt-24 lg:-mt-32 flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* LEFT: MAIN CONTENT */}
          <div className="lg:w-2/3 flex flex-col gap-10 sm:gap-16">
            {/* 1. Why Choose Us (너비·높이 5% 확대, 글씨 약간 확대) */}
            <div className="w-[75%] max-w-full mx-auto bg-white rounded-2xl sm:rounded-full py-3.5 px-4 sm:py-4 sm:px-7 shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-5 text-center">
              <div className="flex flex-row items-center gap-3 sm:gap-3.5">
                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-orange-500" />
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-[13px] sm:text-sm text-neutral-900 leading-tight">{t('tour.secureDeposit')}</h3>
                  <p className="text-[11px] sm:text-xs text-neutral-500 mt-1 font-medium leading-tight">{t('tour.secureDepositSub')}</p>
                </div>
              </div>
              <div className="hidden sm:block w-px h-7 bg-neutral-100" />
              <div className="flex flex-row items-center gap-3 sm:gap-3.5">
                <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-sky-500" />
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-[13px] sm:text-sm text-neutral-900 leading-tight">{t('tour.expertLocalGuides')}</h3>
                  <p className="text-[11px] sm:text-xs text-neutral-500 mt-1 font-medium leading-tight">{t('tour.expertLocalGuidesSub')}</p>
                </div>
              </div>
              <div className="hidden sm:block w-px h-7 bg-neutral-100" />
              <div className="flex flex-row items-center gap-3 sm:gap-3.5">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-[13px] sm:text-sm text-neutral-900 leading-tight">{t('tour.verifiedLLC')}</h3>
                  <p className="text-[11px] sm:text-xs text-neutral-500 mt-1 font-medium leading-tight">{t('tour.verifiedLLCSub')}</p>
                </div>
              </div>
            </div>

            {/* 2. Photo Gallery (asymmetric grid, +N Photos) */}
            <div className="flex flex-col items-center mt-2 sm:mt-4">
              <span className="bg-rose-50 text-rose-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 shadow-inner">{t('tour.galleryTag')}</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 sm:mb-8 text-neutral-900">{t('tour.capturedMoments')}</h2>
              <div className="w-full grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-4 lg:px-6 grid-rows-[1fr_1fr_auto] sm:grid-rows-none">
                {/* Left: big image (mobile row-span-2, sm single row) */}
                <div className="relative row-span-2 sm:row-span-1 h-48 min-h-[180px] sm:min-h-0 sm:h-80 w-full rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-sm">
                  {mainImage ? (
                    <Image src={mainImage} alt={tour.title} fill className="object-cover hover:scale-105 transition-transform duration-700" sizes="(max-width:640px) 50vw, 50vw" />
                  ) : (
                    <div className="w-full h-full bg-neutral-200" />
                  )}
                </div>
                {/* Mobile only: right top small */}
                <div className="relative h-24 min-h-[90px] sm:hidden w-full rounded-xl overflow-hidden shadow-sm">
                  {sub1 ? (
                    <Image src={sub1} alt="" fill className="object-cover" sizes="50vw" />
                  ) : (
                    <div className="w-full h-full bg-neutral-200" />
                  )}
                </div>
                {/* Mobile only: right bottom small */}
                <div className="relative h-24 min-h-[90px] sm:hidden w-full rounded-xl overflow-hidden shadow-sm">
                  {sub2 ? (
                    <Image src={sub2} alt="" fill className="object-cover" sizes="50vw" />
                  ) : (
                    <div className="w-full h-full bg-neutral-200" />
                  )}
                </div>
                {/* sm+: right column (two stacked + overlay on bottom) */}
                <div className="hidden sm:grid sm:grid-rows-2 sm:gap-4 sm:h-80 w-full">
                  <div className="relative w-full h-full rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-sm">
                    {sub1 ? (
                      <Image src={sub1} alt="" fill className="object-cover hover:scale-105 transition-transform duration-700" sizes="50vw" />
                    ) : (
                      <div className="w-full h-full bg-neutral-200" />
                    )}
                  </div>
                  <div className="relative w-full h-full rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-sm cursor-pointer group">
                    {nextGalleryImage ? (
                      <Image src={nextGalleryImage} alt="" fill className="object-cover" sizes="50vw" />
                    ) : (
                      <div className="w-full h-full bg-neutral-200" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                      <span className="text-white font-extrabold text-lg tracking-wide">{t('tour.morePhotos', { count: Math.max(0, imageCount - 3) })}</span>
                    </div>
                  </div>
                </div>
                {/* Mobile only: +N Photos card full width below (배경: 갤러리 다음 사진) */}
                <div className="col-span-2 row-start-3 sm:hidden relative h-24 min-h-[90px] w-full rounded-xl overflow-hidden shadow-sm cursor-pointer group flex items-center justify-center bg-neutral-200">
                  {nextGalleryImage ? (
                    <>
                      <Image src={nextGalleryImage} alt="" fill className="object-cover" sizes="100vw" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors z-[1]" />
                    </>
                  ) : null}
                  <span className={`relative z-10 font-extrabold text-lg tracking-wide ${nextGalleryImage ? 'text-white drop-shadow-md' : 'text-neutral-600'}`}>{t('tour.morePhotos', { count: Math.max(0, imageCount - 3) })}</span>
                </div>
              </div>
            </div>

            {/* 3. The Adventure Unfolds (Timeline) */}
            <div className="flex flex-col items-center" id="details-content">
              <span className="bg-sky-50 text-sky-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 shadow-inner">{t('tour.yourDayAtGlance')}</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center text-neutral-900">{t('tour.theAdventureUnfolds')}</h2>
              <p className="text-sm sm:text-base text-neutral-500 font-medium text-center mb-8 sm:mb-12">{t('tour.cinematicDayTrip')}</p>
              {tour.pickupPoints?.length > 0 && (
                <p className="text-sm text-neutral-500 mb-4">{t('tour.pickupPointsCount', { count: tour.pickupPoints.length })}</p>
              )}
              {destinationItems.length === 0 ? (
                <p className="text-neutral-500 text-sm">{t('tour.itinerary')} — {t('tour.noPickupPoints') || 'No schedule data.'}</p>
              ) : (
                <div className="w-full max-w-4xl relative flex flex-col items-center px-2 sm:px-4" id="tour-timeline">
                  {/* 가운데 채색 물결 곡선: 하늘/주황 교차, 반투명, 굵기 50%, 50% 더 꺾임 */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-8 -translate-x-1/2 pointer-events-none z-0 opacity-90" aria-hidden>
                    <svg className="w-full h-full" viewBox="0 0 24 400" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="timeline-curve-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#0EA5E9" />
                          <stop offset="25%" stopColor="#f97316" />
                          <stop offset="50%" stopColor="#0EA5E9" />
                          <stop offset="75%" stopColor="#f97316" />
                          <stop offset="100%" stopColor="#0EA5E9" />
                        </linearGradient>
                      </defs>
                      {/* 상단 점선 */}
                      <path d="M 12 0 L 12 12" fill="none" stroke="url(#timeline-curve-gradient)" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 5" />
                      {/* 가운데 더 꺾인 물결 실선 (하늘/주황, 굵기 50%) */}
                      <path
                        d="M 12 12 Q 24 32 12 52 Q 0 72 12 92 Q 24 112 12 132 Q 0 152 12 172 Q 24 192 12 212 Q 0 232 12 252 Q 24 272 12 292 Q 0 312 12 332 Q 24 352 12 372"
                        fill="none"
                        stroke="url(#timeline-curve-gradient)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  {destinationItems.map((step, index) => (
                    <StyledTimelineCard
                      key={index}
                      time={step.time || '—'}
                      title={step.title}
                      image={step.image || mainImage}
                      isLeft={index % 2 === 0}
                      details={step.description || '—'}
                      pinColor={TIMELINE_PIN_COLORS[index % 2]}
                      isFirst={index === 0}
                      showPin={index % 2 === 0}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 제주 프라이빗 차 투어 전용: 타임라인 ↔ Logistics 사이 안내 */}
            {isJejuPrivateCarTour(tour.title) && (
              <div className="w-full max-w-4xl px-2 sm:px-4 mt-4 sm:mt-6 mb-2 sm:mb-4">
                <p className="text-center text-neutral-700 font-semibold text-[12px] sm:text-[13px] mb-1.5">
                  {t('tour.jejuNoticeTitle')}
                </p>
                <p className="text-center text-[12px] sm:text-[13px] text-neutral-600 font-medium leading-relaxed px-4 py-3 rounded-xl bg-amber-50/80 border border-amber-100">
                  {(() => {
                    const raw = t('tour.jejuOneRegionPerDayNotice');
                    const parts = raw.split(/\*\*(.*?)\*\*/g);
                    return parts.map((seg, i) => (i % 2 === 1 ? <strong key={i} className="font-bold text-neutral-700">{seg}</strong> : seg));
                  })()}
                </p>
              </div>
            )}

            {/* 4. Meeting & Pickup */}
            <div className="flex flex-col items-center" id="pickup-info">
              <span className="bg-indigo-50 text-indigo-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 shadow-inner">{t('tour.logisticsTag')}</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 sm:mb-8 text-neutral-900">{t('tour.meetingPickup')}</h2>
              <div className="w-full bg-white rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 shadow-sm border border-neutral-100 flex flex-col lg:flex-row flex-wrap gap-8 items-stretch lg:px-8">
                <div className="flex-1 flex flex-col justify-center space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-indigo-500" />
                    </div>
                    <h3 className="font-extrabold text-lg sm:text-xl text-neutral-900">{t('tour.pickupPointsTitle')}</h3>
                  </div>
                  {tour.pickupPoints?.length > 0 ? (
                    <ul className="space-y-4">
                      {tour.pickupPoints.map((point, idx) => {
                        const timeStr = point.pickup_time ? String(point.pickup_time).replace(/(\d{1,2}:\d{2})(:\d{2})?$/, '$1') : '';
                        return (
                          <li key={point.id || idx} className="flex items-center gap-4 p-4 rounded-2xl bg-[#F9F8F6] border border-neutral-100 transition-colors hover:border-indigo-200">
                            <div className="w-6 h-6 rounded-full bg-white border border-neutral-200 flex items-center justify-center font-bold text-xs shrink-0 text-neutral-700 shadow-sm">{idx + 1}</div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-neutral-900">{point.name}</h4>
                              <p className="text-xs text-neutral-500 mt-1 font-medium">{timeStr || (point.address ?? '')}</p>
                            </div>
                            <div className="w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden bg-neutral-200 border border-neutral-100 shrink-0 flex items-center justify-center">
                              {point.image_url ? (
                                <Image src={point.image_url} alt={point.name} width={96} height={64} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-medium text-neutral-400">{t('tour.photoPlaceholder')}</span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
                <div className="flex-1 w-full min-h-[250px]">
                  {(() => {
                    const pointsWithCoords = (tour.pickupPoints || []).filter((p: any) => typeof p.lat === 'number' && typeof p.lng === 'number' && !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
                    const locations = pointsWithCoords.map((p: any) => ({ id: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng }));
                    return (
                      <div className="w-full h-full min-h-[250px] rounded-[1.5rem] overflow-hidden shadow-inner border border-neutral-100">
                        <InteractiveMap
                          locations={locations}
                          zoom={locations.length > 0 ? 11 : 10}
                          height="280px"
                        />
                      </div>
                    );
                  })()}
                </div>
                {/* 픽업 안내 (지도 밑 – 데스크탑·모바일 공통) */}
                <div className="w-full mt-5 space-y-2">
                  <div className="flex items-center gap-2 rounded-xl py-2 px-3 bg-indigo-50/90 border border-indigo-100">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <p className="text-[10px] leading-snug font-medium text-neutral-800">{t('tour.pickupNoticeExactTimes')}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl py-2 px-3 bg-emerald-50/90 border border-emerald-100">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-[10px] leading-snug font-medium text-neutral-800">{t('tour.pickupNoticeArriveEarly')}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl py-2 px-3 bg-blue-50/90 border border-blue-100">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <p className="text-[10px] leading-snug font-medium text-neutral-800">{t('tour.pickupNoticeNoShow')}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl py-2 px-3 bg-violet-50/90 border border-violet-100">
                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <Plane className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <p className="text-[10px] leading-snug font-medium text-neutral-800">{t('tour.pickupNoticeAirport')}</p>
                  </div>
                  {isJejuPrivateCarTour(tour.title) && (
                    <div className="flex items-center gap-2 rounded-xl py-2 px-3 bg-amber-50/90 border border-amber-100">
                      <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <Banknote className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <p className="text-[10px] leading-snug font-medium text-neutral-800">{t('tour.pickupNoticeJejuOutsideCityCost')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 5. At a Glance (맨 아래) */}
            <div className="flex flex-col items-center">
              <span className="bg-yellow-50 text-amber-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 shadow-inner">Quick Info</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 sm:mb-8 text-neutral-900">At a Glance</h2>
              <div className="w-full grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4 lg:px-6">
                <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 flex flex-col items-center justify-center text-center shadow-sm border border-neutral-100">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-orange-50 flex items-center justify-center mb-2 sm:mb-3 shadow-inner">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Duration</span>
                  <span className="font-extrabold text-sm sm:text-base text-neutral-900">{tour.duration || '—'}</span>
                </div>
                <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 flex flex-col items-center justify-center text-center shadow-sm border border-neutral-100">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-sky-50 flex items-center justify-center mb-2 sm:mb-3 shadow-inner">
                    <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Languages</span>
                  <span className="font-extrabold text-xs sm:text-base text-neutral-900">En, 中文, KR</span>
                </div>
              </div>
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:px-6">
                <div className="bg-[#F0FDF4] rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 border border-emerald-100/50 shadow-sm">
                  <h3 className="font-bold flex items-center gap-2 mb-3 sm:mb-4 text-sm sm:text-base text-neutral-900">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" /> {t('tour.included')}
                  </h3>
                  <ul className="space-y-2 sm:space-y-3">
                    {(tour.inclusions?.length ? tour.inclusions : ['Round-trip Transport', 'Professional Guide']).map((item: string | { text?: string }, i: number) => (
                      <li key={i} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-neutral-700 font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" /> {typeof item === 'string' ? item : (item as { text?: string }).text}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-[#FEF2F2] rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 border border-red-100/50 shadow-sm">
                  <h3 className="font-bold flex items-center gap-2 mb-3 sm:mb-4 text-sm sm:text-base text-neutral-900">
                    <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" /> {t('tour.notIncluded')}
                  </h3>
                  <ul className="space-y-2 sm:space-y-3">
                    {(tour.exclusions?.length ? tour.exclusions : ['Personal Expenses', 'Meals & Snacks']).map((item: string | { text?: string }, i: number) => (
                      <li key={i} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-neutral-700 font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" /> {typeof item === 'string' ? item : (item as { text?: string }).text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

        <div className="bottom-section bg-neutral-50 border-t border-neutral-200">
          <section className="tour-reviews-section" aria-label={t('tour.reviews')}>
            <TourReviewsSection tourId={tour.id} tourTitle={tour.title} />
          </section>

          {highlightsToShow.length > 0 && (
            <section className="bottom-section-card">
              <button
                type="button"
                className="bottom-section-card-head"
                onClick={() => toggleBottomSection('highlights')}
                aria-expanded={bottomSectionOpen['highlights']}
              >
                <h2>{t('tour.highlights')}</h2>
                <span className="bottom-section-card-icon" aria-hidden>
                  {bottomSectionOpen['highlights'] ? '▼' : '▶'}
                </span>
              </button>
              {bottomSectionOpen['highlights'] && (
                <div className="bottom-section-card-body">
                  <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--cro-text-light)', fontSize: 14, lineHeight: 1.8 }}>
                    {highlightsToShow.map((h, i) => (
                      <li key={i} style={{ marginBottom: i < highlightsToShow.length - 1 ? 10 : 0 }}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {tour.overview && (
            <section className="bottom-section-card">
              <button
                type="button"
                className="bottom-section-card-head"
                onClick={() => toggleBottomSection('description')}
                aria-expanded={bottomSectionOpen['description']}
              >
                <h2>{t('tour.fullDescription')}</h2>
                <span className="bottom-section-card-icon" aria-hidden>
                  {bottomSectionOpen['description'] ? '▼' : '▶'}
                </span>
              </button>
              {bottomSectionOpen['description'] && (
                <div className="bottom-section-card-body" style={{ lineHeight: 1.85 }}>
                  <TourOverviewContent content={tour.overview} />
                </div>
              )}
            </section>
          )}

          {tour.faqs && tour.faqs.length > 0 && (
            <section className="bottom-section-card">
              <button
                type="button"
                className="bottom-section-card-head"
                onClick={() => toggleBottomSection('faq')}
                aria-expanded={bottomSectionOpen['faq']}
              >
                <h2>{t('tour.faqShort')}</h2>
                <span className="bottom-section-card-icon" aria-hidden>
                  {bottomSectionOpen['faq'] ? '▼' : '▶'}
                </span>
              </button>
              {bottomSectionOpen['faq'] && (
                <div className="bottom-section-card-body" style={{ lineHeight: 1.85 }}>
                  <FaqAccordion items={tour.faqs} />
                </div>
              )}
            </section>
          )}

          <section className="bottom-section-card">
            <button
              type="button"
              className="bottom-section-card-head"
              onClick={() => toggleBottomSection('warnings')}
              aria-expanded={bottomSectionOpen['warnings']}
            >
              <h2>{t('tour.importantNotesSection')}</h2>
              <span className="bottom-section-card-icon" aria-hidden>
                {bottomSectionOpen['warnings'] ? '▼' : '▶'}
              </span>
            </button>
            {bottomSectionOpen['warnings'] && (
              <div className="bottom-section-card-body">
                <ImportantNotesContent />
              </div>
            )}
          </section>

          {tour.childEligibility && tour.childEligibility.length > 0 && (
            <section className="bottom-section-card">
              <button
                type="button"
                className="bottom-section-card-head"
                onClick={() => toggleBottomSection('child')}
                aria-expanded={bottomSectionOpen['child']}
              >
                <h2>儿童资格 / Child eligibility</h2>
                <span className="bottom-section-card-icon" aria-hidden>
                  {bottomSectionOpen['child'] ? '▼' : '▶'}
                </span>
              </button>
              {bottomSectionOpen['child'] && (
                <div className="bottom-section-card-body">
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--cro-text-light)' }}>
                    {tour.childEligibility.map((rule, idx) => <li key={idx}>{formatChildEligibilityRule(rule, 'ko')}</li>)}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>

            </div>

            {/* ================= RIGHT / CHECKOUT FORM (Desktop Sticky) ================= */}
            <div ref={bookingRef} className="lg:w-1/3 mt-4 lg:mt-0">
              <div className="sticky top-8 bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-neutral-100 overflow-hidden">
                <EnhancedBookingSidebar tour={tour} />
              </div>
            </div>
        </div>

        {/* ================= MOBILE STICKY BOTTOM BAR (Glassmorphism) ================= */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-neutral-200/50 p-4 safe-area-pb shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between gap-4 max-w-md mx-auto">
            <div className="flex-1">
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-bold text-neutral-900">
                  {formatPrice(tour.originalPrice && tour.originalPrice > tour.price ? tour.price : tour.price)}
                </span>
                <span className="text-xs text-neutral-500 font-medium">/ person</span>
              </div>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Deposit Today</p>
            </div>
            <button type="button" onClick={handleCheckAvailability} className="flex-1 bg-neutral-900 text-white rounded-xl py-4 font-bold tracking-wide flex items-center justify-center space-x-2 hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-900/20">
              <span>Book Now</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="h-28 md:hidden" />
    </div>
  );
}
