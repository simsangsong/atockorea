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
import { IconChevronRight, IconTabMap } from '@/components/tour-mode/icons';
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
  /** Distinct from `signedIn === false`: we could not ask, so we do not know. */
  const [loadFailed, setLoadFailed] = useState(false);
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
        // 🔴 A1.6 — a failed load is not an empty account. Treating any
        // response as data told a guest with a confirmed tour "no upcoming
        // confirmed tours on this account" the night before their tour, which
        // reads as "your booking is gone" and sends them to support.
        if (!res.ok) {
          setLoadFailed(true);
          return;
        }
        const json = (await res.json().catch(() => ({}))) as { bookings?: TourModeBooking[] };
        setSignedIn(true);
        setBookings(json.bookings ?? []);
      } catch {
        // Same reasoning: a network failure is not a signed-out session.
        if (!cancelled) setLoadFailed(true);
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

  // U6.4 — entry list on the room token system (light theme; the room itself
  // resolves dark mode after join).
  const inputClass =
    'tr-body mt-1 w-full rounded-[var(--tr-radius-input)] bg-[var(--tr-surface)] px-4 py-2.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--tr-accent)]';

  return (
    <div className="tr-root min-h-dvh bg-[var(--tr-canvas)]">
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-10">
        <h1 className="text-[24px] font-semibold leading-snug text-[var(--tr-ink)]">{copy.title}</h1>
        <p className="tr-body mt-2 text-[var(--tr-ink-2)]">{copy.subtitle}</p>
        <p className="tr-label mt-3 rounded-xl bg-[var(--tr-accent-soft)] px-3 py-2 leading-relaxed text-[var(--tr-accent-deep)]">
          {copy.linkHint}
        </p>

        <section className="mt-8">
          <h2 className="tr-title text-[var(--tr-ink)]">{copy.myBookings}</h2>
          {loadFailed && (
            <p
              className="tr-card-text mt-2 leading-relaxed text-[var(--tr-danger)]"
              data-testid="entry-load-failed"
            >
              {copy.loadFailed}
            </p>
          )}
          {!loadFailed && signedIn === null && (
            <p className="tr-card-text mt-2 text-[var(--tr-ink-3)]">{copy.loading}</p>
          )}
          {signedIn === false && <p className="tr-card-text mt-2 text-[var(--tr-ink-2)]">{copy.signInHint}</p>}
          {signedIn === true && bookings !== null && bookings.length === 0 && (
            <p className="tr-card-text mt-2 text-[var(--tr-ink-2)]">{copy.noBookings}</p>
          )}
          {signedIn === true && bookings !== null && bookings.length > 0 && (
            <ul className="mt-3 space-y-2">
              {bookings.map((booking) => (
                <li key={booking.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/tour-mode/room/${encodeURIComponent(booking.id)}`)}
                    className="tr-card flex w-full items-center gap-3 p-3 text-left tr-press"
                  >
                    {booking.tours?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={booking.tours.image_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]">
                        <IconTabMap size={20} aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="tr-card-text block truncate font-medium text-[var(--tr-ink)]">
                        {booking.tours?.title ?? booking.booking_reference ?? booking.id}
                      </span>
                      <span className="tr-label mt-0.5 block truncate text-[var(--tr-ink-2)]">
                        {[booking.tour_date, booking.tour_time, booking.tours?.city].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <IconChevronRight size={18} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="tr-title text-[var(--tr-ink)]">{copy.guestTitle}</h2>
          <p className="tr-label mt-1 text-[var(--tr-ink-2)]">{copy.guestHint}</p>
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void openGuestRoom();
            }}
          >
            <label className="block">
              <span className="tr-label font-medium text-[var(--tr-ink-2)]">{copy.bookingIdLabel}</span>
              <input
                value={guestBookingId}
                onChange={(e) => setGuestBookingId(e.target.value)}
                required
                autoComplete="off"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="tr-label font-medium text-[var(--tr-ink-2)]">{copy.emailLabel}</span>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="tr-label font-medium text-[var(--tr-ink-2)]">{copy.nameLabel}</span>
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} autoComplete="name" className={inputClass} />
            </label>
            {guestError && <p className="tr-label text-[var(--tr-danger)]">{guestError}</p>}
            <button
              type="submit"
              disabled={guestBusy || !guestBookingId.trim() || !guestEmail.trim()}
              className="tr-body flex min-h-[48px] w-full items-center justify-center rounded-full bg-[var(--tr-accent)] font-semibold text-[var(--tr-bubble-me-ink)] transition disabled:opacity-40"
            >
              {guestBusy ? copy.loading : copy.enterRoom}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
