import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { kstDayBounds } from '@/lib/admin/kst-day';

// Force dynamic rendering for API routes that use headers
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin authentication
    await requireAdmin(req);
    
    const supabase = createServerClient();

    // Get total merchants
    const { count: totalMerchants } = await supabase
      .from('merchants')
      .select('*', { count: 'exact', head: true });

    // Get active merchants
    const { count: activeMerchants } = await supabase
      .from('merchants')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get total tours (products)
    const { count: totalProducts } = await supabase
      .from('tours')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get total bookings (orders)
    const { count: totalOrders } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true });

    // Get today's bookings — M-6: use KST day bounds (was UTC, so KST 00:00–09:00
    // counted the wrong day and showed "0 orders today").
    const { startIso: todayStart, endIso: todayEnd } = kstDayBounds();
    const { count: todayOrders } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);

    // Pending bookings (for dashboard "Pending items")
    const { count: pendingOrders } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    /** Phase 10.6 — split revenue by currency. Pre-Phase-10 the dashboard
     *  hardcoded ₩ but legacy data is USD; after Phase 10.2 builder bookings
     *  land in KRW. Sum each currency separately so the dashboard renders
     *  honest totals per currency instead of mixing them. */
    const { data: bookings } = await supabase
      .from('bookings')
      .select('final_price, payment_status, currency')
      .eq('payment_status', 'paid');

    const revenueByCurrency = (bookings ?? []).reduce(
      (acc, b) => {
        const ccy = (b as { currency?: string | null }).currency === 'krw' ? 'krw' : 'usd';
        acc[ccy] = (acc[ccy] ?? 0) + parseFloat(String(b.final_price ?? 0));
        return acc;
      },
      { usd: 0, krw: 0 } as { usd: number; krw: number },
    );
    /** Backwards-compat scalar — pre-Phase-10 dashboards may still read this.
     *  Equals the USD bucket since legacy data is USD-only; new dashboards
     *  should read revenueByCurrency.{usd,krw} separately. */
    const totalRevenue = revenueByCurrency.usd;

    // Get recent bookings (last 20 for better visibility)
    const { data: recentBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        created_at,
        booking_date,
        tour_date,
        number_of_guests,
        number_of_people,
        final_price,
        currency,
        source,
        status,
        payment_status,
        pickup_point_id,
        tours (
          id,
          title
        ),
        user_profiles (
          id,
          full_name,
          email
        ),
        pickup_points (
          id,
          name,
          address
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (bookingsError) {
      console.error('Error fetching recent bookings:', bookingsError.code, bookingsError.message);
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error details:', JSON.stringify(bookingsError, null, 2));
      }
    }

    return NextResponse.json({
      stats: {
        totalMerchants: totalMerchants || 0,
        activeMerchants: activeMerchants || 0,
        totalProducts: totalProducts || 0,
        totalOrders: totalOrders || 0,
        todayOrders: todayOrders || 0,
        pendingOrders: pendingOrders || 0,
        totalRevenue,
        revenueByCurrency,
      },
      recentBookings: recentBookings || [],
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}





