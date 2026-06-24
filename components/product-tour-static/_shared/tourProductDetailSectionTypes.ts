/**
 * Section-data shapes consumed by the shared tour-product detail components
 * (`TourAtAGlance`, `TourTimelineSection`, `TourFitSection`, …).
 *
 * Migrated from the deleted `east-signature-nature-core/staticProductData.ts`
 * during the v17 batch — the section components now read these from authoring
 * JSON (`<slug>.en.json`) via `buildTourProductViewModelFromFullPageJson`.
 *
 * All fields are optional/loose so authoring drift between slugs (e.g. bus
 * tours skipping `visitBasics`, private tours adding `_poi_meta`) doesn't
 * crash the renderer.
 */

export type GlanceItemIcon =
  | "camera"
  | "mountain"
  | "footprints"
  | "cloud-rain"
  | "users"
  | "scale"
  | "gauge"
  | "clock"
  | "calendar"
  | "map-pin"
  | "ticket";

export type GlanceItem = {
  label: string;
  value: string;
  icon: GlanceItemIcon | (string & {});
  /** 1–5 dot indicator. Filled = level, hollow = remainder. */
  level?: number;
};

export type GalleryMediaItem = {
  id: number | string;
  type: "photo" | "video";
  src: string;
  location?: string;
  atmosphere?: string;
  alt?: string;
  caption?: string;
};

export type ItineraryStopVisitBasics = {
  hours?: string;
  closed?: string;
  admission?: string;
  walking?: string;
};

export type ItineraryStopConvenience = {
  restroom?: string;
  parking?: string;
};

export type ItineraryStopSmartNotes = {
  photo?: string;
  facilities?: string;
  tip?: string;
};

export type ItineraryStopPoiMeta = {
  poi_key?: string;
  verified?: boolean;
  match?: string;
  kb_version?: string;
  verified_date?: string;
  sources?: readonly string[];
};

export type ItineraryStop = {
  number: number;
  time?: string;
  duration?: string;
  name: string;
  category?: string;
  description?: string;
  image?: string;
  /** Optional secondary photos for the v0-style horizontal photo strip on the stop card. */
  images?: readonly string[];
  highlights?: readonly string[];
  whyOnRoute?: string;
  /** Some authoring batches emit a single string instead of an array. */
  timeUsed?: readonly string[] | string;
  visitBasics?: ItineraryStopVisitBasics;
  convenience?: ItineraryStopConvenience;
  smartNotes?: ItineraryStopSmartNotes;
  /** v17 batch: per-stop POI verification metadata. Renderer ignores. */
  _poi_meta?: ItineraryStopPoiMeta;
  /**
   * Marks a stop as a pickup / return pseudo-stop that is already shown by the
   * dedicated PickupOnlyCards / DropoffOnlyCard. The timeline strips these so they
   * don't render twice. Locale-independent (set by array position), unlike name/category text.
   */
  _role?: "pickup" | "dropoff";
};

export type RouteFlowStop = {
  id: string;
  name: string;
  theme?: string;
};

export type RoutePhase = {
  label: string;
  range: string;
  theme: string;
  bgClass?: string;
  textClass?: string;
  dotClass?: string;
};

export type RouteShapeIntro = {
  title?: string;
  subtitle?: string;
};

export type WhyTourWorksItem = {
  label?: string;
  detail?: string;
};

export type WhyTourWorksSection = {
  title?: string;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  items?: readonly WhyTourWorksItem[];
};

export type WhyTourWorks = {
  bestFor?: readonly string[];
  lessIdeal?: readonly string[];
  routeLogicSections?: readonly WhyTourWorksSection[];
};

export type PracticalAccordionItem = {
  id: string;
  title: string;
  preview?: string;
  content?: readonly string[];
  variant?: "included" | "default";
  /**
   * For `variant: "included"` items, the first `includedCount` entries of `content`
   * render with a ✓; the rest render with an ✗ (excluded). Defaults to 5 to preserve
   * the historic positional contract used by all existing JSON bundles.
   */
  includedCount?: number;
};

export type PracticalWeatherStatic = {
  today: { temp: string; label: string };
  tomorrow: { temp: string; label: string };
};

export type SeasonalVariation = {
  name: string;
  icon?: string;
  description?: string;
  tag?: string;
  bgClass?: string;
  iconColor?: string;
};

export type BookingTrustItem = {
  icon?: string;
  title: string;
  description?: string;
  iconBg?: string;
  iconColor?: string;
};

export type BookingSupportStep = {
  timing: string;
  title: string;
  detail?: string;
};

