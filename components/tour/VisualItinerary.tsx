'use client';

import Image from 'next/image';
import { useTranslations, useI18n } from '@/lib/i18n';

function normalizePickupName(name: string, locale: string): string {
  const label = locale === 'zh-TW' ? '接送地點' : '接送地点';
  return name.replace(/取货地点|取貨地點|接机|接機/g, label);
}

interface ItineraryItem {
  time: string;
  title: string;
  description: string;
  icon?: string;
  images?: string[];
}

interface PickupPoint {
  id: string;
  name: string;
  address?: string;
  pickup_time?: string;
}

interface VisualItineraryProps {
  items: ItineraryItem[];
  pickupPoints?: PickupPoint[];
}

const DOT_COLORS = ['bg-orange-500', 'bg-blue-500', 'bg-orange-500', 'bg-blue-500'];

export default function VisualItinerary({ items, pickupPoints = [] }: VisualItineraryProps) {
  const t = useTranslations();
  const { locale } = useI18n();
  if (!items || items.length === 0) {
    return null;
  }

  const processedItems: Array<{
    type: 'normal' | 'pickup';
    item?: ItineraryItem;
    pickupPoints?: PickupPoint[];
    pickupTime?: string;
    index: number;
  }> = [];
  let colorIndex = 0;

  items.forEach((item) => {
    const titleLower = item.title?.toLowerCase() || '';
    if (titleLower.includes('pickup') || titleLower.includes('pick-up') || titleLower.includes('pick up')) {
      const existingPickup = processedItems.find((p) => p.type === 'pickup');
      if (!existingPickup && pickupPoints.length > 0) {
        processedItems.push({
          type: 'pickup',
          pickupPoints,
          pickupTime: item.time,
          index: colorIndex++,
        });
      }
    } else {
      processedItems.push({ type: 'normal', item, index: colorIndex++ });
    }
  });

  return (
    <div className="relative">
      <div className="absolute left-[15px] top-6 bottom-6 w-0.5 bg-gray-200" aria-hidden />
      <ul className="space-y-5">
        {processedItems.map((processed, idx) => {
          const dotColor = DOT_COLORS[processed.index % DOT_COLORS.length];

          if (processed.type === 'pickup' && processed.pickupPoints?.length) {
            return (
              <li key={`pickup-${idx}`} className="relative flex gap-5 pl-1">
                <div className="flex flex-col items-center flex-shrink-0 pt-1">
                  <span
                    className={`mt-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm flex-shrink-0 z-10 ${dotColor}`}
                    aria-hidden
                  />
                  {processed.pickupTime && (
                    <span className="text-xs font-semibold text-gray-600 tabular-nums mt-2 min-w-[4rem] text-left">
                      {processed.pickupTime}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="rounded-xl bg-gray-50/90 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4">
                    <h4 className="text-base font-bold text-gray-900 mb-2">{t('tour.pickupPointsTitle')}</h4>
                    <ul className="space-y-2">
                      {processed.pickupPoints.map((point) => {
                        const timeStr = point.pickup_time ? String(point.pickup_time).replace(/(\d{1,2}:\d{2})(:\d{2})?$/, '$1') : '';
                        const name = normalizePickupName(point.name || '', locale);
                        return (
                          <li key={point.id} className="flex items-baseline gap-2 text-sm text-gray-600">
                            {timeStr ? <span className="font-semibold text-gray-700 tabular-nums">{timeStr}</span> : null}
                            {timeStr && name ? <span className="text-gray-400"> · </span> : null}
                            <span className="font-medium text-gray-800">{name || '—'}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </li>
            );
          }

          if (processed.type === 'normal' && processed.item) {
            const item = processed.item;
            const firstImage = item.images?.[0];
            return (
              <li key={idx} className="relative flex gap-5 pl-1">
                <div className="flex flex-col items-center flex-shrink-0 pt-1">
                  <span
                    className={`mt-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm flex-shrink-0 z-10 ${dotColor}`}
                    aria-hidden
                  />
                  <span className="text-xs font-semibold text-gray-600 tabular-nums mt-2 min-w-[4rem] text-left">
                    {item.time}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="rounded-xl bg-gray-50/90 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                    {firstImage ? (
                      <div className="relative w-full h-48 md:h-64 bg-gray-100">
                        <Image
                          src={firstImage}
                          alt={item.title}
                          fill
                          className="h-48 md:h-64 object-cover"
                          sizes="(max-width: 640px) 100vw, 600px"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <h4 className="absolute bottom-3 left-4 text-base font-bold text-white drop-shadow-md">
                          {item.title}
                        </h4>
                      </div>
                    ) : (
                      <h4 className="text-base font-bold text-gray-900 px-4 pt-4 pb-1">
                        {item.title}
                      </h4>
                    )}
                    <div className="px-4 pb-4 pt-2">
                      {item.description && (
                        <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          }
          return null;
        })}
      </ul>
    </div>
  );
}
