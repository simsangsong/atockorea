'use client';

import { useEffect, useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe as StripeJS } from '@stripe/stripe-js';
import { toast } from 'sonner';
import { ShieldCheck, Wallet } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Module-level cache so `loadStripe()` is called once per publishable key per page load. */
const stripePromiseCache = new Map<string, Promise<StripeJS | null>>();
function getStripePromise(publishableKey: string): Promise<StripeJS | null> {
  let cached = stripePromiseCache.get(publishableKey);
  if (!cached) {
    cached = loadStripe(publishableKey);
    stripePromiseCache.set(publishableKey, cached);
  }
  return cached;
}

/**
 * Currency-aware authorization-hold card form. Generalized from USD-only to
 * support the itinerary-builder's KRW bookings (Phase 10 D9/D23).
 *
 * - `currency:'usd'` + `amountMinor` in cents (legacy tour-product flow)
 * - `currency:'krw'` + `amountMinor` in whole KRW (Stripe treats KRW as
 *   zero-decimal; no division required)
 *
 * For one PR cycle, the legacy `amountUsdCents` prop is accepted as a
 * deprecated alias and mapped to `{ currency:'usd', amountMinor:<cents> }`
 * so the tour-product checkout page can migrate independently.
 */
export type NoShowHoldCardFormProps = {
  /** Stripe publishable key returned from `/api/stripe/checkout`. */
  publishableKey: string;
  /** Server-issued client secret for either a PaymentIntent (≤7d) or SetupIntent (>7d). */
  clientSecret: string;
  /** Drives whether we call `confirmPayment` (PI) or `confirmSetup` (SI). */
  intentType: 'payment_intent' | 'setup_intent';
  /** Where to land after a successful confirmation. Stripe appends its own params. */
  returnUrl: string;
  /** Days from today to tour date — controls the disclosure copy ("hold today" vs "hold ~5 days before"). */
  leadDays: number;
  /** ISO 4217 currency. Required when `amountMinor` is provided. */
  currency?: 'usd' | 'krw';
  /** Authorized amount in the currency's minor units (cents for USD, whole KRW for KRW). */
  amountMinor?: number;
  /** @deprecated Use `currency:'usd' + amountMinor` instead. Kept for one PR cycle. */
  amountUsdCents?: number;
};

/**
 * Resolve `(currency, amountMinor, amountUsdCents)` into a unified
 * `{currency, amountMinor}` shape.
 *
 * Precedence (Phase 10.2.1 audit fix #1 + #11):
 *   1. Explicit `currency` ALWAYS wins, even when `amountMinor` is missing —
 *      previously this guard required BOTH props which silently dropped a
 *      KRW currency signal if the amount was undefined (rendered '$0' to
 *      the user). Now we honor the caller's currency choice and only fall
 *      back to USD when no currency is explicit at all.
 *   2. If no `currency` but the deprecated `amountUsdCents` is present,
 *      treat as USD cents (legacy tour-product flow).
 *   3. Otherwise USD/0 (last-resort default). In dev, emit a console.warn
 *      so the silent-$0 case is loud during testing.
 *
 * Exported for unit testing — see __tests__/components/checkout/NoShowHoldCardForm.format.test.ts.
 */
export function resolveAmount(
  props: Pick<NoShowHoldCardFormProps, 'currency' | 'amountMinor' | 'amountUsdCents'>,
): { currency: 'usd' | 'krw'; amountMinor: number } {
  if (props.currency) {
    const amountMinor =
      typeof props.amountMinor === 'number'
        ? props.amountMinor
        : typeof props.amountUsdCents === 'number' && props.currency === 'usd'
          ? props.amountUsdCents
          : 0;
    if (amountMinor === 0 && process.env.NODE_ENV !== 'production') {
      console.warn(
        `[NoShowHoldCardForm] resolveAmount: currency='${props.currency}' but no amountMinor provided — rendering 0.`,
      );
    }
    return { currency: props.currency, amountMinor };
  }
  if (typeof props.amountUsdCents === 'number') {
    return { currency: 'usd', amountMinor: props.amountUsdCents };
  }
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[NoShowHoldCardForm] resolveAmount: no currency or amount provided — defaulting to USD/0.',
    );
  }
  return { currency: 'usd', amountMinor: 0 };
}

