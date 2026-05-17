import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  AdminAuthFailure,
  adminAuthJsonResponse,
  getAuthUser,
  requireAdmin,
} from '@/lib/auth';

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

    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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

    if (user.role !== 'admin') {
      if (user.role !== 'merchant' || !user.merchantId) {
        return NextResponse.json(
          { error: 'Merchant access required' },
          { status: 403 }
        );
      }
      if (merchantId && merchantId !== user.merchantId) {
        return NextResponse.json(
          { error: 'You can only view your own settlements' },
          { status: 403 }
        );
      }
      query = query.eq('merchant_id', user.merchantId);
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
    if (error instanceof AdminAuthFailure) {
      return adminAuthJsonResponse(error);
    }
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
    await requireAdmin(req);
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

    const { data: settlement, error: settlementError } = await supabase
      .rpc('create_merchant_settlement', {
        p_merchant_id: merchantId,
        p_period_start: settlementPeriodStart,
        p_period_end: settlementPeriodEnd,
      })
      .single();

    if (settlementError) {
      console.error('Error creating settlement:', settlementError);
      const status = settlementError.code === 'P0002' ? 400 : 500;
      return NextResponse.json(
        { error: 'Failed to create settlement', details: settlementError.message },
        { status }
      );
    }

    return NextResponse.json(
      { settlement, message: 'Settlement created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof AdminAuthFailure) {
      return adminAuthJsonResponse(error);
    }
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}













