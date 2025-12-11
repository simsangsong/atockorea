import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireMerchant } from '@/lib/auth';
import { calculatePlatformFee, calculateMerchantPayout } from '@/lib/constants';

/**
 * GET /api/merchant/analytics
 * Get merchant analytics data
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireMerchant(req);
    const merchantId = user.merchantId;
    
    if (!merchantId) {
      return NextResponse.json(
        { error: 'User is not associated with a merchant' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();

    // 1. Total revenue
    const { data: allBookings } = await supabase
      .from('bookings')
      .select('final_price')
      .eq('merchant_id', merchantId);

    const totalRevenue = allBookings?.reduce((sum, b) => sum + (b.final_price || 0), 0) || 0;
    
    // Calculate financial metrics
    const totalPlatformFee = calculatePlatformFee(totalRevenue);
    const totalMerchantPayout = calculateMerchantPayout(totalRevenue);

    // 2. Total orders count
    const { count: totalOrders } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId);

    // 3. Average order value
    const averageOrderValue = totalOrders && totalOrders > 0
      ? totalRevenue / totalOrders
      : 0;

    // 4. Top products (by order count and revenue)
    const { data: bookingsWithTours } = await supabase
      .from('bookings')
      .select(`
        id,
        final_price,
        tour_id,
        tours:tour_id (
          id,
          title
        )
      `)
      .eq('merchant_id', merchantId);

    // Group by tour_id and calculate stats
    const productStats: { [key: string]: { name: string; orders: number; revenue: number } } = {};
    
    bookingsWithTours?.forEach((booking: any) => {
      if (!booking.tour_id || !booking.tours) return;
      
      const tourId = booking.tour_id;
      if (!productStats[tourId]) {
        productStats[tourId] = {
          name: booking.tours.title || 'Unknown Tour',
          orders: 0,
          revenue: 0,
        };
      }
      
      productStats[tourId].orders += 1;
      productStats[tourId].revenue += booking.final_price || 0;
    });

    const topProducts = Object.values(productStats)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10);

    // 5. Sales trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: trendBookings } = await supabase
      .from('bookings')
      .select('booking_date, final_price')
      .eq('merchant_id', merchantId)
      .gte('booking_date', startDate)
      .order('booking_date', { ascending: true });

    // Group by date
    const salesTrend: { [key: string]: { date: string; orders: number; revenue: number } } = {};
    
    trendBookings?.forEach((booking: any) => {
      const date = booking.booking_date || booking.created_at?.split('T')[0];
      if (!date) return;
      
      if (!salesTrend[date]) {
        salesTrend[date] = {
          date,
          orders: 0,
          revenue: 0,
        };
      }
      
      salesTrend[date].orders += 1;
      salesTrend[date].revenue += booking.final_price || 0;
    });

    const salesTrendArray = Object.values(salesTrend)
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      totalRevenue,
      totalPlatformFee,
      totalMerchantPayout,
      totalOrders: totalOrders || 0,
      averageOrderValue: Math.round(averageOrderValue),
      topProducts,
      salesTrend: salesTrendArray,
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

