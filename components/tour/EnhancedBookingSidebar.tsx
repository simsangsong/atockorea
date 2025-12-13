'use client';

import { useState } from 'react';
import DatePicker from 'react-datepicker';
import { MapIcon } from '@/components/Icons';

interface EnhancedBookingSidebarProps {
  tour: {
    id: number;
    price: number;
    originalPrice?: number;
    priceType: 'person' | 'group';
    pickupPoints: Array<{ id: number; name: string; address: string; lat: number; lng: number }>;
    availableSpots?: number;
  };
}

export default function EnhancedBookingSidebar({ tour }: EnhancedBookingSidebarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [adultCount, setAdultCount] = useState(1);
  const [childCount, setChildCount] = useState(0);
  const [selectedPickup, setSelectedPickup] = useState<number | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'deposit' | 'full'>('deposit');

  const discount = tour.originalPrice ? tour.originalPrice - tour.price : 0;
  const discountPercent = tour.originalPrice ? Math.round((discount / tour.originalPrice) * 100) : 0;
  const totalGuests = adultCount + childCount;
  const childPrice = tour.priceType === 'person' ? tour.price * 0.7 : 0; // 70% for children
  const adultTotal = tour.priceType === 'person' ? tour.price * adultCount : tour.price;
  const childTotal = tour.priceType === 'person' ? childPrice * childCount : 0;
  const subtotal = adultTotal + childTotal;
  const promoDiscount = promoCode === 'SAVE10' ? subtotal * 0.1 : 0;
  const totalPrice = subtotal - promoDiscount;

  const handleCheckAvailability = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    setIsBooking(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 p-6 lg:sticky lg:top-20">
      {/* Price Display */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        {tour.originalPrice && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg text-gray-400 line-through">${tour.originalPrice}</span>
            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-semibold rounded">
              Save {discountPercent}%
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-blue-600">${tour.price}</span>
          <span className="text-sm text-gray-500">/ {tour.priceType}</span>
        </div>
        {tour.priceType === 'person' && (
          <p className="text-xs text-gray-500 mt-1">Per person pricing</p>
        )}
      </div>

      {/* Stock Alert */}
      {tour.availableSpots !== undefined && tour.availableSpots < 10 && (
        <div className="mb-6 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm font-medium text-orange-800">
            ⚠️ Only {tour.availableSpots} spots left!
          </p>
        </div>
      )}

      {/* Booking Form */}
      <div className="space-y-5">
        {/* Date Picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Date <span className="text-red-500">*</span>
          </label>
          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            minDate={new Date()}
            placeholderText="Choose a date"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
            dateFormat="MMMM d, yyyy"
          />
        </div>

        {/* Guest Count */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Guests <span className="text-red-500">*</span>
          </label>
          <div className="space-y-3">
            {/* Adults */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Adults</p>
                <p className="text-xs text-gray-500">Age 13+</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAdultCount(Math.max(1, adultCount - 1))}
                  className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-lg font-semibold text-gray-900 min-w-[3rem] text-center">
                  {adultCount}
                </span>
                <button
                  onClick={() => setAdultCount(adultCount + 1)}
                  className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Children */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Children</p>
                <p className="text-xs text-gray-500">Age 2-12</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setChildCount(Math.max(0, childCount - 1))}
                  className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-lg font-semibold text-gray-900 min-w-[3rem] text-center">
                  {childCount}
                </span>
                <button
                  onClick={() => setChildCount(childCount + 1)}
                  className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Pickup Point */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pickup Location
          </label>
          <select
            value={selectedPickup || ''}
            onChange={(e) => setSelectedPickup(Number(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
          >
            <option value="">Select pickup point</option>
            {tour.pickupPoints.map((point) => (
              <option key={point.id} value={point.id}>
                {point.name}
              </option>
            ))}
          </select>
          {selectedPickup && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-2">
                <MapIcon className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {tour.pickupPoints.find((p) => p.id === selectedPickup)?.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {tour.pickupPoints.find((p) => p.id === selectedPickup)?.address}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Promo Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Promo Code (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
            />
            <button className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors">
              Apply
            </button>
          </div>
          {promoCode === 'SAVE10' && (
            <p className="mt-2 text-sm text-green-600">✓ Promo code applied! 10% off</p>
          )}
        </div>
      </div>

      {/* Price Summary */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="space-y-2 mb-3">
          {tour.priceType === 'person' && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Adults ({adultCount})</span>
                <span className="font-semibold text-gray-900">${adultTotal.toFixed(2)}</span>
              </div>
              {childCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Children ({childCount})</span>
                  <span className="font-semibold text-gray-900">${childTotal.toFixed(2)}</span>
                </div>
              )}
            </>
          )}
          {promoDiscount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600">Promo Discount</span>
              <span className="font-semibold text-green-600">-${promoDiscount.toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="border-t border-blue-200 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-blue-600">${totalPrice.toFixed(2)}</span>
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
            className={`relative px-3 py-3.5 rounded-lg font-semibold text-white transition-all duration-200 ${
              paymentMethod === 'deposit'
                ? 'bg-blue-600 ring-2 ring-blue-300 shadow-md'
                : 'bg-blue-500 hover:bg-blue-600 shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-bold leading-tight">Deposit + Cash</span>
              <span className="text-[10px] opacity-90 leading-tight">Pay deposit online</span>
              <span className="text-[10px] opacity-90 leading-tight">Pay balance on site</span>
            </div>
            {paymentMethod === 'deposit' && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>

          {/* Full Payment on Site Button */}
          <button
            type="button"
            onClick={() => setPaymentMethod('full')}
            className={`relative px-3 py-3.5 rounded-lg font-semibold text-white transition-all duration-200 ${
              paymentMethod === 'full'
                ? 'bg-orange-600 ring-2 ring-orange-300 shadow-md'
                : 'bg-orange-500 hover:bg-orange-600 shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-bold leading-tight">Full Payment</span>
              <span className="text-[10px] opacity-90 leading-tight">Pay on site</span>
              <span className="text-[10px] opacity-90 leading-tight">Cash payment</span>
            </div>
            {paymentMethod === 'full' && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                <svg className="w-3 h-3 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
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
            <span className="text-gray-600 font-medium">Deposit (30%)</span>
            <span className="font-semibold text-blue-700">${(totalPrice * 0.3).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <span className="text-gray-500">Balance (on site)</span>
            <span className="font-semibold text-gray-700">${(totalPrice * 0.7).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Book Button */}
      <button
        onClick={handleCheckAvailability}
        disabled={!selectedDate || isLoading || isBooking}
        className="w-full mt-6 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
      >
        {isLoading 
          ? 'Checking...' 
          : isBooking 
          ? 'Booking...' 
          : paymentMethod === 'deposit'
          ? 'Pay Deposit & Book'
          : 'Reserve & Pay on Site'}
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

