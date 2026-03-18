'use client';

import { useState, useEffect } from 'react';
import TourCard from '@/components/TourCard';
import { useTranslations, useI18n } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

export interface TourSectionFetchParams {
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  features?: string;
  city?: string;
  /** When true, omit useScoreSort so API returns requested sort (e.g. price asc for Best Value) */
  useRequestedSort?: boolean;
}

interface TourSectionRowProps {
  /** i18n key for section title (e.g. home.sections.popularTours) */
  titleKey: string;
  /** Optional "See all" link (e.g. /tours?sortBy=rating) */
  seeAllHref?: string;
  /** API query params for /api/tours */
  fetchParams: TourSectionFetchParams;
  /** Override locale for fetch */
  localeOverride?: Locale;
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80';

export default function TourSectionRow({
  titleKey,
  seeAllHref,
  fetchParams,
  localeOverride,
}: TourSectionRowProps) {
  const t = useTranslations();
  const { locale: contextLocale } = useI18n();
  const locale = localeOverride ?? contextLocale;
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchTours = () => {
    setLoading(true);
    setFetchError(false);
    const params = new URLSearchParams();
    params.set('limit', String(fetchParams.limit ?? 4));
    params.set('isActive', 'true');
    params.set('locale', locale);
    if (fetchParams.sortBy) params.set('sortBy', fetchParams.sortBy);
    if (fetchParams.sortOrder) params.set('sortOrder', fetchParams.sortOrder);
    if (fetchParams.features) params.set('features', fetchParams.features);
    if (fetchParams.city) params.set('city', fetchParams.city);
    if (fetchParams.useRequestedSort) params.set('useScoreSort', 'false');

    fetch(`/api/tours?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { tours: [] }))
      .then((data) => {
        setTours(Array.isArray(data.tours) ? data.tours : []);
      })
      .catch(() => {
        setTours([]);
        setFetchError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    params.set('limit', String(fetchParams.limit ?? 4));
    params.set('isActive', 'true');
    params.set('locale', locale);
    if (fetchParams.sortBy) params.set('sortBy', fetchParams.sortBy);
    if (fetchParams.sortOrder) params.set('sortOrder', fetchParams.sortOrder);
    if (fetchParams.features) params.set('features', fetchParams.features);
    if (fetchParams.city) params.set('city', fetchParams.city);
    if (fetchParams.useRequestedSort) params.set('useScoreSort', 'false');

    fetch(`/api/tours?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { tours: [] }))
      .then((data) => {
        if (!mounted) return;
        setTours(Array.isArray(data.tours) ? data.tours : []);
        setFetchError(false);
      })
      .catch(() => {
        if (mounted) {
          setTours([]);
          setFetchError(true);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [locale, fetchParams.limit, fetchParams.sortBy, fetchParams.sortOrder, fetchParams.features, fetchParams.city, fetchParams.useRequestedSort]);

  if (loading) {
    return (
      <section className="py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-7 w-48 bg-[#E1E5EA] rounded-full animate-pulse mb-4" />
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-[44vw] sm:w-44 lg:w-52 aspect-[5/4.6] bg-[#E1E5EA] rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Empty or error: keep section visible with title + "See all" so the block doesn't disappear (no "white hole")
  if (tours.length === 0) {
    return (
      <section className="py-4 sm:py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {t(titleKey)}
            </h2>
            {seeAllHref && (
              <a
                href={seeAllHref}
                className="text-sm font-semibold text-[#1E4EDF] hover:underline whitespace-nowrap min-h-[44px] inline-flex items-center"
              >
                {t('home.sections.seeAll')}
              </a>
            )}
          </div>
          <div className="rounded-xl border border-[#E1E5EA] bg-[#F5F7FA] px-4 py-6 text-center">
            <p className="text-sm text-slate-600 mb-3">
              {fetchError ? t('errors.somethingWentWrong') : t('listDetail.noToursFound')}
            </p>
            {fetchError && (
              <button
                type="button"
                onClick={fetchTours}
                className="text-sm font-semibold text-[#1E4EDF] hover:underline min-h-[44px]"
              >
                {t('common.tryAgain')}
              </button>
            )}
            {seeAllHref && !fetchError && (
              <a
                href={seeAllHref}
                className="inline-block text-sm font-semibold text-[#1E4EDF] hover:underline min-h-[44px] leading-[44px]"
              >
                {t('home.sections.seeAll')}
              </a>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-4 sm:py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-base sm:text-lg font-bold text-[#1A1A1A]">
            {t(titleKey)}
          </h2>
          {seeAllHref && (
            <a
              href={seeAllHref}
              className="text-sm font-semibold text-[#1E4EDF] hover:underline whitespace-nowrap min-h-[44px] inline-flex items-center"
            >
              {t('home.sections.seeAll')}
            </a>
          )}
        </div>
        <div
          className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scrollbar-thin"
          style={{ scrollbarWidth: 'thin' }}
        >
          {tours.map((tour) => {
            const hasDiscount = tour.originalPrice != null && tour.price != null && tour.originalPrice > tour.price;
            const discount = hasDiscount && tour.originalPrice
              ? Math.round(((tour.originalPrice - tour.price) / tour.originalPrice) * 100)
              : undefined;
            const tourImage = tour.image || (Array.isArray(tour.images) && tour.images[0]) || DEFAULT_IMAGE;
            return (
              <div
                key={tour.id}
                className="flex-shrink-0 w-[44vw] sm:w-44 lg:w-52 snap-start"
              >
                <TourCard
                  id={tour.id}
                  slug={tour.slug}
                  title={tour.title}
                  location={tour.city ?? tour.location}
                  type={tour.duration || 'Day tour'}
                  duration={tour.duration}
                  price={(tour.price ?? 0) / 1000}
                  originalPriceKRW={tour.originalPrice != null && tour.originalPrice > (tour.price ?? 0) ? tour.originalPrice : undefined}
                  priceType={tour.priceType ?? 'person'}
                  image={tourImage}
                  badge={Array.isArray(tour.badges) && tour.badges[0] ? tour.badges[0] : 'Day tour'}
                  rating={tour.rating ?? 4.5}
                  reviewCount={tour.reviewCount ?? 0}
                  bookingCount={tour.bookingCount}
                  discount={discount}
                  badgeVariant="brand"
                  variant="home"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