export type StaticQuestion = {
  id: string;
  question: string;
  answer: string;
};

export type GuestReview = {
  id: number | string;
  author: string;
  avatar?: string;
  location?: string;
  date?: string;
  rating?: number;
  title?: string;
  text?: string;
  helpful?: number;
  verified?: boolean;
  tripType?: string;
  photos?: readonly string[];
};

export type ReviewsRatingBucket = {
  stars: number;
  count: number;
  percentage: number;
};

export type ReviewsHighlight = { label: string; count: number };

export type ReviewsSummary = {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: readonly ReviewsRatingBucket[];
  highlights: readonly ReviewsHighlight[];
};

export type SubnavItem = { id: string; label: string };

export type TourProductHero = {
  imageUrl: string;
  imagePosition: string;
  tagline: string;
  pills: readonly string[];
  meta: {
    duration: string;
    region: string;
    stops: string;
    rating: number;
    ratingStars: number;
  };
  /** Optional auto-cycling slide images. First entry should match imageUrl for SSR consistency. */
  images?: readonly string[];
};

export type TourProductPrice = {
  amountLabel: string;
  currency: string;
  per: string;
  /** Original (compare-at) price in USD — when > sale, renders strikethrough on the booking surfaces. */
  originalPriceUsd?: number | null;
  /** Sale price in USD; mirrors `amountLabel` numerically. */
  salePriceUsd?: number | null;
  /** Discount percent (rounded integer) — renders a badge when > 0. */
  discountPercent?: number | null;
  /** Free-form note shown below the price (e.g. source attribution). */
  priceNote?: string;
};

/** Variable pricing matrix — used by private/charter products priced by group size × duration. */
export type TourProductPricingTier = {
  paxLabel: string;
  paxMin: number;
  paxMax: number;
  /** Price per duration key, e.g. { "4h": 179, "10h": 259 }. */
  prices: Record<string, number>;
};

export type TourProductPricingTiers = {
  currency: string;
  unit: string;
  /** Ordered duration keys to display, e.g. ["4h", "10h"] or ["flat"] for single-rate. */
  durations: readonly string[];
  tiers: readonly TourProductPricingTier[];
  /**
   * Optional extension — when guestCount exceeds the last tier's paxMax, price scales linearly.
   * Formula: basePrice + perPaxAdd × (guestCount - anchorPax) for guestCount > anchorPax.
   */
  extraPerPaxAbove?: {
    anchorPax: number;
    basePrice: number;
    perPaxAdd: number;
  };
};

/**
 * Sample-itinerary section — private/charter products only.
 *
 * A private charter has no fixed route, so instead of the route-flow + numbered
 * timeline logic we surface a few *sample* day plans the guest can mix-and-match
 * with their driver-guide. Each variant is a stack of empty slots that authoring
 * fills in later (`import는 나중에`); pickup/drop-off default to the guest's hotel.
 * The private-tour rules block renders directly below the variants.
 */
export type SampleItineraryStopSlot = {
  /** Optional clock window, e.g. "09:00" or "09:00–11:00". */
  time?: string;
  /** Stop name — left empty while the slot is awaiting content import. */
  title?: string;
  /** Short supporting line (area, theme, or note). */
  note?: string;
};

export type SampleItineraryVariant = {
  /** Stable key, e.g. "pocheon" / "seoul-city" / "suwon-hwaseong". */
  id: string;
  /** Tab label, e.g. "Pocheon" / "포천". */
  label: string;
  /** One-line teaser shown under the tab strip when the variant is active. */
  summary?: string;
  /** Optional duration hint, e.g. "~10 hours". */
  durationLabel?: string;
  /** Ordered stop slots between the hotel pickup and drop-off bookends. */
  stops: readonly SampleItineraryStopSlot[];
};

export type PrivateTourRuleGroup = {
  heading: string;
  items: readonly string[];
};

export type SampleItinerarySection = {
  title?: string;
  subtitle?: string;
  /** Fixed hotel bookend labels — pickup/drop-off default to the guest's hotel. */
  pickupDefaultLabel?: string;
  dropoffDefaultLabel?: string;
  /** Placeholder copy for slots that have no title yet. */
  slotPlaceholder?: string;
  /** "Not included" heading + chips (parking, tolls, admission, meals …). */
  notIncludedLabel?: string;
  notIncluded?: readonly string[];
  variants: readonly SampleItineraryVariant[];
  /** Private-tour rules block rendered below the sample variants. */
  rulesTitle?: string;
  rulesSubtitle?: string;
  rules?: readonly PrivateTourRuleGroup[];
};
