'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { useTranslations } from '@/lib/i18n';
import { useCurrencyOptional } from '@/lib/currency';
import {
  MapPin, Users, Car, Calendar, ChevronDown, ChevronUp,
  Sparkles, RefreshCw, Bot, Clock
} from 'lucide-react';
import type { ProposedTourItem } from '@/app/api/custom-join-tour/proposed/route';

function TourCard({
  tour,
  isExpanded,
  onToggle,
}: {
  tour: ProposedTourItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const currency = useCurrencyOptional();

  const totalDays = tour.schedule.length;
  const allPlaces = tour.schedule.flatMap((d) => d.places);
  const coverImage = allPlaces.find((p) => p.image_url)?.image_url ?? null;

  const priceDisplay = currency
    ? currency.formatPrice(tour.total_price_krw)
    : `₩${tour.total_price_krw.toLocaleString()}`;

  const createdDate = new Date(tour.created_at);
  const timeAgo = (() => {
    const diff = Date.now() - createdDate.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  })();

  return (
    <article className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Cover image strip */}
      {coverImage && (
        <div className="relative h-36 w-full overflow-hidden">
          <Image
            src={coverImage}
            alt={tour.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/90 text-white text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {t('home.proposedTours.statusOpen')}
            </span>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            {!coverImage && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {t('home.proposedTours.statusOpen')}
              </span>
            )}
            <h2 className="text-base font-bold text-gray-900 line-clamp-2 leading-snug">
              {tour.title}
            </h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-extrabold text-blue-600">{priceDisplay}</p>
            <p className="text-xs text-gray-400">{t('home.proposedTours.perPerson')}</p>
          </div>
        </div>

        {/* Summary */}
        {tour.summary && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{tour.summary}</p>
        )}

        {/* Hotel / Pickup */}
        {tour.hotel_address && (
          <p className="text-xs text-gray-500 mb-3 flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{tour.hotel_address}</span>
          </p>
        )}
        {/* Meta chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium">
            <Users className="w-3.5 h-3.5" />
            {t('home.proposedTours.participantsCount').replace('{{n}}', String(tour.participants))}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium">
            <Car className="w-3.5 h-3.5" />
            {tour.vehicle_type === 'large_van' ? t('home.proposedTours.largeVan') : t('home.proposedTours.van')}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium">
            <Calendar className="w-3.5 h-3.5" />
            {t('home.proposedTours.dayCount').replace('{{n}}', String(totalDays))}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 text-xs">
            <Clock className="w-3 h-3" />
            {timeAgo}
          </span>
        </div>

        {/* Expandable itinerary */}
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-500" />
            {t('home.proposedTours.viewItinerary')}
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-3">
            {tour.schedule.map((day) => (
              <div key={day.day} className="pl-3 border-l-2 border-blue-100">
                <p className="text-xs font-bold text-blue-600 mb-1.5 uppercase tracking-wide">
                  {t('home.proposedTours.dayLabel').replace('{{n}}', String(day.day))}
                </p>
                <ul className="space-y-2">
                  {(day.places || []).map((place, i) => (
                    <li key={i} className="flex gap-2.5 items-start">
                      {place.image_url ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          <Image
                            src={place.image_url}
                            alt={place.name || ''}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-blue-400 text-[10px] font-bold">{i + 1}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 leading-snug">{place.name || '-'}</p>
                        {place.address && (
                          <p className="text-xs text-gray-400 truncate">{place.address}</p>
                        )}
                        <div className="mt-0.5 min-h-[2rem]">
                          {place.overview ? (
                            <p className="text-sm text-gray-600 line-clamp-3 leading-snug">{place.overview}</p>
                          ) : (
                            <p className="text-sm text-gray-400/60 italic">—</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* CTA: join this specific tour (hotel distance check on target page) */}
        <Link
          href={`/custom-join-tour?join=${tour.id}`}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold transition-all"
        >
          <Sparkles className="w-4 h-4" />
          {t('home.proposedTours.joinThisTour')}
        </Link>
      </div>
    </article>
  );
}

export default function ProposedToursPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const idFromQuery = searchParams?.get('id') ?? null;

  const [list, setList] = useState<ProposedTourItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(idFromQuery);

  const fetchList = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch('/api/custom-join-tour/proposed', { cache: 'no-store' });
      const data = await res.json();
      setList(data.proposedTours || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchList(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchList]);

  useEffect(() => {
    if (idFromQuery) setExpandedId(idFromQuery);
  }, [idFromQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/20">
      <Header />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-5xl">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">
              {t('home.proposedTours.eyebrow')}
            </span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {t('home.proposedTours.pageTitle')}
              </h1>
              <p className="text-sm text-gray-500 mt-1">{t('home.proposedTours.pageSubtitle')}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fetchList(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {t('home.proposedTours.refresh')}
              </button>
              <Link
                href="/custom-join-tour?propose=1"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold transition shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t('home.proposedTours.propose')}
              </Link>
            </div>
          </div>
        </div>

        {/* Live badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {t('home.proposedTours.liveLabel')}
          </span>
          {!loading && (
            <span className="text-xs text-gray-400">
              {t('home.proposedTours.tourCount').replace('{{n}}', String(list.length))}
            </span>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-white border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-36 bg-gray-100" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="flex gap-2">
                    <div className="h-6 w-16 bg-gray-100 rounded-lg" />
                    <div className="h-6 w-16 bg-gray-100 rounded-lg" />
                    <div className="h-6 w-16 bg-gray-100 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-7 h-7 text-blue-400" />
            </div>
            <p className="text-gray-700 font-semibold mb-1">{t('home.proposedTours.noItems')}</p>
            <p className="text-sm text-gray-400 mb-6">{t('home.proposedTours.noItemsSubtitle')}</p>
            <Link
              href="/custom-join-tour?propose=1"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold transition shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              {t('home.proposedTours.propose')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {list.map((tour) => (
              <TourCard
                key={tour.id}
                tour={tour}
                isExpanded={expandedId === tour.id}
                onToggle={() => setExpandedId((prev) => (prev === tour.id ? null : tour.id))}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}
