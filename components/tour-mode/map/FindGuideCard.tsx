'use client';

/**
 * T3.3 — "find the guide": live straight-line distance + compass direction
 * from my position to the guide, and a one-tap Google Maps walking deep link
 * (promoted from §H P2 #5 to v1). Renders only when both positions exist.
 */

import { bearingDeg, haversineM, type LatLng } from '@/lib/tour-room/geo';
import { IconFollow, IconGuide, IconWalking } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<RoomLocale, { title: string; away: (d: string) => string; walk: string }> = {
  en: { title: 'Find my guide', away: (d) => `${d} away`, walk: 'Walking directions' },
  ko: { title: '가이드에게 가기', away: (d) => `${d} 거리`, walk: '도보 길찾기' },
  ja: { title: 'ガイドの所へ', away: (d) => `${d} 先`, walk: '徒歩ルート' },
  es: { title: 'Encontrar a mi guía', away: (d) => `a ${d}`, walk: 'Ruta a pie' },
  zh: { title: '找到导游', away: (d) => `距离 ${d}`, walk: '步行导航' },
};

const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];

/** Compass emoji for a bearing (0° = north, 45°-wide sectors). Exported for tests. */
export function arrowForBearing(bearing: number): string {
  return ARROWS[Math.round(((bearing % 360) + 360) % 360 / 45) % 8];
}

/** "230m" under 1km, "1.4km" above. Exported for tests. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export default function FindGuideCard({
  me,
  guide,
  locale,
}: {
  me: LatLng | null;
  guide: LatLng | null;
  locale: RoomLocale;
}) {
  if (!me || !guide) return null;
  const copy = COPY[locale];
  const distance = haversineM(me, guide);
  const arrow = arrowForBearing(bearingDeg(me, guide));
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${guide.latitude},${guide.longitude}&travelmode=walking`;

  const bearing = bearingDeg(me, guide);

  return (
    <div
      className="flex items-center gap-3 rounded-[var(--tr-radius-card)] bg-[#12151a] px-4 py-3 text-white"
      style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
      data-testid="find-guide-card"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10"
        style={{ transform: `rotate(${Math.round(bearing)}deg)` }}
        aria-hidden
        title={arrow}
      >
        <IconFollow size={18} strokeWidth={2.25} className="-rotate-45" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="tr-card-text flex items-center gap-1.5 font-semibold">
          <IconGuide size={14} className="text-[var(--tr-accent)]" aria-hidden />
          {copy.title}
        </p>
        <p className="tr-label opacity-80">{copy.away(formatDistance(distance))}</p>
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="tr-label flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-[var(--tr-safe)] px-3.5 font-semibold text-white"
      >
        <IconWalking size={14} aria-hidden />
        {copy.walk}
      </a>
    </div>
  );
}
