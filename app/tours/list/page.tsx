'use client';

import React, { useState, useEffect } from 'react';
import TourListCard from '@/components/tour/TourListCard';
import { SearchSummaryBar } from '@/components/list/SearchSummaryBar';
import { adaptToursListResponse } from '@/src/lib/adapters/tours-adapter';
import type { TourCardViewModel } from '@/src/types/tours';
import { useCurrencyOptional } from '@/lib/currency';
import { useTranslations, useCopy, useI18n } from '@/lib/i18n';
import { SitePageShell } from '@/src/components/layout/SitePageShell';

const TOURS_LIMIT = 500;

export default function ToursListPage() {
  const t = useTranslations();
  const { locale } = useI18n();
  const copy = useCopy();
  const currencyCtx = useCurrencyOptional();
  const [tours, setTours] = useState<TourCardViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (priceKRW: number) => {
    if (currencyCtx) return currencyCtx.formatPrice(priceKRW);
    return `₩${Math.round(priceKRW).toLocaleString('ko-KR')}`;
  };

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    params.set('limit', String(TOURS_LIMIT));
    params.set('isActive', 'true');
    params.set('sortBy', 'rating');
    params.set('sortOrder', 'desc');
    params.set('locale', locale);

    fetch(`/api/tours?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { tours: [] }))
      .then((data) => {
        if (!mounted) return;
        const viewModels = adaptToursListResponse(data);
        setTours(viewModels);
      })
      .catch(() => {
        if (mounted) setError(t('toursList.loadFailed'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [t, locale]);

  const panelClass =
    'mx-auto w-[90%] max-w-3xl rounded-[1.75rem] border border-white/20 bg-white/55 px-4 py-10 text-center text-slate-600 shadow-[0_14px_44px_-10px_rgba(15,23,42,0.18)] backdrop-blur-xl';

  return (
    <SitePageShell>
      <main className="pb-24">
        <section className="border-b border-white/25 bg-white/35 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl px-4 pt-6 pb-4 sm:pt-8 sm:pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {t('home.sections.standardBusDayTour')}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{t('toursList.subtitle')}</p>
            {!loading && !error && (
              <div className="mt-3">
                <SearchSummaryBar
                  count={tours.length}
                  destination={null}
                  refineHref="/search"
                />
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-2 py-6 sm:px-4">
          {loading ? (
            <div className={panelClass}>
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <p className="text-slate-800">{copy.listDetail.loadingTours}</p>
            </div>
          ) : error ? (
            <div className={`${panelClass} py-6`}>
              <p className="font-medium text-red-600">{error}</p>
            </div>
          ) : tours.length === 0 ? (
            <div className={panelClass}>
              <p className="font-medium text-slate-800">{copy.listDetail.noToursFound}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-5 md:gap-x-5 md:gap-y-6">
              {tours.map((tour) => (
                <TourListCard
                  key={tour.id}
                  tour={tour}
                  detailHref={`/tour/${tour.id}`}
                  formatPriceFn={formatPrice}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </SitePageShell>
  );
}
