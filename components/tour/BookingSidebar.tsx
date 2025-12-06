'use client';

import { useState } from 'react';
import DatePicker from 'react-datepicker';
import { MapIcon } from '@/components/Icons';

interface BookingSidebarProps {
  tour: {
    id: number;
    price: number;
    priceType: 'person' | 'group';
    pickupPoints: Array<{ id: number; name: string; address: string; lat: number; lng: number }>;
  };
}

export default function BookingSidebar({ tour }: BookingSidebarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [selectedPickup, setSelectedPickup] = useState<number | null>(null);

  const calculatePrice = () => {
    if (tour.priceType === 'person') {
      return tour.price * guestCount;
    }
    return tour.price;
  };

  const totalPrice = calculatePrice();

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6 sticky top-20">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Book This Tour</h2>

      {/* Date Picker */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Date
        </label>
        <DatePicker
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date)}
          minDate={new Date()}
          placeholderText="Choose a date"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
          dateFormat="MMMM d, yyyy"
        />
      </div>

      {/* Guest Count */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Number of Guests
        </label>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
            className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-lg font-semibold text-gray-900 min-w-[3rem] text-center">
            {guestCount}
          </span>
          <button
            onClick={() => setGuestCount(guestCount + 1)}
            className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Pickup Point */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pickup Location
        </label>
        <select
          value={selectedPickup || ''}
          onChange={(e) => setSelectedPickup(Number(e.target.value))}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
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
              <MapIcon className="w-5 h-5 text-indigo-600 mt-0.5" />
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

      {/* Price Calculator */}
      <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Price per {tour.priceType}</span>
          <span className="text-sm font-semibold text-gray-900">${tour.price}</span>
        </div>
        {tour.priceType === 'person' && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Guests</span>
            <span className="text-sm font-semibold text-gray-900">{guestCount}</span>
          </div>
        )}
        <div className="border-t border-indigo-200 pt-2 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-indigo-600">${totalPrice}</span>
          </div>
        </div>
      </div>

      {/* Check Availability Button */}
      <button
        disabled={!selectedDate || !selectedPickup}
        className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
      >
        Check Availability
      </button>

      <p className="mt-4 text-xs text-center text-gray-500">
        Free cancellation up to 24 hours before tour
      </p>
    </div>
  );
}

