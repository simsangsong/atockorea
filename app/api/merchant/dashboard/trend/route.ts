import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireMerchant } from '@/lib/auth';
import { calculateMerchantPayout } from '@/lib/constants';

/**
 * GET /api/merchant/dashboard/trend
 * Get merchant dashboard trend data for charts (last 30 days)
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

    // Get last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    // Get bookings grouped by date
    const { data: bookings } = await supabase
      .from('bookings')
      .select('booking_date, final_price, status, payment_status, settlement_status')
      .eq('merchant_id', merchantId)
      .gte('booking_date', startDate)
      .order('booking_date', { ascending: true });

    // Group by date
    const trendData: { [key: string]: { 
      date: string; 
      orders: number; 
      revenue: number;
      pending: number;
      confirmed: number;
      completed: number;
      pendingSettlement: number;
      settledRevenue: number;
    } } = {};

    bookings?.forEach((booking: any) => {
      const date = booking.booking_date || booking.created_at?.split('T')[0];
      if (!date) return;

      if (!trendData[date]) {
        trendData[date] = {
          date,
          orders: 0,
          revenue: 0,
          pending: 0,
          confirmed: 0,
          completed: 0,
          pendingSettlement: 0,
          settledRevenue: 0,
        };
      }

      const bookingAmount = booking.final_price || 0;
      trendData[date].orders += 1;
      trendData[date].revenue += bookingAmount;

      // Count by status
      const status = booking.status || 'pending';
      if (status === 'pending') {
        trendData[date].pending += 1;
      } else if (status === 'confirmed') {
        trendData[date].confirmed += 1;
      } else if (status === 'completed') {
        trendData[date].completed += 1;
      }

      // Calculate settlement amounts (扣除10%平台手续费)
      if (booking.payment_status === 'paid') {
        const merchantPayout = calculateMerchantPayout(bookingAmount); // 使用统一的计算函数
        if (booking.settlement_status === 'settled') {
          trendData[date].settledRevenue += merchantPayout;
        } else {
          trendData[date].pendingSettlement += merchantPayout;
        }
      }
    });

    // Convert to array and sort by date
    const trendArray = Object.values(trendData)
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ trend: trendArray });
  } catch (error: any) {
    console.error('Error fetching dashboard trend:', error);
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

