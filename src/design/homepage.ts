/**
 * Homepage-specific copy and config: comparison panel, AI card prices,
 * and short scan-friendly blocks for trust and conversion.
 * Keep: what the product is, who it's for, pickup, payment rules, AI vs bus/private, booking rules.
 */

export const HOMEPAGE_COMPARISON = {
  title: "Find the Korea travel style that fits you",
  subtitle: "Compare comfort, flexibility, and price at a glance.",
  rows: [
    {
      label: "Planning",
      ai: "We suggest the route",
      private: "You decide more",
      bus: "Fixed schedule",
    },
    {
      label: "Group size",
      ai: "Small group",
      private: "Your group only",
      bus: "Largest group",
    },
    {
      label: "Pickup",
      ai: "Hotel-aware",
      private: "Most flexible",
      bus: "Limited stops",
    },
    {
      label: "Comfort",
      ai: "Better than bus",
      private: "Best",
      bus: "Basic",
    },
    {
      label: "Price",
      ai: "Mid",
      private: "Highest",
      bus: "Lowest",
    },
    {
      label: "Best for",
      ai: "Comfort + value",
      private: "Families / groups",
      bus: "Budget-first travelers",
    },
  ],
} as const;

/** Three comparison cards (ComparisonPanelPremium — horizontal swipe on mobile). */
export const HOMEPAGE_COMPARISON_CARDS = {
  eyebrow: "COMPARE TRAVEL STYLES",
  title: "Find the Korea travel style that fits you",
  subtitle:
    "Bus routes, AI-planned small-group, or fully private custom travel.",
  swipeHint: "Swipe to compare",
  cards: [
    {
      variant: "featured" as const,
      badge: "BEST BALANCE",
      categoryLabel: "AI-POWERED",
      title: "Small Group",
      description: "Comfort + value with AI routes",
      rows: [
        { label: "Price", value: "Mid-range" },
        { label: "Group", value: "Small group" },
        { label: "Route", value: "AI-planned" },
        { label: "Pickup", value: "Hotel" },
        { label: "Best for", value: "Smart value" },
      ],
      cta: "Plan Now",
      href: "/custom-join-tour",
    },
    {
      variant: "default" as const,
      categoryLabel: "CLASSIC",
      title: "Bus Tour",
      description: "Fixed-route sightseeing at lowest cost",
      rows: [
        { label: "Price", value: "Lowest" },
        { label: "Group", value: "Large shared" },
        { label: "Route", value: "Fixed" },
        { label: "Pickup", value: "Meeting point" },
        { label: "Best for", value: "Budget" },
      ],
      cta: "Explore",
      href: "/tours/list",
    },
    {
      variant: "premium" as const,
      badge: "TOP COMFORT",
      categoryLabel: "PRIVATE",
      title: "Private Tour",
      description: "Your vehicle, your schedule — fully custom",
      rows: [
        { label: "Price", value: "Premium" },
        { label: "Group", value: "Your group only" },
        { label: "Route", value: "Custom" },
        { label: "Pickup", value: "Most flexible" },
        { label: "Best for", value: "Families & VIP" },
      ],
      cta: "Start Private",
      href: "/custom-join-tour",
    },
  ],
} as const;

/** Visible prices on AI cards (server remains source of truth at checkout). */
export const HOMEPAGE_AI_PRICES = {
  /** Private: team pricing. e.g. "From ₩398,000 / group" */
  privatePriceLabel: "From ₩398,000 / group",
  privatePriceSub: "1–6 travelers · 7–13 pax higher",
  /** Join: per person. e.g. "From ₩50,000 / person" — update from API if needed. */
  joinPriceLabel: "From ₩50,000 / person",
  joinPriceSub: "Pay in full online at checkout",
  /** Bus: indicative from-price for card; list has full prices. */
  busPriceLabel: "From ₩59,000 / person",
} as const;

/** One block: what pickup is and how it works. */
export const HOMEPAGE_PICKUP = {
  title: "How pickup works",
  body: "We match your hotel area to a route. Fewer stops, less waiting. Surcharge may apply outside core zones.",
} as const;

/** One block: how payment works (trust + conversion). */
export const HOMEPAGE_PAYMENT_INFO = {
  title: "Payment",
  body: "Pay the full tour price securely online when you book. Free cancellation until 24h before departure.",
} as const;

/** One block: key booking rules. */
export const HOMEPAGE_BOOKING_RULES = {
  title: "Booking rules",
  items: [
    "Free cancellation until 24 hours before departure.",
    "You will receive a confirmation email after payment.",
  ],
} as const;

/** Why AI Join differs from private and bus (one line per product). */
export const HOMEPAGE_WHY_JOIN = {
  title: "Why choose AI Join?",
  vsPrivate: "More affordable than private; same hotel-aware route and small-group comfort.",
  vsBus: "Smaller groups and smarter pickup than classic bus tours.",
} as const;
