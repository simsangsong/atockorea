/**
 * Tour types aligned with web API responses (e.g. GET /api/tours).
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
}

export interface Tour {
  id: number | string;
  slug?: string;
  city: string;
  title: string;
  description?: string;
  overview?: string;
  price: number;
  originalPrice?: number | null;
  original_price?: number | null;
  priceType?: 'person' | 'group';
  duration?: string;
  image?: string;
  images?: TourImage[] | string[];
  tag?: string;
  rating?: number;
  reviewCount?: number;
  review_count?: number;
  booking_count?: number;
  badges?: string[];
  features?: string[];
  pickup_points?: PickupPoint[];
  pickupPoints?: PickupPoint[];
}
