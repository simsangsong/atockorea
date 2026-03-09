'use client';

/**
 * Unified checkout entry: redirects to Stripe-backed tour checkout.
 * All payments go through Stripe (same as web tour checkout).
 * - Query: tourSlug (or tourId) + date + guests → /tour/[id]/checkout with sessionStorage.
 * - No tour params (e.g. from cart) → /cart.
 */
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

const DEPOSIT_KRW = 10000;

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'redirect' | 'error'>('loading');

  useEffect(() => {
    const tourSlug = searchParams.get('tourSlug');
    const tourId = searchParams.get('tourId');
    const date = searchParams.get('date');
    const guests = searchParams.get('guests');

    let resolvedTourId: string | null = tourId || null;
    let resolvedDate = date || null;
    let resolvedGuests = guests ? Math.max(1, parseInt(guests, 10) || 1) : 0;

    if (!resolvedDate || !resolvedGuests) {
      try {
        const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('cartItems') : null;
        const cartItems = raw ? (JSON.parse(raw) as Array<{ tourId: string; date?: string; quantity?: number }>) : [];
        const first = cartItems[0];
        if (first) {
          resolvedTourId = first.tourId;
          resolvedDate = first.date || null;
          resolvedGuests = first.quantity ?? 1;
        }
      } catch {
        // ignore
      }
    }

    if (!resolvedDate || !resolvedGuests) {
      router.replace('/cart');
      return;
    }

    const guestNum = resolvedGuests;
    const idOrSlug = resolvedTourId || tourSlug;
    if (!idOrSlug) {
      router.replace('/cart');
      return;
    }

    let cancelled = true;
    (async () => {
      try {
        const res = await fetch(`/api/tours/${encodeURIComponent(idOrSlug)}`);
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const { tour } = await res.json();
        if (!tour?.id) {
          setStatus('error');
          return;
        }
        const totalPrice = tour.price_type === 'person' ? tour.price * guestNum : tour.price;
        const depositAmountKRW = DEPOSIT_KRW;
        const balanceAmountKRW = totalPrice - depositAmountKRW;
        const bookingData = {
          tourId: tour.id,
          date: date.includes('T') ? date : new Date(date).toISOString(),
          guests: guestNum,
          pickup: null,
          paymentMethod: 'deposit',
          depositAmountKRW,
          balanceAmountKRW,
          totalPrice,
        };
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('bookingData', JSON.stringify(bookingData));
        }
        cancelled = false;
        router.replace(`/tour/${tour.id}/checkout`);
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [router, searchParams]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <p className="text-center text-gray-600">Could not load tour. Try again from the tour page.</p>
          <button
            type="button"
            onClick={() => router.push('/tours')}
            className="mx-auto mt-4 block px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Browse tours
          </button>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
      <Header />
      <main className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-600">Redirecting to checkout...</p>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
