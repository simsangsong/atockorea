'use client';

/**
 * T1.4 — Tour Mode entry (§B D-2 track 2 + track 3 UI).
 *
 * Track 1 (invite links) never lands here — links open the room directly.
 * This screen serves: logged-in customers (their upcoming confirmed
 * bookings) and guests (booking ID + email lookup). Guest credentials are
 * stashed in sessionStorage — never in the URL — and consumed once by the
 * room page.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { detectEntryLocale, ENTRY_COPY } from '@/components/tour-mode/entryCopy';
import { isStandaloneDisplayMode } from '@/hooks/useStandaloneDisplayMode';

interface TourModeBooking {
  id: string;
  booking_reference: string | null;
  tour_date: string | null;
  tour_time: string | null;
  number_of_guests: number | null;
  tours: { title?: string | null; city?: string | null; image_url?: string | null } | null;
}

export const GUEST_CREDS_STORAGE_PREFIX = 'tour_mode_guest_creds:';

export default function TourModeEntry() {
  const router = useRouter();
  const copy = useMemo(() => ENTRY_COPY[detectEntryLocale()], []);

  const [bookings, setBookings] = useState<TourModeBooking[] | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [guestBookingId, setGuestBookingId] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestBusy, setGuestBusy] = useState(false);

  // W5.1 — the installed PWA's start_url is /tour-mode; jump straight back
  // into the last room (its stored room session makes rejoin seamless, and
  // the room's own error state links back here if it no longer opens).
  useEffect(() => {
    const jump = () => {
      if (!isStandaloneDisplayMode()) return;
      try {
        // The room's error page sends the user back here with ?nojump=1 after a
        // dead/expired room — honoring it prevents an infinite redirect loop
        // (entry → dead room → error → entry → …) that would lock the installed
        // app out of the booking list.
        const params = new URLSearchParams(window.location.search);
        if (params.get('nojump') === '1') {
          window.localStorage.removeItem('tour_mode_last_room');
          return;
        }
        const lastRoom = window.localStorage.getItem('tour_mode_last_room');
        if (lastRoom) router.replace(`/tour-mode/room/${encodeURIComponent(lastRoom)}`);
      } catch {
        /* stay on the entry list */
      }
    };
    jump();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tour-mode/bookings');
        if (cancelled) return;
        if (res.status === 401) {
          setSignedIn(false);
          return;
        }
        const json = (await res.json().catch(() => ({}))) as { bookings?: TourModeBooking[] };
        setSignedIn(true);
        setBookings(json.bookings ?? []);
      } catch {
        if (!cancelled) setSignedIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openGuestRoom = async () => {
    const bookingId = guestBookingId.trim();
    const email = guestEmail.trim();
    if (!bookingId || !email) return;
    setGuestBusy(true);
    setGuestError(null);
    try {
      sessionStorage.setItem(
        `${GUEST_CREDS_STORAGE_PREFIX}${bookingId}`,
        JSON.stringify({ contactEmail: email, contactName: guestName.trim() || undefined }),
      );
    } catch {
      /* the room page will fall back to asking again */
    }
    router.push(`/tour-mode/room/${encodeURIComponent(bookingId)}`);
    setGuestBusy(false);
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16 pt-10">
      <h1 className="text-[24px] font-semibold text-gray-900">{copy.title}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-gray-600">{copy.subtitle}</p>
      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
        {copy.linkHint}
      </p>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-gray-900">{copy.myBookings}</h2>
        {signedIn === null && <p className="mt-2 text-[13px] text-gray-500">{copy.loading}</p>}
        {signedIn === false && <p className="mt-2 text-[13px] text-gray-500">{copy.signInHint}</p>}
        {signedIn === true && bookings !== null && bookings.length === 0 && (
          <p className="mt-2 text-[13px] text-gray-500">{copy.noBookings}</p>
        )}
        {signedIn === true && bookings !== null && bookings.length > 0 && (
          <ul className="mt-3 space-y-2">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/tour-mode/room/${encodeURIComponent(booking.id)}`)}
                  className="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-gray-100 transition hover:ring-amber-300"
                >
                  <div className="text-[14px] font-medium text-gray-900">
                    {booking.tours?.title ?? booking.booking_reference ?? booking.id}
                  </div>
                  <div className="mt-1 text-[12px] text-gray-500">
                    {[booking.tour_date, booking.tour_time, booking.tours?.city].filter(Boolean).join(' · ')}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-[15px] font-semibold text-gray-900">{copy.guestTitle}</h2>
        <p className="mt-1 text-[12px] text-gray-500">{copy.guestHint}</p>
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void openGuestRoom();
          }}
        >
          <label className="block">
            <span className="text-[12px] font-medium text-gray-700">{copy.bookingIdLabel}</span>
            <input
              value={guestBookingId}
              onChange={(e) => setGuestBookingId(e.target.value)}
              required
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] focus:border-amber-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-gray-700">{copy.emailLabel}</span>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] focus:border-amber-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-gray-700">{copy.nameLabel}</span>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              autoComplete="name"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] focus:border-amber-400 focus:outline-none"
            />
          </label>
          {guestError && <p className="text-[12px] text-red-600">{guestError}</p>}
          <button
            type="submit"
            disabled={guestBusy || !guestBookingId.trim() || !guestEmail.trim()}
            className="w-full rounded-xl bg-amber-500 py-3 text-[14px] font-semibold text-white transition disabled:opacity-40"
          >
            {guestBusy ? copy.loading : copy.enterRoom}
          </button>
        </form>
      </section>
    </div>
  );
}
