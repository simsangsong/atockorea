'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { useTranslations, useI18n, defaultLocale, type Locale } from '@/lib/i18n';
import { useCurrencyOptional } from '@/lib/currency';
import type { TourDetailViewModel } from '@/src/types/tours';
import { adaptTourDetailResponse } from '@/src/lib/adapters/tours-adapter';
import { buildSmallGroupDetailContent } from '@/components/tour/small-group';
import EastSmallGroupTourV2Page from '@/components/tour-detail/east/v2/EastSmallGroupTourV2Page';
import { FEATURED_JOIN_TOUR_SLUG } from '@/lib/home/home-cta-routes';
import { analytics } from '@/src/design/analytics';

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

/**
 * Legacy client for the flagship East Jeju join tour (fetches `FEATURED_JOIN_TOUR_SLUG`).
 * Public URL is `/tour-product/east-signature-nature-core`; this module remains for rare embeds.
 */
export default function FeaturedEastSmallGroupTourLivePage() {
  const t = useTranslations();
  const { locale } = useI18n();
  const currencyCtx = useCurrencyOptional();
  const [tour, setTour] = useState<TourDetailViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tourId = FEATURED_JOIN_TOUR_SLUG;

  useEffect(() => {
    const ac = new AbortController();

    const urlLocale =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('locale') : null;
    const apiLocale = locale === defaultLocale ? localeQueryForTourApi(urlLocale, locale) : locale;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiUrl =
          typeof window !== 'undefined'
            ? `${window.location.origin}/api/tours/${encodeURIComponent(tourId)}?locale=${encodeURIComponent(apiLocale)}`
            : `/api/tours/${encodeURIComponent(tourId)}?locale=${encodeURIComponent(apiLocale)}`;

        const response = await fetch(apiUrl, { cache: 'no-store', signal: ac.signal });
        if (ac.signal.aborted) return;

        if (!response.ok) {
          if (response.status === 404) setError('Tour not found');
          else {
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
        analytics.detailViewed(viewModel.type, viewModel.pickup?.areaLabel ?? 'Unknown');
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (ac.signal.aborted) return;
        console.error('Error fetching featured tour:', err);
        setError('Failed to load tour. Please try again later.');
        setLoading(false);
      }
    };

    void run();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId, locale]);

  useEffect(() => {
    if (tour?.title) {
      document.title = tour.title;
    } else if (error) {
      document.title = 'Tour Not Found';
    } else {
      document.title = 'Loading Tour...';
    }
  }, [tour, error]);

  const formatPrice = (n: number) =>
    currencyCtx ? currencyCtx.formatPrice(n) : `₩${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(n)}`;

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

  if (error || !tour) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-lg mx-auto">
              <p className="text-red-600 text-lg mb-4">{error || t('tour.tourNotFound')}</p>
              {process.env.NODE_ENV === 'development' && error === 'Tour not found' ? (
                <p className="text-sm text-slate-600 mb-4 text-left rounded-lg bg-slate-100 px-4 py-3">
                  <span className="font-medium text-slate-800">Dev hint:</span> Ensure Supabase has an active row for slug{' '}
                  <code className="rounded bg-white px-1">{FEATURED_JOIN_TOUR_SLUG}</code> (
                  <code className="rounded bg-white px-1">is_active = true</code>). Run{' '}
                  <code className="rounded bg-white px-1 text-[11px]">supabase/manual/insert-east-signature-nature-core-product.sql</code>.
                </p>
              ) : null}
              <a
                href="/tours"
                className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('tour.backToTours')}
              </a>
            </div>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  if (tour.type === 'join') {
    const smallGroupContent = buildSmallGroupDetailContent(tour);

    return (
      <div className="relative min-h-screen overflow-x-hidden bg-transparent pb-0 text-slate-900 lg:pb-24">
        <Header premiumTourDetail />
        <main className="bg-transparent">
          <EastSmallGroupTourV2Page tour={tour} content={smallGroupContent} formatPrice={formatPrice} />
        </main>
        <Footer premiumHandoff />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-16 text-center text-slate-700">
        <p>This tour is not configured as a small-group (join) product.</p>
      </main>
      <Footer />
    </div>
  );
}
