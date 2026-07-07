'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { useTranslations, useCopy } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth-session';
import { useCurrencyOptional } from '@/lib/currency';
import { BookingTimelineSection } from '@/components/tour/BookingTimelineSection';
import { analytics } from '@/src/design/analytics';
import { CheckoutChatAppSelect } from '@/components/checkout/CheckoutChatAppSelect';
import {
  AUTH_FIELD_LABEL,
  AUTH_INPUT,
  MYPAGE_FOCUS_RING,
  MYPAGE_SECTION_TITLE,
  MYPAGE_SHELL,
  MYPAGE_SKELETON_BLOCK,
  mypagePageCard,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

// The Stripe card form only mounts after the user starts payment (a client
// secret + publishable key arrive), so its Stripe React SDK is loaded lazily
// instead of sitting in the checkout page's initial bundle.
const NoShowHoldCardForm = dynamic(
  () => import('@/components/checkout/NoShowHoldCardForm').then((m) => m.NoShowHoldCardForm),
  { ssr: false },
);

interface BookingData {
  tourId: number;
  date: string;
  guests: number;
  pickup: number | string | null;
  paymentMethod: 'full';
  preferredLanguage?: 'en' | 'zh' | 'ko';
  totalPrice: number;
  promoCode?: string;
}

interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  preferredChatApp: string;
  chatAppContact: string;
}

const inputError = (err: boolean) =>
  err ? 'border-red-400 bg-red-50/60' : 'border-slate-200';

const premiumIconShell =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_6px_16px_-6px_rgba(15,23,42,0.35)]';

const primaryCtaClass =
  'inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-md px-5 text-base font-semibold text-white transition-all shadow-lg outline-none disabled:pointer-events-none disabled:opacity-50 bg-foreground hover:bg-foreground/90 hover:shadow-xl focus-visible:border focus-visible:ring-[3px] focus-visible:ring-ring/50';

function CheckoutPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className={MYPAGE_SKELETON_BLOCK} style={{ height: 120 }} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className={MYPAGE_SKELETON_BLOCK} style={{ height: 360 }} />
        </div>
        <div className="space-y-3">
          <div className={MYPAGE_SKELETON_BLOCK} style={{ height: 200 }} />
          <div className={MYPAGE_SKELETON_BLOCK} style={{ height: 120 }} />
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const copy = useCopy();
  // Shared session from the global provider (lib/auth-session) — replaces raw
  // `supabase.auth.getSession()` on the payment critical path, which the
  // provider dock-block documents as the cause of past 5–6s auth hangs.
  const { session, getAccessToken } = useSession();
  const currencyCtx = useCurrencyOptional();
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    email: '',
    preferredChatApp: '',
    chatAppContact: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerInfo, string>>>({});
  const [paymentSession, setPaymentSession] = useState<{
    intentType: 'payment_intent' | 'setup_intent';
    clientSecret: string;
    publishableKey: string;
    bookingId: string;
    amountUsdCents: number;
    leadDays: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setPaymentCancelled(sp.get('cancelled') === 'true');
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem('bookingData');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as BookingData & {
          paymentMethod?: string;
          depositAmountKRW?: number;
          depositAmountUsd?: number;
        };
        setBookingData({
          ...parsed,
          paymentMethod: 'full',
        });
        analytics.checkoutStarted('unknown', (parsed as { pickupAreaLabel?: string })?.pickupAreaLabel ?? 'Unknown');
      } catch (error) {
        console.error('Error parsing booking data:', error);
        toast.error('Invalid booking data. Please try again.');
        router.push(`/tour/${params.id}`);
      }
    } else {
      router.push(`/tour/${params.id}`);
    }
  }, [params.id, router]);

  // 로그인 시 회원 정보(이름, 이메일, 전화번호) 자동 입력.
  // Reads the warm `session.user` from the global provider instead of a fresh
  // getSession() round-trip. Deps are value-stable (bookingData reference is
  // set once; session?.user?.id is a primitive) — no `t()` in deps, so this
  // can't hit the useTranslations() refetch loop (PR #266).
  useEffect(() => {
    const authUser = session?.user;
    if (!bookingData || !authUser) return;
    const name = (authUser.user_metadata?.full_name as string) || '';
    const email = authUser.email || '';
    if (!name && !email) return;
    let mounted = true;
    (async () => {
      const profile = supabase
        ? (await supabase.from('user_profiles').select('full_name, phone').eq('id', authUser.id).single()).data
        : null;
      if (!mounted) return;
      setCustomerInfo((prev) => ({
        ...prev,
        name: prev.name || (profile?.full_name ?? name) || '',
        email: prev.email || email || '',
        phone: prev.phone || (profile?.phone ?? '') || '',
      }));
    })();
    return () => { mounted = false; };
  }, [bookingData, session?.user?.id]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CustomerInfo, string>> = {};
    const name = customerInfo.name.trim();
    const phone = customerInfo.phone.trim();
    const email = customerInfo.email.trim();

    if (!name) {
      newErrors.name = t('errors.pleaseEnter') + ' ' + t('booking.fullName').toLowerCase();
    } else if (name.length < 2) {
      newErrors.name = t('errors.invalidName') || 'Name must be at least 2 characters';
    } else if (name.length > 100) {
      newErrors.name = t('errors.nameTooLong') || 'Name must be at most 100 characters';
    }

    if (!phone) {
      newErrors.phone = t('errors.pleaseEnter') + ' ' + t('booking.phone').toLowerCase();
    } else {
      const digitsOnly = phone.replace(/\D/g, '');
      if (digitsOnly.length < 8) {
        newErrors.phone = t('errors.phoneTooShort') || 'Phone must have at least 8 digits';
      } else if (digitsOnly.length > 15) {
        newErrors.phone = t('errors.phoneTooLong') || 'Phone must have at most 15 digits';
      } else if (!/^[0-9+\s\-()]+$/.test(phone)) {
        newErrors.phone = t('errors.invalidPhone');
      }
    }

    if (!email) {
      newErrors.email = t('errors.pleaseEnter') + ' ' + t('booking.email').toLowerCase();
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('errors.invalidEmail');
    } else if (email.length > 254) {
      newErrors.email = t('errors.emailTooLong') || 'Email is too long';
    }
    if (!customerInfo.preferredChatApp.trim()) {
      newErrors.preferredChatApp = t('errors.pleaseSelect') + ' ' + t('tour.preferredChatApp').toLowerCase();
    }
    if (!customerInfo.chatAppContact.trim()) {
      newErrors.chatAppContact = t('errors.pleaseEnter') + ' ' + t('tour.chatAppContact').toLowerCase();
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatPrice = (amountUsd: number) =>
    currencyCtx
      ? currencyCtx.formatPrice(amountUsd)
      : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amountUsd);

  const handlePayment = async () => {
    if (!bookingData) return;

    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);

    try {
      const paymentAmount = bookingData.totalPrice;

      const bookingPayload = {
        tourId: bookingData.tourId.toString(),
        bookingDate: bookingData.date,
        numberOfGuests: bookingData.guests,
        pickupPointId: bookingData.pickup != null ? String(bookingData.pickup) : null,
        finalPrice: bookingData.totalPrice,
        paymentMethod: 'full' as const,
        preferredLanguage: bookingData.preferredLanguage || 'en',
        specialRequests: JSON.stringify({
          preferredChatApp: customerInfo.preferredChatApp,
          chatAppContact: customerInfo.chatAppContact,
        }),
        customerInfo: {
          name: customerInfo.name,
          email: customerInfo.email,
          phone: customerInfo.phone,
          preferredChatApp: customerInfo.preferredChatApp,
          chatAppContact: customerInfo.chatAppContact,
        },
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      // Warm token from the shared provider (cached ref, or one bootstrap on
      // cold-miss) instead of a raw getSession() on the payment critical path.
      const token = await getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const bookingResponse = await fetch('/api/bookings', {
        method: 'POST',
        headers,
        body: JSON.stringify(bookingPayload),
      });

      const errorData = bookingResponse.ok ? null : await bookingResponse.json().catch(() => ({}));
      if (!bookingResponse.ok) {
        console.error('Booking API error response:', errorData);
        const errorMessage =
          bookingResponse.status === 403 && errorData?.message
            ? errorData.message
            : errorData?.details || errorData?.error || 'Failed to create booking';
        throw new Error(errorMessage);
      }

      const bookingResult = await bookingResponse.json();

      const completeBookingData = {
        ...bookingData,
        bookingId: bookingResult.booking.id,
        customerInfo,
      };
      sessionStorage.setItem('bookingData', JSON.stringify(completeBookingData));

      try {
        const paymentResponse = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: bookingResult.booking.id,
            bookingData: completeBookingData,
          }),
        });

        const paymentData = await paymentResponse.json();

        if (
          paymentResponse.ok &&
          paymentData.clientSecret &&
          paymentData.publishableKey &&
          (paymentData.intentType === 'payment_intent' ||
            paymentData.intentType === 'setup_intent')
        ) {
          setPaymentSession({
            intentType: paymentData.intentType,
            clientSecret: paymentData.clientSecret,
            publishableKey: paymentData.publishableKey,
            bookingId: paymentData.bookingId ?? bookingResult.booking.id,
            amountUsdCents: paymentData.amountUsdCents ?? Math.round(paymentAmount * 100),
            leadDays: paymentData.leadDays ?? 0,
          });
          setIsProcessing(false);
          /** Smooth-scroll to the card form which now appears below the customer info. */
          if (typeof window !== 'undefined') {
            requestAnimationFrame(() => {
              document.getElementById('checkout-card-form')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            });
          }
          return;
        }

        console.error('Stripe checkout API error:', paymentResponse.status, paymentData);
        const msg = paymentData?.error || 'Payment could not be started.';
        toast.error(
          `${msg} Your booking has been saved. Please try again or contact support.`,
          { duration: 8000 },
        );
        setIsProcessing(false);
        return;
      } catch (error) {
        console.error('Payment error:', error);
        toast.error('Payment could not be started. Please try again.');
        setIsProcessing(false);
        return;
      }
    } catch (error: unknown) {
      console.error('Booking error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to process booking. Please try again.';
      toast.error(msg);
      setIsProcessing(false);
    }
  };

  const handleInputChange = (field: keyof CustomerInfo, value: string) => {
    if (field === 'phone') {
      value = value.replace(/[^0-9+]/g, '');
    }
    setCustomerInfo((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (!bookingData) {
    return (
      <div className="min-h-dvh min-h-screen bg-transparent text-slate-900">
        <Header />
        <main className="relative z-10 container mx-auto px-4 py-8 sm:px-6 md:py-12 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className={MYPAGE_SHELL}>
              <p className={cn(MYPAGE_SECTION_TITLE, 'sr-only')}>{copy.checkout.title}</p>
              <CheckoutPageSkeleton />
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
        <div className="mx-auto max-w-4xl">
          <div className={MYPAGE_SHELL}>
            {paymentCancelled && (
              <div
                className="rounded-[22px] border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-[13px] font-medium text-amber-950 shadow-sm ring-1 ring-amber-500/10"
                role="status"
              >
                {copy.checkout.paymentCancelled}
              </div>
            )}

            <div className="mb-2 px-0.5 sm:px-0">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-slate-950 sm:text-3xl">
                {copy.checkout.pageTitle}
              </h1>
              <p className="mt-1 text-[14px] font-medium text-slate-600">{copy.checkout.pageSubtitle}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
              <div className="space-y-4 lg:col-span-2">
                <div className={cn(mypagePageCard(), 'p-5 sm:p-6')}>
                  <div className="mb-5 flex items-center gap-3">
                    <div className={premiumIconShell} aria-hidden>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className={MYPAGE_SECTION_TITLE}>{copy.checkout.customerInfoTitle}</h2>
                      <p className="mt-0.5 text-[12px] font-medium text-slate-500">{copy.checkout.requiredFieldsHint}</p>
                    </div>
                  </div>

                  <div className="space-y-4 sm:space-y-5">
                    <div>
                      <label className={AUTH_FIELD_LABEL} htmlFor="checkout-name">
                        {t('booking.fullName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="checkout-name"
                        type="text"
                        value={customerInfo.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className={cn(
                          AUTH_INPUT,
                          inputError(Boolean(errors.name)),
                          MYPAGE_FOCUS_RING,
                        )}
                        placeholder={t('booking.enterFullName')}
                        autoComplete="name"
                      />
                      {errors.name && (
                        <p className="mt-1.5 flex items-center gap-1 text-sm text-red-600">
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className={AUTH_FIELD_LABEL} htmlFor="checkout-phone">
                        {t('booking.phone')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="checkout-phone"
                        type="tel"
                        value={customerInfo.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={cn(
                          AUTH_INPUT,
                          inputError(Boolean(errors.phone)),
                          MYPAGE_FOCUS_RING,
                        )}
                        placeholder={t('booking.enterPhone')}
                        autoComplete="tel"
                      />
                      {errors.phone && (
                        <p className="mt-1.5 flex items-center gap-1 text-sm text-red-600">
                          {errors.phone}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className={AUTH_FIELD_LABEL} htmlFor="checkout-email">
                        {t('booking.email')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="checkout-email"
                        type="email"
                        value={customerInfo.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={cn(
                          AUTH_INPUT,
                          inputError(Boolean(errors.email)),
                          MYPAGE_FOCUS_RING,
                        )}
                        placeholder={t('booking.enterEmail')}
                        autoComplete="email"
                      />
                      {errors.email && (
                        <p className="mt-1.5 flex items-center gap-1 text-sm text-red-600">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className={AUTH_FIELD_LABEL} htmlFor="checkout-chat-app">
                        {t('tour.preferredChatApp')} <span className="text-red-500">*</span>
                      </label>
                      <CheckoutChatAppSelect
                        id="checkout-chat-app"
                        value={customerInfo.preferredChatApp}
                        onValueChange={(v) => handleInputChange('preferredChatApp', v)}
                        pleaseSelect={t('tour.pleaseSelect')}
                        aria-invalid={Boolean(errors.preferredChatApp)}
                      />
                      {errors.preferredChatApp && (
                        <p className="mt-1.5 flex items-center gap-1 text-sm text-red-600">
                          {errors.preferredChatApp}
                        </p>
                      )}
                    </div>

                    {customerInfo.preferredChatApp === 'line' && (
                      <div
                        className={cn(
                          'card-premium animate-in fade-in slide-in-from-top-1 border border-amber-200/60 bg-amber-50/90 p-4 duration-300',
                        )}
                        role="note"
                      >
                        <p className="text-[14px] leading-relaxed text-amber-950">
                          <span className="font-bold">{copy.checkout.lineCalloutEmphasis}</span>
                          <span className="font-normal">. </span>
                          <span className="text-[13px] text-amber-900/90">{t('tour.lineNotice')}</span>
                        </p>
                      </div>
                    )}

                    <div>
                      {customerInfo.preferredChatApp === 'line' && (
                        <p className="mb-1.5 text-[12px] font-medium text-slate-600">
                          {copy.checkout.chatContactLineHelper}
                        </p>
                      )}
                      <label className={AUTH_FIELD_LABEL} htmlFor="checkout-chat-contact">
                        {t('tour.chatAppContact')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="checkout-chat-contact"
                        type="text"
                        value={customerInfo.chatAppContact}
                        onChange={(e) => handleInputChange('chatAppContact', e.target.value)}
                        className={cn(
                          AUTH_INPUT,
                          inputError(Boolean(errors.chatAppContact)),
                          MYPAGE_FOCUS_RING,
                        )}
                        placeholder={
                          customerInfo.preferredChatApp === 'line' ? t('tour.enterLineLink') : t('tour.enterChatAppId')
                        }
                        autoComplete="off"
                      />
                      {errors.chatAppContact && (
                        <p className="mt-1.5 flex items-center gap-1 text-sm text-red-600">
                          {errors.chatAppContact}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {paymentSession && (
                  <div
                    id="checkout-card-form"
                    className={cn(mypagePageCard(), 'p-5 sm:p-6 scroll-mt-20')}
                  >
                    <div className="mb-4 flex items-start gap-3">
                      <div className={premiumIconShell} aria-hidden>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h2 className={MYPAGE_SECTION_TITLE}>
                          {(() => {
                            const v = t('checkout.cardOnFileTitle');
                            return v === 'checkout.cardOnFileTitle'
                              ? 'Card saved today — charged on tour day'
                              : v;
                          })()}
                        </h2>
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                          {(() => {
                            const v = t('checkout.cardOnFileSubtitle');
                            return v === 'checkout.cardOnFileSubtitle'
                              ? 'We save your card securely today to confirm your reservation. Your tour price will be charged automatically at 10:00 AM Korea time on the tour date. Cancel at least 24 hours before departure for a fee-free refund.'
                              : v;
                          })()}
                        </p>
                      </div>
                    </div>

                    <NoShowHoldCardForm
                      publishableKey={paymentSession.publishableKey}
                      clientSecret={paymentSession.clientSecret}
                      intentType={paymentSession.intentType}
                      currency="usd"
                      amountMinor={paymentSession.amountUsdCents}
                      leadDays={paymentSession.leadDays}
                      returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/tour/${params.id}/confirmation?booking_id=${encodeURIComponent(paymentSession.bookingId)}`}
                    />
                  </div>
                )}
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-20 space-y-4 lg:space-y-5">
                  <div className={cn(mypagePageCard(), 'p-5 sm:p-6')}>
                    <div className="mb-4 flex items-center gap-3">
                      <div className={premiumIconShell} aria-hidden>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <h2 className={MYPAGE_SECTION_TITLE}>{copy.checkout.orderSummary}</h2>
                    </div>
                    <div className="space-y-3.5 border-b border-slate-200/80 pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
                          <span className="text-slate-500" aria-hidden>
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </span>
                          {t('booking.tourDate')}
                        </span>
                        <span className="text-right text-[13px] font-semibold tabular-nums text-slate-900">
                          {new Date(bookingData.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
                          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {t('tour.guests')}
                        </span>
                        <span className="text-[13px] font-semibold tabular-nums text-slate-900">{bookingData.guests}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
                          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          {t('booking.paymentMethod')}
                        </span>
                        <span className="text-[13px] font-semibold text-slate-900">{t('booking.fullPayment')}</span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 border-b border-slate-200/80 pb-4">
                      <div className="flex justify-between text-[13px]">
                        <span className="text-slate-600">{copy.checkout.basePrice}</span>
                        <span className="font-semibold tabular-nums text-slate-900">{formatPrice(bookingData.totalPrice)}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t-2 border-slate-200/90 pt-4">
                      <span className="text-[15px] font-bold text-slate-900">{copy.checkout.total}</span>
                      <span className="text-2xl font-bold tabular-nums text-slate-900">
                        {formatPrice(bookingData.totalPrice)}
                      </span>
                    </div>
                  </div>

                  <BookingTimelineSection allowClientFallback={false} />

                  <div className={cn(mypagePageCard(), 'p-4 sm:p-5')}>
                    <h3 className="text-[15px] font-bold text-slate-900">{copy.checkout.secureCheckoutTitle}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{copy.checkout.secureCheckoutBody}</p>
                    <p className="mt-2 text-[12px] font-medium text-slate-700">{copy.checkout.confirmationEmailNote}</p>
                  </div>

                  {!paymentSession && (
                    <button
                      type="button"
                      onClick={handlePayment}
                      disabled={
                        isProcessing ||
                        !customerInfo.name ||
                        !customerInfo.phone ||
                        !customerInfo.email ||
                        !customerInfo.preferredChatApp ||
                        !customerInfo.chatAppContact
                      }
                      className={primaryCtaClass}
                    >
                      {isProcessing ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {t('booking.processing')}
                        </span>
                      ) : (
                        copy.checkout.completeBooking
                      )}
                    </button>
                  )}
                </div>
              </div>
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
