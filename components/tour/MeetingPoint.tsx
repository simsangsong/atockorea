'use client';

import InteractiveMap from '@/components/maps/InteractiveMap';
import { useTranslations, useI18n } from '@/lib/i18n';

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

const PICKUP_LABEL_ZH = '接送地点';
const PICKUP_LABEL_ZH_TW = '接送地點';

function normalizePickupName(name: string, locale: string): string {
  const label = locale === 'zh-TW' ? PICKUP_LABEL_ZH_TW : PICKUP_LABEL_ZH;
  return name.replace(/取货地点|取貨地點|接机|接機/g, label);
}

export default function MeetingPoint({ points }: MeetingPointProps) {
  const t = useTranslations();
  const { locale } = useI18n();
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

      {/* Single text-only card: time · place name */}
      <div className="rounded-xl bg-blue-50/80 border border-blue-100 p-4 mb-4">
        <ul className="space-y-2">
          {points.map((point) => {
            const timeStr = pickupPointWithTime(point).pickup_time
              ? String(pickupPointWithTime(point).pickup_time).replace(/(\d{1,2}:\d{2})(:\d{2})?$/, '$1')
              : '';
            const name = normalizePickupName(point.name || point.address || '', locale);
            return (
              <li key={point.id} className="flex items-baseline gap-2 text-sm">
                {timeStr ? <span className="font-semibold text-gray-700 shrink-0">{timeStr}</span> : null}
                {timeStr && name ? <span className="text-gray-500"> · </span> : null}
                <span className="text-gray-900 font-medium">{name || point.address || '—'}</span>
              </li>
            );
          })}
        </ul>
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

