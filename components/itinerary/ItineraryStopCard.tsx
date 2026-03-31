'use client';

import type { GeneratedItineraryResponse } from '@/lib/itinerary/types';
import {
  stopHasPrimaryGallery,
  stopRepresentativeImageUrl,
} from '@/lib/itinerary/stop-image-priority';

type Stop = GeneratedItineraryResponse['stops'][number];

export function ItineraryStopCard(props: {
  stop: Stop;
  onViewDetails: (stop: Stop) => void;
}) {
  const { stop, onViewDetails } = props;
  const rep = stopRepresentativeImageUrl(stop);

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden flex flex-col sm:flex-row">
      <div className="sm:w-44 h-40 sm:h-auto sm:min-h-[10rem] shrink-0 bg-neutral-100 relative">
        {stopHasPrimaryGallery(stop) ? (
          <div className="flex flex-col h-full min-h-[10rem] sm:min-h-0">
            <div className="flex-1 flex gap-1.5 overflow-x-auto px-2 py-2 items-center min-h-0">
              {stop.photoGallery.slice(0, 8).map((ph, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${ph.imageUrl}-${idx}`}
                  src={ph.thumbUrl || ph.imageUrl}
                  alt={ph.galTitle || ''}
                  className="h-[calc(100%-8px)] min-h-[5.5rem] w-[5.5rem] shrink-0 rounded-lg object-cover border border-neutral-100"
                  loading="lazy"
                />
              ))}
            </div>
            {stop.photoGallery.length > 8 && (
              <p className="text-[10px] text-neutral-500 px-2 pb-2 text-center shrink-0">
                +{stop.photoGallery.length - 8} more in details
              </p>
            )}
          </div>
        ) : rep ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={rep} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs font-light">
            No image
          </div>
        )}
        <div className="absolute top-2 left-2 w-8 h-8 rounded-full bg-neutral-900 text-white text-sm flex items-center justify-center font-medium">
          {stop.sortOrder}
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-lg font-medium text-neutral-900 mb-1">{stop.title}</h3>
        <p className="text-sm text-neutral-600 font-light line-clamp-3 mb-3">
          {stop.shortDescription || stop.overview?.slice(0, 200) || '—'}
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-neutral-500 mb-4">
          {stop.plannedDurationMin != null && <span>~{stop.plannedDurationMin} min</span>}
          {stop.reason && (
            <span className="text-neutral-700 line-clamp-2">
              <span className="text-neutral-400">Why: </span>
              {stop.reason}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onViewDetails(stop)}
          className="mt-auto self-start px-4 py-2 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-900 hover:bg-neutral-50 transition-colors"
        >
          View details
        </button>
      </div>
    </div>
  );
}
