import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Ops-dashboard room lifecycle control.
 *
 * PATCH /api/admin/tour-ops/rooms/[roomId] { status: 'active' | 'closed' }
 * Manual close/reopen. Closing also rotates the Broadcast topic (topic
 * derives from status), which kicks live subscribers — the same mechanism
 * the cancellation hook relies on.
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    await requireAdmin(req);
    const { roomId } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as { status?: string };
    if (body.status !== 'active' && body.status !== 'closed') {
      return NextResponse.json({ error: "status must be 'active' or 'closed'" }, { status: 400 });
    }

    const { data: room, error } = await supabase
      .from('tour_rooms')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', roomId)
      .select('id, booking_id, status')
      .single();
    if (error || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('PATCH /api/admin/tour-ops/rooms/[roomId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
