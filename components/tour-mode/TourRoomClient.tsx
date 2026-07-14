'use client';

/**
 * T1.4/T1.5 room-entry client (full RoomShell tabs arrive with T1.6).
 *
 * Join credential ladder on mount:
 *   1. `?rt=` invite token (track 1) — consumed once, then scrubbed from the
 *      address bar via history.replaceState (§O-1 ③: no token in history,
 *      screen shares, or share sheets; the link itself stays re-clickable);
 *   2. stored room session (frictionless re-entry, §O-1 ④);
 *   3. guest credentials stashed by the entry page (sessionStorage, one-shot);
 *   4. plain cookie session (logged-in owner / merchant / admin).
 *
 * Once joined, messages flow through useTourRoomChannel (Realtime Broadcast →
 * SSE fallback → visibility resync, T1.5).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import Composer from '@/components/tour-mode/Composer';
import RoomShell from '@/components/tour-mode/RoomShell';
import { detectEntryLocale, ENTRY_COPY } from '@/components/tour-mode/entryCopy';
import { GUEST_CREDS_STORAGE_PREFIX } from '@/components/tour-mode/TourModeEntry';
import { useTourRoomSession, type TourRoomJoinResult } from '@/hooks/useTourRoomSession';
import { useTourRoomChannel, type RoomMessage } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

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

export default function TourRoomClient({ bookingId }: { bookingId: string }) {
  const copy = useMemo(() => ENTRY_COPY[detectEntryLocale()], []);
  const { state, join } = useTourRoomSession(bookingId);
  const attempted = useRef(false);
  const [locale] = useState<RoomLocale>(() => detectEntryLocale());

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

  return <TourRoomLive bookingId={bookingId} data={state.data} locale={locale} />;
}

function TourRoomLive({
  bookingId,
  data,
  locale,
}: {
  bookingId: string;
  data: TourRoomJoinResult;
  locale: RoomLocale;
}) {
  const snapshot = data.snapshot as {
    booking?: { tours?: { title?: string; city?: string } | null; tour_date?: string | null } | null;
    messages?: RoomMessage[];
    schedule?: Array<Record<string, unknown>>;
  };
  const { messages, connection, sendText, sendPreset, retryFailed, failedCount } = useTourRoomChannel({
    bookingId,
    channelTopic: data.channel.topic,
    roomSession: data.session,
    initialMessages: snapshot.messages ?? [],
  });

  const viewerRole = data.participant.role;
  const readOnly = data.lifecycle === 'ended';
  const schedule = Array.isArray(snapshot.schedule) ? snapshot.schedule : [];

  return (
    <RoomShell
      title={snapshot.booking?.tours?.title ?? 'Your tour'}
      subtitle={[snapshot.booking?.tour_date, snapshot.booking?.tours?.city].filter(Boolean).join(' · ')}
      lifecycle={data.lifecycle}
      connection={connection}
      locale={locale}
      schedule={schedule}
      chat={
        <>
          <ChatFeed messages={messages} viewerLocale={locale} viewerRole={viewerRole} />
          {failedCount > 0 && (
            <button
              type="button"
              onClick={() => void retryFailed()}
              className="mb-2 w-full rounded-xl bg-red-50 py-2 text-[12px] font-medium text-red-600"
            >
              ↻ {failedCount}
            </button>
          )}
          {!readOnly && (
            <Composer
              locale={locale}
              onSendText={(text) => void sendText(text)}
              onSendPreset={(preset) => void sendPreset(preset, locale)}
            />
          )}
        </>
      }
    />
  );
}
