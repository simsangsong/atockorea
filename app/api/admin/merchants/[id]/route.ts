import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

/**
 * GET /api/admin/merchants/[id]
 * Get a single merchant (admin only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(req);
    
    const supabase = createServerClient();
    const merchantId = params.id;

    const { data: merchant, error } = await supabase
      .from('merchants')
      .select(`
        *,
        user_profiles (
          id,
          full_name,
          email,
          avatar_url
        ),
        tours (
          id,
          title,
          city,
          price,
          is_active,
          created_at
        )
      `)
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

    return NextResponse.json({ merchant });
  } catch (error: any) {
    console.error('Error fetching merchant:', error);
    
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
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(req);
    
    const supabase = createServerClient();
    const merchantId = params.id;
    const body = await req.json();

    const {
      status,
      isVerified,
      companyName,
      contactPerson,
      contactEmail,
      contactPhone,
    } = body;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (isVerified !== undefined) updateData.is_verified = isVerified;
    if (companyName !== undefined) updateData.company_name = companyName;
    if (contactPerson !== undefined) updateData.contact_person = contactPerson;
    if (contactEmail !== undefined) updateData.contact_email = contactEmail;
    if (contactPhone !== undefined) updateData.contact_phone = contactPhone;

    const { data: merchant, error } = await supabase
      .from('merchants')
      .update(updateData)
      .eq('id', merchantId)
      .select(`
        *,
        user_profiles (
          id,
          full_name,
          email
        )
      `)
      .single();

    if (error) {
      console.error('Error updating merchant:', error);
      return NextResponse.json(
        { error: 'Failed to update merchant', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ merchant, message: 'Merchant updated successfully' });
  } catch (error: any) {
    console.error('Error updating merchant:', error);
    
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
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(req);
    
    const supabase = createServerClient();
    const merchantId = params.id;

    // Check if merchant has active bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('merchant_id', merchantId)
      .in('status', ['pending', 'confirmed'])
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










