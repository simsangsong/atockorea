'use client';

/**
 * T3.2–T3.6 — the map tab: everyone on one map.
 *
 * Renders the sharing toggle (opt-in, K-4 default OFF), follow-the-guide mode,
 * and the find-the-guide card. The Maps SDK loads only when this tab mounts
 * (§O-1 ② — dynamic ssr:false canvas).
 *
 * 🔴 It no longer OWNS the sharing state or the watcher. This panel unmounts on
 * every tab change (RoomShell renders `{tab === 'map' && …}`), which silently
 * threw away the guest's opt-in and stopped the arrival geofence the moment
 * they opened Chat. Both now live in TourRoomLive via `useLocationSharing`;
 * this component is the screen for them, not the home.
 */

import { useEffect, useRef, useState } from 'react';
import dynamicImport from 'next/dynamic';
import FindGuideCard from '@/components/tour-mode/map/FindGuideCard';
import { IconFollow, TR_ICON } from '@/components/tour-mode/icons';
import LocationShareCard from '@/components/tour-mode/map/LocationShareCard';
import PresenceBar from '@/components/tour-mode/PresenceBar';
import type { GeoWatcherStatus } from '@/hooks/useGeoWatcher';
import { acquireWakeLock, type WakeLockHandle } from '@/lib/tour-room/wakeLock';
import type { LatLng } from '@/lib/tour-room/geo';
import type { RoomLocation, RoomPresence } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import type { MapSpot, MapPoint } from '@/components/tour-mode/map/RoomMapCanvas';

const RoomMapCanvas = dynamicImport(() => import('@/components/tour-mode/map/RoomMapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="tr-skeleton flex h-full min-h-[300px] items-center justify-center rounded-[var(--tr-radius-card)]">
      <span className="tr-card-text text-[var(--tr-ink-3)]">Loading map…</span>
    </div>
  ),
});

/**
 * P1-1 — map action labels are keyed by ROLE first, then locale.
 *
 * The guide's own screen was showing "가이드 따라가기 / 找到导游" (follow the
 * guide) because the map tab had no role in scope at all: the follow toggle was
 * gated only on "a guide location exists", which for a guide viewer is their
 * own pin. Keeping the two label sets side by side as constants makes the
 * asymmetry visible, so a future edit cannot quietly reintroduce it.
 *
 *   guide/driver → follow the GUESTS ("손님 위치 보기")
 *   customer     → follow the GUIDE  ("가이드 따라가기")
 */
export const MAP_FOLLOW_LABEL: Record<'customer' | 'operator', Record<RoomLocale, string>> = {
  customer: {
    en: 'Follow guide',
    ko: '가이드 따라가기',
    ja: 'ガイドを追跡',
    es: 'Seguir al guía',
    zh: '跟随导游',
    'zh-TW': '跟隨導遊',
    fr: 'Suivre le guide',
    de: 'Guide folgen',
    ru: 'Следовать за гидом',
    it: 'Segui la guida',
  },
  operator: {
    en: 'View guests',
    ko: '손님 위치 보기',
    ja: 'お客様の位置',
    es: 'Ver a los viajeros',
    zh: '查看客人位置',
    'zh-TW': '查看客人位置',
    fr: 'Voir les voyageurs',
    de: 'Gäste anzeigen',
    ru: 'Показать гостей',
    it: 'Vedi gli ospiti',
  },
};

/** Operators (guide/driver) never get the guest wayfinding affordances. */
export function isOperatorRole(role?: string | null): boolean {
  return role === 'guide' || role === 'driver' || role === 'admin';
}

