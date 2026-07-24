import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { hashToken } from '@/lib/tour-room/token';
import { signRoomClaimToken } from '@/lib/ops/seating/claimToken';
import { getOpsRoom } from '@/lib/ops/seating/access';

export const dynamic = 'force-dynamic';

/**
 * 룸 초대(claim) 링크 발급 — AtoC 통합 플랜 §5.1 (조인투어 링크 2계층의 1층).
 *
 * POST /api/admin/tour-ops/rooms/[roomId]/claim-link
 *   조인투어 게스트에게 일괄 발송할 룸 초대 링크를 발급한다. 이 링크로 들어온
 *   게스트가 명단에서 본인을 선택(claim)하면 그 순간 개인 토큰이 발급된다
 *   (§5.2). 링크 스코프 = room (tour_id + tour_date), 만료 = 투어일+1.
 *   원장은 tour_room_invites role='room_claim' (claim 라우트가 revoked_at 검사).
 *
 * 좌석 선택은 이 roomId를 앵커로 쓰므로 — 차량이 붙는 룸에 발급해야 한다.
 * 기존 링크를 폐기하지 않는다(links 라우트와 동일: 재발급은 additive).
 */

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com').replace(/\/$/, '');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const admin = await requireAdmin(req);
    const { roomId } = await params;
    const supabase = createServerClient();

    const room = await getOpsRoom(supabase, roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    if (!room.tour_id || !room.tour_date) {
      return NextResponse.json({ error: 'Room has no tour scope' }, { status: 409 });
    }

    const { token, payload } = signRoomClaimToken({
      roomId: room.id,
      tourId: room.tour_id,
      tourDate: room.tour_date,
    });
    const expiresAt = new Date(payload.exp * 1000).toISOString();

    const { error: ledgerError } = await supabase.from('tour_room_invites').insert({
      role: 'room_claim',
      token_hash: hashToken(token),
      sent_via: 'ops-link',
      created_by: admin.id,
      tour_id: room.tour_id,
      tour_date: room.tour_date,
      display_name: '룸 초대',
      expires_at: expiresAt,
    });
    if (ledgerError) throw ledgerError;

    const url = `${appUrl()}/tour-mode/join/${encodeURIComponent(token)}`;
    let qrDataUrl: string | null = null;
    try {
      qrDataUrl = await QRCode.toDataURL(url, { width: 360, margin: 1 });
    } catch {
      qrDataUrl = null;
    }

    return NextResponse.json({ url, expires_at: expiresAt, qr_data_url: qrDataUrl }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('POST /api/admin/tour-ops/rooms/[roomId]/claim-link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
