import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function todayYmd(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(
    now.getUTCDate(),
  ).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(
        `
        id, booking_reference, tour_date, tour_time, number_of_guests,
        contact_name, contact_email, status, payment_status,
        tours ( id, title, city, image_url, schedule )
      `,
      )
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .gte('tour_date', todayYmd())
      .order('tour_date', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch tour mode bookings', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ bookings: data ?? [] });
  } catch (error) {
    console.error('GET /api/tour-mode/bookings error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
