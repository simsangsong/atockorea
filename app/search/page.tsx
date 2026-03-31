'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import TourListCard from '@/components/tour/TourListCard';
import { SearchSummaryBar } from '@/components/list/SearchSummaryBar';
import { adaptToursListResponse } from '@/src/lib/adapters/tours-adapter';
import type { TourCardViewModel } from '@/src/types/tours';
import { useCurrencyOptional } from '@/lib/currency';
import { useI18n, useCopy } from '@/lib/i18n';

function SearchResults() {
  const searchParams = useSearchParams();
  const { locale } = useI18n();
  const copy = useCopy();
  const [results, setResults] = useState<TourCardViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currencyCtx = useCurrencyOptional();

  const cityRaw = searchParams?.get('city');
  const qRaw = searchParams?.get('q');
  const cityParam = cityRaw && cityRaw !== 'All' ? cityRaw : null;
  const qParam = qRaw?.trim() ?? '';

  const formatPrice = (priceKRW: number) => {
    if (currencyCtx) return currencyCtx.formatPrice(priceKRW);
    return `₩${Math.round(priceKRW).toLocaleString('ko-KR')}`;
  };

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    if (cityParam) params.set('city', cityParam);
    if (qParam) params.set('search', qParam);
    params.set('locale', locale);

    fetch(`/api/tours?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { tours: [] }))
      .then((data) => {
        if (!mounted) return;
        const viewModels = adaptToursListResponse(data);
        setResults(viewModels);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message ?? 'Failed to load tours');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [cityParam, qParam, locale]);

  return (
    <>
      <section className="border-b border-[#e5e5ea]/70 bg-gradient-to-b from-white via-[#f9f9fb] to-[#f5f5f7]">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 pb-4 sm:pt-6 sm:pb-5">
          <div>
            <h1 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em] text-[#111111]">
              Search results
            </h1>
            <p className="mt-1 text-[12px] sm:text-[13px] text-[#6e6e73]">
              Find the right tour in seconds. Refine by destination and keyword.
            </p>
          </div>
          {!loading && !error && (
            <SearchSummaryBar
              count={results.length}
              destination={cityParam ?? undefined}
              keyword={qParam || undefined}
              refineHref="/search"
            />
          )}
        </div>
      </section>

      <section className="mx-auto mt-4 w-full max-w-5xl px-2 sm:px-4">
        {loading ? (
          <div className="mx-auto mt-10 w-[90%] max-w-3xl rounded-3xl bg-white/95 px-4 py-6 text-center text-[13px] text-[#6e6e73] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-[#111111]">{copy.listDetail.loadingTours}</p>
          </div>
        ) : error ? (
          <div className="mx-auto mt-10 w-[90%] max-w-3xl rounded-3xl bg-white/95 px-4 py-6 text-center text-[13px] text-[#6e6e73] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <p className="font-medium text-red-600 mb-2">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Retry
            </button>
          </div>
        ) : results.length === 0 ? (
          <div className="mx-auto mt-10 w-[90%] max-w-3xl rounded-3xl bg-white/95 px-4 py-6 text-center text-[13px] text-[#6e6e73] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <p className="font-medium text-[#111111]">{copy.listDetail.noToursFound}</p>
            <p className="mt-1 text-[12px] text-[#6e6e73]">
              Try removing some filters or using a broader keyword.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 pt-1 sm:gap-x-4 sm:gap-y-5 md:gap-x-5 md:gap-y-6">
            {results.map((tour) => (
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
    </>
  );
}

export default function SearchPage() {
  const copy = useCopy();
  return (
    <main className="min-h-screen bg-[#f5f5f7] pb-10">
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#f5f5f7] pb-10 flex items-center justify-center">
            <div className="text-center">
              <p className="text-[#6e6e73]">{copy.listDetail.loadingTours}</p>
            </div>
          </div>
        }
      >
        <SearchResults />
      </Suspense>
    </main>
  );
}
