import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { ACTIVE_BOOKING_STATUSES } from '@/lib/constants/booking-status';
import { getMerchantProfileMap } from '@/lib/admin/merchant-profiles';
import { validateMerchantUpdate } from '@/lib/admin/merchant-update';

/**
 * GET /api/admin/merchants/[id]
 * Get a single merchant (admin only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: merchantId } = await params;
    await requireAdmin(req);

    const supabase = createServerClient();

    const { data: merchant, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', merchantId)
      .single();

    if (error || !merchant) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Merchant not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch merchant', details: error?.message },
        { status: 500 }
      );
    }

    const [profileMap, toursResult] = await Promise.all([
      getMerchantProfileMap(supabase, [merchant.user_id], { includeAvatar: true }),
      supabase
        .from('tours')
        .select('id, title, city, price, is_active, created_at')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false }),
    ]);

    if (toursResult.error) {
      console.error('Error fetching merchant tours:', toursResult.error);
      return NextResponse.json(
        { error: 'Failed to fetch merchant tours', details: toursResult.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      merchant: {
        ...merchant,
        user_profiles: merchant.user_id ? profileMap.get(merchant.user_id) ?? null : null,
        tours: toursResult.data || [],
      },
    });
  } catch (error: any) {
    console.error('Error fetching merchant:', error);
    
    if (error instanceof AdminAuthFailure) {
      return adminAuthJsonResponse(error);
    }

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

/**
 * PUT /api/admin/merchants/[id]
 * Update merchant (admin only)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: merchantId } = await params;
    await requireAdmin(req);

    const supabase = createServerClient();
    const body = await req.json();

    // N-5: allowlist + validate (status enum, email format, boolean) so bad
    // input fails with a clean 400 instead of a DB CHECK 500 or silent persist.
    const validation = validateMerchantUpdate(body as Record<string, unknown>);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const updateData = validation.updateData;

    // S-F7: reject an empty update instead of issuing a no-op write.
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: merchant, error } = await supabase
      .from('merchants')
      .update(updateData)
      .eq('id', merchantId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating merchant:', error);
      return NextResponse.json(
        { error: 'Failed to update merchant', details: error.message },
        { status: 500 }
      );
    }

    const [profileMap, toursResult] = await Promise.all([
      getMerchantProfileMap(supabase, [merchant.user_id], { includeAvatar: true }),
      supabase
        .from('tours')
        .select('id, title, city, price, is_active, created_at')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false }),
    ]);

    if (toursResult.error) {
      console.error('Error fetching merchant tours:', toursResult.error);
      return NextResponse.json(
        { error: 'Failed to fetch merchant tours', details: toursResult.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      merchant: {
        ...merchant,
        user_profiles: merchant.user_id ? profileMap.get(merchant.user_id) ?? null : null,
        tours: toursResult.data || [],
      },
      message: 'Merchant updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating merchant:', error);
    
    if (error instanceof AdminAuthFailure) {
      return adminAuthJsonResponse(error);
    }

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

/**
 * DELETE /api/admin/merchants/[id]
 * Delete merchant (admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: merchantId } = await params;
    await requireAdmin(req);

    const supabase = createServerClient();

    // Check if merchant has active bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('merchant_id', merchantId)
      .in('status', [...ACTIVE_BOOKING_STATUSES])
      .limit(1);

    if (bookings && bookings.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete merchant with active bookings' },
        { status: 400 }
      );
    }

    // Get user_id before deletion
    const { data: merchant } = await supabase
      .from('merchants')
      .select('user_id')
      .eq('id', merchantId)
      .single();

    // Delete merchant (cascade will handle related data)
    const { error } = await supabase
      .from('merchants')
      .delete()
      .eq('id', merchantId);

    if (error) {
      console.error('Error deleting merchant:', error);
      return NextResponse.json(
        { error: 'Failed to delete merchant', details: error.message },
        { status: 500 }
      );
    }

    // Update user role back to customer
    if (merchant?.user_id) {
      await supabase
        .from('user_profiles')
        .update({ role: 'customer' })
        .eq('id', merchant.user_id);
    }

    return NextResponse.json({ message: 'Merchant deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting merchant:', error);
    
    if (error instanceof AdminAuthFailure) {
      return adminAuthJsonResponse(error);
    }

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













