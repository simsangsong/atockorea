import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireMerchant } from '@/lib/auth';

/**
 * POST /api/auth/merchant/change-password
 * Change password (required on first login)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireMerchant(req);
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify current password by attempting to sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword,
        user_metadata: {
          needs_password_change: false,
          password_changed_at: new Date().toISOString(),
        },
      }
    );

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update password: ${updateError.message}` },
        { status: 400 }
      );
    }

    // Create audit log (ignore errors if table doesn't exist)
    try {
      await supabase
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action: 'password_changed',
          resource_type: 'user',
          resource_id: user.id,
        });
    } catch (error) {
      // Ignore audit log errors
      console.warn('Failed to create audit log:', error);
    }

    return NextResponse.json({
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

