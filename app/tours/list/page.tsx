'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import TourCardDetail from '@/components/TourCardDetail';
import type { DetailedTour } from '@/data/tours';
import { useCurrencyOptional } from '@/lib/currency';
import { useTranslations } from '@/lib/i18n';

const TOURS_LIMIT = 500;

/** Map API tour to DetailedTour shape for TourCardDetail (schedule, one card per row) */
function mapApiTourToDetail(tour: any, formatPrice: (n: number) => string): DetailedTour {
  const priceNum = typeof tour.price === 'number' ? tour.price : Number(tour.price) || 0;
  const schedule = Array.isArray(tour.schedule) ? tour.schedule : [];
  const scheduleItems = schedule.map((item: any) => ({
    time: item.time ?? '',
    title: item.title ?? '',
    description: item.description,
  }));

  const originalNum = tour.originalPrice != null ? Number(tour.originalPrice) : null;
  const hasDiscount = originalNum != null && originalNum > priceNum && priceNum > 0;
  const discountPercent = hasDiscount && originalNum
    ? Math.round(((originalNum - priceNum) / originalNum) * 100)
    : undefined;

  return {
    id: tour.id,
    city: (tour.city === 'Seoul' || tour.city === 'Busan' || tour.city === 'Jeju' ? tour.city : 'Seoul') as 'Seoul' | 'Busan' | 'Jeju',
    tag: Array.isArray(tour.badges) && tour.badges.length > 0 ? tour.badges.join(' · ') : 'Day tour',
    title: tour.title ?? '',
    price: formatPrice(priceNum),
    originalPrice: hasDiscount && originalNum != null ? formatPrice(originalNum) : undefined,
    discountPercent,
    imageUrl: tour.image ?? (Array.isArray(tour.images) && tour.images[0]) ?? '',
    duration: tour.duration ?? '',
    lunchIncluded: Boolean(tour.lunchIncluded),
    ticketIncluded: Boolean(tour.ticketIncluded),
    pickupInfo: tour.pickupInfo ?? '',
    pickupPointsCount: (() => {
      const count = (tour.pickupPoints?.length ?? tour.pickup_points?.length ?? tour.pickupPointsCount ?? tour.pickup_points_count) || 0;
      if (count === 0 && typeof tour.title === 'string' && tour.title.includes('Busan Top Attractions')) return 3;
      return count;
    })(),
    pickupDisplayKey: (() => {
      const title = (tour.title ?? '').trim();
      if (title.includes('Jeju Private Car Charter') || title.includes('Private Busan Tour')) return 'hotelPickup' as const;
      if (title.includes('Cruise Ship Passengers') || title.includes('Shore Excursion for Cruise')) return 'cruiseTerminalPickup' as const;
      return undefined;
    })(),
    notes: tour.notes ?? tour.description ?? undefined,
    schedule: scheduleItems.length > 0 ? scheduleItems : undefined,
    slug: tour.slug,
  };
}

export default function ToursListPage() {
  const t = useTranslations();
  const currencyCtx = useCurrencyOptional();
  const [tours, setTours] = useState<DetailedTour[]>([]);
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
        const list = Array.isArray(data.tours) ? data.tours : [];
        setTours(list.map((tourItem: any) => mapApiTourToDetail(tourItem, formatPrice)));
      })
      .catch(() => {
        if (mounted) setError(t('toursList.loadFailed'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />
      <main className="pb-24">
        <section className="border-b border-[#e5e5ea]/70 bg-gradient-to-b from-white via-[#f9f9fb] to-[#f5f5f7]">
          <div className="mx-auto max-w-5xl px-4 pt-6 pb-4 sm:pt-8 sm:pb-5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#111111]">
              {t('home.sections.standardBusDayTour')}
            </h1>
            <p className="mt-1 text-sm text-[#6e6e73]">
              {t('toursList.subtitle')}
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-2 py-6 sm:px-4">
          {loading ? (
            <div className="mx-auto w-[90%] max-w-3xl rounded-3xl bg-white/95 px-4 py-10 text-center text-[#6e6e73] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#0c66ff] border-t-transparent" />
              <p className="text-[#111111]">{t('toursList.loadingTours')}</p>
            </div>
          ) : error ? (
            <div className="mx-auto w-[90%] max-w-3xl rounded-3xl bg-white/95 px-4 py-6 text-center text-[#6e6e73] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
              <p className="font-medium text-red-600">{error}</p>
            </div>
          ) : tours.length === 0 ? (
            <div className="mx-auto w-[90%] max-w-3xl rounded-3xl bg-white/95 px-4 py-10 text-center text-[#6e6e73] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
              <p className="font-medium text-[#111111]">{t('toursList.noToursFound')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tours.map((tour) => (
                <TourCardDetail
                  key={tour.id}
                  tour={tour}
                  detailHref={`/tour/${tour.id}`}
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
