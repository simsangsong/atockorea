"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Loader2, ShieldCheck, Wallet } from "lucide-react";

// Stripe card form mounts only once the authorization session (client secret)
// is fetched, so load its Stripe React SDK lazily rather than up-front.
const NoShowHoldCardForm = dynamic(
  () => import("@/components/checkout/NoShowHoldCardForm").then((m) => m.NoShowHoldCardForm),
  { ssr: false },
);

interface Props {
  bookingId: string;
  currency: "krw" | "usd";
  /** Authorized amount in minor units (whole KRW or USD cents). */
  amountMinor: number;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

interface PaymentSession {
  intentType: "payment_intent" | "setup_intent";
  clientSecret: string;
  publishableKey: string;
  leadDays: number;
  currency: "krw" | "usd";
  amountMinor: number;
}

/**
 * Phase 10.5b — checkout card form client wrapper for the itinerary builder.
 *
 * On mount, POSTs `/api/stripe/checkout` with the bookingId to mint a
 * PaymentIntent (≤7d) or SetupIntent (>7d) clientSecret + publishableKey.
 * Then renders the same `<NoShowHoldCardForm>` the tour-product flow uses,
 * with `currency='krw'` so the form formats as ₩.
 *
 * Stripe success redirects back to `/itinerary-builder/confirmation/[id]`.
 */
export default function CheckoutCardClient({
  bookingId,
  currency,
  amountMinor,
  contactName,
  contactEmail,
  contactPhone,
}: Props) {
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId,
            bookingData: {
              customerInfo: {
                name: contactName ?? undefined,
                email: contactEmail ?? undefined,
                phone: contactPhone ?? undefined,
              },
            },
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data?.clientSecret) {
          setError(data?.error || `HTTP ${res.status}`);
          setLoading(false);
          return;
        }
        setSession({
          intentType: data.intentType,
          clientSecret: data.clientSecret,
          publishableKey: data.publishableKey,
          leadDays: typeof data.leadDays === "number" ? data.leadDays : 0,
          currency: (data.currency as "krw" | "usd") ?? currency,
          amountMinor:
            typeof data.amountMinor === "number" ? data.amountMinor : amountMinor,
        });
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "request_failed");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, contactName, contactEmail, contactPhone, currency, amountMinor]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-caption text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Preparing your secure card form…
        </div>
        <div className="h-32 animate-pulse rounded-button bg-white/60" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-start gap-2 rounded-button border border-rose-200 bg-rose-50 px-3 py-2.5 text-caption text-rose-700">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">Couldn&rsquo;t prepare card form</p>
          <p className="mt-0.5 text-micro">{error ?? "Unknown error"}</p>
        </div>
      </div>
    );
  }

  const returnUrl = typeof window !== "undefined"
    ? `${window.location.origin}/itinerary-builder/confirmation/${encodeURIComponent(bookingId)}`
    : `/itinerary-builder/confirmation/${encodeURIComponent(bookingId)}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          Card saved securely
        </span>
        <span aria-hidden className="h-3 w-px bg-emerald-700/20" />
        <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-emerald-700">
          <Wallet className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          No charge today
        </span>
      </header>
      <NoShowHoldCardForm
        publishableKey={session.publishableKey}
        clientSecret={session.clientSecret}
        intentType={session.intentType}
        currency={session.currency}
        amountMinor={session.amountMinor}
        leadDays={session.leadDays}
        returnUrl={returnUrl}
      />
    </div>
  );
}
