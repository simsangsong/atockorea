'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ItineraryDetail } from '@/types/tour';

interface ItineraryTimelineProps {
  items: ItineraryDetail[];
  className?: string;
}

export default function ItineraryTimeline({ items, className = '' }: ItineraryTimelineProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  if (!items?.length) return null;

  return (
    <div className={`relative ${className}`}>
      <div
        className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-200 via-slate-200 to-orange-200"
        aria-hidden
      />
      <ul className="space-y-0">
        {items.map((step, index) => (
          <li key={index} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
              <span className="text-xs font-semibold text-gray-500 tabular-nums min-w-[3rem] text-center">
                {step.time}
              </span>
              <span
                className="mt-2 w-6 h-6 rounded-full border-2 border-white bg-blue-500 shadow-sm flex items-center justify-center flex-shrink-0 z-10"
                aria-hidden
              />
            </div>
            <div className="flex-1 min-w-0 pt-0 pb-1">
              <h4 className="text-sm font-semibold text-gray-900">{step.activity}</h4>
              {step.description && (
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">{step.description}</p>
              )}
              {step.images && step.images.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {step.images.map((imgUrl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightboxImage(imgUrl)}
                      className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity"
                    >
                      <Image
                        src={imgUrl}
                        alt={`${step.activity} ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
            className="absolute top-4 right-4 z-[101] p-3 bg-white/20 rounded-full hover:bg-white/30"
            aria-label="Close"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <Image
              src={lightboxImage}
              alt=""
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
        </div>
      )}
    </div>
  );
}
