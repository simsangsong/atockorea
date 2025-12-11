import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireMerchant } from '@/lib/auth';

/**
 * GET /api/merchant/customers
 * Get merchant's customers (derived from bookings)
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

    // Get all bookings for this merchant with user info
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        user_id,
        final_price,
        created_at,
        user_profiles:user_id (
          id,
          full_name,
          phone
        )
      `)
      .eq('merchant_id', merchantId)
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get user emails from auth.users (requires service role)
    // Group customers by user_id
    const customerMap: { [key: string]: {
      user_id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
      order_count: number;
      total_spent: number;
      last_order_date: string;
    } } = {};

    bookings?.forEach((booking: any) => {
      const userId = booking.user_id;
      if (!userId) return;

      if (!customerMap[userId]) {
        customerMap[userId] = {
          user_id: userId,
          full_name: booking.user_profiles?.full_name || null,
          email: null, // Will be fetched separately if needed
          phone: booking.user_profiles?.phone || null,
          order_count: 0,
          total_spent: 0,
          last_order_date: booking.created_at || '',
        };
      }

      customerMap[userId].order_count += 1;
      customerMap[userId].total_spent += booking.final_price || 0;
      
      const bookingDate = booking.created_at || '';
      if (bookingDate > customerMap[userId].last_order_date) {
        customerMap[userId].last_order_date = bookingDate;
      }
    });

    // Convert to array and sort by last order date
    const customers = Object.values(customerMap)
      .sort((a, b) => b.last_order_date.localeCompare(a.last_order_date));

    return NextResponse.json({ customers });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

