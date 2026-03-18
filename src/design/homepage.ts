/**
 * Homepage-specific copy and config: comparison panel, AI card prices,
 * and short scan-friendly blocks for trust and conversion.
 * Keep: what the product is, who it's for, pickup, deposit/balance, AI vs bus/private, booking rules.
 */

export const HOMEPAGE_COMPARISON = {
  title: "Which tour style fits you best?",
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

/** Visible prices on AI cards (server remains source of truth at checkout). */
export const HOMEPAGE_AI_PRICES = {
  /** Private: team pricing. e.g. "From ₩398,000 / group" */
  privatePriceLabel: "From ₩398,000 / group",
  privatePriceSub: "1–6 travelers · 7–13 pax higher",
  /** Join: per person. e.g. "From ₩50,000 / person" — update from API if needed. */
  joinPriceLabel: "From ₩50,000 / person",
  joinPriceSub: "20% deposit · balance in My Tours",
  /** Bus: indicative from-price for card; list has full prices. */
  busPriceLabel: "From ₩59,000 / person",
} as const;

/** One block: what pickup is and how it works. */
export const HOMEPAGE_PICKUP = {
  title: "How pickup works",
  body: "We match your hotel area to a route. Fewer stops, less waiting. Surcharge may apply outside core zones.",
} as const;

/** One block: deposit and remaining balance (trust + conversion). */
export const HOMEPAGE_DEPOSIT_BALANCE = {
  title: "Deposit & balance",
  body: "Pay 20% deposit to reserve. Free cancellation until 24h before. We never auto-charge the rest — you pay the balance in My Tours.",
} as const;

/** One block: key booking rules. */
export const HOMEPAGE_BOOKING_RULES = {
  title: "Booking rules",
  items: [
    "Free cancellation until 24 hours before departure.",
    "Balance opens 24h before; pay manually in My Tours.",
    "No automatic charge for the remaining balance.",
  ],
} as const;

/** Why AI Join differs from private and bus (one line per product). */
export const HOMEPAGE_WHY_JOIN = {
  title: "Why choose AI Join?",
  vsPrivate: "More affordable than private; same hotel-aware route and small-group comfort.",
  vsBus: "Smaller groups and smarter pickup than classic bus tours.",
} as const;
