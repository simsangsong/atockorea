'use client';

/**
 * T3.2–T3.6 — the map tab: everyone on one map.
 *
 * Owns the sharing toggle (opt-in, K-4 default OFF), the foreground geo
 * watcher, the screen wake lock while sharing (T3.6), follow-the-guide mode,
 * and the find-the-guide card. The Maps SDK loads only when this tab mounts
 * (§O-1 ② — dynamic ssr:false canvas).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamicImport from 'next/dynamic';
import FindGuideCard from '@/components/tour-mode/map/FindGuideCard';
import { IconFollow } from '@/components/tour-mode/icons';
import LocationShareCard from '@/components/tour-mode/map/LocationShareCard';
import PresenceBar from '@/components/tour-mode/PresenceBar';
import { useApproachWatch } from '@/hooks/useApproachWatch';
import { useGeoWatcher } from '@/hooks/useGeoWatcher';
import { useSpotGeofence } from '@/hooks/useSpotGeofence';
import { acquireWakeLock, type WakeLockHandle } from '@/lib/tour-room/wakeLock';
import type { ApproachTarget } from '@/lib/tour-room/approach';
import type { GeoSample } from '@/lib/tour-room/geo';
import type { WatchableSpot } from '@/lib/tour-room/spotWatcher';
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

const FOLLOW_LABEL: Record<RoomLocale, string> = {
  en: 'Follow guide',
  ko: '가이드 따라가기',
  ja: 'ガイドを追跡',
  es: 'Seguir al guía',
  zh: '跟随导游',
};

export default function RoomMapTab({
  bookingId,
  roomSession,
  locale,
  myParticipantId,
  locations,
  presence,
  spots,
  facilities,
  pickup,
  geofenceSpots,
  approachTargets,
}: {
  bookingId: string;
  roomSession: string;
  locale: RoomLocale;
  myParticipantId: string | null;
  locations: Record<string, RoomLocation>;
  presence: RoomPresence[];
  spots: MapSpot[];
  facilities: MapPoint[];
  pickup: MapPoint | null;
  /** T4.4 — spots with radii; arrivals auto-post while sharing is on. */
  geofenceSpots?: WatchableSpot[];
  /** §11.C C2 — scheduled POIs whose 1 km preview may fire while sharing. */
  approachTargets?: ApproachTarget[];
}) {
  const [sharing, setSharing] = useState(false);
  const [followGuide, setFollowGuide] = useState(false);
  const { onSample: onGeofenceSample } = useSpotGeofence({
    bookingId,
    roomSession,
    spots: geofenceSpots ?? [],
    locale,
    enabled: sharing && (geofenceSpots?.length ?? 0) > 0,
  });
  // §11.C C2 — the approach stepper rides the same opt-in sample stream as the
  // arrival geofence; nothing extra is switched on behind the guest's back.
  const { onSample: onApproachSample } = useApproachWatch({
    bookingId,
    roomSession,
    targets: approachTargets ?? [],
    locale,
    enabled: sharing && (approachTargets?.length ?? 0) > 0,
  });
  const onSample = useCallback(
    (sample: GeoSample) => {
      onGeofenceSample(sample);
      onApproachSample(sample);
    },
    [onGeofenceSample, onApproachSample],
  );
  const { status, lastPosition, stopSharing } = useGeoWatcher({
    bookingId,
    roomSession,
    enabled: sharing,
    onSample,
  });

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

  const guideLocation =
    Object.values(locations).find((location) => location.role === 'guide') ?? null;

  const onToggle = (next: boolean) => {
    setSharing(next);
    if (!next) void stopSharing();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <PresenceBar presence={presence} locale={locale} myParticipantId={myParticipantId} />
      <LocationShareCard locale={locale} enabled={sharing} status={status} onToggle={onToggle} />

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
        />
        {guideLocation && (
          <button
            type="button"
            onClick={() => setFollowGuide((v) => !v)}
            aria-pressed={followGuide}
            className={`tr-label absolute right-2 top-2 flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 font-semibold ${
              followGuide ? 'bg-[#12151a] text-white' : 'bg-[var(--tr-surface)] text-[var(--tr-ink)]'
            }`}
            style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
            data-testid="follow-guide-toggle"
          >
            <IconFollow size={14} aria-hidden />
            {FOLLOW_LABEL[locale]}
          </button>
        )}
      </div>

      <FindGuideCard
        me={
          lastPosition ??
          (myParticipantId && locations[myParticipantId]
            ? { latitude: locations[myParticipantId].latitude, longitude: locations[myParticipantId].longitude }
            : null)
        }
        guide={guideLocation ? { latitude: guideLocation.latitude, longitude: guideLocation.longitude } : null}
        locale={locale}
      />
    </div>
  );
}
