'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { useTranslations } from '@/lib/i18n';
import { MapPin, Users, Car } from 'lucide-react';
import type { ProposedTourItem } from '@/app/api/custom-join-tour/proposed/route';

export default function ProposedToursPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const idFromQuery = searchParams.get('id');
  const [list, setList] = useState<ProposedTourItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(idFromQuery);

  useEffect(() => {
    if (idFromQuery) setSelectedId(idFromQuery);
  }, [idFromQuery]);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/custom-join-tour/proposed', { cache: 'no-store' });
      const data = await res.json();
      const tours = data.proposedTours || [];
      setList(tours);
      if (idFromQuery && tours.some((p: ProposedTourItem) => p.id === idFromQuery)) setSelectedId(idFromQuery);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [idFromQuery]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const onVisible = () => fetchList();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchList]);

  const selected = selectedId ? list.find((p) => p.id === selectedId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {t('home.proposedTours.sectionTitle')}
          </h1>
          <Link
            href="/custom-join-tour?propose=1"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-md"
          >
            {t('home.proposedTours.propose')} ✨
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-500 mb-4">{t('home.proposedTours.noItems')}</p>
            <Link
              href="/custom-join-tour?propose=1"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-md"
            >
              {t('home.proposedTours.propose')} ✨
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ul className="space-y-2">
              {list.map((pt) => (
                <li key={pt.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(pt.id)}
                    className={`w-full text-left rounded-xl border p-3 sm:p-4 transition ${
                      selectedId === pt.id
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <p className="font-medium text-gray-900 line-clamp-1">{pt.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('home.proposedTours.participantsCount').replace('{{n}}', String(pt.participants))} · {pt.vehicle_type === 'large_van' ? t('home.proposedTours.largeVan') : t('home.proposedTours.van')} · {(pt.total_price_krw / 10000).toFixed(0)}만 원
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 min-h-[200px]">
              {selected ? (
                <>
                  <h2 className="text-lg font-bold text-gray-900 mb-3">{selected.title}</h2>
                  {selected.summary && <p className="text-sm text-gray-600 mb-3">{selected.summary}</p>}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs">
                      <Users className="w-3.5 h-3.5" />
                      {t('home.proposedTours.participantsCount').replace('{{n}}', String(selected.participants))}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs">
                      <Car className="w-3.5 h-3.5" />
                      {selected.vehicle_type === 'large_van' ? t('home.proposedTours.largeVan') : t('home.proposedTours.van')}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs">
                      {(selected.total_price_krw / 10000).toFixed(0)}만 원
                    </span>
                  </div>
                  <div className="space-y-2">
                    {selected.schedule.map((day) => (
                      <div key={day.day} className="border-b border-gray-100 pb-2 last:border-0">
                        <p className="text-xs font-semibold text-gray-500 mb-1">
                          {t('home.proposedTours.dayCount').replace('{{n}}', String(day.day))}
                        </p>
                        <ul className="space-y-2">
                          {(day.places || []).map((place: { name?: string; address?: string; image_url?: string | null; overview?: string | null }, i: number) => (
                            <li key={i} className="flex gap-2 items-start text-sm">
                              {place.image_url ? (
                                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                                  <Image
                                    src={place.image_url}
                                    alt={place.name || ''}
                                    width={56}
                                    height={56}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="text-gray-800 font-medium">{place.name || '-'}</span>
                                {place.address && <span className="text-xs text-gray-500 block truncate">{place.address}</span>}
                                {place.overview && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{place.overview}</p>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">{t('home.proposedTours.selectPrompt')}</p>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}
