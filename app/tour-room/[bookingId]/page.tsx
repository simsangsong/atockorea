'use client';

// Client-rendered, auth-gated, live data — never statically generate.
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { supabase } from '@/lib/supabase';
import { useI18n, useTranslations } from '@/lib/i18n';
import { computeRoomActive } from '@/lib/tour-room/use-tour-room-booking';
import { cn } from '@/lib/utils';

interface RoomBooking {
  id: string;
  bookingReference: string | null;
  tourTitle: string;
  tourCity: string;
  tourDate: string;
  tourTime: string | null;
  guests: number | null;
}

interface RoomMessage {
  id: string;
  sender_role: 'customer' | 'guide' | 'admin' | 'system';
  source_text: string;
  source_locale: string | null;
  translations: Record<string, string> | null;
  created_at: string;
}

function panelClass(extra?: string) {
  return cn(
    'rounded-[1.75rem] border border-slate-200/90 bg-white',
    'shadow-[0_28px_64px_-26px_rgba(15,23,42,0.11),0_12px_32px_-16px_rgba(15,23,42,0.07)]',
    'ring-1 ring-slate-900/[0.04]',
    extra,
  );
}

function dayOffset(tourDate: string): number {
  if (!tourDate) return NaN;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = tourDate.split('-').map(Number);
  const tour = new Date(y || 1970, (m || 1) - 1, d || 1);
  tour.setHours(0, 0, 0, 0);
  return Math.round((tour.getTime() - today.getTime()) / 86_400_000);
}

