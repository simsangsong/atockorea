'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import TourOverviewContent from '@/components/tour/TourOverviewContent';
import FaqAccordion from '@/components/tour/FaqAccordion';
import ImportantNotesContent from '@/components/tour/ImportantNotesContent';
import { useTranslations, useI18n, useCopy, defaultLocale, type Locale } from '@/lib/i18n';
import { formatChildEligibilityRule, CHILD_SEAT_OPTIONS, STROLLER_WHEELCHAIR_OPTIONS } from '@/lib/participant-rules';
import TourReviewsSection from '@/components/tour/TourReviewsSection';
import { TourDetailKeyInfoGrid } from '@/components/tour/TourDetailKeyInfoGrid';
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

import type { ItineraryDetail } from '@/types/tour';
import type { TourDetailViewModel } from '@/src/types/tours';
import { adaptTourDetailResponse } from '@/src/lib/adapters/tours-adapter';
import { BookingTimelineSection } from '@/components/tour/BookingTimelineSection';
import {
  BusTourItinerarySection,
  BUS_TOUR_ITINERARY_DEMO_STOPS,
  formatBusPickupInfoSummary,
  mapDestinationItemsToBusTourStops,
} from '@/components/tour/BusTourItinerarySection';
import {
  BusTourInclusionsSection,
  BUS_TOUR_INCLUSIONS_DEMO_INCLUDED,
  BUS_TOUR_INCLUSIONS_DEMO_NOT_INCLUDED,
  linesFromTourList,
} from '@/components/tour/BusTourInclusionsSection';
import { analytics } from '@/src/design/analytics';
import { SmallGroupTourDetailTemplate, buildSmallGroupDetailContent } from '@/components/tour/small-group';
import { TourDetailTemplateView } from '@/components/tour-detail-template';
import { tourUsesDetailTemplateView } from '@/lib/tour-detail-template-slugs';
import { Star, Shield, Award, Users, Clock, Globe, Check, X, ChevronRight, MapPin, Navigation, AlertCircle, Plane, Banknote, Footprints } from 'lucide-react';

