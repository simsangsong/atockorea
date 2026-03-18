/**
 * Centralized copy: one primary message per section, supporting text max 2 lines,
 * product cards one-line descriptions. Trust and payment rules remain visible.
 */
export const COPY = {
  brand: {
    support: "Starting with Jeju, expanding across Korea.",
  },

  nav: {
    aiTours: "AI Tours",
    privateTours: "Private Tours",
    joinTours: "Small-Group Join",
    busTours: "Classic Bus Tours",
    myTour: "My Tour",
    help: "Help",
  },

  /** Hero: one primary (headline), sub max 2 lines, trust strip visible. */
  hero: {
    headline: "Plan less. Enjoy more of Jeju.",
    sub: "Hotel, date, and style — we find your right tour. Private, small-group, or classic bus.",
    /** Extended subtitle for floating card (image_22 style). */
    subCard: "Tell us your hotel, date, and travel style — we find your right tour. Private, small-group, or traditional bus.",
    cta: "Plan My Trip",
    badge: "EXPERTISE CRAFTED BY PROFESSIONAL GUIDES",
    trust: [
      "AI-built itinerary in minutes",
      "Smarter pickup flow",
      "3–13 travelers only",
      "Transparent deposit and balance rules",
    ],
    /** Subtitles for hero floating card value props (title + subtitle per row). */
    valuePropSubtitles: [
      "Personalized in minutes",
      "Area-aware hotel matching",
      "Secure deposit & balance",
    ],
    /** Short trust line under CTA (deposit/balance). */
    trustCta: "No automatic balance charge. Free cancellation until 24h before.",
  },

  howItWorks: {
    title: "How it works",
    step1: "Enter your hotel",
    step2: "We plan the best route",
    step3: "Choose your comfort level",
    step4: "Travel with less hassle",
  },

  /** Comparison: concise, customer-facing; primary = title, bullets short. */
  comparison: {
    title: "Why choose this over bus tours or private charters",
    bullets: [
      "Less planning — we suggest the route",
      "Small groups (3–13) — not crowded buses",
      "Hotel-area pickup — smoother flow",
      "Clear deposit and balance — no hidden fees",
      "Better value than full private",
    ],
  },

  /** Preview itinerary: one primary (title), supporting max 2 lines. */
  previewItinerary: {
    title: "Example Jeju day tour",
    pickupArea: "City core",
    hotelFitHint: "Good match for your hotel",
    travelerCount: "4 travelers",
    vehicleType: "Premium van",
    depositNote: "20% deposit to reserve",
    balanceNote: "Balance opens 24h before departure",
    /** Single line for card: travelers · vehicle · deposit rule. */
    oneLine: "4 travelers · Premium van · 20% deposit, balance 24h before.",
  },

  reviews: {
    title: "What travelers say",
    quotes: [
      "Much easier than planning it myself.",
      "More comfortable than a regular bus tour.",
      "The pickup route made much more sense.",
      "Felt smoother than I expected for a join tour.",
    ],
  },

  /** Tour type cards: one-line description per product; points optional for expand. */
  tourTypes: {
    privateTitle: "AI Private Tour",
    privateBody: "Your group only. AI plans the route; you confirm instantly.",
    privatePoints: [
      "Your group only",
      "Instant confirmation",
      "Best for families & friends",
    ],
    privateCta: "Start Private Tour",

    joinTitle: "AI Small-Group Join Tour",
    joinBody: "Small-group comfort, hotel-area pickup, transparent deposit.",
    joinPoints: [
      "Small-group comfort",
      "Better pickup flow",
      "Transparent deposit timeline",
    ],
    joinCta: "Join Small Group",

    busTitle: "Classic Bus Tour",
    busBody: "Fixed itineraries, traditional group format.",
    busCta: "View Classic Bus Tours",
  },

  surcharge: {
    short: "Pickup surcharge may apply",
    title: "Smoother Route for Everyone",
    body: "Because your hotel is outside the main pickup area, an additional pickup fee applies. This helps keep the route smoother for all travelers.",
    final: "Final for your selected hotel",
    included: "Pickup included",
  },

  pickupMatch: {
    great: "Great pickup match",
    good: "Good pickup match",
    slight: "Slight extra travel time may apply",
  },

  joinStatus: {
    waiting: "Waiting for more travelers",
    balanceOpen: "Balance payment open",
    confirmed: "Confirmed",
    missedDeadline: "Missed deadline",
    privateOnly: "Private tour recommended",
    joinUnavailable: "Join not available for this route yet",
  },

  joinStatusHelp: {
    waiting: "This tour needs more travelers before balance payment opens.",
    balanceOpen: "You can now pay the remaining balance in My Tours.",
    confirmed: "This tour is confirmed and ready to go.",
    missedDeadline: "The balance payment deadline has passed.",
    privateOnly: "This hotel area is better suited for a private tour.",
    joinUnavailable: "This route is currently not open for join bookings.",
  },

  /** Checkout/detail: trust and payment rules remain visible; body max 2 lines. */
  checkout: {
    title: "Checkout",
    whyDepositTitle: "Secure Your Seat with a 20% Deposit",
    whyDepositBody:
      "Pay a small deposit today. Free cancellation until 24h before. We never auto-charge the balance — you pay the rest in My Tours.",
    autoChargeWarning:
      "We will never charge your card automatically for the remaining balance. You need to complete it manually in My Tours.",
    cta: "Reserve My Spot",
    payDeposit: "Pay Deposit",
    completeBooking: "Complete Booking",
    /** Shown when server does not provide timeline (no client-computed dates). */
    timelineStaticCopy:
      "Deposit refundable until 24h before; balance due 18h before.",
    orderSummary: "Order summary",
    basePrice: "Base tour price",
    pickupSurcharge: "Pickup surcharge",
    subtotal: "Subtotal",
    depositDueToday: "Deposit due today",
    remainingBalanceLater: "Remaining balance later",
    total: "Total",
  },

  /** List/detail: search summary and filters */
  listDetail: {
    summaryToursFound: "{{count}} tour(s) found",
    destination: "Destination",
    destinationAll: "All",
    hotelArea: "Hotel area",
    date: "Date",
    guests: "Guests",
    styleTags: "Travel style",
    editSearch: "Edit search",
    refine: "Refine",
    tourTypeAll: "All",
    noToursFound: "No tours found",
    loadingTours: "Loading tours…",
    viewTour: "View tour",
    viewDetails: "View details",
    joinThisTour: "Join this tour",
    depositBalanceNote: "20% deposit · Balance in My Tours",
  },

  /** Detail page: one primary per section; cancellation + payment rules visible. */
  detail: {
    whyThisFitsYou: "Why this fits you",
    whoThisIsBestFor: "Who this is best for",
    cancellationPolicy: "Cancellation policy",
    cancellationPolicyBody: "Free cancellation until 24h before departure. After that, deposit may be non-refundable.",
    /** Single line for pickup tips block (detail page). */
    pickupTipsIntro: "Exact times in confirmation. Arrive early; no-shows are non-refundable.",
    badgeAiPlanned: "AI Planned",
    badgeSmallGroup: "Small Group",
    badgePrivate: "Private",
    badgeVerifiedGuide: "Verified Local Guide",
    badgeTransparentBooking: "Transparent Booking Rules",
    badgeClassicBus: "Classic Bus",
    selectDateToSeeTimeline: "Select a date above to see your booking timeline",
    whoBus: "Travelers who prefer a classic group format",
  },

  timeline: {
    title: "Booking timeline",
    depositTitle: "Pay 20% deposit",
    depositSub: "Reserve your spot today",
    refundTitle: "Free cancellation until",
    refundSub: "Balance opens at the same time",
    balanceTitle: "Balance payment deadline",
    balanceSub: "Complete manually in My Tours",
    startTitle: "Tour begins",
    startSub: "Booking is closed",
  },

  myTour: {
    title: "My Tours",
    payBalance: "Pay Balance Now",
    viewDetails: "View Booking Details",
    viewPickup: "View Pickup Information",
    rebook: "Rebook Another Tour",
    confirmed: "Confirmed",
    awaitingBalance: "Awaiting Balance Payment",
    nextStep: "Next step",
    status: {
      pending: "Pending",
      depositPaid: "Deposit Paid",
      awaitingBalance: "Awaiting Balance Payment",
      balanceDue: "Balance Payment Required",
      confirmed: "Confirmed",
      completed: "Completed",
      cancelled: "Cancelled",
      refunded: "Refunded",
      deadlineMissed: "Deadline Missed",
    },
  },

  /** Destinations: one primary (title); each destination one line. */
  destinations: {
    title: "Jeju is live. More Korea destinations coming.",
    jeju: "Available now",
    busan: "Coming soon",
    seoul: "Coming soon",
    notify: "Notify Me",
  },

  fallback: {
    title: "Prefer a classic group tour instead?",
  },

  finalCta: {
    title: "Ready to build your Jeju trip the smarter way?",
    cta: "Plan My Trip",
  },

  /** Builder loading overlay: allowed copy only. No real-time matching claims. */
  builderLoading: {
    /** Stage 1 when area is known — use with [Area] replaced by human label */
    stage1WithArea: "Checking pickup flow near [Area]…",
    /** Stage 1 when area is unknown — generic only */
    stage1Generic: "Finding the best route for your hotel area…",
    stage2: "Looking for the best tour fit…",
    stage3: "Almost there…",
    end: "Your trip is ready",
  },

  /** Human-only pickup area labels for builder/loading (do not expose internal zone names). */
  builderPickupArea: {
    jeju_city: "City Core",
    jeju_outside: "Near-city",
    seogwipo_city: "Seogwipo area",
    seogwipo_outside: "Outer",
  } as const,

  /** Live summary panel (builder dashboard). */
  builderSummary: {
    depositNote: "20% deposit to reserve · Balance due 24h before departure",
  },
} as const;
