import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@/lib/supabase';

/**
 * PATCH /api/notifications/[id]
 * Update notification (mark as read, delete)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const notificationId = params.id;
    const body = await req.json();
    const { isRead, isDeleted } = body;

    // Verify notification belongs to user
    const { data: notification } = await supabase
      .from('notifications')
      .select('id, user_id')
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .single();

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: any = {};
    if (isRead !== undefined) {
      updates.is_read = isRead;
      if (isRead) {
        updates.read_at = new Date().toISOString();
      } else {
        updates.read_at = null;
      }
    }
    if (isDeleted !== undefined) {
      updates.is_deleted = isDeleted;
    }

    const { data: updatedNotification, error } = await supabase
      .from('notifications')
      .update(updates)
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating notification:', error);
      return NextResponse.json(
        { error: 'Failed to update notification', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ notification: updatedNotification });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/mark-all-read
 * Mark all notifications as read
 */
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('is_deleted', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return NextResponse.json(
        { error: 'Failed to mark all as read', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}










