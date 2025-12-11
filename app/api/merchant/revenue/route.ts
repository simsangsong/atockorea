import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withMerchantIsolation } from '@/lib/middleware';
import { PLATFORM_COMMISSION_RATE, calculatePlatformFee, calculateMerchantPayout } from '@/lib/constants';

// GET /api/merchant/revenue - Get revenue data for merchant (with isolation)
export async function GET(req: NextRequest) {
  return withMerchantIsolation(
    async (req: NextRequest, user: any, merchantId: string) => {
      const { searchParams } = new URL(req.url);
      const dateRange = searchParams.get('dateRange') || 'today';
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      const supabase = createServerClient();

      try {
        // Calculate date range
        let queryStartDate: string;
        let queryEndDate: string = new Date().toISOString().split('T')[0];

        switch (dateRange) {
          case 'today':
            queryStartDate = new Date().toISOString().split('T')[0];
            break;
          case 'week':
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            queryStartDate = weekAgo.toISOString().split('T')[0];
            break;
          case 'month':
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            queryStartDate = monthAgo.toISOString().split('T')[0];
            break;
          case 'custom':
            if (!startDate || !endDate) {
              return NextResponse.json(
                { error: 'Start date and end date are required for custom range' },
                { status: 400 }
              );
            }
            queryStartDate = startDate;
            queryEndDate = endDate;
            break;
          default:
            queryStartDate = new Date().toISOString().split('T')[0];
        }

        // Fetch bookings for this merchant only
        // Try booking_date first, fallback to tour_date or created_at
        let query = supabase
          .from('bookings')
          .select(`
            id,
            booking_date,
            tour_date,
            created_at,
            final_price,
            number_of_guests,
            number_of_people,
            payment_status,
            status,
            settlement_status,
            tours:tour_id (
              id,
              title
            )
          `)
          .eq('merchant_id', merchantId);

        // Use booking_date if available, otherwise use tour_date or created_at
        // Try to filter by booking_date first
        query = query.gte('booking_date', queryStartDate).lte('booking_date', queryEndDate);
        
        const { data: bookings, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching revenue data:', error);
          return NextResponse.json(
            { error: 'Failed to fetch revenue data' },
            { status: 500 }
          );
        }

        // Calculate summary
        // totalRevenue = 客人支付的总金额
        const totalRevenue = bookings?.reduce((sum, b) => sum + (b.final_price || 0), 0) || 0;
        
        // Calculate platform fee and merchant payout
        const platformFee = calculatePlatformFee(totalRevenue);
        const merchantPayout = calculateMerchantPayout(totalRevenue); // 实际应收金额（应付金额）
        
        // Pending settlement: 已支付但未结算的订单金额（扣除平台手续费后）
        const pendingSettlement = bookings
          ?.filter((b) => b.payment_status === 'paid' && b.settlement_status !== 'settled')
          .reduce((sum, b) => {
            const bookingAmount = b.final_price || 0;
            return sum + calculateMerchantPayout(bookingAmount);
          }, 0) || 0;
        
        // Settled revenue: 已结算的订单金额（扣除平台手续费后）
        const settledRevenue = bookings
          ?.filter((b) => b.payment_status === 'paid' && b.settlement_status === 'settled')
          .reduce((sum, b) => {
            const bookingAmount = b.final_price || 0;
            return sum + calculateMerchantPayout(bookingAmount);
          }, 0) || 0;
        
        // 付后结余 = 实际应收金额 - 已结算金额
        const remainingBalance = merchantPayout - settledRevenue;

        // Format response
        const revenueItems = bookings?.map((booking: any) => {
          // Use settlement_status from database if available, otherwise determine from status
          const settlementStatus = 
            booking.settlement_status || 
            (booking.status === 'completed' && booking.payment_status === 'paid'
              ? 'settled'
              : booking.payment_status === 'paid'
              ? 'pending'
              : 'pending');

          // Use available date field
          const bookingDate = booking.booking_date || booking.tour_date || booking.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
          const guests = booking.number_of_guests || booking.number_of_people || 0;

          const bookingAmount = booking.final_price || 0;
          const bookingPlatformFee = calculatePlatformFee(bookingAmount);
          const bookingMerchantPayout = calculateMerchantPayout(bookingAmount);

          return {
            id: booking.id,
            date: bookingDate,
            tourName: booking.tours?.title || 'Unknown Tour',
            bookingId: `BK-${booking.id.substring(0, 8).toUpperCase()}`,
            guests,
            amount: bookingAmount, // 客人支付金额
            platformFee: bookingPlatformFee, // 平台手续费
            merchantPayout: bookingMerchantPayout, // 商家应收金额
            paymentStatus: booking.payment_status || 'pending',
            settlementStatus: booking.settlement_status || settlementStatus,
          };
        }) || [];

        return NextResponse.json({
          summary: {
            totalRevenue, // 客人支付总金额
            platformFee, // 平台手续费（10%）
            merchantPayout, // 实际应收金额（应付金额）= 总金额 - 平台手续费
            pendingSettlement, // 待结算金额（扣除平台手续费后）
            settledRevenue, // 已结算金额（扣除平台手续费后）
            remainingBalance, // 付后结余 = 实际应收 - 已结算
            totalBookings: bookings?.length || 0,
          },
          items: revenueItems,
        });
      } catch (error) {
        console.error('Error in revenue API:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    }
  )(req);
}

