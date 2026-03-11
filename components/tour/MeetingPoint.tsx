'use client';

import InteractiveMap from '@/components/maps/InteractiveMap';
import { useTranslations } from '@/lib/i18n';

interface PickupPoint {
  id: string | number;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  image_url?: string | null;
  pickup_time?: string;
}

function hasValidCoords(lat: number, lng: number): boolean {
  const la = Number(lat);
  const ln = Number(lng);
  if (Number.isNaN(la) || Number.isNaN(ln)) return false;
  if (la === 0 && ln === 0) return false;
  return la >= -90 && la <= 90 && ln >= -180 && ln <= 180;
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
  const pointsWithCoords = points.filter((p) => hasValidCoords(p.lat, p.lng));
  const hasApiKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const canShowMap = hasApiKey && pointsWithCoords.length > 0;
  const mapCenterPoint = pointsWithCoords.length > 0 ? pointsWithCoords[0] : primaryPoint;

  const pickupPointWithTime = (p: PickupPoint) => p as PickupPoint & { pickup_time?: string };

  return (
    <div className="rounded-2xl border border-gray-200/50 bg-white p-4 sm:p-5 shadow-[0_2px_16px_rgba(0,0,0,0.06),0_1px_6px_rgba(0,0,0,0.03)]">
      {/* Header: bus icon + Pickup Points */}
      <div className="flex items-center gap-2 mb-4">
        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 text-blue-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8m0 0v-8m0 0h8M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
        </span>
        <h2 className="text-base font-bold text-gray-900 tracking-tight">{t('tour.pickupMeetupInfo')}</h2>
      </div>

      {/* Pickup point cards — light blue style */}
      <div className="space-y-3 mb-4">
        {points.map((point) => {
          const detail = [point.address, pickupPointWithTime(point).pickup_time].filter(Boolean).join(' · ') || undefined;
          return (
            <div
              key={point.id}
              className="rounded-xl bg-blue-50/80 border border-blue-100 p-4 flex items-start gap-3 shadow-sm"
            >
              <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{point.name}</p>
                {(detail || point.address) && (
                  <p className="text-xs text-gray-600 mt-0.5">{detail || point.address}</p>
                )}
              </div>
              <a
                href={hasValidCoords(point.lat, point.lng)
                  ? `https://www.google.com/maps?q=${point.lat},${point.lng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point.address || point.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                {t('tour.directions')}
              </a>
            </div>
          );
        })}
      </div>

      {/* Map: show pins only when we have valid lat/lng */}
      <div className="relative w-full h-40 sm:h-52 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
        {canShowMap ? (
          <InteractiveMap
            locations={pointsWithCoords.map((p) => ({
              lat: Number(p.lat),
              lng: Number(p.lng),
              name: p.name,
              address: p.address,
              id: p.id,
            }))}
            center={{ lat: Number(mapCenterPoint.lat), lng: Number(mapCenterPoint.lng) }}
            zoom={pointsWithCoords.length > 1 ? 12 : 15}
            height="100%"
            showInfoWindow={true}
          />
        ) : !hasApiKey ? (
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
        ) : (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(primaryPoint.address || primaryPoint.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors rounded-xl"
          >
            {t('tour.directions')} – {primaryPoint.name}
          </a>
        )}
      </div>
    </div>
  );
}

