import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { kstToday } from '@/lib/tour-room/time';

export const dynamic = 'force-dynamic';

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
      // KST-anchored "today" — the UTC version hid today's tour between
      // 00:00 and 09:00 KST (live defect R-7, master plan §B D-9).
      .gte('tour_date', kstToday())
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
