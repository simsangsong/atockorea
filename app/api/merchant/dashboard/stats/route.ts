import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireMerchant } from '@/lib/auth';
import { calculatePlatformFee, calculateMerchantPayout } from '@/lib/constants';

/**
 * GET /api/merchant/dashboard/stats
 * Get merchant dashboard statistics
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

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // 1. Today's orders count
    const { count: todayOrders } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .gte('booking_date', today)
      .lte('booking_date', today);

    // 2. Pending orders count
    const { count: pendingOrders } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('status', 'pending');

    // 3. Total products count
    const { count: totalProducts } = await supabase
      .from('tours')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId);

    // 4. Active products count
    const { count: activeProducts } = await supabase
      .from('tours')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('is_active', true);

    // 5. Today's revenue and financial metrics
    const { data: todayBookings } = await supabase
      .from('bookings')
      .select('final_price, payment_status, settlement_status')
      .eq('merchant_id', merchantId)
      .gte('booking_date', today)
      .lte('booking_date', today);

    const todayRevenue = todayBookings?.reduce((sum, b) => sum + (b.final_price || 0), 0) || 0;
    
    // Calculate today's platform fee and merchant payout
    const todayPlatformFee = calculatePlatformFee(todayRevenue);
    const todayMerchantPayout = calculateMerchantPayout(todayRevenue);
    
    // Today's pending settlement and settled revenue
    const todayPendingSettlement = todayBookings
      ?.filter((b) => b.payment_status === 'paid' && b.settlement_status !== 'settled')
      .reduce((sum, b) => sum + calculateMerchantPayout(b.final_price || 0), 0) || 0;
    
    const todaySettledRevenue = todayBookings
      ?.filter((b) => b.settlement_status === 'settled')
      .reduce((sum, b) => sum + calculateMerchantPayout(b.final_price || 0), 0) || 0;

    // 6. Total revenue and financial metrics
    const { data: allBookings } = await supabase
      .from('bookings')
      .select('final_price, payment_status, settlement_status')
      .eq('merchant_id', merchantId);

    const totalRevenue = allBookings?.reduce((sum, b) => sum + (b.final_price || 0), 0) || 0;
    
    // Calculate total platform fee and merchant payout
    const totalPlatformFee = calculatePlatformFee(totalRevenue);
    const totalMerchantPayout = calculateMerchantPayout(totalRevenue);

    // 7. Pending settlement (已支付但未结算，扣除10%手续费后)
    const { data: pendingSettlementBookings } = await supabase
      .from('bookings')
      .select('final_price')
      .eq('merchant_id', merchantId)
      .eq('payment_status', 'paid')
      .eq('settlement_status', 'pending');

    const pendingSettlement = pendingSettlementBookings?.reduce(
      (sum, b) => sum + calculateMerchantPayout(b.final_price || 0),
      0
    ) || 0;

    // 8. Settled revenue (已结算，扣除10%手续费后)
    const { data: settledBookings } = await supabase
      .from('bookings')
      .select('final_price')
      .eq('merchant_id', merchantId)
      .eq('settlement_status', 'settled');

    const settledRevenue = settledBookings?.reduce(
      (sum, b) => sum + calculateMerchantPayout(b.final_price || 0),
      0
    ) || 0;

    // 9. Recent orders (last 5)
    const { data: recentOrders } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_date,
        final_price,
        status,
        number_of_guests,
        number_of_people,
        tours:tour_id (
          id,
          title
        )
      `)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Calculate remaining balance (付后结余)
    const remainingBalance = totalMerchantPayout - settledRevenue;
    
    return NextResponse.json({
      stats: {
        // Order statistics
        todayOrders: todayOrders || 0,
        pendingOrders: pendingOrders || 0,
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
        
        // Today's financial metrics
        todayRevenue,
        todayPlatformFee,
        todayMerchantPayout,
        todayPendingSettlement,
        todaySettledRevenue,
        
        // Total financial metrics
        totalRevenue,
        totalPlatformFee,
        totalMerchantPayout,
        pendingSettlement,
        settledRevenue,
        remainingBalance, // 付后结余 = 实际应收 - 已结算
      },
      recentOrders: recentOrders?.map((order: any) => ({
        id: order.id,
        bookingId: `BK-${order.id.substring(0, 8).toUpperCase()}`,
        tourName: order.tours?.title || 'Unknown Tour',
        guests: order.number_of_guests || order.number_of_people || 0,
        date: order.booking_date || order.created_at?.split('T')[0],
        amount: order.final_price || 0,
        status: order.status,
      })) || [],
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

