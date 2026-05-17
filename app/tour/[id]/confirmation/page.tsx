'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { supabase } from '@/lib/supabase';
import { useCurrencyOptional } from '@/lib/currency';
import { analytics } from '@/src/design/analytics';
import {
  MYPAGE_FOCUS_RING,
  MYPAGE_SECTION_TITLE,
  MYPAGE_SHELL,
  MYPAGE_SKELETON_BLOCK,
  mypagePageCard,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

interface BookingData {
  tourId: number;
  date: string;
  guests: number;
  pickup: number | null;
  paymentMethod: 'full';
  preferredLanguage?: 'en' | 'zh' | 'ko';
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
  const currencyCtx = useCurrencyOptional();
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const formatTotal = (amountUsd: number) =>
    currencyCtx
      ? currencyCtx.formatPrice(amountUsd)
      : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amountUsd);

  useEffect(() => {
    isMountedRef.current = true;
    setFetchError(null);

    const applyBookingPayload = (b: Record<string, unknown>) => {
      let stored: BookingData | null = null;
      const storedRaw = sessionStorage.getItem('bookingData');
      if (storedRaw) {
        try {
          stored = JSON.parse(storedRaw) as BookingData;
        } catch {
          stored = null;
        }
      }

      let specialRequests: { preferredChatApp?: string; chatAppContact?: string } = {};
      try {
        if (b.special_requests) {
          specialRequests =
            typeof b.special_requests === 'string'
              ? JSON.parse(b.special_requests as string)
              : (b.special_requests as typeof specialRequests);
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[confirmation] special_requests parse:', e);
        }
      }
      const built: BookingData = {
        ...stored,
        tourId: Number(b.tour_id ?? stored?.tourId ?? 0),
        date: (b.booking_date as string) || (b.tour_date as string) || stored?.date || '',
        guests: (b.number_of_guests as number) ?? (b.number_of_people as number) ?? stored?.guests ?? 1,
        pickup: b.pickup_point_id ? Number(b.pickup_point_id) : stored?.pickup ?? null,
        paymentMethod: 'full',
        preferredLanguage:
          (b.preferred_language as 'en' | 'zh' | 'ko') || stored?.preferredLanguage || 'en',
        totalPrice: parseFloat(String(b.final_price ?? stored?.totalPrice ?? 0)),
        customerInfo: {
          name: (b.contact_name as string) || stored?.customerInfo?.name || '',
          phone: (b.contact_phone as string) || stored?.customerInfo?.phone || '',
          email: (b.contact_email as string) || stored?.customerInfo?.email || '',
          preferredChatApp:
            specialRequests.preferredChatApp || stored?.customerInfo?.preferredChatApp || '',
          chatAppContact: specialRequests.chatAppContact || stored?.customerInfo?.chatAppContact || '',
        },
      };
      return built;
    };

    (async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      const bookingId = urlParams.get('booking_id');

      if (sessionId && bookingId) {
        const headers: Record<string, string> = {};
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        }
        let url = `/api/bookings/${encodeURIComponent(bookingId)}?session_id=${encodeURIComponent(sessionId)}`;
        let res = await fetch(url, { headers });
        if (!res.ok) {
          const storedEmail = (() => {
            const raw = sessionStorage.getItem('bookingData');
            if (!raw) return null;
            try {
              return (JSON.parse(raw) as { customerInfo?: { email?: string } })?.customerInfo?.email;
            } catch {
              return null;
            }
          })();
          if (storedEmail) {
            url = `/api/bookings/${encodeURIComponent(bookingId)}?email=${encodeURIComponent(storedEmail)}`;
            res = await fetch(url, { headers: {} });
          }
        }
        if (!isMountedRef.current) return;
        if (!res.ok) {
          const msg =
            res.status === 404
              ? 'Booking not found'
              : `Request failed (${res.status})`;
          const stored = sessionStorage.getItem('bookingData');
          if (stored) {
            try {
              setBookingData(JSON.parse(stored) as BookingData);
            } catch {
              setFetchError(msg);
            }
          } else {
            setFetchError(msg);
          }
          return;
        }
        const data = await res.json();
        if (!isMountedRef.current) return;
        if (data.booking) {
          const b = data.booking as Record<string, unknown>;
          const built = applyBookingPayload(b);
          setBookingData(built);
          sessionStorage.setItem('bookingData', JSON.stringify({ ...built, bookingId: b.id }));
          // Fire booking_confirmed exactly once per booking_id. The Stripe
          // redirect can land here twice (3DS callbacks, refresh) — sessionStorage
          // flag prevents double-counting which would corrupt A/B CVR.
          const firedKey = `analytics.booking_confirmed.fired:${b.id}`;
          if (!sessionStorage.getItem(firedKey)) {
            sessionStorage.setItem(firedKey, '1');
            analytics.bookingConfirmed(String(b.id), {
              tourId: built.tourId,
              totalUsd: built.totalPrice,
              guests: built.guests,
            });
          }
        } else {
          router.push(consumerTourDetailHref(String(params.id)));
        }
        return;
      }

      const stored = sessionStorage.getItem('bookingData');
      if (stored) {
        try {
          setBookingData(JSON.parse(stored) as BookingData);
        } catch {
          router.push(consumerTourDetailHref(String(params.id)));
        }
      } else if (isMountedRef.current) {
        router.push(consumerTourDetailHref(String(params.id)));
      }
    })();

    return () => {
      isMountedRef.current = false;
    };
  }, [params.id, router]);

  if (!bookingData) {
    return (
      <div className="min-h-dvh min-h-screen bg-transparent text-slate-900">
        <Header />
        <main className="relative z-10 container mx-auto px-4 py-8 sm:px-6 md:py-12 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <div className={MYPAGE_SHELL}>
              {fetchError ? (
                <div className="space-y-4 text-center">
                  <p className="text-[14px] text-slate-600">{fetchError}</p>
                  <Link
                    href={consumerTourDetailHref(String(params.id))}
                    className={cn(
                      'inline-flex rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-[13px] font-semibold text-slate-900 shadow-sm',
                      MYPAGE_FOCUS_RING,
                    )}
                  >
                    Back to tour
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  <div className={MYPAGE_SKELETON_BLOCK} style={{ height: 64 }} />
                  <div className={MYPAGE_SKELETON_BLOCK} style={{ height: 220 }} />
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
        <BottomNav />
        <div className="h-16 md:hidden" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh min-h-screen bg-transparent text-slate-900">
      <Header />
      <main className="relative z-10 container mx-auto px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className={MYPAGE_SHELL}>
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
              Thank you for your reservation.
            </p>
            {bookingData.customerInfo?.email && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 text-[13px] text-emerald-800">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Confirmation email sent to <strong>{bookingData.customerInfo.email}</strong></span>
              </p>
            )}
            <p className="mt-2 text-sm text-gray-500">
              Check your spam/junk folder if you don't see it within 5 minutes.
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
                <span className="text-gray-900 font-semibold">Full payment (online)</span>
              </div>

              {/* Preferred language */}
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-gray-600 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  Preferred language
                </span>
                <span className="text-gray-900 font-semibold">
                  {bookingData.preferredLanguage === 'zh' ? '中文 (Chinese)' : bookingData.preferredLanguage === 'ko' ? '한국어 (Korean)' : 'English'}
                </span>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center py-3">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent tabular-nums">
                  {formatTotal(bookingData.totalPrice)}
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
              href="/tours/list"
              className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg text-center"
            >
              Browse More Tours
            </Link>
          </div>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}

