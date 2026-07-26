import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import {
  toAttachmentItem,
  toLinkItems,
  type DrawerKind,
  type DrawerMessageRow,
} from '@/lib/tour-room/drawer';

export const dynamic = 'force-dynamic';

/**
 * U4-D5 — the room drawer's media roundup (사진/파일/링크 모아보기).
 *
 * GET /api/tour-rooms/[bookingId]/media?kind=image|file|link&cursor=<ISO>
 *
 * Reads tour_room_messages through the same resolveRoomActor gate as the
 * messages route — customers, guides, drivers, admin all see exactly the room
 * they could already scroll. Newest first, keyset-paginated on created_at
 * (the chat is append-only, so created_at is a stable cursor).
 */
const PAGE = 30;
/** Link extraction over-fetches text rows since not every message has a URL. */
const LINK_SCAN_PAGE = 120;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const kindRaw = req.nextUrl.searchParams.get('kind');
    const kind = (['image', 'file', 'link'] as const).find((k) => k === kindRaw) as
      | DrawerKind
      | undefined;
    if (!kind) {
      return NextResponse.json({ error: 'kind must be image | file | link' }, { status: 400 });
    }
    const cursor = req.nextUrl.searchParams.get('cursor');

    const supabase = createServerClient();
    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const room = await ensureRoom(supabase, resolved.booking);

    if (kind === 'link') {
      // Plain-text rows that contain a URL. ilike keeps this index-friendly
      // enough at room scale (a day-tour room holds hundreds of rows, not
      // millions); extraction happens in pure code (lib/tour-room/drawer).
      let query = supabase
        .from('tour_room_messages')
        .select('id, created_at, sender_role, input_kind, source_text, metadata')
        .eq('room_id', room.id)
        .eq('input_kind', 'text')
        .or('source_text.ilike.%http://%,source_text.ilike.%https://%')
        .order('created_at', { ascending: false })
        .limit(LINK_SCAN_PAGE);
      if (cursor) query = query.lt('created_at', cursor);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as DrawerMessageRow[];
      const items = rows.flatMap(toLinkItems).slice(0, PAGE);
      const lastRow = rows[rows.length - 1];
      const nextCursor = rows.length === LINK_SCAN_PAGE && lastRow ? lastRow.created_at : null;
      return NextResponse.json({ kind, items, nextCursor });
    }

    let query = supabase
      .from('tour_room_messages')
      .select('id, created_at, sender_role, input_kind, source_text, metadata')
      .eq('room_id', room.id)
      .eq('input_kind', kind)
      .order('created_at', { ascending: false })
      .limit(PAGE);
    if (cursor) query = query.lt('created_at', cursor);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as DrawerMessageRow[];
    const items = rows.map(toAttachmentItem).filter(Boolean);
    const lastRow = rows[rows.length - 1];
    const nextCursor = rows.length === PAGE && lastRow ? lastRow.created_at : null;
    return NextResponse.json({ kind, items, nextCursor });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/media error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
