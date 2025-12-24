'use client';

import { MapIcon } from '@/components/Icons';
import InteractiveMap from '@/components/maps/InteractiveMap';

interface PickupPoint {
  id: string | number;
  name: string;
  address?: string;
  lat: number;
  lng: number;
}

interface MeetingPointProps {
  points: PickupPoint[];
}

export default function MeetingPoint({ points }: MeetingPointProps) {
  if (!points || points.length === 0) {
    return (
      <div className="rounded-xl bg-white border-2 border-gray-200 shadow-md p-4">
        <h2 className="text-base font-semibold text-gray-900 mb-2">Pick-up & Meet-up Information</h2>
        <p className="text-xs text-gray-600">No pickup points available.</p>
      </div>
    );
  }

  const primaryPoint = points[0];
  const hasApiKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <div className="rounded-xl bg-white border-2 border-gray-200 shadow-md p-4">
      <h2 className="text-base font-semibold text-gray-900 mb-3">Pick-up & Meet-up Information</h2>

      {/* Map - Use interactive map (if API Key available) or fallback to iframe */}
      <div className="relative w-full h-48 sm:h-64 rounded-lg overflow-hidden mb-3 bg-gray-100 border-2 border-gray-300 shadow-sm">
        {hasApiKey ? (
          <InteractiveMap
            locations={points.map(p => ({
              lat: p.lat,
              lng: p.lng,
              name: p.name,
              address: p.address,
              id: p.id,
            }))}
            center={{ lat: primaryPoint.lat, lng: primaryPoint.lng }}
            zoom={points.length > 1 ? 12 : 15}
            height="100%"
            showInfoWindow={true}
          />
        ) : (
          <iframe
            src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3168.5!2d${primaryPoint.lng}!3d${primaryPoint.lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzXCsDA2JzU2LjIiTiAxMjnCsDAyJzMyLjAiRQ!5e0!3m2!1sen!2sus!4v1234567890&q=${encodeURIComponent(primaryPoint.address || primaryPoint.name)}`}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0"
          />
        )}
      </div>

      {/* Address */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border border-blue-200/50">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
          <MapIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-0.5">{primaryPoint.name}</h3>
          <p className="text-xs text-gray-600">{primaryPoint.address || ''}</p>
        </div>
        <a
          href={`https://www.google.com/maps?q=${primaryPoint.lat},${primaryPoint.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold transition-all shadow-sm active:scale-95 whitespace-nowrap"
        >
          Directions
        </a>
      </div>

      {/* All Pickup Points List */}
      {points.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">All pickup points:</p>
          <ul className="space-y-1.5">
            {points.map((point) => (
              <li key={point.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50/50 border border-gray-200/50 hover:bg-gray-100/50 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-gray-900">{point.name}</span>
                  {point.address && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{point.address}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