export default function RoomMapTab({
  locale,
  viewerRole,
  myParticipantId,
  locations,
  presence,
  spots,
  facilities,
  pickup,
  sharing,
  onSharingChange,
  geoStatus,
  lastPosition,
}: {
  locale: RoomLocale;
  /** P1-1 — which action set this viewer gets. Guest affordances are gated on it. */
  viewerRole?: string | null;
  myParticipantId: string | null;
  locations: Record<string, RoomLocation>;
  presence: RoomPresence[];
  spots: MapSpot[];
  facilities: MapPoint[];
  pickup: MapPoint | null;
  /** Owned by TourRoomLive so it survives a tab change. */
  sharing: boolean;
  onSharingChange: (next: boolean) => void;
  geoStatus: GeoWatcherStatus;
  lastPosition: LatLng | null;
}) {
  const [followGuide, setFollowGuide] = useState(false);

  // T3.6 — hold a screen wake lock while actively sharing.
  const wakeLockRef = useRef<WakeLockHandle | null>(null);
  useEffect(() => {
    if (sharing) {
      void acquireWakeLock().then((handle) => {
        wakeLockRef.current = handle;
      });
    }
    return () => {
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [sharing]);

  // The operator a guest follows may be a guide OR a driver — on a driver-run
  // tour the guest previously had no follow target and no FindGuideCard at all,
  // because this only ever looked for 'guide'.
  const guideLocation =
    Object.values(locations).find((location) => location.role === 'guide') ??
    Object.values(locations).find((location) => location.role === 'driver') ??
    null;

  // P1-1 — an operator follows the guests; only a guest follows the guide.
  const isOperator = isOperatorRole(viewerRole);
  const guestLocation =
    Object.values(locations).find((location) => location.role === 'customer') ?? null;
  const followTarget = isOperator ? guestLocation : guideLocation;
  const followLabel = MAP_FOLLOW_LABEL[isOperator ? 'operator' : 'customer'][locale];

  return (
    /* 사장님 2026-08-07: "좀 더 컴팩트하게". The chrome above and below the map
       keeps its structure — the gaps between the cards just stopped costing the
       map three rows of its own height. */
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <PresenceBar presence={presence} locale={locale} myParticipantId={myParticipantId} />
      <LocationShareCard
        locale={locale}
        enabled={sharing}
        status={geoStatus}
        onToggle={onSharingChange}
      />

      {/* Framed map card — a hairline + soft shadow so the map reads as a
          contained surface, not a raw full-bleed embed. */}
      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)]"
        style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
      >
        <RoomMapCanvas
          locations={locations}
          myParticipantId={myParticipantId}
          spots={spots}
          facilities={facilities}
          pickup={pickup}
          followGuide={followGuide}
          locale={locale}
          /* 🔴 The canvas used to see "me" only once a ping round-tripped
             through the server, and the publish path drops anything coarser
             than 100m. `lastPosition` was already in this component's props,
             handed to FindGuideCard and nowhere else — so the map was the one
             surface that could not answer "where am I". */
          myPosition={lastPosition}
          sharing={sharing}
          isOperator={isOperator}
        />
        {followTarget && (
          <button
            type="button"
            onClick={() => setFollowGuide((v) => !v)}
            aria-pressed={followGuide}
            className={`tr-label text-cjk-safe absolute right-2 top-2 flex min-h-[44px] items-center gap-1.5 rounded-full px-3 font-semibold ${
              followGuide
                ? 'bg-[#12151a] text-white'
                : 'bg-[var(--tr-surface)]/95 text-[var(--tr-ink)] backdrop-blur-sm'
            }`}
            style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
            data-testid="follow-guide-toggle"
          >
            <IconFollow size={TR_ICON.meta} aria-hidden />
            {followLabel}
          </button>
        )}
      </div>

      {/* P1-1 — "가이드에게 가기 / 找到导游" is a GUEST affordance; it used to
          render unconditionally, so the guide got directions to themselves. */}
      {!isOperator && (
      <FindGuideCard
        me={
          lastPosition ??
          (myParticipantId && locations[myParticipantId]
            ? { latitude: locations[myParticipantId].latitude, longitude: locations[myParticipantId].longitude }
            : null)
        }
        guide={guideLocation ? { latitude: guideLocation.latitude, longitude: guideLocation.longitude } : null}
        // A1.4 — 좌표만 넘기면 카드가 나이를 알 수 없다. `recorded_at`이 정직성 게이트의 입력이다.
        guideRecordedAt={guideLocation?.recorded_at ?? null}
        locale={locale}
      />
      )}
    </div>
  );
}
