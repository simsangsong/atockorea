/**
 * Minimal types for Supabase join/relation results.
 * Used when selecting bookings with tours, user_profiles, pickup_points to avoid `as any`.
 */

export interface TourRelation {
  id?: number | string;
  title?: string;
  image_url?: string;
  price_type?: 'person' | 'group';
}

export interface UserProfileRelation {
  email?: string;
  full_name?: string;
}

export interface PickupPointRelation {
  name?: string;
  address?: string;
  pickup_time?: string;
}
