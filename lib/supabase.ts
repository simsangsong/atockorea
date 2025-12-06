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
    throw new Error('Missing Supabase environment variables. Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

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
        Insert: Omit<Database['public']['Tables']['tours']['Row'], 'id' | 'created_at' | 'updated_at'>;
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
          language_preference: 'en' | 'zh' | 'ko';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
      };
    };
  };
};

