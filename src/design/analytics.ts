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

/** Homepage funnel: hero planner, style cards, best-match, final CTA (distinct from generic hero_form_start). */
export type HomeCtaSource =
  | "hero_planner_match"
  | "choose_style_featured_join"
  | "choose_style_private_custom"
  | "choose_style_browse_bus"
  | "best_match_idle_card_hero"
  | "best_match_idle_primary"
  | "best_match_empty_start"
  | "best_match_result_card_hero"
  | "best_match_result_primary"
  | "final_cta_custom_join"
  | "final_cta_browse_styles";

/** Standalone `/match` page — funnel events distinct from the in-page home planner flow. */
export type MatchPageOutcome = "matched" | "no_match" | "error";

/** v3 Phase 0a — sticky CTA surface action. Separate event from `home_cta_click` so Phase D.3
 *  threshold A/B can isolate sticky surface behaviour. */
export type HomeStickyCtaAction = "focus_matcher" | "browse_tours";

/** v3 Phase 0a — featured product card click source. `idle_preview` = idle carousel (Phase B.2),
 *  `regular_section` = main FeaturedProductsShowcase rail. */
export type HomeFeaturedCardSource = "idle_preview" | "regular_section";

/** v3 Phase 0a — match preview region visibility states surfaced via IntersectionObserver.
 *  Mirrors `HomeV2MatchPhase` from the match provider so funnel queries can join cleanly. */
export type HomeMatchPreviewPhase = "idle" | "loading" | "result";

/** v3 Phase 0a — seasonal chip identifier. Wired in Phase C.1; event method defined now so
 *  taxonomy is stable. */
export type HomeHeroSeason = "spring" | "summer" | "autumn" | "winter";

export const analytics = {
  homeCtaClick: (payload: { source: HomeCtaSource }) => trackEvent("home_cta_click", payload),

  /** v3 Phase 0a — fires once when the hero intent textarea receives focus.
   *  PII guard: textarea content is never sent. */
  homeHeroIntentFocus: () => trackEvent("home_hero_intent_focus", {}),

  /** v3 Phase 0a — fires on style chip click inside the hero matcher card.
   *  `chipId` is the chip's i18n key or label slug, not free-text. */
  homeHeroStyleChipClick: (payload: { chipId: string }) =>
    trackEvent("home_hero_style_chip_click", payload),

  /** v3 Phase 0a — defined now, wired in Phase C.1 when the season chip becomes interactive. */
  homeHeroSeasonChipClick: (payload: { season: HomeHeroSeason }) =>
    trackEvent("home_hero_season_chip_click", payload),

  /** v3 Phase 0a — sticky CTA surface clicks (kept distinct from `home_cta_click` for D.3 A/B). */
  homeStickyCtaClick: (payload: { action: HomeStickyCtaAction }) =>
    trackEvent("home_sticky_cta_click", payload),

  /** v3 Phase 0a — match preview region visibility. Emitted once per phase transition while
   *  the region is in viewport (IntersectionObserver in DeferredBestMatchPreview). */
  homeMatchPreviewVisible: (payload: { phase: HomeMatchPreviewPhase }) =>
    trackEvent("home_match_preview_visible", payload),

  /** v3 Phase 0a — featured product card click. `source` differentiates idle carousel (B.2)
   *  from the main featured rail. */
  homeFeaturedCardClick: (payload: { source: HomeFeaturedCardSource; slug: string }) =>
    trackEvent("home_featured_card_click", payload),

  /** v3 Phase 0a — destination card click (Seoul/Busan/Jeju 3-up rail). */
  homeDestinationCardClick: (payload: { destination: string }) =>
    trackEvent("home_destination_card_click", payload),

  matchPageSubmit: (payload: { textLength: number; locale: string }) =>
    trackEvent("match_page_submit", payload),

  matchPageResultView: (payload: {
    outcome: MatchPageOutcome;
    winnerId: string | null;
    matchedCount: number;
    noMatchReason: string | null;
  }) => trackEvent("match_page_result_view", payload),

  matchPageWinnerClick: (payload: { winnerId: string; destinationHref: string }) =>
    trackEvent("match_page_winner_click", payload),

  matchPageRefine: () => trackEvent("match_page_refine", {}),

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

  checkoutPaymentCompleted: (tourType: string, pickupAreaLabel: string) =>
    trackEvent("checkout_payment_completed", {
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
