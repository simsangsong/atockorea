'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from 'react-datepicker';
import { MapIcon } from '@/components/Icons';
import { useTranslations } from '@/lib/i18n';
import { useCurrencyOptional } from '@/lib/currency';
import { BOOKING_CANCELLATION_SUMMARY_LINE } from '@/components/tour/bookingPolicy';
import 'react-datepicker/dist/react-datepicker.css';

export type BookingPanelSummary = {
  hasDate: boolean;
  guestCount: number;
  unitPriceFormatted: string;
  /** Raw KRW unit (before guest multiplier) for dual-currency sticky bar, etc. */
  unitPriceKRW: number;
  totalFormatted: string | null;
  priceType: 'person' | 'group';
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

interface EnhancedBookingSidebarProps {
  tour: {
    id: string | number;
    title?: string;
    price: number;
    originalPrice?: number | null;
    priceType: 'person' | 'group';
    pickupPoints: Array<{ id: string | number; name: string; address: string; lat: number; lng: number }>;
    availableSpots?: number;
    /** Server-only social proof; shown only when positive and smallGroup shell. */
    recentBookings24h?: number | null;
  };
  /** Optional: notify parent when selected date changes (e.g. for booking timeline). */
  onDateSelect?: (date: Date | null) => void;
  /** Optional: sync mobile bar / parent with formatted totals (small-group detail). */
  onBookingSummaryChange?: (summary: BookingPanelSummary) => void;
  /** Visual shell: `smallGroup` uses detail-page tokens for borders + CTA. */
  bookingShell?: 'default' | 'smallGroup';
}

interface AvailabilityData {
  available: boolean;
  availableSpots: number;
  maxCapacity: number | null;
  requestedGuests: number;
  canAccommodate: boolean;
  price: number;
  priceOverride: number | null;
  date: string;
}

export default function EnhancedBookingSidebar({
  tour,
  onDateSelect,
  onBookingSummaryChange,
  bookingShell = 'default',
}: EnhancedBookingSidebarProps) {
  const router = useRouter();
  const t = useTranslations();
  const currencyCtx = useCurrencyOptional();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleDateChange = useCallback(
    (date: Date | null) => {
      setSelectedDate(date);
      onDateSelect?.(date);
    },
    [onDateSelect]
  );
  const [guestCount, setGuestCount] = useState(1);
  const [selectedPickup, setSelectedPickup] = useState<string | number | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [applyDiscount, setApplyDiscount] = useState(true); // 할인율 자동 적용 (기본값 true)
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'zh' | 'ko'>('en');
  
  // Availability state
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [disabledDates, setDisabledDates] = useState<Date[]>([]);

  // Fetch availability when date or guest count changes
  useEffect(() => {
    if (selectedDate) {
      checkAvailability();
    } else {
      setAvailability(null);
      setAvailabilityError(null);
    }
  }, [selectedDate, guestCount, tour.id]);

  // Fetch date range availability to disable unavailable dates
  useEffect(() => {
    fetchDateRangeAvailability();
  }, [tour.id]);

  const fetchDateRangeAvailability = async () => {
    try {
      const response = await fetch(`/api/tours/${tour.id}/availability/range?days=90`);
      if (response.ok) {
        const data = await response.json();
        const unavailableDates: Date[] = [];
        
        Object.entries(data.availability).forEach(([dateStr, avail]: [string, any]) => {
          if (!avail.available || avail.availableSpots === 0) {
            unavailableDates.push(new Date(dateStr));
          }
        });
        
        setDisabledDates(unavailableDates);
      }
    } catch (err) {
      console.error('Error fetching date range availability:', err);
    }
  };

  const checkAvailability = useCallback(async () => {
    if (!selectedDate) return;

    try {
      setCheckingAvailability(true);
      setAvailabilityError(null);

      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await fetch(
        `/api/tours/${tour.id}/availability?date=${dateStr}&guests=${guestCount}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check availability');
      }

      setAvailability(data);
    } catch (err: any) {
      console.error('Error checking availability:', err);
      setAvailabilityError(err.message);
      setAvailability(null);
    } finally {
      setCheckingAvailability(false);
    }
  }, [selectedDate, guestCount, tour.id]);

  const isJejuPriceOverride = isJejuPrivateCarTour(tour.title) && (preferredLanguage === 'en' || preferredLanguage === 'zh');
  const hasDiscount = tour.originalPrice !== null && tour.originalPrice !== undefined && tour.originalPrice > tour.price;
  const discount = hasDiscount && tour.originalPrice ? tour.originalPrice - tour.price : 0;
  const discountPercent = hasDiscount && tour.originalPrice ? Math.round((discount / tour.originalPrice) * 100) : 0;
  // 제주: 원가 45만원 고정, 할인율 표시 (영어 35만 → 22%, 중국어 25만 → 44%)
  const JEJU_ORIGINAL_PRICE = 450000;
  const jejuDiscountPercent = isJejuPriceOverride
    ? preferredLanguage === 'en'
      ? Math.round(((JEJU_ORIGINAL_PRICE - 350000) / JEJU_ORIGINAL_PRICE) * 100)
      : Math.round(((JEJU_ORIGINAL_PRICE - 250000) / JEJU_ORIGINAL_PRICE) * 100)
    : 0;
  const showOriginalPrice = hasDiscount && tour.originalPrice && !isJejuPriceOverride ? true : isJejuPriceOverride;
  const displayOriginalPrice = isJejuPriceOverride ? JEJU_ORIGINAL_PRICE : (hasDiscount ? tour.originalPrice! : 0);
  
  // Format price in current currency (USD/KRW with real-time rate)
  const formatPrice = (price: number) => {
    if (currencyCtx) return currencyCtx.formatPrice(price);
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(price);
  };
  
  // Calculate base price (use original price if discount is not applied, otherwise use discounted price)
  const basePrice = applyDiscount && hasDiscount ? tour.price : (tour.originalPrice || tour.price);
  // Use availability price if available, otherwise use base price
  const effectivePrice = availability?.price || basePrice;
  const subtotal = tour.priceType === 'person' ? effectivePrice * guestCount : effectivePrice;
  const promoDiscount = promoCode === 'SAVE10' ? subtotal * 0.1 : 0;
  const totalPrice = subtotal - promoDiscount;

  // 제주 프라이빗 차 투어: 예약폼 언어 선택에 따라 총액 적용 (영어 35만원, 중국어 25만원)
  const displayTotalPrice =
    isJejuPrivateCarTour(tour.title) && (preferredLanguage === 'en' || preferredLanguage === 'zh')
      ? preferredLanguage === 'en'
        ? 350000
        : 250000
      : totalPrice;

  const unitPriceAmount = isJejuPriceOverride
    ? displayTotalPrice
    : availability?.priceOverride ?? (applyDiscount && hasDiscount ? tour.price : (tour.originalPrice || tour.price));

  useEffect(() => {
    if (!onBookingSummaryChange) return;
    onBookingSummaryChange({
      hasDate: selectedDate != null,
      guestCount,
      unitPriceFormatted: formatPrice(unitPriceAmount),
      unitPriceKRW: unitPriceAmount,
      totalFormatted: selectedDate != null ? formatPrice(displayTotalPrice) : null,
      priceType: tour.priceType,
    });
  }, [
    onBookingSummaryChange,
    selectedDate,
    guestCount,
    unitPriceAmount,
    displayTotalPrice,
    tour.priceType,
    currencyCtx,
    applyDiscount,
    hasDiscount,
    tour.price,
    tour.originalPrice,
    availability?.priceOverride,
    isJejuPriceOverride,
  ]);

  const isSg = bookingShell === 'smallGroup';
  const shellBorder = isSg ? 'border-[var(--dp-border)]/60' : 'border-slate-200/90';
  const fromLabelClass = isSg
    ? 'text-[11px] font-semibold uppercase tracking-[0.12em] text-[color-mix(in_oklab,var(--sg-ota-label)_78%,var(--dp-fg)_22%)]'
    : 'text-[11px] font-semibold text-slate-500 uppercase tracking-[0.14em]';
  const fieldLabelClass = isSg
    ? 'sg-dp-booking-field-label block text-[11px] font-semibold text-[var(--sg-ota-label)] uppercase tracking-[0.12em]'
    : 'block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-[0.12em]';
  const inputSurfaceClass = isSg
    ? 'sg-dp-booking-input w-full min-h-touch px-3.5 py-2.5 text-sm font-medium'
    : 'w-full min-h-touch px-3.5 py-2.5 text-sm font-medium text-slate-900 rounded-design-md bg-white border border-slate-200/90 shadow-sm outline-none transition-colors duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400/55';
  const insetCardClass = isSg
    ? 'sg-dp-booking-inset'
    : 'rounded-design-md border border-slate-200/80 bg-white shadow-sm';
  const panelClass = isSg
    ? 'rounded-design-lg border border-[var(--dp-border)]/50 bg-white/95 shadow-sm'
    : 'rounded-design-lg border border-slate-200/80 bg-white shadow-sm';
  const ctaClass = isSg
    ? 'sg-dp-booking-primary-cta disabled:cursor-not-allowed'
    : 'w-full mt-4 min-h-touch px-5 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm rounded-design-md transition-all duration-200 shadow-design-md active:scale-[0.98] disabled:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2';

  const handleCheckAvailability = async () => {
    if (!selectedDate) return;
    
    setIsLoading(true);
    
    // Optional: Check availability (can be skipped for now)
    try {
      await checkAvailability();
      
      if (availability && !availability.canAccommodate) {
        alert(`Sorry, only ${availability?.availableSpots || 0} spots available for this date.`);
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Availability check failed, proceeding anyway:', err);
      // Continue to checkout even if availability check fails
    }
    
    // Prepare booking data
    const bookingData = {
      tourId: tour.id,
      date: selectedDate.toISOString(),
      guests: guestCount,
      pickup: selectedPickup,
      paymentMethod: 'full' as const,
      preferredLanguage,
      totalPrice: displayTotalPrice,
      promoCode: promoCode || undefined,
      availability: availability,
    };
    
    // Store booking data in sessionStorage immediately
    try {
      sessionStorage.setItem('bookingData', JSON.stringify(bookingData));
      console.log('Booking data stored in sessionStorage:', bookingData);
    } catch (error) {
      console.error('Error storing booking data:', error);
      alert('Failed to save booking data. Please try again.');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(false);
    
    // Redirect to checkout page immediately (API connection not required)
    router.push(`/tour/${tour.id}/checkout`);
  };

  // Update guest count with availability check
  const handleGuestCountChange = (newCount: number) => {
    if (newCount < 1) return;
    
    // Check if new count exceeds availability
    if (availability && newCount > availability.availableSpots) {
      alert(`Only ${availability.availableSpots} spots available for this date.`);
      return;
    }
    
    setGuestCount(newCount);
  };

  const priceSuffix = tour.priceType === 'person' ? '/ guest' : '/ group';

  return (
    <div
      className={`booking-sidebar-cro bg-transparent p-0 antialiased ${isSg ? 'sg-dp-booking-block text-[var(--dp-fg)]' : 'text-slate-900'}`}
    >
      {/* Price header — OTA scan: From + unit + optional total when date selected */}
      <div className={isSg ? 'sg-dp-booking-price-well' : `mb-4 pb-4 border-b ${shellBorder}`}>
        {showOriginalPrice && displayOriginalPrice != null && displayOriginalPrice > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative inline-block text-base font-semibold text-slate-500 tabular-nums">
                {formatPrice(displayOriginalPrice)}
                <span className="absolute left-0 right-0 top-[42%] block h-0 border-t-2 border-red-500 pointer-events-none" aria-hidden />
                <span className="absolute left-0 right-0 top-[58%] block h-0 border-t-2 border-red-500 pointer-events-none" aria-hidden />
              </span>
            </div>
            {isJejuPriceOverride ? (
              <span className="text-sm text-slate-700 font-medium">
                {jejuDiscountPercent}% {t('tour.discountApplied')}
              </span>
            ) : hasDiscount ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyDiscount}
                  onChange={(e) => setApplyDiscount(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/25 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-700 font-medium">
                  {discountPercent}% {t('tour.discountApplied')}
                </span>
              </label>
            ) : null}
          </div>
        )}
        <div className={isSg ? 'sg-dp-booking-price-row' : 'flex flex-wrap items-baseline gap-x-2 gap-y-0.5'}>
          <span className={fromLabelClass}>From</span>
          <span
            className={
              isSg
                ? 'sg-dp-booking-price-figure'
                : 'text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight tabular-nums'
            }
          >
            {formatPrice(unitPriceAmount)}
          </span>
          <span className={isSg ? 'sg-dp-booking-price-suffix' : 'text-sm text-slate-600 font-medium'}>
            {priceSuffix}
          </span>
        </div>
        {selectedDate ? (
          <p className={isSg ? 'sg-dp-booking-total-preview' : 'mt-2 text-sm font-semibold text-slate-900 tabular-nums'}>
            {tour.priceType === 'person' ? (
              <>
                Total for {guestCount} {guestCount === 1 ? 'guest' : 'guests'} · {formatPrice(displayTotalPrice)}
              </>
            ) : (
              <>
                Total · {formatPrice(displayTotalPrice)}
              </>
            )}
          </p>
        ) : null}
        {availability?.priceOverride ? (
          <p
            className={
              isSg ? 'sg-dp-booking-scarcity sg-dp-booking-scarcity--urgent' : 'mt-1.5 text-xs font-semibold text-amber-700'
            }
          >
            Special price for this date
          </p>
        ) : null}
        {isSg && selectedDate && availability && availability.canAccommodate ? (
          <p className="sg-dp-booking-scarcity tabular-nums">
            Seats left: {availability.availableSpots}
          </p>
        ) : null}
        {isSg && selectedDate && availability && !availability.canAccommodate ? (
          <p className="sg-dp-booking-scarcity--alert">Not enough seats for your group on this date.</p>
        ) : null}
      </div>

      {/* Availability Alert — default tours only; smallGroup uses compact line in price header */}
      {availability && !isSg ? (
        <div
          className={`mb-6 rounded-design-md border p-3 ${
            availability.canAccommodate
              ? availability.availableSpots < 10
                ? 'border-amber-200/90 bg-amber-50/90'
                : 'border-emerald-200/90 bg-emerald-50/90'
              : 'border-red-200/90 bg-red-50/90'
          }`}
        >
          {availability.canAccommodate ? (
            <p
              className={`text-sm font-semibold ${
                availability.availableSpots < 10 ? 'text-amber-900' : 'text-emerald-900'
              }`}
            >
              {availability.availableSpots < 10
                ? `⚠️ Only ${availability.availableSpots} spots left!`
                : `✓ ${availability.availableSpots} spots available`}
            </p>
          ) : (
            <p className="text-sm font-semibold text-red-900">
              ❌ Not enough spots available. Only {availability.availableSpots} spots left.
            </p>
          )}
        </div>
      ) : null}

      {availabilityError && (
        <div
          className={
            isSg
              ? 'mb-5 rounded-[0.625rem] border border-red-200/80 bg-red-50/85 px-3 py-2.5'
              : 'mb-6 rounded-design-md border border-red-200/90 bg-red-50/90 p-3'
          }
        >
          <p className={isSg ? 'm-0 text-[13px] font-semibold leading-snug text-red-900' : 'text-sm font-semibold text-red-900'}>
            Error: {availabilityError}
          </p>
        </div>
      )}

      {/* Booking Form */}
      <div className={isSg ? 'sg-dp-booking-form-stack' : 'space-y-4'}>
        {/* Date Picker */}
        <div>
          <label className={fieldLabelClass}>
            {t('tour.selectDate')} <span className="text-rose-600">*</span>
          </label>
          <DatePicker
            selected={selectedDate}
            onChange={(date) => handleDateChange(date ?? null)}
            minDate={new Date()}
            placeholderText={t('tour.chooseDate')}
            className={inputSurfaceClass}
            popperClassName={`react-datepicker-booking-slate${isSg ? ' sg-datepicker-popper-fade' : ''}`}
            dateFormat="MMMM d, yyyy"
            excludeDates={disabledDates}
            filterDate={(date) => {
              // Additional client-side filtering if needed
              return true;
            }}
          />
          {checkingAvailability && selectedDate && (
            <p
              className={
                isSg
                  ? 'mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-[color-mix(in_oklab,var(--dp-muted)_82%,var(--dp-fg)_18%)]'
                  : 'mt-1.5 flex items-center gap-1 text-xs font-medium text-slate-600'
              }
            >
              <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Checking availability...
            </p>
          )}
        </div>

        {/* Guest Count */}
        <div>
          <label className={fieldLabelClass}>
            {t('tour.numberOfGuests')} <span className="text-rose-600">*</span>
          </label>
          <div className={`flex min-h-touch items-center justify-between gap-3 p-2.5 ${insetCardClass}`}>
            <span
              className={
                isSg
                  ? 'text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sg-ota-label)]'
                  : 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600'
              }
            >
              {t('tour.guests')}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleGuestCountChange(guestCount - 1)}
                className={isSg ? 'sg-dp-booking-icon-btn' : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-design-md border border-slate-200/90 bg-slate-50 text-slate-800 transition-colors duration-200 hover:bg-slate-100 active:scale-[0.98]'}
                aria-label="Decrease guests"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                </svg>
              </button>
              <span
                className={isSg ? 'sg-dp-booking-stepper-value' : 'min-w-[2rem] text-center text-base font-bold tabular-nums text-slate-900'}
              >
                {guestCount}
              </span>
              <button
                type="button"
                onClick={() => handleGuestCountChange(guestCount + 1)}
                disabled={availability ? guestCount >= availability.availableSpots : false}
                className={
                  isSg
                    ? 'sg-dp-booking-icon-btn'
                    : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-design-md border border-slate-200/90 bg-slate-50 text-slate-800 transition-colors duration-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.98]'
                }
                aria-label="Increase guests"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
          {availability && availability.availableSpots < guestCount && (
            <p className="mt-1.5 text-xs font-semibold text-red-700">
              Only {availability.availableSpots} spots available
            </p>
          )}
        </div>

        {/* Pickup Point */}
        <div>
          <label className={fieldLabelClass}>{t('tour.pickupLocation')}</label>
          <select
            value={selectedPickup || ''}
            onChange={(e) => setSelectedPickup(e.target.value)}
            className={`${inputSurfaceClass} appearance-none bg-[length:1rem_1rem] bg-[right_0.65rem_center] bg-no-repeat pr-10`}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
            }}
          >
              <option value="">{t('tour.selectPickupPoint')}</option>
            {tour.pickupPoints.map((point) => (
              <option key={point.id} value={point.id}>
                {point.name}
              </option>
            ))}
          </select>
          {selectedPickup && (
            <div className={isSg ? 'sg-dp-booking-pickup-detail' : `mt-2 p-3 ${insetCardClass}`}>
              <div className="flex items-start gap-2.5">
                <MapIcon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${isSg ? 'text-[var(--sg-ota-label)]' : 'text-slate-500'}`}
                />
                <div className="min-w-0">
                  <p
                    className={
                      isSg
                        ? 'sg-dp-booking-pickup-name'
                        : 'text-sm font-semibold text-slate-900'
                    }
                  >
                    {tour.pickupPoints.find((p) => p.id === selectedPickup)?.name}
                  </p>
                  <p
                    className={
                      isSg ? 'sg-dp-booking-pickup-address' : 'mt-0.5 text-xs font-medium leading-relaxed text-slate-600'
                    }
                  >
                    {tour.pickupPoints.find((p) => p.id === selectedPickup)?.address}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preferred language (guide) */}
        <div>
          <label className={fieldLabelClass}>Preferred language</label>
          <select
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value as 'en' | 'zh' | 'ko')}
            className={`${inputSurfaceClass} appearance-none bg-[length:1rem_1rem] bg-[right_0.65rem_center] bg-no-repeat pr-10`}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
            }}
          >
            <option value="en">English</option>
            <option value="zh">中文 (Chinese)</option>
            <option value="ko">한국어 (Korean)</option>
          </select>
        </div>
      </div>

      {/* Price summary + payment — merged premium ledger on small-group */}
      {isSg ? (
        <div className="sg-dp-booking-card-group">
          <div className="sg-dp-booking-ledger-pane">
            <div className="mb-2.5 space-y-1.5">
              {tour.priceType === 'person' && (
                <div className="sg-dp-booking-ledger-row">
                  <span>
                    {t('tour.guests')} ({guestCount})
                  </span>
                  <span className="tabular-nums">
                    {formatPrice(
                      isJejuPrivateCarTour(tour.title) && (preferredLanguage === 'en' || preferredLanguage === 'zh')
                        ? displayTotalPrice
                        : subtotal
                    )}
                  </span>
                </div>
              )}
              {promoDiscount > 0 && (
                <div className="sg-dp-booking-ledger-row">
                  <span className="font-semibold text-emerald-700">Promo Discount</span>
                  <span className="font-semibold tabular-nums text-emerald-700">-{formatPrice(promoDiscount)}</span>
                </div>
              )}
            </div>
            <div className="sg-dp-booking-ledger-total">
              <span className="sg-dp-booking-ledger-total-label">{t('tour.total')}</span>
              <span className="sg-dp-booking-ledger-total-value">{formatPrice(displayTotalPrice)}</span>
            </div>
          </div>
          <div className="sg-dp-booking-ledger-pane">
            <p className="sg-dp-booking-payment-eyebrow">{t('booking.paymentMethod')}</p>
            <p className="sg-dp-booking-payment-title">{t('booking.fullPayment')}</p>
            <p className="sg-dp-booking-payment-note">{t('booking.payFullAmountOnline')}</p>
          </div>
        </div>
      ) : (
        <>
          <div className={`mt-5 p-4 ${panelClass}`}>
            <div className="mb-2.5 space-y-1.5">
              {tour.priceType === 'person' && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">
                    {t('tour.guests')} ({guestCount})
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {formatPrice(
                      isJejuPrivateCarTour(tour.title) && (preferredLanguage === 'en' || preferredLanguage === 'zh')
                        ? displayTotalPrice
                        : subtotal
                    )}
                  </span>
                </div>
              )}
              {promoDiscount > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-700">Promo Discount</span>
                  <span className="font-semibold tabular-nums text-emerald-700">-{formatPrice(promoDiscount)}</span>
                </div>
              )}
            </div>
            <div className="border-t border-slate-200/90 pt-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold uppercase tracking-[0.12em] text-slate-600">{t('tour.total')}</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-3xl">
                  {formatPrice(displayTotalPrice)}
                </span>
              </div>
            </div>
          </div>

          <div className={`mt-5 p-4 ${panelClass}`}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {t('booking.paymentMethod')}
            </p>
            <p className="text-sm font-bold text-slate-900">{t('booking.fullPayment')}</p>
            <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-600">{t('booking.payFullAmountOnline')}</p>
          </div>
        </>
      )}

      <div className={isSg ? 'sg-dp-booking-trust-footnotes' : ''}>
        <p
          className={
            isSg
              ? 'sg-dp-booking-trust-line'
              : 'mt-4 text-[11px] sm:text-xs leading-relaxed text-slate-600'
          }
        >
          {BOOKING_CANCELLATION_SUMMARY_LINE}
        </p>
        {isSg && tour.recentBookings24h != null && tour.recentBookings24h > 0 ? (
          <p className="sg-dp-booking-trust-line">
            Booked {tour.recentBookings24h}{' '}
            {tour.recentBookings24h === 1 ? 'time' : 'times'} in the last 24 hours
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleCheckAvailability}
        disabled={!selectedDate || isLoading || isBooking || (availability ? !availability.canAccommodate : false)}
        className={ctaClass}
      >
        {isLoading
          ? t('common.loading')
          : isBooking
            ? t('common.processing')
            : availability && !availability.canAccommodate
              ? t('tour.checkAvailability')
              : t('booking.confirmBookingPayOnline')}
      </button>
    </div>
  );
}
