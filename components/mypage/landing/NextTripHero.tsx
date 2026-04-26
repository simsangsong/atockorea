'use client';

import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarDateIcon, ClockIcon, MapIcon } from '@/components/Icons';
import { useTranslations } from '@/lib/i18n';
import { buildIcsEvent, downloadIcsFile } from '@/lib/ics';
import { MYPAGE_FOCUS_RING, MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { supabase } from '@/lib/supabase';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { cn } from '@/lib/utils';

export interface NextTripData {
  bookingId: string;
  tourId: string;
  slug?: string | null;
  title: string;
  tourDate: string;
  status: string;
  guests?: number | null;
  imageUrl?: string | null;
  city?: string | null;
  pickupName?: string | null;
  pickupTime?: string | null;
}

interface NextTripHeroProps {
  trip: NextTripData | null;
}

function dayCountdownKey(iso: string): { key: string; days?: number } {
  const tourDate = new Date(iso);
  if (Number.isNaN(tourDate.getTime())) return { key: 'mypage.bookings.dayCountdownFuture', days: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(tourDate);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return { key: 'mypage.bookings.dayCountdownToday' };
  if (diff === 1) return { key: 'mypage.bookings.dayCountdownTomorrow' };
  if (diff < 0) return { key: 'mypage.bookings.dayCountdownPast' };
  return { key: 'mypage.bookings.dayCountdownFuture', days: diff };
}

function EmptyHero() {
  const t = useTranslations();
  return (
    <div
      className={cn(
        MYPAGE_SURFACE_PAGE,
        'relative overflow-hidden p-6 md:p-8',
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-sky-100 via-white to-amber-50"
      />
      <div className="relative flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t('mypage.landing.nextTrip.badgeLabel')}
          </p>
          <h2 className="text-[1.15rem] font-bold tracking-tight text-[#0f172a] md:text-[1.3rem]">
            {t('mypage.landing.emptyHero.title')}
          </h2>
          <p className="mt-1 max-w-md text-[13px] leading-snug text-slate-600">
            {t('mypage.landing.emptyHero.subtitle')}
          </p>
        </div>
        <Link
          href="/tours/list"
          className={cn(
            'inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800',
            MYPAGE_FOCUS_RING,
          )}
        >
          {t('mypage.landing.emptyHero.cta')} →
        </Link>
      </div>
    </div>
  );
}

export function NextTripHero({ trip }: NextTripHeroProps) {
  const t = useTranslations();

  if (!trip) return <EmptyHero />;

  const detailHref = consumerTourDetailHref(trip.tourId, trip.slug ?? null);
  const countdown = dayCountdownKey(trip.tourDate);
  const countdownText = countdown.days != null
    ? t(countdown.key, { days: countdown.days })
    : t(countdown.key);

  const formattedDate = (() => {
    const d = new Date(trip.tourDate);
    if (Number.isNaN(d.getTime())) return trip.tourDate;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  })();

  const handleCalendar = () => {
    const ics = buildIcsEvent({
      uid: `booking-${trip.bookingId}@atockorea`,
      title: trip.title || 'AtoC Korea Tour',
      description: `AtoC Korea booking #${trip.bookingId}`,
      location: trip.city || trip.pickupName || 'South Korea',
      start: trip.tourDate,
      url: typeof window !== 'undefined'
        ? `${window.location.origin}${detailHref}`
        : undefined,
    });
    downloadIcsFile(`atoc-booking-${trip.bookingId}`, ics);
    toast.success(t('mypage.bookings.addToCalendar'));
  };

  const handleReceipt = async () => {
    try {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t('mypage.common.toast.signInRequired'));
        return;
      }
      const res = await fetch(`/api/bookings/${trip.bookingId}/receipt`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        toast.error(t('mypage.common.toast.saveFailed'));
        return;
      }
      const html = await res.text();
      const win = window.open('', '_blank');
      if (!win) {
        toast.error(t('mypage.common.toast.saveFailed'));
        return;
      }
      win.document.write(html);
      win.document.close();
    } catch (e) {
      console.error('[landing/NextTripHero] receipt failed', e);
      toast.error(t('mypage.common.toast.saveFailed'));
    }
  };

  const showReceipt = trip.status === 'confirmed' || trip.status === 'completed';

  return (
    <div className={cn(MYPAGE_SURFACE_PAGE, 'relative overflow-hidden p-0')}>
      <div className="relative h-56 w-full md:h-64">
        {trip.imageUrl ? (
          <Image
            src={trip.imageUrl}
            alt={trip.title}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 800px"
          />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-800">
              {t('mypage.landing.nextTrip.badgeLabel')}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
              {countdownText}
            </span>
          </div>
          <h2 className="truncate text-[1.25rem] font-bold tracking-tight text-white md:text-[1.5rem]">
            {trip.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/90">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDateIcon className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
            {trip.pickupTime && (
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5" />
                {trip.pickupTime}
              </span>
            )}
            {trip.pickupName && (
              <span className="inline-flex items-center gap-1.5">
                <MapIcon className="h-3.5 w-3.5" />
                {trip.pickupName}
              </span>
            )}
            {typeof trip.guests === 'number' && trip.guests > 0 && (
              <span className="inline-flex items-center gap-1.5">
                {t('mypage.landing.nextTrip.guests', { count: trip.guests })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 p-4 md:p-5">
        <Link
          href={detailHref}
          className={cn(
            'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800',
            MYPAGE_FOCUS_RING,
          )}
        >
          {t('mypage.landing.nextTrip.viewDetails')}
        </Link>
        <button
          type="button"
          onClick={handleCalendar}
          className={cn(
            'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-900 transition-colors hover:bg-slate-50',
            MYPAGE_FOCUS_RING,
          )}
        >
          {t('mypage.landing.nextTrip.addToCalendar')}
        </button>
        {showReceipt && (
          <button
            type="button"
            onClick={handleReceipt}
            className={cn(
              'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-900 transition-colors hover:bg-slate-50',
              MYPAGE_FOCUS_RING,
            )}
          >
            {t('mypage.landing.nextTrip.receipt')}
          </button>
        )}
      </div>
    </div>
  );
}
