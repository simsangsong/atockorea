/**
 * Tour types aligned with web API (GET /api/tours, GET /api/tours/[id]).
 * Same shape as web TourDetail for full detail page parity.
 */

export interface TourImage {
  url: string;
  title?: string;
  description?: string;
}

export interface PickupPoint {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  pickup_time?: string | null;
  image_url?: string | null;
}

export interface ItineraryDetail {
  time: string;
  activity: string;
  description: string;
  images?: string[];
}

export interface Faq {
  question: string;
  answer: string;
}

export interface ChildEligibilityRule {
  id: string;
  num?: number;
  num1?: number;
  num2?: number;
  num3?: number;
  text?: string;
}

export interface AccessibilityFacilities {
  note_children_counted?: boolean;
  child_seat?: 'none' | 'no_seat' | 'one_free_on_request' | 'counted_as_passenger' | 'custom';
  child_seat_custom?: { num1?: number; num2?: number; num3?: number };
  stroller?: 'suitable' | 'not_suitable';
  wheelchair?: 'suitable' | 'not_suitable';
  stroller_wheelchair?: 'both_ok' | 'both_not';
}

export interface Tour {
  id: number | string;
  slug?: string;
  city: string;
  location?: string;
  title: string;
  tagline?: string;
  description?: string;
  overview?: string;
  price: number;
  originalPrice?: number | null;
  original_price?: number | null;
  priceType?: 'person' | 'group';
  duration?: string;
  difficulty?: string;
  groupSize?: string;
  image?: string;
  images?: TourImage[] | Array<{ url: string; title?: string; description?: string }>;
  gallery_images?: string[];
  tag?: string;
  rating?: number;
  reviewCount?: number;
  review_count?: number;
  booking_count?: number;
  badges?: string[];
  features?: string[];
  highlight?: string;
  keywords?: string[];
  quickFacts?: string[];
  itinerary?: Array<{ time: string; title: string; description: string; icon?: string; images?: string[] }>;
  itineraryDetails?: ItineraryDetail[];
  inclusions?: Array<string | { icon?: string; text: string }>;
  exclusions?: Array<string | { icon?: string; text: string }>;
  highlights?: string[];
  faqs?: Faq[];
  pickup_points?: PickupPoint[];
  pickupPoints?: PickupPoint[];
  childEligibility?: ChildEligibilityRule[];
  suggestedToBring?: string[];
  accessibilityFacilities?: AccessibilityFacilities;
  pickupInfo?: string;
  notes?: string;
}