export default function TourRoomPage() {
  const params = useParams();
  const bookingId = String(params?.bookingId ?? '');
  const t = useTranslations();
  const { locale } = useI18n();

  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [booking, setBooking] = useState<RoomBooking | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 1) Resolve session token.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = (await supabase?.auth.getSession()) || { data: { session: null } };
      if (!alive) return;
      setSignedIn(Boolean(session));
      setToken(session?.access_token ?? null);
      setAuthChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 2) Load briefing (from tour-mode bookings) + messages once we have a token.
  useEffect(() => {
    if (!authChecked) return;
    if (!signedIn || !token || !bookingId) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [bRes, mRes] = await Promise.all([
          fetch('/api/tour-mode/bookings', { headers }),
          fetch(`/api/tour-rooms/${bookingId}/messages`, { headers }),
        ]);

        if (bRes.ok) {
          const json = await bRes.json();
          const list: any[] = Array.isArray(json?.bookings) ? json.bookings : [];
          const b = list.find((x) => x.id === bookingId);
          if (b) {
            const tour = Array.isArray(b.tours) ? b.tours[0] : b.tours;
            if (alive)
              setBooking({
                id: b.id,
                bookingReference: b.booking_reference ?? null,
                tourTitle: tour?.title ?? '',
                tourCity: tour?.city ?? '',
                tourDate: b.tour_date,
                tourTime: b.tour_time ?? null,
                guests: typeof b.number_of_guests === 'number' ? b.number_of_guests : null,
              });
          }
        }

        if (mRes.ok) {
          const json = await mRes.json();
          if (alive) setMessages(Array.isArray(json?.messages) ? json.messages : []);
        } else if (mRes.status === 403 || mRes.status === 404) {
          if (alive) setLoadError(true);
        }
      } catch {
        if (alive) setLoadError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authChecked, signedIn, token, bookingId]);

  // Keep the chat pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending || !token) return;
    setSending(true);
    setSendError(false);
    try {
      const res = await fetch(`/api/tour-rooms/${bookingId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('send failed');
      const json = await res.json();
      if (json?.message) setMessages((prev) => [...prev, json.message as RoomMessage]);
      setDraft('');
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  }, [draft, sending, token, bookingId]);

  function displayText(m: RoomMessage): string {
    const src = m.source_locale || '';
    if (src && src !== locale && m.translations && m.translations[locale]) {
      return m.translations[locale];
    }
    return m.source_text;
  }

  // ---- States -------------------------------------------------------------
  if (!authChecked || loading) {
    return (
      <SitePageShell>
        <main className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            <p className="text-sm text-slate-500">{t('common.loading')}</p>
          </div>
        </main>
      </SitePageShell>
    );
  }

  if (!signedIn) {
    return (
      <SitePageShell>
        <main className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className={panelClass('w-full max-w-md p-8 text-center')}>
            <h1 className="mb-2 text-xl font-semibold text-slate-900">{t('tourRoom.signInTitle')}</h1>
            <p className="mb-6 text-sm text-slate-600">{t('tourRoom.signInDesc')}</p>
            <Link
              href={`/signin?redirect=/tour-room/${bookingId}`}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3.5 font-medium text-white transition-colors hover:bg-slate-800"
            >
              {t('auth.signIn')}
            </Link>
          </div>
        </main>
      </SitePageShell>
    );
  }

  if (loadError || !booking) {
    return (
      <SitePageShell>
        <main className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className={panelClass('w-full max-w-md p-8 text-center')}>
            <h1 className="mb-2 text-xl font-semibold text-slate-900">{t('tourRoom.loadError')}</h1>
            <p className="mb-6 text-sm text-slate-600">{t('tourRoom.noActiveDesc')}</p>
            <Link
              href="/mypage/upcoming"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3.5 font-medium text-white transition-colors hover:bg-slate-800"
            >
              {t('tourRoom.viewUpcoming')}
            </Link>
          </div>
        </main>
      </SitePageShell>
    );
  }

  const days = dayOffset(booking.tourDate);
  const live = computeRoomActive(booking.tourDate);
  const statusLabel = days === 0 ? t('tourRoom.today') : days === 1 ? t('tourRoom.tomorrow') : '';
  const dateLabel = (() => {
    try {
      return new Date(booking.tourDate).toLocaleDateString(locale, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return booking.tourDate;
    }
  })();

  return (
    <SitePageShell>
      <main className="relative isolate container mx-auto max-w-3xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(60vh,360px)] bg-gradient-to-b from-slate-50/95 via-white/55 to-transparent"
          aria-hidden
        />

        {/* Briefing */}
        <section className={panelClass('mb-5 overflow-hidden')}>
          <div className="border-b border-slate-100 bg-[linear-gradient(165deg,#ffffff_0%,#fafbfc_45%,#f4f7fb_100%)] p-5 sm:p-6">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {live ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                  </span>
                  {t('tourRoom.liveNow')}
                </span>
              ) : null}
              {statusLabel ? (
                <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                  {statusLabel}
                </span>
              ) : null}
            </div>
            <h1 className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
              {booking.tourTitle || t('tourRoom.title')}
            </h1>
            {booking.tourCity ? <p className="mt-1 text-sm text-slate-500">{booking.tourCity}</p> : null}
          </div>

          <dl className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
            <Detail label={t('tourRoom.date')} value={dateLabel} />
            <Detail label={t('tourRoom.time')} value={booking.tourTime ? booking.tourTime.slice(0, 5) : '—'} />
            <Detail label={t('tourRoom.guests')} value={booking.guests != null ? String(booking.guests) : '—'} />
            <Detail label={t('tourRoom.reference')} value={booking.bookingReference || '—'} mono />
          </dl>
        </section>

        {/* Chat */}
        <section className={panelClass('flex h-[min(60vh,560px)] flex-col overflow-hidden')}>
          <header className="border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">{t('tourRoom.chatHeading')}</h2>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">{t('tourRoom.chatEmpty')}</p>
            ) : (
              messages.map((m) => {
                if (m.sender_role === 'system') {
                  return (
                    <div key={m.id} className="flex justify-center">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-center text-[12px] text-slate-500">
                        {displayText(m)}
                      </span>
                    </div>
                  );
                }
                const mine = m.sender_role === 'customer';
                return (
                  <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                        mine
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200/80 bg-white text-slate-800',
                      )}
                    >
                      {!mine ? (
                        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                          {m.sender_role === 'guide' ? t('tourRoom.senderGuide') : t('tourRoom.senderTeam')}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap">{displayText(m)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 p-3 sm:p-4">
            {sendError ? <p className="mb-2 text-xs text-red-600">{t('tourRoom.sendError')}</p> : null}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                placeholder={t('tourRoom.chatPlaceholder')}
                className="max-h-28 flex-1 resize-none rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              />
              <button
                onClick={() => void handleSend()}
                disabled={sending || !draft.trim()}
                className="shrink-0 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
              >
                {sending ? '…' : t('tourRoom.send')}
              </button>
            </div>
          </div>
        </section>
      </main>
    </SitePageShell>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={cn('mt-0.5 text-sm font-semibold text-slate-900', mono && 'font-mono text-[13px]')}>{value}</dd>
    </div>
  );
}
