'use client';

/**
 * SG-3a / E1 — the personal walk-back, ON-DEVICE only (SG-D8).
 *
 * "당신 위치에서 6분 · 10:09에는 출발하세요" is the one line that actually
 * dissolves free-time anxiety — but it needs the guest's position, and this
 * repo's location primitives (useGeoWatcher) PUBLISH to the room. This
 * component must never touch them: one `navigator.geolocation` read, the
 * haversine and the subtraction happen on the phone, nothing is sent
 * anywhere. Degradation ladder: no consent → a quiet opt-in chip; refused /
 * failed / stale → the chip again; granted → the line, recomputed only
 * on demand (tap, visibility return) — no interval, no battery tax.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { NOW_CARD_COPY } from '@/lib/tour-room/nowCardCopy';
import { formatTargetTime } from '@/lib/tour-room/notices';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** Tourist walking pace with bags — brisker estimates make guests late. */
const WALK_M_PER_MIN = 70;
const WALK_MIN_FLOOR = 2;
const WALK_MIN_CEIL = 60;
/** Leave-by buffer: find shoes, pay, say goodbye to the haenyeo. */
const LEAVE_BUFFER_MS = 3 * 60 * 1000;
const CONSENT_KEY = 'tr-walkback-optin';

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function walkBackMinutes(meters: number): number {
  return Math.min(WALK_MIN_CEIL, Math.max(WALK_MIN_FLOOR, Math.ceil(meters / WALK_M_PER_MIN)));
}

export default function WalkBackLine({
  lat,
  lng,
  targetMs,
  locale,
}: {
  lat: number;
  lng: number;
  targetMs: number;
  locale: RoomLocale;
}) {
  const copy = NOW_CARD_COPY[locale];
  const [line, setLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const compute = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mountedRef.current) return;
        try {
          window.localStorage.setItem(CONSENT_KEY, '1');
        } catch {
          /* storage may be unavailable; the line still renders this once */
        }
        const meters = haversineMeters(
          position.coords.latitude,
          position.coords.longitude,
          lat,
          lng,
        );
        const minutes = walkBackMinutes(meters);
        const leaveByMs = targetMs - minutes * 60_000 - LEAVE_BUFFER_MS;
        setLine(copy.leaveBy(minutes, formatTargetTime(leaveByMs, locale)));
        setBusy(false);
      },
      () => {
        if (!mountedRef.current) return;
        setBusy(false);
        setLine(null);
      },
      { maximumAge: 30_000, timeout: 8_000, enableHighAccuracy: false },
    );
  }, [lat, lng, targetMs, locale, copy]);

  // Prior consent → compute on mount and again when the tab returns.
  useEffect(() => {
    let consented = false;
    try {
      consented = window.localStorage.getItem(CONSENT_KEY) === '1';
    } catch {
      consented = false;
    }
    if (consented) compute();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && consented) compute();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [compute]);

  if (line) {
    return (
      <p data-testid="walkback-line" className="tr-card-text text-cjk-body mt-1 text-[var(--tr-ink-2)]">
        {line}
      </p>
    );
  }
  return (
    <button
      type="button"
      data-testid="walkback-optin"
      onClick={compute}
      disabled={busy}
      className="tr-chip-tap tr-chip-tap--quiet tr-label text-cjk-safe mt-1.5 flex h-9 items-center rounded-full bg-[var(--tr-surface)] px-3 font-semibold text-[var(--tr-ink)] disabled:opacity-50"
    >
      {copy.walkOptIn}
    </button>
  );
}
