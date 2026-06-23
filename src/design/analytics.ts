// Self-built product analytics SDK (Phase 1 Foundation + Phase 6 experiments).
// Master plan: docs/atockorea-analytics-master-plan-2026-05-17.md §5 Phase 1.2 + §5 Phase 6
//
// The public surface (`analytics.*` methods + `trackEvent`) is unchanged so
// all 25+ existing call sites flow into the new pipeline automatically.
// `trackEvent` now batches into an in-memory queue, flushes to
// /api/analytics/events every 5s (or once 5 events accumulate), and uses
// sendBeacon on beforeunload as a last-mile safety net.
//
// Phase 6 — every batched event also carries the user's current variant
// assignment for every running experiment. Variants are computed from the
// stable hash in lib/analytics/experiment-assignment.ts so SSR/CSR agree.

import { assignVariant, type ExperimentVariant } from "@/lib/analytics/experiment-assignment";

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

// ===========================================================================
// Cookie + identity helpers
// ===========================================================================

const ANON_COOKIE = "atoc_anon_id";
const SESSION_COOKIE = "atoc_session_id";
const SESSION_SEEN_COOKIE = "atoc_session_seen";
const ANON_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1년
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30분
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12; // 12시간 (idle 리셋 따로)

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax${secure}`;
}

function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes — RFC4122 v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getAnonymousId(): string {
  let id = readCookie(ANON_COOKIE);
  if (!id) {
    id = newUuid();
    writeCookie(ANON_COOKIE, id, ANON_MAX_AGE_SECONDS);
  }
  return id;
}

function getSessionId(): string {
  const now = Date.now();
  const lastSeenStr = readCookie(SESSION_SEEN_COOKIE);
  const lastSeen = lastSeenStr ? parseInt(lastSeenStr, 10) : 0;
  let id = readCookie(SESSION_COOKIE);

  if (!id || !lastSeen || now - lastSeen > SESSION_IDLE_MS) {
    id = newUuid();
    writeCookie(SESSION_COOKIE, id, SESSION_COOKIE_MAX_AGE_SECONDS);
  }
  // Refresh "last seen" on every event so idle timeout counts from last activity.
  writeCookie(SESSION_SEEN_COOKIE, String(now), SESSION_COOKIE_MAX_AGE_SECONDS);
  return id;
}

// ===========================================================================
// Context auto-collect
// ===========================================================================

type ClientContext = {
  page_path: string;
  page_query: Record<string, string> | null;
  referrer: string | null;
  locale: string | null;
  viewport_width: number | null;
  viewport_height: number | null;
  device_class: "mobile" | "tablet" | "desktop" | "unknown";
  user_agent_family: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
};

function detectDeviceClass(width: number): ClientContext["device_class"] {
  if (width <= 768) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}

function detectUserAgentFamily(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Other";
}

function captureContext(): ClientContext {
  if (typeof window === "undefined") {
    return {
      page_path: "",
      page_query: null,
      referrer: null,
      locale: null,
      viewport_width: null,
      viewport_height: null,
      device_class: "unknown",
      user_agent_family: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
    };
  }
  const url = new URL(window.location.href);
  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    queryParams[k] = v;
  });
  const width = window.innerWidth;
  return {
    page_path: url.pathname,
    page_query: Object.keys(queryParams).length ? queryParams : null,
    referrer: document.referrer || null,
    locale: navigator.language || null,
    viewport_width: width,
    viewport_height: window.innerHeight,
    device_class: detectDeviceClass(width),
    user_agent_family: detectUserAgentFamily(navigator.userAgent || ""),
    utm_source: url.searchParams.get("utm_source"),
    utm_medium: url.searchParams.get("utm_medium"),
    utm_campaign: url.searchParams.get("utm_campaign"),
    utm_term: url.searchParams.get("utm_term"),
    utm_content: url.searchParams.get("utm_content"),
  };
}

// ===========================================================================
// Batch queue + flush
// ===========================================================================

type QueuedEvent = {
  event_name: string;
  payload: AnalyticsPayload;
  client_ts: string;
  context: ClientContext;
  anonymous_id: string;
  session_id: string;
  experiment_assignments?: Record<string, string>;
};

// ===========================================================================
// Experiment registry (Phase 6)
// ===========================================================================

type ExperimentConfig = { key: string; variants: ExperimentVariant[] };
let experimentRegistry: ExperimentConfig[] | null = null;
let experimentLoadPromise: Promise<void> | null = null;

function ensureExperimentsLoaded(): Promise<void> {
  if (experimentRegistry !== null) return Promise.resolve();
  if (experimentLoadPromise) return experimentLoadPromise;
  experimentLoadPromise = fetch("/api/analytics/experiments/active", {
    headers: { Accept: "application/json" },
  })
    .then(async (res) => {
      if (!res.ok) {
        experimentRegistry = [];
        return;
      }
      const json = (await res.json()) as { experiments?: ExperimentConfig[] };
      experimentRegistry = Array.isArray(json.experiments) ? json.experiments : [];
    })
    .catch(() => {
      experimentRegistry = [];
    })
    .finally(() => {
      experimentLoadPromise = null;
    });
  return experimentLoadPromise!;
}

function computeAssignments(anonId: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!experimentRegistry || experimentRegistry.length === 0) return out;
  for (const exp of experimentRegistry) {
    const variant = assignVariant(anonId, exp.key, exp.variants);
    if (variant) out[exp.key] = variant;
  }
  return out;
}

/** Phase 6 — read the current variant for one experiment. Returns null until
 *  the registry has loaded or if the experiment isn't running. */
export function getExperimentVariant(experimentKey: string): string | null {
  if (typeof window === "undefined") return null;
  if (!experimentRegistry) {
    // Kick off load for future calls.
    void ensureExperimentsLoaded();
    return null;
  }
  const exp = experimentRegistry.find((e) => e.key === experimentKey);
  if (!exp) return null;
  return assignVariant(getAnonymousId(), experimentKey, exp.variants);
}

/** Phase 6 — async variant lookup that awaits the shared registry fetch.
 *  Callers (e.g. hero-section A/B copy) use this instead of polling: one
 *  promise per page load, dedupe'd via `ensureExperimentsLoaded`. */
export async function getExperimentVariantAsync(
  experimentKey: string,
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  await ensureExperimentsLoaded();
  return getExperimentVariant(experimentKey);
}

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_BATCH_SIZE = 5;
const MAX_QUEUE_SIZE = 50;
const ENDPOINT = "/api/analytics/events";

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let beforeunloadInstalled = false;

function installBeforeUnload() {
  if (beforeunloadInstalled || typeof window === "undefined") return;
  beforeunloadInstalled = true;
  // sendBeacon survives navigation away — last-mile safety so the final few
  // events in the queue don't vanish on tab close / link click.
  window.addEventListener("beforeunload", () => {
    if (queue.length === 0) return;
    const body = JSON.stringify({ events: queue });
    queue = [];
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      } catch {
        // ignore — best effort
      }
    }
  });
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, FLUSH_INTERVAL_MS);
}

async function flushQueue(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.slice();
  queue = [];
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    // Network error — re-queue at the front (so order is preserved), but
    // respect the max queue size to avoid unbounded memory.
    const reattach = batch.slice(0, Math.max(0, MAX_QUEUE_SIZE - queue.length));
    queue = [...reattach, ...queue];
  }
}

function enqueueEvent(eventName: string, payload: AnalyticsPayload) {
  if (typeof window === "undefined") return;
  installBeforeUnload();
  // Kick off registry load if not yet started — the very first event of a
  // session typically lands before the registry resolves, which is fine
  // (no variant attached). Subsequent events will have variants.
  void ensureExperimentsLoaded();
  const anonymousId = getAnonymousId();
  const assignments = computeAssignments(anonymousId);
  const event: QueuedEvent = {
    event_name: eventName,
    payload,
    client_ts: new Date().toISOString(),
    context: captureContext(),
    anonymous_id: anonymousId,
    session_id: getSessionId(),
    experiment_assignments:
      Object.keys(assignments).length > 0 ? assignments : undefined,
  };
  queue.push(event);
  // Drop oldest if queue overflowed — keeps memory bounded under offline
  // streaks. The dropped count is reported via the queue-overflow self-event
  // on next successful flush (Phase 7 wiring).
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }
  if (queue.length >= FLUSH_BATCH_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flushQueue();
  } else {
    scheduleFlush();
  }
}

// ===========================================================================
// Public trackEvent (no signature change — all 25+ call sites unaffected)
// ===========================================================================

export function trackEvent(event: string, payload: AnalyticsPayload = {}) {
  const data = sanitizePayload(payload);
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") {
    // Dev-only: keep the console log so existing manual verification flows
    // (Cloudflare tunnel + DevTools) still see the event.
    // eslint-disable-next-line no-console
    console.log("[analytics]", event, data);
  }
  enqueueEvent(event, data);
}

/** Phase 1 helper — explicit anonymous → user identity merge. Call after
 *  successful login so retroactive cohort analysis still works. */
export function identifyUser(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  void fetch("/api/analytics/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anonymous_id: getAnonymousId(), user_id: userId }),
    keepalive: true,
  }).catch(() => {
    // best-effort — analytics identity is non-critical
  });
}

/** Phase 1 helper — page_view convenience for SPA route changes that the
 *  static `usePathname` listener will surface in a later commit. Today,
 *  call manually if needed. */
export function trackPageView(extra: AnalyticsPayload = {}): void {
  trackEvent("page_view", extra);
}

// ===========================================================================
// Type definitions (unchanged from Phase 0a / Phase C.1)
// ===========================================================================

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
  | "final_cta_browse_styles"
  | "chatbot_open_choose_style";

/** Standalone `/match` page — funnel events distinct from the in-page home planner flow. */
export type MatchPageOutcome = "matched" | "no_match" | "error";

/** v3 Phase 0a — sticky CTA surface action. Separate event from `home_cta_click` so Phase D.3
 *  threshold A/B can isolate sticky surface behaviour. */
export type HomeStickyCtaAction = "focus_matcher" | "browse_tours";

/** v3 Phase 0a — featured product card click source. `idle_preview` = idle carousel (Phase B.2),
 *  `regular_section` = main FeaturedProductsShowcase rail.
 *  v3 §D #1 — `similar_recommendation` = "비슷한 투어" strip under matcher winner. */
export type HomeFeaturedCardSource =
  | "idle_preview"
  | "regular_section"
  | "similar_recommendation";

/** v3 Phase 0a — match preview region visibility states surfaced via IntersectionObserver.
 *  Mirrors `HomeV2MatchPhase` from the match provider so funnel queries can join cleanly. */
export type HomeMatchPreviewPhase = "idle" | "loading" | "result";

/** v3 Phase 0a — seasonal chip identifier. Aligned with `SeasonKey` in
 *  `lib/home/season.ts` so the analytics enum matches the code's source of
 *  truth (Phase C.1 sync). */
export type HomeHeroSeason =
  | "springBlossom"
  | "lateSpring"
  | "summer"
  | "autumn"
  | "winter";

/** Unified landing planner (matcher + builder modes) — net-new events for the
 *  "Match me / Build myself" surface (LandingPlannerCard).
 *  NOTE: match-submit is intentionally NOT a unified_planner event — it already
 *  fires `home_cta_click { source: "hero_planner_match" }` in HomeV2MatchProvider,
 *  and the home_cta_copy A/B attributes off that. Adding a second event for the
 *  same click would double-count (사실 수정 vs plan's 5-event list, 2026-05-21). */
export type UnifiedPlannerMode = "match" | "build";
export type UnifiedPlannerDestination = "jeju" | "seoul" | "busan";

/** Reform (tour-type-first home) — the tour-type card funnel. `type` is the
 *  card chosen; forward-compatible with the 3-card structure (private / group /
 *  recommend) while the current cards are private / small_group / bus.
 *  `party` rides along so the funnel can segment by group size (U13). */
export type HomeTourTypeCard =
  | "private"
  | "small_group"
  | "bus"
  | "group"
  | "builder"
  | "recommend";

// ===========================================================================
// Public API — unchanged signatures
// ===========================================================================

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

  /** Reform U13 — tour-type card click (the reform funnel entry point). Carries
   *  the current party size so the funnel can segment private vs group by group
   *  size. Distinct from `home_cta_click` so the reform surface is isolatable. */
  homeTourTypeCardClick: (payload: { type: HomeTourTypeCard; party: number }) =>
    trackEvent("home_tour_type_card_click", payload),

  /** Reform U13 — party stepper changed above the tour-type cards. Fires on a
   *  settled value change (not per keystroke); `party` is the new count. */
  homePartyStepperChange: (payload: { party: number }) =>
    trackEvent("home_party_stepper_change", payload),

  /** Unified planner — user toggled the Match me / Build myself segmented
   *  control. `mode` is the mode being switched TO. Fires only on an actual
   *  change, not on re-clicking the active segment. */
  unifiedPlannerModeSwitch: (payload: {
    mode: UnifiedPlannerMode;
    destination: UnifiedPlannerDestination;
  }) => trackEvent("unified_planner_mode_switch", payload),

  /** Unified planner — "Start Building" click in build mode (jeju/busan), the
   *  moment before routing into the itinerary builder. */
  unifiedPlannerBuildStart: (payload: {
    destination: UnifiedPlannerDestination;
    hasIntent: boolean;
    selectedChipCount: number;
  }) => trackEvent("unified_planner_build_start", payload),

  /** Unified planner — "Request a Seoul day" click in the Seoul build
   *  fallback (no builder map exists for Seoul yet). */
  unifiedPlannerSeoulRequest: (payload: { hasIntent: boolean }) =>
    trackEvent("unified_planner_seoul_request", payload),

  /** Unified planner (Phase 5 bridge) — "Build your own day in {destination}"
   *  click on a match result. Flips the planner into build mode for the same
   *  destination (no product→POI carry-over claimed). */
  unifiedPlannerCustomizeFromMatch: (payload: {
    destination: UnifiedPlannerDestination;
  }) => trackEvent("unified_planner_customize_from_match", payload),

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

  /** Strongest conversion signal — fires once per booking after the user lands
   *  on the confirmation page (post-Stripe redirect). Drops the booking_id into
   *  the payload so sessions can be joined to the bookings table later. */
  bookingConfirmed: (
    bookingId: string,
    extra: { tourId?: number; totalUsd?: number; guests?: number } = {},
  ) =>
    trackEvent("booking_confirmed", {
      bookingId,
      ...extra,
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

  /** Page view convenience. Auto page-view tracking is wired in a follow-up
   *  Phase 1 commit via a top-level useEffect+usePathname listener. */
  pageView: (extra: AnalyticsPayload = {}) => trackPageView(extra),

  /** Identity merge after login. Should be called once per auth transition. */
  identify: (userId: string) => identifyUser(userId),
};