export function NoShowHoldCardForm(props: NoShowHoldCardFormProps) {
  const stripePromise = useMemo(
    () => getStripePromise(props.publishableKey),
    [props.publishableKey],
  );

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#0f172a',
            colorBackground: '#ffffff',
            colorText: '#0f172a',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            borderRadius: '10px',
          },
        },
      }}
    >
      <CardFormInner {...props} />
    </Elements>
  );
}

/**
 * Format an amount in a currency's minor units. KRW is zero-decimal in Stripe
 * (and IRL), so `amountMinor` is already whole won; USD needs /100.
 */
export function formatHoldAmount(currency: 'usd' | 'krw', amountMinor: number): string {
  if (currency === 'krw') {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amountMinor);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function CardFormInner(props: NoShowHoldCardFormProps) {
  const { intentType, returnUrl, leadDays } = props;
  const { currency, amountMinor } = resolveAmount(props);
  const stripe = useStripe();
  const elements = useElements();
  const t = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  /** Reset error when the user starts editing again (Stripe's onChange fires for any change). */
  useEffect(() => {
    if (!elements) return;
    const el = elements.getElement('payment');
    if (!el) return;
    const handler = () => setErrorMessage(null);
    el.on('change', handler);
    return () => {
      el.off('change', handler);
    };
  }, [elements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);

    const result =
      intentType === 'payment_intent'
        ? await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: returnUrl },
          })
        : await stripe.confirmSetup({
            elements,
            confirmParams: { return_url: returnUrl },
          });

    /** `confirm*` returns only on error or 3DS-not-needed local-redirect cases.
     *  On success, the browser is redirected by Stripe to `return_url`. */
    if (result.error) {
      const msg = result.error.message ?? 'Card authorization failed.';
      setErrorMessage(msg);
      toast.error(msg);
      setSubmitting(false);
      return;
    }

    /** Defensive — should not reach here on success because Stripe redirects. */
    setSubmitting(false);
  };

  /** i18n with English fallback — `useTranslations` returns the literal key when missing. */
  const tt = (key: string, fallback: string): string => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const ctaLabel =
    leadDays <= 7
      ? tt('checkout.holdNow', 'Place hold & confirm reservation')
      : tt('checkout.saveCardAndReserve', 'Save card & confirm reservation');

  const formattedAmount = formatHoldAmount(currency, amountMinor);
  const disclosureLine =
    leadDays <= 7
      ? tt(
          'checkout.holdDisclosureNow',
          `${formattedAmount} authorization placed today. It will be charged automatically at 10:00 AM Korea time on the tour date unless you cancel at least 24 hours before departure.`,
        ).replace('{amount}', formattedAmount)
      : tt(
          'checkout.holdDisclosureLater',
          `Card saved today. A ${formattedAmount} authorization is placed about 5 days before your tour and charged automatically at 10:00 AM Korea time on the tour date unless you cancel at least 24 hours before departure.`,
        ).replace('{amount}', formattedAmount);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      aria-busy={submitting}
      aria-live="polite"
    >
      {/* Reassurance row — color + weight only, no italic */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-emerald-50/60 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          {t('tour.freeCancellation')}
        </span>
        <span aria-hidden className="h-3 w-px bg-emerald-700/20" />
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
          <Wallet className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          {t('tour.payLater')}
        </span>
      </div>

      <PaymentElement
        options={{ layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never' } }}
        onReady={() => setReady(true)}
      />

      <p className="text-[12.5px] leading-relaxed text-slate-600">{disclosureLine}</p>

      {errorMessage && (
        <p
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || !ready || submitting}
        className={cn(
          'inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-md px-5 text-base font-semibold text-white shadow-lg outline-none transition-all',
          'bg-foreground hover:bg-foreground/90 hover:shadow-xl',
          'focus-visible:border focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {t('booking.processing')}
          </span>
        ) : (
          ctaLabel
        )}
      </button>
    </form>
  );
}
