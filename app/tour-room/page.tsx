'use client';

// Auth-gated resolver — never statically generate.
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';
import { useTourRoomBooking } from '@/lib/tour-room/use-tour-room-booking';
import { cn } from '@/lib/utils';

/**
 * `/tour-room` (no booking id) — the fallback entry point. When a live room
 * exists it redirects straight into it; otherwise it explains that the room
 * opens the day before the tour and points to upcoming bookings / the catalogue.
 * The adaptive BottomNav tab normally deep-links past this to `/tour-room/[id]`.
 */

function panelClass(extra?: string) {
  return cn(
    'rounded-[1.75rem] border border-slate-200/90 bg-white',
    'shadow-[0_28px_64px_-26px_rgba(15,23,42,0.11),0_12px_32px_-16px_rgba(15,23,42,0.07)]',
    'ring-1 ring-slate-900/[0.04]',
    extra,
  );
}

export default function TourRoomIndexPage() {
  const router = useRouter();
  const t = useTranslations();
  const { booking, loading } = useTourRoomBooking();

  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = (await supabase?.auth.getSession()) || { data: { session: null } };
      if (!alive) return;
      setSignedIn(Boolean(session));
      setAuthChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // A live room exists → go straight in.
  useEffect(() => {
    if (!loading && booking?.isRoomActive) {
      router.replace(`/tour-room/${booking.bookingId}`);
    }
  }, [loading, booking, router]);

  const resolving = loading || !authChecked || Boolean(booking?.isRoomActive);
  if (resolving) {
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
              href="/signin?redirect=/tour-room"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3.5 font-medium text-white transition-colors hover:bg-slate-800"
            >
              {t('auth.signIn')}
            </Link>
          </div>
        </main>
      </SitePageShell>
    );
  }

  const hasUpcoming = Boolean(booking);
  return (
    <SitePageShell>
      <main className="relative isolate container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(60vh,360px)] bg-gradient-to-b from-slate-50/95 via-white/55 to-transparent"
          aria-hidden
        />
        <div className={panelClass('w-full max-w-md p-8 text-center')}>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-7 w-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-slate-900">{t('tourRoom.noActiveTitle')}</h1>
          <p className="mb-6 text-sm text-slate-600">
            {hasUpcoming ? t('tourRoom.opensSoon') : t('tourRoom.noActiveDesc')}
          </p>
          <div className="flex flex-col gap-2.5">
            {hasUpcoming ? (
              <Link
                href="/mypage/upcoming"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3.5 font-medium text-white transition-colors hover:bg-slate-800"
              >
                {t('tourRoom.viewUpcoming')}
              </Link>
            ) : null}
            <Link
              href="/tours/list"
              className={cn(
                'inline-flex items-center justify-center rounded-xl px-6 py-3.5 font-medium transition-colors',
                hasUpcoming
                  ? 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                  : 'bg-slate-900 text-white hover:bg-slate-800',
              )}
            >
              {t('tourRoom.browseTours')}
            </Link>
          </div>
        </div>
      </main>
    </SitePageShell>
  );
}
