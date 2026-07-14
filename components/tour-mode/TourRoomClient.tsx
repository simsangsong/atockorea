'use client';

/**
 * T1.4 room-entry client (chat/map/schedule shell arrives with T1.5/T1.6).
 *
 * Join credential ladder on mount:
 *   1. `?rt=` invite token (track 1) — consumed once, then scrubbed from the
 *      address bar via history.replaceState (§O-1 ③: no token in history,
 *      screen shares, or share sheets; the link itself stays re-clickable);
 *   2. stored room session (frictionless re-entry, §O-1 ④);
 *   3. guest credentials stashed by the entry page (sessionStorage, one-shot);
 *   4. plain cookie session (logged-in owner / merchant / admin).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { detectEntryLocale, ENTRY_COPY } from '@/components/tour-mode/entryCopy';
import { GUEST_CREDS_STORAGE_PREFIX } from '@/components/tour-mode/TourModeEntry';
import { useTourRoomSession } from '@/hooks/useTourRoomSession';

function consumeGuestCreds(bookingId: string): { contactEmail?: string; contactName?: string } | null {
  try {
    const key = `${GUEST_CREDS_STORAGE_PREFIX}${bookingId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as { contactEmail?: string; contactName?: string };
  } catch {
    return null;
  }
}

function scrubTokenFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('rt')) {
      url.searchParams.delete('rt');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {
    /* noop */
  }
}

const LIFECYCLE_BADGE: Record<string, { label: string; className: string }> = {
  lobby: { label: 'D-day soon', className: 'bg-sky-100 text-sky-700' },
  live: { label: 'LIVE', className: 'bg-emerald-100 text-emerald-700' },
  ended: { label: 'Ended', className: 'bg-gray-200 text-gray-600' },
};

export default function TourRoomClient({ bookingId }: { bookingId: string }) {
  const copy = useMemo(() => ENTRY_COPY[detectEntryLocale()], []);
  const { state, join } = useTourRoomSession(bookingId);
  const attempted = useRef(false);

  const [locale] = useState(() => detectEntryLocale());

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const url = new URL(window.location.href);
    const token = url.searchParams.get('rt');
    const guest = consumeGuestCreds(bookingId);

    void join({
      token: token || undefined,
      contactEmail: guest?.contactEmail,
      contactName: guest?.contactName,
      locale,
    }).then((result) => {
      if (result) scrubTokenFromUrl();
    });
  }, [bookingId, join, locale]);

  if (state.status === 'idle' || state.status === 'joining') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-[14px] text-gray-500">{copy.loading}</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="text-[32px]">🧭</div>
        <p className="mt-4 text-[14px] leading-relaxed text-gray-700">
          {state.httpStatus === 404 ? copy.errorNotFound : copy.errorGeneric}
        </p>
        <Link
          href="/tour-mode"
          className="mt-6 rounded-xl bg-amber-500 px-5 py-2.5 text-[13px] font-semibold text-white"
        >
          {copy.title}
        </Link>
      </div>
    );
  }

  const { data } = state;
  const snapshot = data.snapshot as {
    booking?: { tours?: { title?: string; city?: string } | null; tour_date?: string | null } | null;
    messages?: Array<{ id: string; sender_role: string; source_text: string; translations?: Record<string, string> }>;
  };
  const tourTitle = snapshot.booking?.tours?.title ?? 'Your tour';
  const badge = LIFECYCLE_BADGE[data.lifecycle] ?? LIFECYCLE_BADGE.live;
  const messages = snapshot.messages ?? [];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-gray-900">{tourTitle}</h1>
          <p className="mt-0.5 text-[12px] text-gray-500">
            {[snapshot.booking?.tour_date, snapshot.booking?.tours?.city].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </header>

      {/* T1.5/T1.6 replace this static list with the realtime ChatFeed. */}
      <section className="mt-6 flex-1 space-y-2 overflow-y-auto">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-[13px] text-gray-400">—</p>
        )}
        {messages.map((message) => {
          const translated = message.translations?.[locale];
          return (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed shadow-sm ${
                message.sender_role === 'customer'
                  ? 'ml-auto bg-amber-500 text-white'
                  : message.sender_role === 'system'
                    ? 'mx-auto bg-gray-100 text-gray-600'
                    : 'bg-white text-gray-900 ring-1 ring-gray-100'
              }`}
            >
              {translated || message.source_text}
            </div>
          );
        })}
      </section>
    </div>
  );
}
