export type TourType = "private" | "join" | "bus";

export type JoinVisibleStatus =
  | "waiting"
  | "balance_open"
  | "confirmed"
  | "missed_deadline"
  | "private_only"
  | "join_unavailable";

export type MatchQuality = "great" | "good" | "slight";

export interface PickupInfo {
  areaLabel: string;
  surchargeLabel: string | null;
  surchargeAmount: number;
  surchargeFinal: boolean;
  joinAvailable: boolean;
}

export interface TourCardViewModel {
  id: string;
  title: string;
  type: TourType;
  tags: string[];
  priceFrom: number;
  /** List API: 할인 전 가격(원가). `priceFrom`보다 클 때만 표시. */
  originalPrice?: number | null;
  currency: string;
  pickup: PickupInfo;
  matchQuality?: MatchQuality;
  joinStatus?: JoinVisibleStatus;
  travelersJoined?: number;
  maxTravelers?: number;
  /** Optional for list display; set by list adapter from API image. */
  imageUrl?: string;
  /** Short duration string from API (e.g. list card badges). */
  duration?: string;
  /** City / region label for list card (e.g. home TourCard 📍 row). */
  city?: string;
  rating?: number;
  reviewCount?: number;
  bookingCount?: number;
}

/** Build tour request (client → server). Server is source of truth for pricing and availability. */
export interface BuildTourRequest {
  destination: "jeju";
  hotelId?: string;
  hotelName?: string;
  lat?: number;
  lng?: number;
  pickupAreaLabel?: string;
  date: string;
  guests: number;
  styleTags: string[];
  preferredType: "private" | "join" | "both";
}

/** Build tour response (server → client). Consume via adapters only. */
export interface BuildTourResponse {
  searchSummary: {
    destination: "jeju";
    pickupAreaLabel: string;
    date: string;
    guests: number;
    styleTags: string[];
  };
  recommended: TourCardViewModel[];
  privateTours: TourCardViewModel[];
  joinTours: TourCardViewModel[];
  busTours: TourCardViewModel[];
}

/** Booking timeline for detail/checkout. All dates ISO strings. Prefer server-provided; client fallback is not source of truth. */
export interface BookingTimelineViewModel {
  now: string;
  refundDeadlineAt: string;
  balanceOpensAt: string;
  balanceDueAt: string;
  tourStartAt: string;
  autoCharge: false;
}

/** Detail page ViewModel. Consume via detail adapter only. */
export interface TourDetailViewModel {
  id: string;
  /** Present when API returns tour.slug — selects v0 detail template on `/tour/[id]`. */
  slug?: string;
  title: string;
  type: TourType;
  tagline?: string;
  city: string;
  rating: number;
  reviewCount: number;
  badges: string[];
  price: number;
  originalPrice: number | null;
  priceType: "person" | "group";
  duration: string;
  difficulty?: string;
  groupSize?: string;
  highlight?: string;
  images: Array<{ url: string; title?: string; description?: string }>;
  itinerary: Array<{ time: string; title: string; description?: string; icon?: string; images?: string[] }>;
  itineraryDetails?: Array<{ time: string; activity: string; description: string; images?: string[] }>;
  overview: string;
  pickup: PickupInfo;
  pickupPoints: Array<{ id: string; name: string; address: string; lat: number; lng: number; pickup_time?: string | null }>;
  inclusions: Array<string | { icon: string; text: string }>;
  exclusions: Array<string | { icon: string; text: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  highlights?: string[];
  /** Why this tour fits (hotel area, pickup, value). From adapter/server. */
  whyThisFitsYou: string[];
  /** Who this is best for. From adapter/copy. */
  whoThisIsBestFor: string[];
  /** Short cancellation policy. Centralized copy. */
  cancellationPolicy: string;
  joinStatus?: JoinVisibleStatus;
  travelersJoined?: number;
  maxTravelers?: number;
  /** Optional: child eligibility rules (detail page accordion). */
  childEligibility?: Array<{ id: string; num?: number; num1?: number; num2?: number; num3?: number; text?: string }>;
  /** Optional: server-provided booking timeline. When present, UI must use this; do not use client-computed timeline as source of truth. */
  bookingTimeline?: BookingTimelineViewModel | null;
  /**
   * Optional: verified count of bookings in the last 24 hours from server analytics.
   * UI shows social-proof line only when present and greater than zero.
   */
  recentBookings24h?: number | null;
}
