'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ItineraryDetail } from '@/types/tour';

interface ItineraryTimelineProps {
  items: ItineraryDetail[];
  className?: string;
  /** Optional height class for step images; e.g. "h-32 sm:h-40" for smaller mobile */
  stepImageClassName?: string;
}

const DOT_COLORS = ['bg-orange-500', 'bg-blue-500', 'bg-orange-500', 'bg-blue-500'];

export default function ItineraryTimeline({ items, className = '', stepImageClassName }: ItineraryTimelineProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  if (!items?.length) return null;

  return (
    <div className={`relative ${className}`}>
      {/* Vertical timeline line */}
      <div
        className="absolute left-[15px] top-6 bottom-6 w-0.5 bg-gray-200"
        aria-hidden
      />
      <ul className="space-y-5">
        {items.map((step, index) => {
          const dotColor = DOT_COLORS[index % DOT_COLORS.length];
          const hasImage = step.images && step.images.length > 0;
          const firstImage = hasImage ? step.images![0] : null;

          return (
            <li key={index} className="relative flex gap-5 pl-1">
              {/* Time + dot */}
              <div className="flex flex-col items-center flex-shrink-0 pt-1">
                <span
                  className={`mt-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm flex-shrink-0 z-10 ${dotColor}`}
                  aria-hidden
                />
                <span className="text-xs font-semibold text-gray-600 tabular-nums mt-2 min-w-[4rem] text-left">
                  {step.time}
                </span>
              </div>

              {/* Card */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="rounded-xl bg-gray-50/90 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                  {firstImage ? (
                    <div className={`relative w-full bg-gray-100 ${stepImageClassName || 'h-48 md:h-64'}`}>
                      <Image
                        src={firstImage}
                        alt={step.activity}
                        fill
                        className="h-48 md:h-64 object-cover"
                        sizes="(max-width: 640px) 100vw, 600px"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <h4 className="absolute bottom-3 left-4 text-base font-bold text-white drop-shadow-md">
                        {step.activity}
                      </h4>
                    </div>
                  ) : (
                    <h4 className="text-base font-bold text-gray-900 px-4 pt-4 pb-1">
                      {step.activity}
                    </h4>
                  )}
                  <div className="px-4 pb-4 pt-2">
                    {step.description && (
                      <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
                    )}
                    {step.images && step.images.length > 1 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
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
                </div>
              </div>
            </li>
          );
        })}
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
