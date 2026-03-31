'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import DatePicker from 'react-datepicker';
import { MapPin } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { useCurrencyOptional } from '@/lib/currency';
import type { HotelInfo } from '@/components/maps/HotelMapPicker';
import 'react-datepicker/dist/react-datepicker.css';
import './small-group-premium.css';

const HotelMapPicker = dynamic(() => import('@/components/maps/HotelMapPicker').then((m) => m.default), {
  ssr: false,
});

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function nearestPickupPoint(
  lat: number,
  lng: number,
  points: SmallGroupMobileBookingSheetTour['pickupPoints']
): SmallGroupMobileBookingSheetTour['pickupPoints'][0] | null {
  if (!points.length) return null;
  let best = points[0];
  let bestD = Infinity;
  for (const p of points) {
    const d = haversineKm(lat, lng, p.lat, p.lng);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

type AvailabilityData = {
  available: boolean;
  availableSpots: number;
  maxCapacity: number | null;
  requestedGuests: number;
  canAccommodate: boolean;
  price: number;
  priceOverride: number | null;
  date: string;
  /** Server-side rule, e.g. Jeju East not on Mondays */
  reason?: string;
};

export type SmallGroupMobileBookingSheetTour = {
  id: string | number;
  title?: string;
  price: number;
  originalPrice?: number | null;
  priceType: 'person' | 'group';
  pickupPoints: Array<{ id: string | number; name: string; address: string; lat: number; lng: number }>;
};

type SmallGroupMobileBookingSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: SmallGroupMobileBookingSheetTour;
  checkoutPath: string;
  onDateSelect?: (date: Date | null) => void;
};

function isJejuPrivateCarTour(title: string | undefined): boolean {
  if (!title || typeof title !== 'string') return false;
  const s = title.toLowerCase().trim();
  return (
    /jeju\s+private\s+car|private\s+car\s+charter/i.test(s) ||
    /제주\s*프라이빗\s*차|프라이빗\s*차\s*차터/i.test(s) ||
    /济州\s*私人\s*包车|济州\s*私人\s*汽车|私人\s*包车|私人\s*汽车/i.test(s) ||
    /濟州\s*私人\s*包車|私人\s*包車/i.test(s) ||
    /済州\s*プライベート|プライベート\s*チャーター|済州\s*貸切/i.test(s) ||
    /jeju\s+coche\s+privado|charter\s+privado/i.test(s)
  );
}

const OVERLAY_MS = 520;

export default function SmallGroupMobileBookingSheet({
  open,
  onOpenChange,
  tour,
  checkoutPath,
  onDateSelect,
}: SmallGroupMobileBookingSheetProps) {
  const router = useRouter();
  const t = useTranslations();
  const currencyCtx = useCurrencyOptional();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [selectedPickup, setSelectedPickup] = useState<string | number | null>(null);
  const [applyDiscount, setApplyDiscount] = useState(true);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [disabledDates, setDisabledDates] = useState<Date[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [hotelMapOpen, setHotelMapOpen] = useState(false);
  const [pickupMapDetail, setPickupMapDetail] = useState<string | null>(null);

  const pickupList = tour.pickupPoints ?? [];
  const needsPickup = pickupList.length > 0;

  const formatPrice = useCallback(
    (price: number) => {
      if (currencyCtx) return currencyCtx.formatPrice(price);
      return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(price);
    },
    [currencyCtx]
  );

  const hasDiscount =
    tour.originalPrice !== null && tour.originalPrice !== undefined && tour.originalPrice > tour.price;
  const isJejuPrivate = isJejuPrivateCarTour(tour.title);
  const basePrice = applyDiscount && hasDiscount ? tour.price : (tour.originalPrice ?? tour.price);
  const effectivePrice = availability?.price ?? basePrice;
  const subtotal = tour.priceType === 'person' ? effectivePrice * guestCount : effectivePrice;
  /** Mobile step does not switch guide language; default English private-car tier matches sidebar default. */
  const previewTotal = isJejuPrivate ? 350000 : subtotal;

  const handleDateChange = useCallback(
    (date: Date | null) => {
      setSelectedDate(date);
      setGateError(null);
      onDateSelect?.(date);
    },
    [onDateSelect]
  );

  const handlePickupChange = useCallback((value: string | number | null) => {
    setSelectedPickup(value);
    setPickupMapDetail(null);
    setGateError(null);
  }, []);

  const handleHotelMapConfirm = useCallback(
    (info: HotelInfo) => {
      const near = nearestPickupPoint(info.lat, info.lng, pickupList);
      if (near) {
        setSelectedPickup(near.id);
        const label = (info.placeName && info.placeName.trim()) || info.address;
        setPickupMapDetail(label);
      }
      setHotelMapOpen(false);
      setGateError(null);
    },
    [pickupList]
  );

  useEffect(() => {
    if (!open) {
      setHotelMapOpen(false);
      setPickupMapDetail(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const tId = window.setTimeout(() => setMounted(false), OVERLAY_MS);
    return () => window.clearTimeout(tId);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  useEffect(() => {
    if (!selectedDate) {
      setAvailability(null);
      setAvailabilityError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setCheckingAvailability(true);
        setAvailabilityError(null);
        const dateStr = selectedDate.toISOString().split('T')[0];
        const response = await fetch(`/api/tours/${tour.id}/availability?date=${dateStr}&guests=${guestCount}`);
        const data = (await response.json()) as AvailabilityData & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(data.error || 'Failed to check availability');
        }
        setAvailability(data as AvailabilityData);
      } catch (e: unknown) {
        if (!cancelled) {
          setAvailability(null);
          setAvailabilityError(e instanceof Error ? e.message : 'Error');
        }
      } finally {
        if (!cancelled) setCheckingAvailability(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, guestCount, tour.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/tours/${tour.id}/availability/range?days=90`);
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as { availability?: Record<string, { available?: boolean; availableSpots?: number }> };
        const unavailableDates: Date[] = [];
        if (data.availability) {
          Object.entries(data.availability).forEach(([dateStr, avail]) => {
            if (!avail?.available || avail.availableSpots === 0) {
              unavailableDates.push(new Date(dateStr));
            }
          });
        }
        if (!cancelled) setDisabledDates(unavailableDates);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tour.id]);

  const handleGuestDelta = (delta: number) => {
    const next = guestCount + delta;
    if (next < 1) return;
    if (availability && next > availability.availableSpots) {
      window.alert(
        t('tour.checkAvailability') + `: ${availability.availableSpots}`
      );
      return;
    }
    setGuestCount(next);
    setGateError(null);
  };

  const dateBlockReason =
    selectedDate && availability && !availability.canAccommodate && availability.reason
      ? availability.reason
      : null;
  const dateBlockSeats =
    selectedDate && availability && !availability.canAccommodate && !availability.reason
      ? `${t('tour.checkAvailability')}: ${availability.availableSpots ?? 0}`
      : null;

  const handleConfirm = async () => {
    if (isSubmitting) return;

    setAvailabilityError(null);
    setGateError(null);

    if (needsPickup && (selectedPickup === null || selectedPickup === '')) {
      setGateError(t('tour.bookingPickupRequired'));
      return;
    }

    if (!selectedDate) {
      setGateError(t('tour.bookingSelectDateFirst'));
      return;
    }

    setIsSubmitting(true);

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await fetch(`/api/tours/${tour.id}/availability?date=${dateStr}&guests=${guestCount}`);
      const data = (await response.json()) as AvailabilityData & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check availability');
      }

      if (!data.canAccommodate) {
        const msg =
          data.reason ||
          `${t('tour.checkAvailability')}: ${data.availableSpots ?? 0}`;
        setGateError(msg);
        setIsSubmitting(false);
        return;
      }

      const freshBase = applyDiscount && hasDiscount ? tour.price : (tour.originalPrice ?? tour.price);
      const freshEffective = data.price ?? freshBase;
      const freshSubtotal = tour.priceType === 'person' ? freshEffective * guestCount : freshEffective;
      const total = isJejuPrivate ? 350000 : freshSubtotal;

      const pickupRow = pickupList.find((p) => String(p.id) === String(selectedPickup));
      const pickupAreaLabel =
        pickupRow && pickupMapDetail
          ? `${pickupRow.name} — ${pickupMapDetail}`
          : (pickupRow?.name ?? null);

      const bookingData = {
        tourId: tour.id,
        date: selectedDate.toISOString(),
        guests: guestCount,
        pickup:
          selectedPickup === null || selectedPickup === ''
            ? null
            : typeof selectedPickup === 'number'
              ? selectedPickup
              : /^\d+$/.test(selectedPickup)
                ? Number.parseInt(selectedPickup, 10)
                : selectedPickup,
        pickupAreaLabel,
        paymentMethod: 'full' as const,
        preferredLanguage: 'en' as const,
        totalPrice: total,
        availability: data,
      };

      try {
        sessionStorage.setItem('bookingData', JSON.stringify(bookingData));
      } catch {
        window.alert(t('common.error'));
        setIsSubmitting(false);
        return;
      }

      onOpenChange(false);
      router.push(checkoutPath);
    } catch (e: unknown) {
      setAvailabilityError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldLabelClass =
    'block text-[11px] font-semibold text-[var(--sg-ota-label)] mb-1.5 uppercase tracking-[0.12em]';
  const inputSurfaceClass =
    'w-full min-h-touch px-3.5 py-2.5 text-sm font-medium text-[var(--dp-fg)] rounded-xl bg-white/95 border border-stone-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] outline-none transition-[box-shadow,border-color,background-color] duration-200 focus:ring-2 focus:ring-[var(--dp-primary)]/20 focus:border-[var(--dp-primary)]/35';
  const insetCardClass =
    'rounded-xl border border-stone-200/70 bg-white/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]';

  if (!mounted || typeof document === 'undefined') return null;

  const overlayCls = `sg-mobile-booking-fade fixed inset-0 z-[70] flex flex-col justify-end bg-black/50 backdrop-blur-[2px] transition-opacity ease-out ${
    visible ? 'opacity-100 duration-500' : 'pointer-events-none opacity-0 duration-[480ms]'
  }`;
  const panelCls = `sg-mobile-booking-panel tour-detail-premium sg-dp-theme sg-mobile-booking-fade relative z-[71] mx-auto min-w-0 w-full max-w-[min(32rem,100vw)] rounded-t-[1.35rem] border-t border-x border-white/80 bg-white/88 backdrop-blur-2xl px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-5 shadow-[0_-24px_64px_-12px_rgba(0,0,0,0.18),0_-1px_0_rgba(255,255,255,0.95)_inset] ${
    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5 pointer-events-none'
  }`;

  return createPortal(
    <div className={overlayCls} role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-transparent"
        aria-label={t('common.close')}
        onClick={() => onOpenChange(false)}
      />
      <div
        className={panelCls}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-mobile-booking-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 h-1 w-11 rounded-full bg-gradient-to-r from-transparent via-stone-300 to-transparent shadow-sm"
          aria-hidden
        />
        <h2
          id="sg-mobile-booking-title"
          className="sg-dp-serif mb-1 text-[1.35rem] font-normal tracking-[-0.02em] text-[var(--dp-fg)] sm:text-[1.4rem]"
        >
          {t('tour.bookingStepOneTitle')}
        </h2>
        <p className="mb-5 text-[13px] leading-relaxed text-[var(--sg-ota-label)]">
          {needsPickup ? `${t('tour.pickupLocation')} · ` : null}
          {t('tour.selectDate')} · {t('tour.numberOfGuests')}
        </p>

        {needsPickup ? (
          <div className="mb-4">
            <label className={fieldLabelClass}>
              {t('tour.pickupLocation')} <span className="text-rose-600">*</span>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <select
                value={selectedPickup === null ? '' : String(selectedPickup)}
                onChange={(e) => {
                  const v = e.target.value;
                  handlePickupChange(v === '' ? null : v);
                }}
                className={`${inputSurfaceClass} min-w-0 flex-1 appearance-none bg-[length:1rem_1rem] bg-[right_0.65rem_center] bg-no-repeat pr-10`}
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2357534e'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
                }}
              >
                <option value="">{t('tour.selectPickupPoint')}</option>
                {pickupList.map((point: (typeof pickupList)[number]) => (
                  <option key={String(point.id)} value={String(point.id)}>
                    {point.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setHotelMapOpen(true)}
                className="flex min-h-touch shrink-0 items-center justify-center gap-2 rounded-[0.9375rem] border border-stone-200/85 bg-stone-800/[0.045] px-3.5 text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--dp-fg)] shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_2px_10px_-5px_rgba(15,23,42,0.08)] backdrop-blur-md transition-[transform,box-shadow,background-color] duration-200 hover:bg-stone-800/[0.07] active:scale-[0.99] sm:min-w-[8.5rem]"
              >
                <MapPin className="h-4 w-4 text-[var(--dp-primary)]" aria-hidden />
                {t('tour.searchHotelOnMap')}
              </button>
            </div>
            {pickupMapDetail ? (
              <p className="mt-1.5 text-[12px] font-medium leading-snug text-[var(--dp-primary)]">
                {t('tour.pickupMapMatched')}: {pickupMapDetail}
              </p>
            ) : null}
            {selectedPickup ? (
              <p className="mt-1.5 text-[12px] font-medium leading-snug text-[var(--sg-ota-label)]">
                {pickupList.find((p) => String(p.id) === String(selectedPickup))?.address}
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] font-medium leading-snug text-[var(--sg-ota-label)]">
                {t('tour.bookingPickupZoneHint')}
              </p>
            )}
          </div>
        ) : null}

        {hasDiscount && tour.originalPrice != null && !isJejuPrivate ? (
          <label className="mb-4 flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={applyDiscount}
              onChange={(e) => setApplyDiscount(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-[var(--dp-primary)] focus:ring-2 focus:ring-[var(--dp-primary)]/25"
            />
            <span className="text-sm font-medium text-[var(--dp-fg)]">{t('tour.discountApplied')}</span>
          </label>
        ) : null}

        <div className="mb-4">
          <label className={fieldLabelClass}>
            {t('tour.selectDate')} <span className="text-rose-600">*</span>
          </label>
          <DatePicker
            selected={selectedDate}
            onChange={(date: Date | null) => handleDateChange(date ?? null)}
            minDate={new Date()}
            placeholderText={t('tour.chooseDate')}
            className={inputSurfaceClass}
            popperClassName="react-datepicker-booking-slate sg-datepicker-popper-fade !z-[10000]"
            popperPlacement="top-start"
            dateFormat="MMMM d, yyyy"
            excludeDates={disabledDates}
          />
          {checkingAvailability && selectedDate ? (
            <p className="mt-1.5 text-xs font-medium text-[var(--sg-ota-label)]">{t('common.loading')}</p>
          ) : null}
        </div>

        <div className="mb-4">
          <label className={fieldLabelClass}>
            {t('tour.numberOfGuests')} <span className="text-rose-600">*</span>
          </label>
          <div className={`flex min-h-touch items-center justify-between gap-3 p-2.5 ${insetCardClass}`}>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sg-ota-label)]">
              {t('tour.guests')}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleGuestDelta(-1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-design-md border border-[var(--dp-border)]/55 bg-stone-50/80 text-[var(--dp-fg)] transition-colors duration-200 hover:bg-stone-100 active:scale-[0.98]"
                aria-label="Decrease guests"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                </svg>
              </button>
              <span className="min-w-[2rem] text-center text-base font-bold tabular-nums text-[var(--dp-fg)]">
                {guestCount}
              </span>
              <button
                type="button"
                onClick={() => handleGuestDelta(1)}
                disabled={availability ? guestCount >= availability.availableSpots : false}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-design-md border border-[var(--dp-border)]/55 bg-stone-50/80 text-[var(--dp-fg)] transition-colors duration-200 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.98]"
                aria-label="Increase guests"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {selectedDate ? (
          <div className="sg-dp-booking-sheet-total-pill">
            <p>
              {t('tour.total')}: {formatPrice(previewTotal)}
              {tour.priceType === 'person' ? ` · ${guestCount} ${t('tour.guests')}` : null}
            </p>
          </div>
        ) : null}

        {gateError ? (
          <p className="mb-3 text-sm font-semibold leading-snug text-red-700">{gateError}</p>
        ) : null}
        {availabilityError ? (
          <p className="mb-3 text-sm font-semibold text-red-700">{availabilityError}</p>
        ) : null}
        {dateBlockReason ? (
          <p className="mb-3 text-sm font-semibold leading-snug text-red-700">{dateBlockReason}</p>
        ) : null}
        {dateBlockSeats ? (
          <p className="mb-3 text-sm font-semibold leading-snug text-red-700">{dateBlockSeats}</p>
        ) : null}

        <div className="mt-3 flex gap-2.5 border-t border-stone-200/60 pt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="sg-dp-booking-sheet-secondary-cta"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={
              isSubmitting ||
              checkingAvailability ||
              (availability !== null && !availability.canAccommodate)
            }
            className="sg-dp-booking-sheet-primary-cta"
          >
            {isSubmitting ? t('common.loading') : t('common.confirm')}
          </button>
        </div>
      </div>

      <HotelMapPicker
        open={hotelMapOpen}
        onClose={() => setHotelMapOpen(false)}
        onConfirm={handleHotelMapConfirm}
        uiTone="glassLight"
        title={t('tour.searchHotelOnMap')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.confirm')}
        zIndexClass="z-[120]"
      />
    </div>,
    document.body
  );
}
