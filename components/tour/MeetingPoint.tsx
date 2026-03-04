'use client';

import { MapIcon } from '@/components/Icons';
import InteractiveMap from '@/components/maps/InteractiveMap';
import { useTranslations } from '@/lib/i18n';

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
  const t = useTranslations();
  if (!points || points.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1.5">{t('tour.pickupMeetupInfo')}</h2>
        <p className="text-xs text-gray-500">{t('tour.noPickupPoints')}</p>
      </div>
    );
  }

  const primaryPoint = points[0];
  const hasApiKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('tour.pickupMeetupInfo')}</h2>

      {/* Map */}
      <div className="relative w-full h-40 sm:h-52 rounded-xl overflow-hidden mb-3 bg-gray-50 border border-gray-100">
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
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
          <MapIcon className="w-4 h-4 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{primaryPoint.name}</p>
          <p className="text-xs text-gray-500 truncate">{primaryPoint.address || ''}</p>
        </div>
        <a
          href={`https://www.google.com/maps?q=${primaryPoint.lat},${primaryPoint.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors whitespace-nowrap"
        >
          {t('tour.directions')}
        </a>
      </div>

      {/* All Pickup Points List */}
      {points.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">{t('tour.allPickupPoints')}</p>
          <ul className="space-y-1">
            {points.map((point) => (
              <li key={point.id} className="flex items-center gap-2 py-1.5">
                <div className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-gray-800">{point.name}</span>
                  {point.address && (
                    <p className="text-[11px] text-gray-500 truncate">{point.address}</p>
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

