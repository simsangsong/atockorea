'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';

export type PlaceDetailPayload = {
  id: number | null;
  lang_type: string | null;
  title: string | null;
  address: string | null;
  image_url: string | null;
  overview: string | null;
  open_time: string | null;
  use_fee: string | null;
  tel: string | null;
  mapx: number | null;
  mapy: number | null;
  detail_images: string[];
  category: string | null;
  source_origin: string | null;
  from_fallback_lang?: 'ko';
};

export interface PlaceDetailModalCopy {
  title: string;
  close: string;
  loading: string;
  noMatch: string;
  koFallbackNote: string;
  labels: {
    address: string;
    overview: string;
    openTime: string;
    useFee: string;
    tel: string;
    coordinates: string;
    category: string;
    source: string;
    gallery: string;
    lang: string;
    id: string;
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  place: PlaceDetailPayload | null;
  copy: PlaceDetailModalCopy;
};

export default function PlaceDetailModal({ open, onClose, loading, error, place, copy }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal
            aria-labelledby="place-detail-title"
            className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/90">
              <h2 id="place-detail-title" className="text-sm font-bold text-slate-900 tracking-wide">
                {copy.title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition"
                aria-label={copy.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-sm text-slate-700">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
                  {copy.loading}
                </div>
              )}
              {!loading && error && <p className="text-rose-600 text-sm py-4">{error}</p>}
              {!loading && !error && !place && <p className="text-slate-500 py-6 text-center">{copy.noMatch}</p>}
              {!loading && !error && place && (
                <div className="space-y-4">
                  {place.from_fallback_lang === 'ko' && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{copy.koFallbackNote}</p>
                  )}
                  {place.image_url && (
                    <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-slate-100">
                      <Image src={place.image_url} alt={place.title ?? ''} fill className="object-cover" sizes="(max-width: 512px) 100vw, 512px" />
                    </div>
                  )}
                  {place.title && <p className="text-base font-semibold text-slate-900">{place.title}</p>}
                  <dl className="space-y-3">
                    {place.id != null && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{copy.labels.id}</dt>
                        <dd className="mt-0.5 text-slate-800">{place.id}</dd>
                      </div>
                    )}
                    {place.lang_type && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{copy.labels.lang}</dt>
                        <dd className="mt-0.5 text-slate-800">{place.lang_type}</dd>
                      </div>
                    )}
                    {place.address && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{copy.labels.address}</dt>
                        <dd className="mt-0.5 text-slate-800 whitespace-pre-wrap">{place.address}</dd>
                      </div>
                    )}
                    {place.overview && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{copy.labels.overview}</dt>
                        <dd className="mt-0.5 text-slate-800 whitespace-pre-wrap leading-relaxed">{place.overview}</dd>
                      </div>
                    )}
                    {place.open_time && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{copy.labels.openTime}</dt>
                        <dd className="mt-0.5 text-slate-800 whitespace-pre-wrap">{place.open_time}</dd>
                      </div>
                    )}
                    {place.use_fee && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{copy.labels.useFee}</dt>
                        <dd className="mt-0.5 text-slate-800 whitespace-pre-wrap">{place.use_fee}</dd>
                      </div>
                    )}
                    {place.tel && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{copy.labels.tel}</dt>
                        <dd className="mt-0.5 text-slate-800">{place.tel}</dd>
                      </div>
                    )}
                    {place.mapx != null && place.mapy != null && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{copy.labels.coordinates}</dt>
                        <dd className="mt-0.5 text-slate-800 font-mono text-xs">
                          {place.mapy}, {place.mapx}
                        </dd>
                      </div>
                    )}
                    {place.category && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{copy.labels.category}</dt>
                        <dd className="mt-0.5 text-slate-800">{place.category}</dd>
                      </div>
                    )}
                    {place.source_origin && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{copy.labels.source}</dt>
                        <dd className="mt-0.5 text-slate-800">{place.source_origin}</dd>
                      </div>
                    )}
                  </dl>
                  {place.detail_images.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{copy.labels.gallery}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {place.detail_images.map((url, i) => (
                          <div key={`${url}-${i}`} className="relative aspect-video rounded-lg overflow-hidden bg-slate-100">
                            <Image src={url} alt="" fill className="object-cover" sizes="(max-width: 512px) 50vw, 256px" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-100 flex justify-end bg-slate-50/90">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition"
              >
                {copy.close}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
