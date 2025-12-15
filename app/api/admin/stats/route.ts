import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

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

    // Get today's bookings
    const today = new Date().toISOString().split('T')[0];
    const { count: todayOrders } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    // Get total revenue (sum of all paid bookings)
    const { data: bookings } = await supabase
      .from('bookings')
      .select('final_price, payment_status')
      .eq('payment_status', 'paid');

    const totalRevenue = bookings?.reduce((sum, booking) => 
      sum + parseFloat(booking.final_price.toString()), 0
    ) || 0;

    // Get recent bookings (last 10)
    const { data: recentBookings } = await supabase
      .from('bookings')
      .select(`
        id,
        created_at,
        final_price,
        status,
        payment_status,
        tours (
          id,
          title
        ),
        user_profiles (
          id,
          full_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      stats: {
        totalMerchants: totalMerchants || 0,
        activeMerchants: activeMerchants || 0,
        totalProducts: totalProducts || 0,
        totalOrders: totalOrders || 0,
        todayOrders: todayOrders || 0,
        totalRevenue,
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

