import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/settlements
 * Get settlements (merchant or admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);

    const merchantId = searchParams.get('merchantId');
    const status = searchParams.get('status');

    // Get user from auth
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let userRole: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        userRole = profile?.role || null;
      }
    }

    let query = supabase
      .from('settlements')
      .select(`
        *,
        merchants (
          id,
          company_name
        )
      `)
      .order('created_at', { ascending: false });

    // If not admin, filter by merchant
    if (userRole !== 'admin') {
      if (!merchantId && userId) {
        // Get merchant_id from user
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id')
          .eq('user_id', userId)
          .single();
        
        if (merchant) {
          query = query.eq('merchant_id', merchant.id);
        } else {
          return NextResponse.json(
            { error: 'Merchant not found' },
            { status: 404 }
          );
        }
      } else if (merchantId) {
        query = query.eq('merchant_id', merchantId);
      } else {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
    } else if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: settlements, error } = await query;

    if (error) {
      console.error('Error fetching settlements:', error);
      return NextResponse.json(
        { error: 'Failed to fetch settlements', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ settlements: settlements || [] });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settlements
 * Create a new settlement (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json();

    const {
      merchantId,
      settlementPeriodStart,
      settlementPeriodEnd,
    } = body;

    if (!merchantId || !settlementPeriodStart || !settlementPeriodEnd) {
      return NextResponse.json(
        { error: 'merchantId, settlementPeriodStart, and settlementPeriodEnd are required' },
        { status: 400 }
      );
    }

    // Get completed bookings in the period
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, final_price, payment_status')
      .eq('merchant_id', merchantId)
      .eq('payment_status', 'paid')
      .eq('status', 'completed')
      .gte('booking_date', settlementPeriodStart)
      .lte('booking_date', settlementPeriodEnd)
      .is('settlement_status', null); // Not yet settled

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return NextResponse.json(
        { error: 'Failed to fetch bookings', details: bookingsError.message },
        { status: 500 }
      );
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json(
        { error: 'No bookings found for settlement period' },
        { status: 400 }
      );
    }

    // Calculate settlement amounts
    const totalRevenue = bookings.reduce((sum, booking) => 
      sum + parseFloat(booking.final_price.toString()), 0
    );
    const platformFee = totalRevenue * 0.1; // 10% platform fee
    const merchantPayout = totalRevenue - platformFee;

    // Create settlement
    const { data: settlement, error: settlementError } = await supabase
      .from('settlements')
      .insert({
        merchant_id: merchantId,
        settlement_period_start: settlementPeriodStart,
        settlement_period_end: settlementPeriodEnd,
        total_revenue: totalRevenue,
        platform_fee: platformFee,
        merchant_payout: merchantPayout,
        total_bookings: bookings.length,
        status: 'pending',
      })
      .select()
      .single();

    if (settlementError) {
      console.error('Error creating settlement:', settlementError);
      return NextResponse.json(
        { error: 'Failed to create settlement', details: settlementError.message },
        { status: 500 }
      );
    }

    // Create settlement_bookings entries
    const settlementBookings = bookings.map((booking) => ({
      settlement_id: settlement.id,
      booking_id: booking.id,
      booking_revenue: parseFloat(booking.final_price.toString()),
      platform_fee_amount: parseFloat(booking.final_price.toString()) * 0.1,
      merchant_payout_amount: parseFloat(booking.final_price.toString()) * 0.9,
    }));

    const { error: sbError } = await supabase
      .from('settlement_bookings')
      .insert(settlementBookings);

    if (sbError) {
      console.error('Error creating settlement bookings:', sbError);
      // Rollback settlement
      await supabase.from('settlements').delete().eq('id', settlement.id);
      return NextResponse.json(
        { error: 'Failed to create settlement bookings', details: sbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { settlement, message: 'Settlement created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}








