/**
 * Tour Mode API types (matches backend).
 */

export interface TourModeBookingSummary {
  id: string;
  booking_reference: string | null;
  tour_date: string;
  tour_time: string | null;
  number_of_guests: number;
  contact_name: string | null;
  contact_email: string | null;
  status: string;
  payment_status: string;
  tours: {
    id: string;
    title: string;
    city: string;
    image_url: string | null;
    schedule: ScheduleItem[];
  } | null;
}

export interface ScheduleItem {
  time?: string;
  title?: string;
  description?: string;
  departure_time?: string;
}

export interface TourGuideSpot {
  id: string;
  tour_id: string;
  title: string;
  description: string | null;
  audio_url: string | null;
  latitude: number;
  longitude: number;
  trigger_radius_m: number;
  sort_order: number;
}

export interface TourFacility {
  id: string;
  tour_id: string;
  type: 'restroom' | 'ticket_office' | 'convenience' | 'restaurant' | 'other';
  name: string;
  latitude: number;
  longitude: number;
  details: Record<string, unknown>;
  sort_order: number;
}

export interface TourBusDetail {
  id: string;
  tour_id: string;
  tour_date: string;
  payload: {
    bus_number?: string;
    driver_phone?: string;
    departure_time?: string;
    pickup_point?: string;
    [key: string]: unknown;
  };
  sent_at: string;
}

export interface TourModeContent {
  booking: {
    id: string;
    booking_reference: string | null;
    tour_date: string;
    tour_time: string | null;
    number_of_guests: number;
    contact_name: string | null;
    tours: TourModeBookingSummary['tours'];
    pickup_points: { id: string; name: string; address: string; lat?: number; lng?: number; pickup_time?: string }[] | null;
  };
  tour_guide_spots: TourGuideSpot[];
  tour_facilities: TourFacility[];
  bus_detail: TourBusDetail | null;
  schedule: ScheduleItem[];
}
