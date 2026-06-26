import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/merchants/[id]/restore — U-6 undo for a soft-deleted merchant.
 * Clears deleted_at and re-promotes the linked user to 'merchant' (reversing the
 * DELETE soft-delete). Admin only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: merchantId } = await params;
    await requireAdmin(req);

    const supabase = createServerClient();

    const { data: merchant } = await supabase
      .from('merchants')
      .select('user_id')
      .eq('id', merchantId)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('merchants')
      .update({ deleted_at: null })
      .eq('id', merchantId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to restore merchant', details: error.message },
        { status: 500 }
      );
    }

    // Re-promote the linked user (the soft-delete demoted them to customer).
    if (merchant.user_id) {
      await supabase
        .from('user_profiles')
        .update({ role: 'merchant' })
        .eq('id', merchant.user_id);
    }

    return NextResponse.json({ message: 'Merchant restored' });
  } catch (error: any) {
    if (error instanceof AdminAuthFailure) {
      return adminAuthJsonResponse(error);
    }
    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('Error restoring merchant:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
