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
};
