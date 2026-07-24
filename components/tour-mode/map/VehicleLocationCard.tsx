'use client';

/**
 * §11.C C1/C3 — the guest's "where is my ride?" card.
 *
 * The room already receives the driver/guide position over the Broadcast
 * channel even when the guest shares nothing themselves (T3.1), so this card
 * needs no new stream: it reads the same by-participant map the map tab draws,
 * picks the vehicle (driver > guide), and renders a static-map thumbnail plus
 * an ETA to the meeting point.
 *
 * Two-speed ETA, deliberately:
 *   ① instant — syntheticLeg on the coordinates already in memory (0 network);
 *   ② upgrade — /vehicle-eta every 60s swaps in a real road estimate when a
 *     routing key is configured. Failures keep ①, they never blank the card.
 *
 * Honesty gate: a stale position (>10 min) shows "{n} min ago" and NO ETA —
 * an arrival promise computed from a position the van left long ago is worse
 * than no promise. With no vehicle sharing at all the card renders nothing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronRight, IconEta, IconPickup } from '@/components/tour-mode/icons';
import { staticMapUrl } from '@/lib/tour-room/locationMessage';
import {
  isPickupWindow,
  pickVehicleLocation,
  renderVehicleAgeLine,
  renderVehicleEtaLine,
  vehicleEtaCopy,
  vehicleEtaFrom,
  vehicleFreshness,
  type VehicleLocationLike,
} from '@/lib/tour-room/vehicleEta';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** Server refresh cadence — paused entirely while the tab is hidden. */
const POLL_MS = 60_000;
/** Freshness re-render tick (the age line counts up on its own). */
const TICK_MS = 30_000;

interface ServerEta {
  minutes: number;
  distanceM: number;
  source: 'kakao' | 'synthetic';
}

export default function VehicleLocationCard({
  locale,
  locations,
  pickup,
  bookingId,
  roomSession,
  tourDate,
  pickupTime,
  onOpenMap,
}: {
  locale: RoomLocale;
  /** The channel's by-participant map (or a plain row list). */
  locations: Record<string, VehicleLocationLike> | VehicleLocationLike[] | null | undefined;
  /** Destination for the ETA — the guest's own meeting point. */
  pickup: { lat: number; lng: number; name?: string | null } | null;
  bookingId: string;
  roomSession: string;
  tourDate: string | null;
  pickupTime?: string | null;
  onOpenMap: () => void;
}) {
  const copy = vehicleEtaCopy(locale);
  const vehicle = useMemo(() => pickVehicleLocation(locations), [locations]);
  const [imgOk, setImgOk] = useState(true);
  const [serverEta, setServerEta] = useState<ServerEta | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Date.now() in render is impure; the age line advances on its own tick.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const hasVehicle = Boolean(vehicle);
  const pickupLat = pickup?.lat ?? null;
  const pickupLng = pickup?.lng ?? null;

  const refresh = useCallback(async () => {
    try {
      const query = pickupLat !== null && pickupLng !== null ? `?toLat=${pickupLat}&toLng=${pickupLng}` : '';
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/vehicle-eta${query}`, {
        headers: { 'x-tour-room-auth': roomSession },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { eta?: ServerEta | null };
      if (data?.eta && Number.isFinite(data.eta.minutes)) setServerEta(data.eta);
    } catch {
      /* the local synthetic estimate stays on screen */
    }
  }, [bookingId, roomSession, pickupLat, pickupLng]);

  // Poll only while there IS a vehicle and the tab is in the foreground —
  // same discipline as the geo watcher (no background traffic).
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    if (!hasVehicle) return undefined;
    let timer: number | null = null;
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (timer !== null) return;
      void refreshRef.current();
      timer = window.setInterval(() => void refreshRef.current(), POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };
    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [hasVehicle]);

  if (!vehicle) return null;

  const freshness = vehicleFreshness(vehicle.recorded_at, nowMs);
  const localEta =
    pickupLat !== null && pickupLng !== null
      ? vehicleEtaFrom({ lat: vehicle.latitude, lng: vehicle.longitude }, { lat: pickupLat, lng: pickupLng })
      : null;
  const eta =
    freshness.state === 'stale'
      ? null
      : serverEta ?? (localEta ? { minutes: localEta.minutes, distanceM: localEta.distanceM, source: 'synthetic' as const } : null);
  const inPickupWindow = isPickupWindow(nowMs, tourDate, pickupTime);

  return (
    <div className="tr-home-card mb-2 overflow-hidden" data-testid="vehicle-location-card">
      <button type="button" onClick={onOpenMap} className="block w-full text-left" data-testid="vehicle-open-map">
        {imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={staticMapUrl(vehicle.latitude, vehicle.longitude, { height: 120 })}
            alt={copy.title}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-24 w-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-full items-center justify-center bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]">
            <IconPickup size={26} strokeWidth={1.75} aria-hidden />
          </div>
        )}
      </button>

      <div className="px-4 py-3">
        <p className="tr-label flex items-center gap-1.5 font-semibold text-[var(--tr-ink)]">
          <IconPickup size={14} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{copy.title}</span>
          {freshness.state === 'live' && (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-[var(--tr-safe)]"
              data-testid="vehicle-live-dot"
              aria-hidden
            />
          )}
        </p>

        {eta && (
          <p
            className="tr-card-text mt-1 flex items-center gap-1.5 font-semibold text-[var(--tr-ink)]"
            data-testid="vehicle-eta-line"
          >
            <IconEta size={14} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
            {renderVehicleEtaLine(locale, eta)}
          </p>
        )}

        <p className="tr-meta mt-1 text-[var(--tr-ink-3)]" data-testid="vehicle-age-line">
          {renderVehicleAgeLine(locale, freshness.ageMs)}
        </p>

        {inPickupWindow && (
          <p className="tr-meta mt-1 font-semibold text-[var(--tr-accent-deep)]" data-testid="vehicle-pickup-line">
            {copy.pickupWindow}
          </p>
        )}

        <button
          type="button"
          onClick={onOpenMap}
          data-testid="vehicle-see-map"
          className="tr-label mt-2 flex min-h-[44px] w-full items-center justify-center gap-1 rounded-full bg-[var(--tr-surface-2)] font-semibold text-[var(--tr-ink)] tr-press"
        >
          {copy.button}
          <IconChevronRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
