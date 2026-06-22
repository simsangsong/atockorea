'use client';

import { useEffect, useState } from 'react';

/**
 * Resolves the signed-in user's *nearest upcoming* booking and whether its
 * Tour Room is "live" yet. Drives the adaptive 3rd tab in {@link BottomNav}
 * (Cart → Tour Room when a tour is today/tomorrow) and the `/tour-room` pages.
 *
 * Source of truth: `GET /api/tour-mode/bookings` (confirmed + tour_date >= today,
 * ordered ascending) — so `bookings[0]` is always the nearest.
 *
 * The room "opens the day before" (ROOM_OPEN_DAYS_BEFORE): active when the tour
 * is today or tomorrow in the visitor's local time.
 *
 * A module-level cache (TTL) + single in-flight promise keep this cheap: the
 * BottomNav re-mounts on every client navigation, but we fetch at most once per
 * minute and never duplicate concurrent requests.
 */

export interface TourRoomBooking {
  bookingId: string;
  bookingReference: string | null;
  tourId: string | null;
  tourTitle: string;
  tourCity: string;
  tourImage: string | null;
  tourDate: string; // YYYY-MM-DD
  tourTime: string | null;
  guests: number | null;
  contactName: string | null;
  /** Tour is today or tomorrow → the room is live and the tab morphs. */
  isRoomActive: boolean;
}

const TTL_MS = 60_000;
/** Room goes live this many days before the tour (1 = "the day before"). */
export const ROOM_OPEN_DAYS_BEFORE = 1;

let cache: { at: number; value: TourRoomBooking | null } | null = null;
let inflight: Promise<TourRoomBooking | null> | null = null;

function startOfLocalDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

/** Days from local-today to the tour date; active when 0..ROOM_OPEN_DAYS_BEFORE. */
export function computeRoomActive(tourDate: string | null | undefined): boolean {
  if (!tourDate) return false;
  const today = startOfLocalDay(new Date());
  const tour = startOfLocalDay(parseLocalDate(tourDate));
  const days = Math.round((tour - today) / 86_400_000);
  return days >= 0 && days <= ROOM_OPEN_DAYS_BEFORE;
}

function normalizeTour(raw: any): any {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

async function fetchNearest(): Promise<TourRoomBooking | null> {
  try {
    // Dynamic import: keeps @supabase/supabase-js out of the server bundle
    // (matches the guard in lib/i18n.ts).
    const { supabase } = await import('@/lib/supabase');
    if (!supabase) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;

    const res = await fetch('/api/tour-mode/bookings', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;

    const json = await res.json();
    const list: any[] = Array.isArray(json?.bookings) ? json.bookings : [];
    if (list.length === 0) return null;

    const b = list[0];
    const tour = normalizeTour(b.tours);
    return {
      bookingId: b.id,
      bookingReference: b.booking_reference ?? null,
      tourId: tour?.id ?? null,
      tourTitle: tour?.title ?? '',
      tourCity: tour?.city ?? '',
      tourImage: tour?.image_url ?? null,
      tourDate: b.tour_date,
      tourTime: b.tour_time ?? null,
      guests: typeof b.number_of_guests === 'number' ? b.number_of_guests : null,
      contactName: b.contact_name ?? null,
      isRoomActive: computeRoomActive(b.tour_date),
    };
  } catch {
    return null;
  }
}

/** Force the next read to re-fetch (e.g. after sign-out). */
export function invalidateTourRoomBooking(): void {
  cache = null;
  inflight = null;
}

export interface UseTourRoomBookingResult {
  booking: TourRoomBooking | null;
  loading: boolean;
}

export function useTourRoomBooking(): UseTourRoomBookingResult {
  // Seed from cache so warm client navigations render instantly. On a cold
  // page load the cache is empty → null, which matches the server render.
  const [booking, setBooking] = useState<TourRoomBooking | null>(cache?.value ?? null);
  const [loading, setLoading] = useState<boolean>(!cache);

  useEffect(() => {
    let alive = true;

    const fresh = cache && Date.now() - cache.at < TTL_MS;
    if (fresh) {
      setBooking(cache!.value);
      setLoading(false);
      return;
    }

    if (!inflight) {
      inflight = fetchNearest().then((value) => {
        cache = { at: Date.now(), value };
        inflight = null;
        return value;
      });
    }

    setLoading(true);
    inflight.then((value) => {
      if (!alive) return;
      setBooking(value);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  return { booking, loading };
}
