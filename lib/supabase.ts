import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client for client-side usage
// Only create client if environment variables are available
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Create Supabase client for server-side usage (with service role key)
// Only use this in API routes or server components
export const createServerClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    const missing = [!supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL', !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean).join(', ');
    throw new Error(`Missing Supabase env: ${missing}. Set them in Vercel Project Settings → Environment Variables.`);
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

/** Server-only anon client (no user session). Use in Route Handlers for auth actions that must not use the service role, e.g. signInWithOtp. */
export const createAnonServerClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [!supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL', !supabaseAnonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].filter(Boolean).join(', ');
    throw new Error(`Missing Supabase env: ${missing}`);
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

/** Alias for service-role server client (itinerary cache, admin batch jobs). */
export const createServiceRoleClient = createServerClient;

/**
 * Anon Supabase client with the caller's JWT — respects RLS as that user.
 */
export function createUserSupabaseClient(accessToken: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [!supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL', !supabaseAnonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
      .filter(Boolean)
      .join(', ');
    throw new Error(`Missing Supabase env: ${missing}`);
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

// Database types (will be generated from Supabase later)
export type Database = {
  public: {
    Tables: {
      tours: {
        Row: {
          id: string;
          title: string;
          slug: string;
          city: 'Seoul' | 'Busan' | 'Jeju';
          tag: string | null;
          subtitle: string | null;
          description: string | null;
          price: number;
          original_price: number | null;
          /** Storage unit for `price` / `original_price`: KRW (won) or USD (dollars). */
          price_currency: 'KRW' | 'USD';
          price_type: 'person' | 'group';
          image_url: string;
          gallery_images: string[];
          duration: string | null;
          lunch_included: boolean;
          ticket_included: boolean;
          pickup_info: string | null;
          notes: string | null;
          highlights: string[];
          includes: string[];
          excludes: string[];
          schedule: Array<{ time: string; title: string; description?: string }>;
          faqs: Array<{ question: string; answer: string }>;
          rating: number;
          review_count: number;
          pickup_points_count: number;
          dropoff_points_count: number;
          is_active: boolean;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['tours']['Row'],
          'id' | 'created_at' | 'updated_at' | 'price_currency'
        > & { price_currency?: 'KRW' | 'USD' };
        Update: Partial<Database['public']['Tables']['tours']['Insert']>;
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          tour_id: string;
          tour_date: string;
          tour_time: string | null;
          number_of_people: number;
          pickup_point_id: string | null;
          unit_price: number;
          total_price: number;
          discount_amount: number;
          final_price: number;
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
          cancelled_at: string | null;
          cancellation_reason: string | null;
          refund_eligible: boolean;
          refund_processed: boolean;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          booking_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bookings']['Row'], 'id' | 'booking_date' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          tour_id: string;
          booking_id: string | null;
          rating: number;
          title: string | null;
          comment: string | null;
          photos: string[];
          is_verified: boolean;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['reviews']['Insert']>;
      };
      wishlist: {
        Row: {
          id: string;
          user_id: string;
          tour_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['wishlist']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
      cart_items: {
        Row: {
          id: string;
          user_id: string;
          tour_id: string;
          tour_date: string | null;
          tour_time: string | null;
          quantity: number;
          pickup_point_id: string | null;
          unit_price: number;
          total_price: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cart_items']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['cart_items']['Insert']>;
      };
      user_profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          birth_year: number | null;
          nationality: string | null;
          language_preference: 'en' | 'zh' | 'ko' | 'zh-TW' | 'es' | 'ja';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
      };
      tour_product_pages: {
        Row: {
          id: string;
          slug: string;
          /** Logical product key — same for all locales of one SKU */
          product_id: string;
          locale: string;
          is_published: boolean;
          sort_order: number;
          tour_id: string | null;
          title: string;
          subtitle: string | null;
          region_label: string | null;
          duration_label: string | null;
          stops_count: number | null;
          rating_avg: number | null;
          review_count: number | null;
          badges: string[];
          hero_image_url: string | null;
          thumbnail_url: string | null;
          card_short_description: string | null;
          seo_title: string | null;
          meta_description: string | null;
          headline_line_1: string | null;
          headline_line_2: string | null;
          price_amount_label: string | null;
          price_currency: string;
          price_per: string;
          detail_payload: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['tour_product_pages']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['tour_product_pages']['Insert']>;
      };
      tour_product_offers: {
        Row: {
          id: string;
          tour_product_page_id: string;
          label: string | null;
          amount_minor: number;
          currency: string;
          stripe_price_id: string | null;
          is_active: boolean;
          is_default: boolean;
          valid_from: string | null;
          valid_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['tour_product_offers']['Row'],
          'id' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['tour_product_offers']['Insert']>;
      };
      tour_matching_profiles: {
        Row: {
          product_id: string;
          product_type: string;
          route_type: string;
          region_type: string;
          region_tags: unknown;
          theme_tags: unknown;
          poi_tags: unknown;
          pace_level: number;
          walking_level: number;
          scenic_level: number;
          photo_level: number;
          culture_level: number;
          relax_level: number;
          first_time_fit: number;
          family_fit: number;
          senior_fit: number;
          couple_fit: number;
          active_traveler_fit: number;
          one_day_fit: number;
          same_day_flight_fit: number;
          rain_fit: number;
          value_for_money_fit: number;
          iconic_landmark_fit: number;
          cafe_fit: number;
          adult_family_fit: number;
          young_kids_fit: number;
          senior_active_fit: number;
          senior_general_fit: number;
          mobility_friendly_fit: number;
          stroller_fit: number;
          indoor_ratio: number;
          weather_sensitivity: number;
          local_culture_fit: number;
          shopping_fit: number;
          storytelling_fit: number;
          comfort_level: number;
          budget_fit: number;
          premium_fit: number;
          small_group_fit: number;
          private_fit: number;
          bus_fit: number;
          price_band: string;
          pickup_base: string;
          return_time_band: string;
          duration_band: string;
          min_recommended_age: number;
          hard_constraints: unknown;
          walking_notes: unknown;
          keywords: unknown;
          synonym_hints: unknown;
          profile_version: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
      };
    };
  };
};

