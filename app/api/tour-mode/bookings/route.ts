import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { handleApiError, ErrorResponses } from '@/lib/error-handler';

/**
 * GET /api/tour-mode/bookings
 * Returns current user's upcoming confirmed bookings for Tour Mode.
 * Auth required.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return ErrorResponses.unauthorized('Authentication required');
    }

    const supabase = createServerClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        tour_date,
        tour_time,
        number_of_guests,
        contact_name,
        contact_email,
        status,
        payment_status,
        tours (
          id,
          title,
          city,
          image_url,
          schedule
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .gte('tour_date', today)
      .order('tour_date', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ bookings: bookings || [] });
  } catch (error: unknown) {
    return handleApiError(error, req);
  }
}
