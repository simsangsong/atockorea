'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

interface BookingData {
  tourId: number;
  date: string;
  guests: number;
  pickup: number | null;
  paymentMethod: 'deposit' | 'full';
  depositAmountUSD?: number;
  balanceAmountKRW?: number;
  totalPrice: number;
  promoCode?: string;
  customerInfo?: {
    name: string;
    phone: string;
    email: string;
    preferredChatApp: string;
    chatAppContact: string;
  };
}

export default function ConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const [bookingData, setBookingData] = useState<BookingData | null>(null);

  useEffect(() => {
    // Get booking data from sessionStorage
    const stored = sessionStorage.getItem('bookingData');
    if (stored) {
      setBookingData(JSON.parse(stored));
    } else {
      // If no booking data, redirect back to tour page
      router.push(`/tour/${params.id}`);
    }
  }, [params.id, router]);

  if (!bookingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-2xl mx-auto">
            <p className="text-center text-gray-600">Loading confirmation...</p>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Success Message */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Booking Confirmed!</h1>
            <p className="text-lg text-gray-600">
              Thank you for your reservation. We've sent a confirmation email to your address.
            </p>
          </div>

          {/* Booking Details Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-6 md:p-8 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              Booking Details
            </h2>

            <div className="space-y-4">
              {/* Date */}
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-gray-600 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Date
                </span>
                <span className="text-gray-900 font-semibold">
                  {new Date(bookingData.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>

              {/* Guests */}
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-gray-600 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Guests
                </span>
                <span className="text-gray-900 font-semibold">{bookingData.guests}</span>
              </div>

              {/* Payment Method */}
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-gray-600 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Payment Method
                </span>
                <span className="text-gray-900 font-semibold">
                  {bookingData.paymentMethod === 'deposit' ? 'Deposit + Cash' : 'Full Payment'}
                </span>
              </div>

              {/* Payment Details */}
              {bookingData.paymentMethod === 'deposit' && bookingData.depositAmountUSD && bookingData.balanceAmountKRW && (
                <>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-600">Deposit Paid (USD)</span>
                    <span className="text-green-600 font-semibold">${bookingData.depositAmountUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-600">Balance Due (KRW)</span>
                    <span className="text-gray-900 font-semibold">₩{bookingData.balanceAmountKRW.toLocaleString()}</span>
                  </div>
                </>
              )}

              {/* Total */}
              <div className="flex justify-between items-center py-3">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                  ${bookingData.totalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Information Card */}
          {bookingData.customerInfo && (
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-6 md:p-8 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                Contact Information
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name</span>
                  <span className="text-gray-900 font-medium">{bookingData.customerInfo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone</span>
                  <span className="text-gray-900 font-medium">{bookingData.customerInfo.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email</span>
                  <span className="text-gray-900 font-medium">{bookingData.customerInfo.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Chat App</span>
                  <span className="text-gray-900 font-medium capitalize">{bookingData.customerInfo.preferredChatApp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Chat Contact</span>
                  <span className="text-gray-900 font-medium">{bookingData.customerInfo.chatAppContact}</span>
                </div>
              </div>
            </div>
          )}

          {/* Important Notes */}
          <div className="bg-blue-50/80 rounded-2xl border border-blue-200/60 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Important Information
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>A confirmation email has been sent to your email address.</span>
              </li>
              {bookingData.paymentMethod === 'deposit' && (
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Please bring the remaining balance in cash on the tour day.</span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>You can cancel your booking up to 24 hours before the tour for a full refund.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>We'll contact you via your preferred chat app before the tour date.</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/mypage/mybookings"
              className="flex-1 py-3 px-6 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-900 font-semibold rounded-xl transition-all text-center shadow-sm hover:shadow-md"
            >
              View My Bookings
            </Link>
            <Link
              href="/tours"
              className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg text-center"
            >
              Browse More Tours
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}