/** Timeline pins — blue + slate (homepage accent alignment) */
const TIMELINE_PIN_COLORS = ['#2563eb', '#64748b'] as const;

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
        <div className="relative overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="relative aspect-[4/3] w-full overflow-hidden">
            {image ? (
              <Image src={image} alt={title} fill className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" sizes="(max-width:640px) 45vw, 400px" />
            ) : (
              <div className="w-full h-full bg-slate-200" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              {time || '—'}
            </div>
          </div>
          <div className="border-t border-neutral-50 p-4">
            <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-tight tracking-tight text-neutral-900">{title}</h3>
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="mt-2 flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wider text-blue-600 transition-colors hover:text-blue-800"
            >
              <span>View Details</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
        {showDetails && (
          <div
            className={`absolute top-0 z-30 flex min-h-[140px] w-[220px] flex-col rounded-2xl border border-neutral-100 bg-white shadow-xl animate-in fade-in duration-200 sm:w-[380px] ${isLeft ? 'left-full ml-2 sm:ml-3' : 'right-full mr-2 sm:mr-3'}`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 p-2 sm:p-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Detailed Information</h4>
              <button type="button" onClick={() => setShowDetails(false)} className="p-0.5 text-slate-400 hover:text-slate-900" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2 sm:p-3">
              <p className="text-[11px] font-medium leading-relaxed text-neutral-700 whitespace-pre-wrap">{details || '—'}</p>
            </div>
          </div>
        )}
      </div>
      <div className="w-[16%] sm:w-[10%] flex justify-center relative z-10 shrink-0">
        {showPin !== false && (
          <div className="rounded-full p-0.5 shadow-[0_0_0_2px_rgba(255,255,255,0.95),0_0_8px_4px_rgba(255,255,255,0.8)]" aria-hidden>
            <svg className="w-6 h-7 flex-shrink-0 block" viewBox="0 0 24 28" fill="none">
              <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8z" fill={pinColor || TIMELINE_PIN_COLORS[0]} />
              <circle cx="12" cy="8" r="3" fill="white" />
            </svg>
          </div>
        )}
      </div>
      <div className="w-[42%] sm:w-[45%]" />
    </div>
  );
}

/** Middleware rewrite adds `?locale=`; use it so the first fetch matches URL before I18n hydrates from localStorage. */
function localeQueryForTourApi(urlParam: string | null, ctx: Locale): string {
  if (urlParam && urlParam.trim()) {
    const raw = urlParam.trim();
    const lower = raw.toLowerCase();
    if (lower === 'zh-cn' || lower === 'zh_cn') return 'zh-CN';
    if (lower === 'zh-tw' || lower === 'zh_tw') return 'zh-TW';
    if (lower === 'en' || lower === 'ko' || lower === 'zh' || lower === 'es' || lower === 'ja') return lower;
    if (raw === 'zh-TW') return 'zh-TW';
  }
  return ctx;
}

export default function TourDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useI18n();
  const copy = useCopy();
  const currencyCtx = useCurrencyOptional();
  
  const tourId = useMemo(() => {
    const id = params?.id;
    if (typeof id === 'string') return id;
    if (Array.isArray(id) && id.length > 0) return id[0];
    return '';
  }, [params?.id]);
  
  const bookingRef = useRef<HTMLDivElement>(null);
  
  const [tour, setTour] = useState<TourDetailViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineSelectedDate, setTimelineSelectedDate] = useState<Date | null>(null);
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
  const hasFetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tourId) {
      if (error !== 'Tour ID is required') {
        setError('Tour ID is required');
        setLoading(false);
      }
      prevTourIdRef.current = null;
      hasFetchedRef.current = null;
      return;
    }

    const urlLocale =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('locale') : null;
    /** URL `?locale=` (middleware) applies before I18n reads localStorage; after user picks a language, trust context. */
    const apiLocale =
      locale === defaultLocale ? localeQueryForTourApi(urlLocale, locale) : locale;
    const fetchKey = `${tourId}:${apiLocale}`;

    if (hasFetchedRef.current === fetchKey) {
      return;
    }

    const tourIdChanged = prevTourIdRef.current !== tourId;
    const localeChanged =
      prevTourIdRef.current !== null &&
      hasFetchedRef.current !== null &&
      hasFetchedRef.current !== fetchKey;

    if (tourIdChanged || localeChanged) {
      if (tourIdChanged && prevTourIdRef.current !== null) {
        setTour(null);
        setError(null);
      }
      setLoading(true);
      prevTourIdRef.current = tourId;
      hasFetchedRef.current = null;
    }

    const ac = new AbortController();

    const fetchTour = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiUrl =
          typeof window !== 'undefined'
            ? `${window.location.origin}/api/tours/${encodeURIComponent(tourId)}?locale=${encodeURIComponent(apiLocale)}`
            : `/api/tours/${encodeURIComponent(tourId)}?locale=${encodeURIComponent(apiLocale)}`;

        const response = await fetch(apiUrl, {
          cache: 'no-store',
          signal: ac.signal,
        });

        if (ac.signal.aborted) return;

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
          return;
        }

        const data = await response.json();

        if (ac.signal.aborted) return;

        const viewModel = adaptTourDetailResponse(data, tourId);
        if (!viewModel) {
          setError('Tour data not found in response');
          setLoading(false);
          return;
        }

        setTour(viewModel);
        setLoading(false);
        hasFetchedRef.current = fetchKey;
        analytics.detailViewed(viewModel.type, viewModel.pickup?.areaLabel ?? 'Unknown');
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (ac.signal.aborted) return;
        console.error('Error fetching tour:', err);
        setError('Failed to load tour. Please try again later.');
        setLoading(false);
      }
    };

    void fetchTour();

    return () => {
      ac.abort();
    };
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

  /** Bus / private classic layout: compact hero chips (join tours use their own template). */
  const classicHeroChips = useMemo((): Array<{ key: string; Icon: typeof Clock; text: string }> => {
    if (!tour || tour.type === 'join') return [];
    const chips: Array<{ key: string; Icon: typeof Clock; text: string }> = [];
    const dur = tour.duration?.trim();
    if (dur) chips.push({ key: 'dur', Icon: Clock, text: dur });
    const city = tour.city?.trim();
    if (city) chips.push({ key: 'city', Icon: MapPin, text: city });
    const grp = tour.groupSize?.trim();
    if (grp) chips.push({ key: 'grp', Icon: Users, text: grp });
    const diff = tour.difficulty?.trim();
    if (diff) chips.push({ key: 'walk', Icon: Footprints, text: diff });
    const typeLabel = tour.type === 'bus' ? 'Bus tour' : 'Private tour';
    chips.push({ key: 'type', Icon: Navigation, text: typeLabel });
    return chips;
  }, [tour]);

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
            <div className="text-center max-w-lg mx-auto">
              <p className="text-red-600 text-lg mb-4">{error || t('tour.tourNotFound')}</p>
              {process.env.NODE_ENV === 'development' && error === 'Tour not found' ? (
                <p className="text-sm text-slate-600 mb-4 text-left rounded-lg bg-slate-100 px-4 py-3">
                  <span className="font-medium text-slate-800">Dev hint:</span> This URL loads the tour from your Supabase{' '}
                  <code className="rounded bg-white px-1">tours</code> row (<code className="rounded bg-white px-1">slug</code> or{' '}
                  <code className="rounded bg-white px-1">id</code>, <code className="rounded bg-white px-1">is_active = true</code>).
                  For <code className="rounded bg-white px-1">east-signature-nature-core</code>, run{' '}
                  <code className="rounded bg-white px-1 text-[11px]">supabase/manual/insert-east-signature-nature-core-product.sql</code>{' '}
                  in the SQL Editor. Until then, try{' '}
                  <a className="text-blue-600 underline" href="/tour/jeju-east-small-group-template-preview">
                    /tour/jeju-east-small-group-template-preview
                  </a>{' '}
                  if that seed exists.
                </p>
              ) : null}
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

  const handleShare = () => {
    if (!tour) return;
    if (navigator.share) {
      navigator.share({ title: tour.title, text: tour.tagline, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  /** Classic tour layout: scroll to desktop booking column on mobile CTA tap. */
  const handleCheckAvailability = () => {
    bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!tour) return null;

  const formatPrice = (n: number) =>
    currencyCtx ? currencyCtx.formatPrice(n) : `₩${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(n)}`;

  if (tour.type === 'join') {
    if (tourUsesDetailTemplateView(tour.slug)) {
      const checkoutHref = `/tour/${encodeURIComponent(tourId)}/checkout`;
      return (
        <div className="relative min-h-screen overflow-x-hidden bg-transparent text-slate-900">
          <Header premiumTourDetail />
          <main className="bg-transparent">
            {tour.slug === 'jeju-east-small-group-template-preview' ? (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[11px] font-medium text-amber-950">
                Internal preview slug — live product URL:{' '}
                <code className="rounded bg-amber-100/80 px-1">/tour/east-signature-nature-core</code>
              </div>
            ) : null}
            <TourDetailTemplateView tour={tour} checkoutHref={checkoutHref} />
          </main>
          <Footer />
          <BottomNav />
        </div>
      );
    }

    const smallGroupContent = buildSmallGroupDetailContent(tour);
    return (
      <div className="relative min-h-screen overflow-x-hidden bg-transparent text-slate-900 tour-detail-premium pb-[max(11.5rem,calc(10rem+env(safe-area-inset-bottom,0px)))] lg:pb-24">
        <Header premiumTourDetail />
        <main className="bg-transparent">
          <SmallGroupTourDetailTemplate
            tour={tour}
            content={smallGroupContent}
            bookingRef={bookingRef}
            onDateSelect={setTimelineSelectedDate}
            formatPrice={formatPrice}
          />
        </main>
        <Footer premiumHandoff />
        <BottomNav />
      </div>
    );
  }

  /** 목적지 일정만 (픽업 제외). 픽업 항목은 Meeting & Pickup 단일 텍스트 카드로만 표시하고 타임라인 카드에서는 제거 */
  const isPickupItem = (title: string, description?: string) => {
    const titleTrim = (title || '').trim();
    const tLower = titleTrim.toLowerCase();
    const descRaw = (description || '').trim();
    const d = descRaw.toLowerCase();
    const pickupTitleEnKo =
      /^pickup\s*[-–—:]|픽업\s*[-–—:]?|pickup\s*point/i.test(tLower) ||
      tour.pickupPoints?.some(
        (p) => p.name && tLower.includes((p.name || '').toLowerCase())
      );
    const pickupTitleZh =
      /接送地點|接送地点|接機|接机|接载|接載|接客|取貨地點|取货地点|接車|接车/.test(titleTrim) ||
      /^第[一二三四五六七八九十0-9]+站/.test(titleTrim);
    /** CMS: 第二站/第三站… in description → pickup row (not a sightseeing card). */
    const pickupDescStationOrder = /^第[一二三四五六七八九十0-9]+站/.test(descRaw);
    const pickupDesc = /first\s*pickup|second\s*pickup|third\s*pickup|fourth\s*pickup|pickup\s*point/i.test(
      d
    );
    return pickupTitleEnKo || pickupTitleZh || pickupDescStationOrder || pickupDesc;
  };
  const rawDestinationItems: Array<{ time: string; title: string; description: string; image?: string }> = tour.itineraryDetails?.length
    ? tour.itineraryDetails.map((d: ItineraryDetail) => ({ time: d.time, title: d.activity, description: d.description || '', image: d.images?.[0] }))
    : (tour.itinerary || []).map((i) => ({ time: i.time || '', title: i.title || '', description: i.description || '', image: i.images?.[0] }));
  const destinationItems = rawDestinationItems.filter((item) => !isPickupItem(item.title, item.description));
  const pickupTimelineItems = rawDestinationItems.filter((item) =>
    isPickupItem(item.title, item.description)
  );
  const busPickupInfoSummary =
    tour.type === 'bus' && pickupTimelineItems.length > 0
      ? formatBusPickupInfoSummary(pickupTimelineItems)
      : '';

  const images = tour.images || [];
  const mainImage = images[0]?.url || (typeof images[0] === 'string' ? images[0] : '');
  const sub1 = images[1]?.url || (typeof images[1] === 'string' ? images[1] : '');
  const sub2 = images[2]?.url || (typeof images[2] === 'string' ? images[2] : '');
  const nextGalleryImage = images[3]?.url || (typeof images[3] === 'string' ? images[3] : '') || sub2 || mainImage;

  const busTourPremiumStops =
    tour.type === 'bus'
      ? destinationItems.length > 0
        ? mapDestinationItemsToBusTourStops(destinationItems, mainImage || '')
        : pickupTimelineItems.length > 0
          ? []
          : BUS_TOUR_ITINERARY_DEMO_STOPS
      : null;

  const busInclusionLines = linesFromTourList(tour.inclusions, BUS_TOUR_INCLUSIONS_DEMO_INCLUDED);
  const busExclusionLines = linesFromTourList(tour.exclusions, BUS_TOUR_INCLUSIONS_DEMO_NOT_INCLUDED);

  const READ_MORE_LENGTH = 120;

  const fullStars = Math.min(5, Math.floor(tour.rating) + (tour.rating % 1 >= 0.5 ? 1 : 0));

  const imageCount = images.length || 1;

  return (
    <div className="tour-detail-cro min-h-screen text-slate-900 pb-32 lg:pb-24">
      <Header />
      <main className="bg-transparent">
        {/* ================= HERO — title + route line on image; facts + rating on bright strip ================= */}
        <div className="relative h-[368px] w-full sm:h-[432px] lg:h-[528px]">
          <div className="absolute inset-0 bg-cover bg-center" aria-hidden>
            {mainImage ? (
              <Image src={mainImage} alt="" fill className="object-cover" sizes="100vw" priority />
            ) : (
              <div className="h-full w-full bg-neutral-300" />
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/48 via-black/26 to-black/74" aria-hidden />
          <div className="absolute inset-0 flex flex-col justify-end px-5 pb-10 pt-20 text-left sm:px-8 sm:pb-9 lg:px-10 lg:pb-10">
            <h1 className="max-w-[min(100%,22rem)] text-[1.625rem] font-semibold leading-[1.12] tracking-[-0.02em] text-white text-balance drop-shadow-[0_2px_20px_rgba(0,0,0,0.35)] sm:max-w-4xl sm:text-4xl lg:text-[2.65rem] lg:leading-[1.08]">
              {tour.title}
            </h1>
            {tour.tagline?.trim() ? (
              <p className="mt-2.5 max-w-2xl text-[14px] font-medium leading-snug tracking-tight text-white/85 line-clamp-2 sm:mt-3 sm:text-[15px]">
                {tour.tagline.trim()}
              </p>
            ) : null}
            <span className="mt-2.5 inline-flex w-fit max-w-full items-center rounded-full border border-white/22 bg-white/[0.09] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/88 backdrop-blur-md sm:mt-3 sm:px-3 sm:py-1.5 sm:text-[9px] sm:tracking-[0.13em] md:text-[10px]">
              Trusted by 50,000+ Travelers
            </span>
          </div>
        </div>

        {/* ================= MAIN CONTENT & SIDEBAR (Overlap Hero) ================= */}
        <div className="relative z-10 mx-auto -mt-8 flex max-w-7xl flex-col gap-5 px-4 pt-0.5 sm:-mt-20 sm:px-6 sm:pt-0 lg:-mt-28 lg:flex-row lg:gap-8 lg:px-8">
          {/* LEFT: MAIN CONTENT */}
          <div className="flex flex-col gap-4 sm:gap-5 lg:w-2/3">
            <div className="td-card-b td-card-b--hero-handoff px-4 pb-3 pt-3.5 backdrop-blur-[2px] supports-[backdrop-filter]:bg-white/80 sm:px-5 sm:py-3.5">
              <div className="flex flex-wrap gap-1.5 sm:gap-2.5">
                {classicHeroChips.map((c) => {
                  const ChipIcon = c.Icon;
                  return (
                    <span
                      key={c.key}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-neutral-200/80 bg-neutral-50/88 px-2.5 py-1 text-[10px] font-medium tracking-tight text-neutral-700 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[11px] sm:font-semibold sm:text-neutral-800 md:text-[12px]"
                    >
                      <ChipIcon className="h-3 w-3 shrink-0 text-neutral-400 sm:h-3.5 sm:w-3.5 sm:text-neutral-500" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 truncate">{c.text}</span>
                    </span>
                  );
                })}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-neutral-200/65 pt-2.5 text-neutral-600 sm:mt-3 sm:gap-2 sm:border-neutral-200/80 sm:pt-3 sm:text-neutral-700">
                <div className="flex items-center gap-0.5 text-amber-500/95" aria-hidden>
                  {[1, 2, 3, 4, 5].map((i: number) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 ${
                        i <= fullStars ? 'fill-amber-500 text-amber-500' : 'fill-transparent text-amber-500/40'
                      }`}
                      strokeWidth={i <= fullStars ? 0 : 1.35}
                    />
                  ))}
                </div>
                <span className="text-[12px] font-semibold tabular-nums text-neutral-800 sm:text-[13px] sm:font-bold sm:text-neutral-900 md:text-sm">
                  {tour.rating != null ? Number(tour.rating).toFixed(1) : '—'}
                </span>
                <span className="text-[10px] font-medium text-neutral-500 sm:text-[11px] md:text-[12px]">
                  ({tour.reviewCount ?? 0} {t('tour.reviews')})
                </span>
              </div>
            </div>
            {keyInfoItems.length > 0 ? (
              <TourDetailKeyInfoGrid title={copy.detail.atAGlance} items={keyInfoItems} />
            ) : null}
            {/* 1. Why Choose Us (너비·높이 5% 확대, 글씨 약간 확대) */}
            <div className="td-card-b mx-auto flex w-[75%] max-w-full flex-col items-center justify-center gap-2 rounded-design-lg py-2.5 px-3 text-center font-sans sm:flex-row sm:gap-4 sm:rounded-full sm:py-3 sm:px-5">
              <div className="flex flex-row items-center gap-2.5 sm:gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-[12px] sm:text-[13px] text-slate-900 leading-tight tracking-tight">{t('tour.securePaymentTitle')}</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 font-medium leading-snug">{t('tour.securePaymentSub')}</p>
                </div>
              </div>
              <div className="hidden sm:block w-px h-6 bg-slate-200" />
              <div className="flex flex-row items-center gap-2.5 sm:gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5 text-slate-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-[12px] sm:text-[13px] text-slate-900 leading-tight tracking-tight">{t('tour.expertLocalGuides')}</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 font-medium leading-snug">{t('tour.expertLocalGuidesSub')}</p>
                </div>
              </div>
              <div className="hidden sm:block w-px h-6 bg-slate-200" />
              <div className="flex flex-row items-center gap-2.5 sm:gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-[12px] sm:text-[13px] text-slate-900 leading-tight tracking-tight">{t('tour.verifiedLLC')}</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 font-medium leading-snug">{t('tour.verifiedLLCSub')}</p>
                </div>
              </div>
            </div>

            {/* Why this fits you (ViewModel) */}
            {tour.whyThisFitsYou?.length > 0 && (
              <div className="w-full p-3 sm:p-4 rounded-design-lg itinerary-glass-card font-sans">
                <h2 className="mb-2 text-[15px] font-semibold tracking-tight text-neutral-900">{copy.detail.whyThisFitsYou}</h2>
                <ul className="space-y-1.5">
                  {tour.whyThisFitsYou.map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-slate-700">
                      <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Booking timeline: prefer server-provided (tour.bookingTimeline); fallback to client-computed only when server has none */}
            <div className="w-full">
              <BookingTimelineSection
                serverTimeline={tour.bookingTimeline ?? undefined}
                selectedDateForFallback={timelineSelectedDate}
                glassCard
              />
            </div>

            {/* Cancellation policy (centralized copy) */}
            <div className="w-full p-3 sm:p-4 rounded-design-lg itinerary-glass-card font-sans">
              <h2 className="mb-1.5 text-[15px] font-semibold tracking-tight text-neutral-900">{copy.detail.cancellationPolicy}</h2>
              <p className="text-[13px] leading-snug text-slate-600">{tour.cancellationPolicy}</p>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{copy.checkout.confirmationEmailNote}</p>
            </div>

            {/* Who this is best for (ViewModel) */}
            {tour.whoThisIsBestFor?.length > 0 && (
              <div className="w-full p-3 sm:p-4 rounded-design-lg itinerary-glass-card font-sans">
                <h2 className="mb-2 text-[15px] font-semibold tracking-tight text-neutral-900">{copy.detail.whoThisIsBestFor}</h2>
                <ul className="space-y-1">
                  {tour.whoThisIsBestFor.map((line, i) => (
                    <li key={i} className="text-[13px] leading-snug text-slate-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 2. Photo Gallery (asymmetric grid, +N Photos) */}
            <div className="flex flex-col items-center mt-2 sm:mt-4">
              <span className="inline-flex items-center border border-slate-200/90 bg-white text-slate-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-3 shadow-sm">{t('tour.galleryTag')}</span>
              <h2 className="text-2xl sm:text-3xl font-black mb-6 sm:mb-8 text-slate-900 tracking-tight">{t('tour.capturedMoments')}</h2>
              <div className="w-full grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-4 lg:px-6 grid-rows-[1fr_1fr_auto] sm:grid-rows-none">
                {/* Left: big image (mobile row-span-2, sm single row) */}
                <div className="group relative row-span-2 sm:row-span-1 h-48 min-h-[180px] sm:min-h-0 sm:h-80 w-full rounded-[1.75rem] overflow-hidden border border-slate-200/80 shadow-design-sm">
                  {mainImage ? (
                    <Image src={mainImage} alt={tour.title} fill className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" sizes="(max-width:640px) 50vw, 50vw" />
                  ) : (
                    <div className="w-full h-full bg-slate-200" />
                  )}
                </div>
                {/* Mobile only: right top small */}
                <div className="group relative h-24 min-h-[90px] sm:hidden w-full rounded-design-md overflow-hidden border border-slate-200/80 shadow-design-sm">
                  {sub1 ? (
                    <Image src={sub1} alt="" fill className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" sizes="50vw" />
                  ) : (
                    <div className="w-full h-full bg-slate-200" />
                  )}
                </div>
                {/* Mobile only: right bottom small */}
                <div className="group relative h-24 min-h-[90px] sm:hidden w-full rounded-design-md overflow-hidden border border-slate-200/80 shadow-design-sm">
                  {sub2 ? (
                    <Image src={sub2} alt="" fill className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" sizes="50vw" />
                  ) : (
                    <div className="w-full h-full bg-slate-200" />
                  )}
                </div>
                {/* sm+: right column (two stacked + overlay on bottom) */}
                <div className="hidden sm:grid sm:grid-rows-2 sm:gap-4 sm:h-80 w-full">
                  <div className="group relative w-full h-full rounded-[1.75rem] overflow-hidden border border-slate-200/80 shadow-design-sm">
                    {sub1 ? (
                      <Image src={sub1} alt="" fill className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" sizes="50vw" />
                    ) : (
                      <div className="w-full h-full bg-slate-200" />
                    )}
                  </div>
                  <div className="group relative w-full h-full rounded-[1.75rem] overflow-hidden border border-slate-200/80 shadow-design-sm cursor-pointer">
                    {nextGalleryImage ? (
                      <Image src={nextGalleryImage} alt="" fill className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" sizes="50vw" />
                    ) : (
                      <div className="w-full h-full bg-slate-200" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                      <span className="text-white font-extrabold text-lg tracking-wide">{t('tour.morePhotos', { count: Math.max(0, imageCount - 3) })}</span>
                    </div>
                  </div>
                </div>
                {/* Mobile only: +N Photos card full width below (배경: 갤러리 다음 사진) */}
                <div className="col-span-2 row-start-3 sm:hidden group relative h-24 min-h-[90px] w-full rounded-design-md overflow-hidden border border-slate-200/80 shadow-design-sm cursor-pointer flex items-center justify-center bg-slate-200">
                  {nextGalleryImage ? (
                    <>
                      <Image src={nextGalleryImage} alt="" fill className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" sizes="100vw" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors z-[1]" />
                    </>
                  ) : null}
                  <span className={`relative z-10 font-extrabold text-lg tracking-wide ${nextGalleryImage ? 'text-white drop-shadow-md' : 'text-slate-600'}`}>{t('tour.morePhotos', { count: Math.max(0, imageCount - 3) })}</span>
                </div>
              </div>
            </div>

            {/* 3. The Adventure Unfolds (Timeline) — 버스투어: 프리미엄 일정 UI(샌드박스 동일) */}
            <div
              className={
                tour.type === 'bus'
                  ? 'w-full -mx-3 px-0 sm:-mx-4 sm:px-0 lg:mx-0 lg:px-0'
                  : 'flex flex-col items-center'
              }
              id="details-content"
            >
              {tour.type === 'bus' && busTourPremiumStops ? (
                <BusTourItinerarySection
                  stops={busTourPremiumStops}
                  journeyTitle={
                    /busan|부산/i.test(`${tour.title} ${tour.city}`)
                      ? 'Your journey through Busan'
                      : `Your journey through ${tour.city || 'Korea'}`
                  }
                  pickupInfoSummary={busPickupInfoSummary || undefined}
                  pickupInfoHeading={t('tour.pickupPointsTitle')}
                />
              ) : (
                <>
                  <span className="inline-flex items-center border border-slate-200/90 bg-white text-blue-600 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-3 shadow-sm">{t('tour.yourDayAtGlance')}</span>
                  <h2 className="text-2xl sm:text-3xl font-black mb-2 text-center text-slate-900 tracking-tight">{t('tour.theAdventureUnfolds')}</h2>
                  <p className="text-sm sm:text-base text-slate-500 font-medium text-center mb-8 sm:mb-12">{t('tour.cinematicDayTrip')}</p>
                  {tour.pickupPoints?.length > 0 && (
                    <p className="text-sm text-slate-500 mb-4">{t('tour.pickupPointsCount', { count: tour.pickupPoints.length })}</p>
                  )}
                  {destinationItems.length === 0 ? (
                    <p className="text-slate-500 text-sm">{t('tour.itinerary')} — {t('tour.noPickupPoints') || 'No schedule data.'}</p>
                  ) : (
                    <div className="w-full max-w-4xl relative flex flex-col items-center px-2 sm:px-4" id="tour-timeline">
                      {/* 가운데 직선: 컨테이너 전체 높이에 맞춰 표시 (CSS 그라데이션) */}
                      <div
                        className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 pointer-events-none z-0 opacity-90 bg-gradient-to-b from-blue-500 via-slate-400 to-blue-500"
                        aria-hidden
                      />
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
                </>
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
              <span className="inline-flex items-center border border-slate-200/90 bg-white text-slate-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-3 shadow-sm">{t('tour.logisticsTag')}</span>
              <h2 className="text-2xl sm:text-3xl font-black mb-6 sm:mb-8 text-slate-900 tracking-tight">{t('tour.meetingPickup')}</h2>
              <div className="w-full rounded-design-lg p-6 sm:p-8 itinerary-glass-card flex flex-col lg:flex-row flex-wrap gap-8 items-stretch lg:px-8">
                <div className="flex-1 flex flex-col justify-center space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-design-md bg-blue-50 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-extrabold text-lg sm:text-xl text-slate-900">{t('tour.pickupPointsTitle')}</h3>
                  </div>
                  {tour.pickupPoints?.length > 0 ? (
                    <div className="p-4 sm:p-5 rounded-design-lg bg-white border border-slate-200/80">
                      <ul className="space-y-2">
                        {tour.pickupPoints.map((point, idx) => {
                          const timeStr = point.pickup_time ? String(point.pickup_time).replace(/(\d{1,2}:\d{2})(:\d{2})?$/, '$1') : '';
                          const pickupLabel = locale === 'zh-TW' ? '接送地點' : '接送地点';
                          const rawName = point.name || point.address || '';
                          const name = rawName.replace(/取货地点|取貨地點|接机|接機/g, pickupLabel);
                          return (
                            <li key={point.id || idx} className="flex items-baseline gap-2 text-sm">
                              {timeStr ? <span className="font-semibold text-slate-700 shrink-0">{timeStr}</span> : null}
                              {timeStr && name ? <span className="text-slate-500"> · </span> : null}
                              <span className="text-slate-900 font-medium">{name || '—'}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="flex-1 w-full min-h-[250px]">
                  {(() => {
                    const pointsWithCoords = (tour.pickupPoints || []).filter((p: any) => typeof p.lat === 'number' && typeof p.lng === 'number' && !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
                    const locations = pointsWithCoords.map((p: any) => ({ id: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng }));
                    return (
                      <div className="w-full h-full min-h-[250px] rounded-design-lg overflow-hidden shadow-inner border border-slate-200">
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
                  <div className="flex items-center gap-2 rounded-design-md py-2 px-3 bg-white border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-slate-200/80 flex items-center justify-center shrink-0">
                      <Navigation className="w-3.5 h-3.5 text-slate-700" />
                    </div>
                    <p className="text-[10px] leading-snug font-medium text-slate-800">{t('tour.pickupNoticeExactTimes')}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-design-md py-2 px-3 bg-white border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-slate-200/80 flex items-center justify-center shrink-0">
                      <Clock className="w-3.5 h-3.5 text-slate-700" />
                    </div>
                    <p className="text-[10px] leading-snug font-medium text-slate-800">{t('tour.pickupNoticeArriveEarly')}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-design-md py-2 px-3 bg-blue-50/90 border border-blue-100">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <p className="text-[10px] leading-snug font-medium text-slate-800">{t('tour.pickupNoticeNoShow')}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-design-md py-2 px-3 bg-white border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-slate-200/80 flex items-center justify-center shrink-0">
                      <Plane className="w-3.5 h-3.5 text-slate-700" />
                    </div>
                    <p className="text-[10px] leading-snug font-medium text-slate-800">{t('tour.pickupNoticeAirport')}</p>
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
              <span className="inline-flex items-center border border-slate-200/90 bg-white text-slate-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-3 shadow-sm">Quick Info</span>
              <h2 className="mb-6 text-base font-semibold tracking-tight text-neutral-900 sm:mb-8">{copy.detail.planEssentials}</h2>
              <div className="w-full grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4 lg:px-6">
                <div className="rounded-design-lg p-4 sm:p-6 flex flex-col items-center justify-center text-center itinerary-glass-card">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-50 flex items-center justify-center mb-2 sm:mb-3 shadow-inner">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Duration</span>
                  <span className="font-black text-sm sm:text-base text-slate-900">{tour.duration || '—'}</span>
                </div>
                <div className="rounded-design-lg p-4 sm:p-6 flex flex-col items-center justify-center text-center itinerary-glass-card">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2 sm:mb-3 shadow-inner">
                    <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Languages</span>
                  <span className="font-black text-xs sm:text-base text-slate-900">En, 中文, KR</span>
                </div>
              </div>
              {tour.type === 'bus' ? (
                <div className="w-full -mx-4 sm:mx-0">
                  <BusTourInclusionsSection
                    included={busInclusionLines}
                    notIncluded={busExclusionLines}
                    labels={{
                      eyebrow: 'Package Details',
                      title: t('tour.whatsIncluded'),
                      tabIncluded: t('tour.included'),
                      tabNotIncluded: t('tour.notIncluded'),
                      tabGoodToKnow: 'Good to Know',
                    }}
                  />
                </div>
              ) : (
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:px-6">
                  <div className="rounded-design-lg p-5 sm:p-6 itinerary-glass-card">
                    <h3 className="font-bold flex items-center gap-2 mb-3 sm:mb-4 text-sm sm:text-base text-slate-900">
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" /> {t('tour.included')}
                    </h3>
                    <ul className="space-y-2 sm:space-y-3">
                      {(tour.inclusions?.length ? tour.inclusions : ['Round-trip Transport', 'Professional Guide']).map((item: string | { text?: string }, i: number) => (
                        <li key={i} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-700 font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" /> {typeof item === 'string' ? item : (item as { text?: string }).text}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-design-lg p-5 sm:p-6 itinerary-glass-card">
                    <h3 className="font-bold flex items-center gap-2 mb-3 sm:mb-4 text-sm sm:text-base text-slate-900">
                      <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" /> {t('tour.notIncluded')}
                    </h3>
                    <ul className="space-y-2 sm:space-y-3">
                      {(tour.exclusions?.length ? tour.exclusions : ['Personal Expenses', 'Meals & Snacks']).map((item: string | { text?: string }, i: number) => (
                        <li key={i} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-700 font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" /> {typeof item === 'string' ? item : (item as { text?: string }).text}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

        <div className="bottom-section border-t border-slate-200">
          <section
            className="tour-reviews-section td-card-a rounded-design-lg p-6"
            aria-label={t('tour.reviews')}
          >
            <TourReviewsSection tourId={tour.id} tourTitle={tour.title} />
          </section>

          {highlightsToShow.length > 0 && (
            <section className="bottom-section-card td-card-c">
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
            <section className="bottom-section-card td-card-c">
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
            <section className="bottom-section-card td-card-c">
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
                  <div className="rounded-2xl border border-neutral-100 bg-white/90 px-2 py-2 sm:px-3">
                    <FaqAccordion items={tour.faqs} />
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="bottom-section-card td-card-c">
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
            <section className="bottom-section-card td-card-c">
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
            <div ref={bookingRef} className="mt-4 lg:mt-0 lg:w-1/3">
              <div className="sticky top-8 overflow-hidden rounded-3xl border border-neutral-100 bg-white/95 p-6 shadow-2xl shadow-black/5 backdrop-blur-xl sm:p-7">
                <EnhancedBookingSidebar tour={tour} onDateSelect={setTimelineSelectedDate} />
              </div>
            </div>
        </div>

        {/* ================= MOBILE STICKY BOTTOM BAR (Glassmorphism) ================= */}
        <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
          <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-white to-transparent" aria-hidden />
          <div className="safe-area-pb border-t border-neutral-100 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.12)]">
            <div className="mx-auto flex max-w-md items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-semibold tracking-tight text-neutral-900">
                    {formatPrice(tour.originalPrice && tour.originalPrice > tour.price ? tour.price : tour.price)}
                  </span>
                  <span className="text-[13px] font-medium text-neutral-500">/ person</span>
                </div>
                <p className="mt-0.5 text-[10px] font-medium text-blue-600">{t('tour.payOnlineToBook')}</p>
              </div>
              <button
                type="button"
                onClick={handleCheckAvailability}
                className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-6 text-[15px] font-medium text-white shadow-lg shadow-neutral-900/20 transition-transform active:scale-[0.98] hover:bg-neutral-800"
              >
                <span>Book Now</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="h-28 md:hidden" />
    </div>
  );
}
