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
  currency: string;
  pickup: PickupInfo;
  matchQuality?: MatchQuality;
  joinStatus?: JoinVisibleStatus;
  travelersJoined?: number;
  maxTravelers?: number;
  /** Optional for list display; set by list adapter from API image. */
  imageUrl?: string;
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
}
