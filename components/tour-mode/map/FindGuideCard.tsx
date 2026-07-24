'use client';

/**
 * T3.3 — "find the guide": live straight-line distance + compass direction
 * from my position to the guide, and a one-tap Google Maps walking deep link
 * (promoted from §H P2 #5 to v1). Renders only when both positions exist.
 *
 * 🔴 **A1.4 정직성 게이트.** 예전에는 좌표만 받아서, 가이드가 공유를 끄거나 신호를
 * 잃은 뒤에도 "230m ⬆️ [도보 길찾기]"를 계속 그렸다 — 손님은 가이드가 **있었던**
 * 곳으로 걸어간다. 이 카드는 손님이 길을 잃었을 때 쓰는 물건이라, 낡은 좌표로
 * 방향을 단언하는 것이 가장 나쁜 순간에 일어난다.
 *
 * 같은 폴더의 `VehicleLocationCard`가 이미 같은 규율을 갖고 있다 —
 * *"an arrival promise computed from a position the van left long ago is worse"*.
 * 여기서도 같은 사다리(`vehicleFreshness`)를 쓴다:
 *   live/recent → 그대로 · stale → 나이를 적고 **길찾기 링크 제거** · expired → 렌더 안 함
 */

import { bearingDeg, haversineM, type LatLng } from '@/lib/tour-room/geo';
import { vehicleFreshness } from '@/lib/tour-room/vehicleEta';
import { IconFollow, IconGuide, IconWalking } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  { title: string; away: (d: string) => string; walk: string; stale: (m: number) => string }
> = {
  en: {
    title: 'Find my guide',
    away: (d) => `${d} away`,
    walk: 'Walking directions',
    stale: (m) => `Last known ${m} min ago — may have moved`,
  },
  ko: {
    title: '가이드에게 가기',
    away: (d) => `${d} 거리`,
    walk: '도보 길찾기',
    stale: (m) => `${m}분 전 위치 — 이동했을 수 있어요`,
  },
  ja: {
    title: 'ガイドの所へ',
    away: (d) => `${d} 先`,
    walk: '徒歩ルート',
    stale: (m) => `${m}分前の位置 — 移動している可能性があります`,
  },
  es: {
    title: 'Encontrar a mi guía',
    away: (d) => `a ${d}`,
    walk: 'Ruta a pie',
    stale: (m) => `Posición de hace ${m} min — puede haberse movido`,
  },
  zh: {
    title: '找到导游',
    away: (d) => `距离 ${d}`,
    walk: '步行导航',
    stale: (m) => `${m} 分钟前的位置 — 可能已经移动`,
  },
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
  guideRecordedAt,
  locale,
  nowMs = Date.now(),
}: {
  me: LatLng | null;
  guide: LatLng | null;
  /**
   * 🔴 가이드 좌표가 기록된 시각. 없으면 나이를 알 수 없으므로 **렌더하지 않는다** —
   * 모르는 것을 "지금 여기"로 그리는 것이 이 카드의 실패 모드다.
   */
  guideRecordedAt?: string | null;
  locale: RoomLocale;
  nowMs?: number;
}) {
  if (!me || !guide) return null;

  const freshness = vehicleFreshness(guideRecordedAt, nowMs);
  // 한 시간 넘게 식은 좌표는 방향조차 말하지 않는다.
  if (freshness.state === 'expired') return null;
  const isStale = freshness.state === 'stale';
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
        {/* 🔴 낡은 좌표에서는 나이를 말한다 — 거리는 여전히 방향 감각에 쓸모가
            있지만, 그것이 "지금"이라는 인상을 주면 안 된다. */}
        {isStale && (
          <p className="tr-meta mt-0.5 text-amber-300" data-testid="find-guide-stale">
            {copy.stale(Math.max(1, Math.round(freshness.ageMs / 60_000)))}
          </p>
        )}
      </div>
      {/* 🔴 낡은 좌표로는 길찾기를 열지 않는다. 손님을 가이드가 **있었던** 곳으로
          걸어가게 만드는 것이 이 카드의 최악 실패다(같은 폴더 VehicleLocationCard가
          같은 이유로 stale에서 ETA를 지운다). */}
      {!isStale && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tr-label flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-[var(--tr-safe)] px-3.5 font-semibold text-white"
        >
          <IconWalking size={14} aria-hidden />
          {copy.walk}
        </a>
      )}
    </div>
  );
}
