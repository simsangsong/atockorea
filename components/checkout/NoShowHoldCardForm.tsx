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

export type NoShowHoldCardFormProps = {
  /** Stripe publishable key returned from `/api/stripe/checkout`. */
  publishableKey: string;
  /** Server-issued client secret for either a PaymentIntent (≤7d) or SetupIntent (>7d). */
  clientSecret: string;
  /** Drives whether we call `confirmPayment` (PI) or `confirmSetup` (SI). */
  intentType: 'payment_intent' | 'setup_intent';
  /** Where to land after a successful confirmation. Stripe appends its own params. */
  returnUrl: string;
  /** USD-cent amount of the no-show fee — displayed inside the card panel. */
  amountUsdCents: number;
  /** Days from today to tour date — controls the disclosure copy ("hold today" vs "hold ~5 days before"). */
  leadDays: number;
};

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

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function CardFormInner({
  intentType,
  returnUrl,
  amountUsdCents,
  leadDays,
}: NoShowHoldCardFormProps) {
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

  const disclosureLine =
    leadDays <= 7
      ? tt(
          'checkout.holdDisclosureNow',
          `${formatUsd(amountUsdCents)} hold placed today, charged only on no-show.`,
        ).replace('{amount}', formatUsd(amountUsdCents))
      : tt(
          'checkout.holdDisclosureLater',
          `${formatUsd(amountUsdCents)} hold placed ~5 days before your tour, charged only on no-show.`,
        ).replace('{amount}', formatUsd(amountUsdCents));

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
