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

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
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

const LIFECYCLE_BADGE: Record<string, { label: string; className: string }> = {
  lobby: { label: 'D-day soon', className: 'bg-sky-100 text-sky-700' },
  live: { label: 'LIVE', className: 'bg-emerald-100 text-emerald-700' },
  ended: { label: 'Ended', className: 'bg-gray-200 text-gray-600' },
};

const CONNECTION_DOT: Record<string, string> = {
  connecting: 'bg-gray-300',
  realtime: 'bg-emerald-500',
  sse: 'bg-amber-400',
  offline: 'bg-red-400',
};

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
  };
  const { messages, connection, sendText, retryFailed, failedCount } = useTourRoomChannel({
    bookingId,
    channelTopic: data.channel.topic,
    roomSession: data.session,
    initialMessages: snapshot.messages ?? [],
  });

  const [draft, setDraft] = useState('');
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [messages.length]);

  const tourTitle = snapshot.booking?.tours?.title ?? 'Your tour';
  const badge = LIFECYCLE_BADGE[data.lifecycle] ?? LIFECYCLE_BADGE.live;
  const readOnly = data.lifecycle === 'ended';

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void sendText(text);
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col px-4 pb-4 pt-6">
      <header className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-semibold text-gray-900">{tourTitle}</h1>
          <p className="mt-0.5 text-[12px] text-gray-500">
            {[snapshot.booking?.tour_date, snapshot.booking?.tours?.city].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${CONNECTION_DOT[connection]}`} title={connection} />
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>
            {badge.label}
          </span>
        </div>
      </header>

      <div ref={feedRef} className="mt-4 flex-1 space-y-2 overflow-y-auto pb-2">
        {messages.length === 0 && <p className="pt-10 text-center text-[13px] text-gray-400">—</p>}
        {messages.map((message) => {
          const translated = message.translations?.[locale];
          const mine = message.sender_role === 'customer';
          return (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed shadow-sm ${
                mine
                  ? 'ml-auto bg-amber-500 text-white'
                  : message.sender_role === 'system'
                    ? 'mx-auto bg-gray-100 text-gray-600'
                    : 'bg-white text-gray-900 ring-1 ring-gray-100'
              } ${message._local === 'sending' ? 'opacity-60' : ''} ${message._local === 'failed' ? 'ring-2 ring-red-300' : ''}`}
            >
              {translated || message.source_text}
            </div>
          );
        })}
      </div>

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
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[14px] focus:border-amber-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-2xl bg-amber-500 px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-40"
            aria-label="send"
          >
            ➤
          </button>
        </form>
      )}
    </div>
  );
}
