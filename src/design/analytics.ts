type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

function sanitizePayload(payload: AnalyticsPayload): AnalyticsPayload {
  const sanitized = { ...payload };

  delete sanitized["hotelName"];
  delete sanitized["hotelRaw"];
  delete sanitized["lat"];
  delete sanitized["lng"];
  delete sanitized["coordinates"];

  return sanitized;
}

export function trackEvent(event: string, payload: AnalyticsPayload = {}) {
  const data = sanitizePayload(payload);

  if (typeof window !== "undefined") {
    console.log("[analytics]", event, data);
    // replace later with actual analytics provider
  }
}

export const analytics = {
  heroFormStart: (pickupAreaLabel?: string) =>
    trackEvent("hero_form_start", { pickupAreaLabel }),

  hotelSelected: (pickupAreaLabel: string, surchargeTier: string, joinAvailable: boolean) =>
    trackEvent("hotel_selected", {
      pickupAreaLabel,
      surchargeTier,
      joinAvailable,
    }),

  surchargeShown: (pickupAreaLabel: string, surchargeTier: string) =>
    trackEvent("surcharge_shown", {
      pickupAreaLabel,
      surchargeTier,
    }),

  buildTourStarted: (pickupAreaLabel: string, preferredType: string) =>
    trackEvent("build_tour_started", {
      pickupAreaLabel,
      preferredType,
    }),

  buildTourCompleted: (pickupAreaLabel: string, resultCount: number) =>
    trackEvent("build_tour_completed", {
      pickupAreaLabel,
      resultCount,
    }),

  tourCardViewed: (tourType: string, pickupAreaLabel: string) =>
    trackEvent("tour_card_viewed", {
      tourType,
      pickupAreaLabel,
    }),

  detailViewed: (tourType: string, pickupAreaLabel: string) =>
    trackEvent("detail_viewed", {
      tourType,
      pickupAreaLabel,
    }),

  checkoutStarted: (tourType: string, pickupAreaLabel: string) =>
    trackEvent("checkout_started", {
      tourType,
      pickupAreaLabel,
    }),

  depositPaid: (tourType: string, pickupAreaLabel: string) =>
    trackEvent("deposit_paid", {
      tourType,
      pickupAreaLabel,
    }),

  balancePaid: (tourType: string, pickupAreaLabel: string) =>
    trackEvent("balance_paid", {
      tourType,
      pickupAreaLabel,
    }),

  balanceOpenSeen: (tourType: string, pickupAreaLabel: string) =>
    trackEvent("balance_open_seen", {
      tourType,
      pickupAreaLabel,
    }),

  paymentMissed: (tourType: string, pickupAreaLabel: string) =>
    trackEvent("payment_missed", {
      tourType,
      pickupAreaLabel,
    }),
};
