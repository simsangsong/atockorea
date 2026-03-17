'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import TourListCard from '@/components/tour/TourListCard';
import { SearchSummaryBar } from '@/components/list/SearchSummaryBar';
import { adaptToursListResponse } from '@/src/lib/adapters/tours-adapter';
import type { TourCardViewModel } from '@/src/types/tours';
import { useCurrencyOptional } from '@/lib/currency';
import { useTranslations } from '@/lib/i18n';
import { COPY } from '@/src/design/copy';

const TOURS_LIMIT = 500;

export default function ToursListPage() {
  const t = useTranslations();
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
  }, [t]);

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />
      <main className="pb-24">
        <section className="border-b border-[#e5e5ea]/70 bg-gradient-to-b from-white via-[#f9f9fb] to-[#f5f5f7]">
          <div className="mx-auto max-w-5xl px-4 pt-6 pb-4 sm:pt-8 sm:pb-5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#111111]">
              {t('home.sections.standardBusDayTour')}
            </h1>
            <p className="mt-1 text-sm text-[#6e6e73]">{t('toursList.subtitle')}</p>
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
            <div className="mx-auto w-[90%] max-w-3xl rounded-3xl bg-white/95 px-4 py-10 text-center text-[#6e6e73] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#0c66ff] border-t-transparent" />
              <p className="text-[#111111]">{COPY.listDetail.loadingTours}</p>
            </div>
          ) : error ? (
            <div className="mx-auto w-[90%] max-w-3xl rounded-3xl bg-white/95 px-4 py-6 text-center text-[#6e6e73] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
              <p className="font-medium text-red-600">{error}</p>
            </div>
          ) : tours.length === 0 ? (
            <div className="mx-auto w-[90%] max-w-3xl rounded-3xl bg-white/95 px-4 py-10 text-center text-[#6e6e73] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
              <p className="font-medium text-[#111111]">{COPY.listDetail.noToursFound}</p>
            </div>
          ) : (
            <div className="space-y-4">
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
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}
