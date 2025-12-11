import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

// GET /api/admin/revenue - Get revenue data for admin
export async function GET(req: NextRequest) {
  return withAuth(
    async (req: NextRequest, user: any) => {
      // Check if user is admin
      if (user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(req.url);
      const dateRange = searchParams.get('dateRange') || 'today';
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      const supabase = createClient();

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

        // Fetch bookings with tour and merchant info
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
            tours:tour_id (
              id,
              title
            ),
            merchants:merchant_id (
              id,
              name
            )
          `);

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
        // For now, consider 'paid' as settled, 'pending' as pending settlement
        // TODO: Add settlement_status column to bookings table
        const totalRevenue = bookings?.reduce((sum, b) => sum + (b.final_price || 0), 0) || 0;
        const pendingSettlement = bookings
          ?.filter((b) => b.payment_status === 'paid' && b.status !== 'completed')
          .reduce((sum, b) => sum + (b.final_price || 0), 0) || 0;
        const settledRevenue = bookings
          ?.filter((b) => b.payment_status === 'paid' && b.status === 'completed')
          .reduce((sum, b) => sum + (b.final_price || 0), 0) || 0;

        // Format response
        const revenueItems = bookings?.map((booking: any) => {
          // Determine settlement status based on booking status
          // completed bookings are considered settled
          const settlementStatus = 
            booking.status === 'completed' && booking.payment_status === 'paid'
              ? 'settled'
              : booking.payment_status === 'paid'
              ? 'pending'
              : 'pending';

          // Use available date field
          const bookingDate = booking.booking_date || booking.tour_date || booking.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
          const guests = booking.number_of_guests || booking.number_of_people || 0;

          return {
            id: booking.id,
            date: bookingDate,
            merchantName: booking.merchants?.name || 'Unknown',
            tourName: booking.tours?.title || 'Unknown Tour',
            bookingId: `BK-${booking.id.substring(0, 8).toUpperCase()}`,
            guests,
            amount: booking.final_price || 0,
            paymentStatus: booking.payment_status || 'pending',
            settlementStatus,
          };
        }) || [];

        return NextResponse.json({
          summary: {
            totalRevenue,
            pendingSettlement,
            settledRevenue,
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
    },
    ['admin']
  )(req);
}

