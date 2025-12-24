'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from 'react-datepicker';
import { MapIcon } from '@/components/Icons';
import { useTranslations } from '@/lib/i18n';
import 'react-datepicker/dist/react-datepicker.css';

interface EnhancedBookingSidebarProps {
  tour: {
    id: string | number;
    price: number;
    originalPrice?: number | null;
    priceType: 'person' | 'group';
    pickupPoints: Array<{ id: string | number; name: string; address: string; lat: number; lng: number }>;
    availableSpots?: number;
    depositAmountUSD?: number;
    balanceAmountKRW?: number;
  };
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

export default function EnhancedBookingSidebar({ tour }: EnhancedBookingSidebarProps) {
  const router = useRouter();
  const t = useTranslations();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [selectedPickup, setSelectedPickup] = useState<string | number | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'deposit' | 'full'>('deposit');
  const [applyDiscount, setApplyDiscount] = useState(true); // 할인율 자동 적용 (기본값 true)
  
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

  const hasDiscount = tour.originalPrice !== null && tour.originalPrice !== undefined && tour.originalPrice > tour.price;
  const discount = hasDiscount && tour.originalPrice ? tour.originalPrice - tour.price : 0;
  const discountPercent = hasDiscount && tour.originalPrice ? Math.round((discount / tour.originalPrice) * 100) : 0;
  
  // Format price as KRW
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
    }).format(price);
  };
  
  // Calculate base price (use original price if discount is not applied, otherwise use discounted price)
  const basePrice = applyDiscount && hasDiscount ? tour.price : (tour.originalPrice || tour.price);
  // Use availability price if available, otherwise use base price
  const effectivePrice = availability?.price || basePrice;
  const subtotal = tour.priceType === 'person' ? effectivePrice * guestCount : effectivePrice;
  const promoDiscount = promoCode === 'SAVE10' ? subtotal * 0.1 : 0;
  const totalPrice = subtotal - promoDiscount;
  
  // Calculate deposit and balance for deposit payment method
  // Deposit: ₩10,000, Balance: totalPrice - ₩10,000
  const depositAmountKRW = 10000;
  const balanceAmountKRW = totalPrice - depositAmountKRW;

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
      paymentMethod,
      depositAmountKRW: paymentMethod === 'deposit' ? depositAmountKRW : undefined,
      balanceAmountKRW: paymentMethod === 'deposit' ? balanceAmountKRW : undefined,
      totalPrice,
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

  return (
    <div className="bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 p-4 sm:p-5 lg:sticky lg:top-24">
      {/* Price Display */}
      <div className="mb-4 pb-4 border-b-2 border-blue-200/40">
        {/* Original Price */}
        {hasDiscount && tour.originalPrice && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg text-gray-400 line-through">{formatPrice(tour.originalPrice)}</span>
            </div>
            {/* Discount Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyDiscount}
                onChange={(e) => setApplyDiscount(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                {discountPercent}% {t('tour.discountApplied')}
              </span>
            </label>
          </div>
        )}
        {/* Final Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {formatPrice(availability?.priceOverride || (applyDiscount && hasDiscount ? tour.price : (tour.originalPrice || tour.price)))}
          </span>
          <span className="text-xs sm:text-sm text-gray-600 font-medium">/ {tour.priceType}</span>
        </div>
        {availability?.priceOverride && (
          <p className="text-xs font-medium text-orange-600 mt-1">Special price for this date</p>
        )}
        {tour.priceType === 'person' && (
          <p className="text-xs text-gray-500 mt-1">{t('tour.pricePerPerson')}</p>
        )}
      </div>

      {/* Availability Alert */}
      {availability && (
        <div className={`mb-6 p-3 rounded-lg border ${
          availability.canAccommodate
            ? availability.availableSpots < 10
              ? 'bg-orange-50 border-orange-200'
              : 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          {availability.canAccommodate ? (
            <p className={`text-sm font-medium ${
              availability.availableSpots < 10 ? 'text-orange-800' : 'text-green-800'
            }`}>
              {availability.availableSpots < 10 
                ? `⚠️ Only ${availability.availableSpots} spots left!`
                : `✓ ${availability.availableSpots} spots available`
              }
            </p>
          ) : (
            <p className="text-sm font-medium text-red-800">
              ❌ Not enough spots available. Only {availability.availableSpots} spots left.
            </p>
          )}
        </div>
      )}

      {availabilityError && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">Error: {availabilityError}</p>
        </div>
      )}

      {/* Booking Form */}
      <div className="space-y-3.5">
        {/* Date Picker */}
        <div>
          <label className="block text-xs font-bold text-gray-900 mb-1.5 uppercase tracking-wide">
            {t('tour.selectDate')} <span className="text-red-500">*</span>
          </label>
          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            minDate={new Date()}
            placeholderText={t('tour.chooseDate')}
            className="w-full px-3.5 py-2.5 text-sm font-medium text-gray-900 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white shadow-sm hover:border-blue-400 transition-colors"
            dateFormat="MMMM d, yyyy"
            excludeDates={disabledDates}
            filterDate={(date) => {
              // Additional client-side filtering if needed
              return true;
            }}
          />
          {checkingAvailability && selectedDate && (
            <p className="mt-1.5 text-xs text-blue-600 font-medium flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Checking availability...
            </p>
          )}
        </div>

        {/* Guest Count */}
        <div>
          <label className="block text-xs font-bold text-gray-900 mb-1.5 uppercase tracking-wide">
            {t('tour.numberOfGuests')} <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center justify-between bg-white rounded-xl border-2 border-gray-300 p-2.5 shadow-sm hover:border-blue-400 transition-colors">
            <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">{t('tour.guests')}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleGuestCountChange(guestCount - 1)}
                className="w-3 h-3 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300 flex items-center justify-center transition-colors active:scale-95"
              >
                <svg className="w-1.5 h-1.5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-base font-bold text-gray-900 min-w-[1.5rem] text-center">
                {guestCount}
              </span>
              <button
                onClick={() => handleGuestCountChange(guestCount + 1)}
                disabled={availability ? guestCount >= availability.availableSpots : false}
                className="w-3 h-3 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <svg className="w-1.5 h-1.5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
          {availability && availability.availableSpots < guestCount && (
            <p className="mt-1.5 text-xs text-red-600 font-bold">
              Only {availability.availableSpots} spots available
            </p>
          )}
        </div>

        {/* Pickup Point */}
        <div>
          <label className="block text-xs font-bold text-gray-900 mb-1.5 uppercase tracking-wide">
            {t('tour.pickupLocation')}
          </label>
          <select
            value={selectedPickup || ''}
            onChange={(e) => setSelectedPickup(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm font-medium text-gray-900 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white shadow-sm hover:border-blue-400 transition-colors"
          >
              <option value="">{t('tour.selectPickupPoint')}</option>
            {tour.pickupPoints.map((point) => (
              <option key={point.id} value={point.id}>
                {point.name}
              </option>
            ))}
          </select>
          {selectedPickup && (
            <div className="mt-2 p-2.5 bg-blue-50/50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <MapIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-gray-900">
                    {tour.pickupPoints.find((p) => p.id === selectedPickup)?.name}
                  </p>
                  <p className="text-xs text-gray-700 mt-0.5 font-medium">
                    {tour.pickupPoints.find((p) => p.id === selectedPickup)?.address}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Price Summary */}
      <div className="mt-4 p-3.5 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-purple-50/30 rounded-xl border-2 border-blue-300/50 shadow-md">
        <div className="space-y-1.5 mb-2.5">
          {tour.priceType === 'person' && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">{t('tour.guests')} ({guestCount})</span>
              <span className="font-bold text-gray-900">{formatPrice(subtotal)}</span>
            </div>
          )}
          {promoDiscount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-700 font-semibold">Promo Discount</span>
              <span className="font-bold text-green-700">-{formatPrice(promoDiscount)}</span>
            </div>
          )}
        </div>
        <div className="border-t-2 border-blue-300/50 pt-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">{t('tour.total')}</span>
            <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{formatPrice(totalPrice)}</span>
          </div>
        </div>
      </div>

      {/* Payment Method Selection - Compact & Elegant */}
      <div className="mt-5">
        <label className="block text-xs font-medium text-gray-600 mb-2.5">
          Payment Method <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Deposit + Cash on Site Button */}
          <button
            type="button"
            onClick={() => setPaymentMethod('deposit')}
            className={`relative px-3 py-3.5 rounded-xl font-semibold text-white transition-all duration-200 ${
              paymentMethod === 'deposit'
                ? 'bg-[#007AFF] shadow-[0_4px_12px_rgba(0,122,255,0.4)] ring-2 ring-blue-300/50'
                : 'bg-[#007AFF] hover:bg-[#0056CC] shadow-[0_2px_8px_rgba(0,122,255,0.3)] hover:shadow-[0_4px_12px_rgba(0,122,255,0.4)]'
            }`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-bold leading-tight text-white">{t('booking.depositCash')}</span>
              <span className="text-[10px] opacity-90 leading-tight text-white">{t('booking.payDepositOnline')}</span>
              <span className="text-[10px] opacity-90 leading-tight text-white">{t('booking.payBalanceOnSite')}</span>
            </div>
            {paymentMethod === 'deposit' && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-3 h-3 text-[#007AFF]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>

          {/* Full Payment on Website Button */}
          <button
            type="button"
            onClick={() => setPaymentMethod('full')}
            className={`relative px-3 py-3.5 rounded-xl font-semibold text-white transition-all duration-200 ${
              paymentMethod === 'full'
                ? 'bg-[#FF9500] shadow-[0_4px_12px_rgba(255,149,0,0.4)] ring-2 ring-orange-300/50'
                : 'bg-[#FF9500] hover:bg-[#CC7700] shadow-[0_2px_8px_rgba(255,149,0,0.3)] hover:shadow-[0_4px_12px_rgba(255,149,0,0.4)]'
            }`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-bold leading-tight text-white">{t('booking.fullPayment')}</span>
              <span className="text-[10px] opacity-90 leading-tight text-white">{t('booking.payFullAmountOnline')}</span>
            </div>
            {paymentMethod === 'full' && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-3 h-3 text-[#FF9500]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Payment Summary - Compact */}
      {paymentMethod === 'deposit' && (
        <div className="mt-3 p-2.5 bg-blue-50/80 rounded-lg border border-blue-200/60">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium">{t('booking.deposit')}</span>
            <span className="font-semibold text-blue-700">{formatPrice(depositAmountKRW)}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <span className="text-gray-500">{t('booking.payOnSite')}</span>
            <span className="font-semibold text-gray-700">{formatPrice(balanceAmountKRW)}</span>
          </div>
        </div>
      )}

      {/* Book Button */}
      <button
        onClick={handleCheckAvailability}
        disabled={!selectedDate || isLoading || isBooking || (availability ? !availability.canAccommodate : false)}
        className="w-full mt-4 px-5 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-98 disabled:shadow-none"
      >
        {isLoading 
          ? t('common.loading')
          : isBooking 
          ? t('common.processing')
          : availability && !availability.canAccommodate
          ? t('tour.checkAvailability')
          : paymentMethod === 'deposit'
          ? t('booking.payDeposit') + ' & ' + t('booking.confirmBooking')
          : 'Pay Full Amount on Website'}
      </button>

      {/* Trust Badges - Compact & Elegant Design */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-green-50/50 hover:bg-green-50 transition-colors">
            <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xs text-gray-600 font-medium">Free cancellation up to 24 hours</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-blue-50/50 hover:bg-blue-50 transition-colors">
            <div className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-xs text-gray-600 font-medium">Instant confirmation</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-purple-50/50 hover:bg-purple-50 transition-colors">
            <div className="flex-shrink-0 w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-xs text-gray-600 font-medium">24/7 customer support</span>
          </div>
        </div>
      </div>
    </div>
  );
}
