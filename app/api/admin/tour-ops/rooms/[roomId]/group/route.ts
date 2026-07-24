import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { getOpsRoom } from '@/lib/ops/seating/access';
import { ensureTourGroup } from '@/lib/ops/seating/group';

export const dynamic = 'force-dynamic';

/**
 * §K B2.4 — 그날 그 그룹만의 정원 예외.
 *
 * PATCH /api/admin/tour-ops/rooms/[roomId]/group  { capacity: number | null }
 *
 * 왜 필요한가: B2-D4의 실효 정원은 **min(상품 정원, 배정 차량 좌석수)**다.
 * 그래서 상품 캡이 병목이면 **2호차를 붙여도 정원이 그대로**이고, 운영자는
 * "차를 붙였는데 왜 아직 초과지?"를 만난다. 그때 올려야 하는 것이 이 값이다.
 *
 * 🔴 B2-D3 — 그룹 값은 **운영자가 명시적으로 넣었을 때만** 존재한다. 비우면
 * (null) 상품값을 다시 따른다. 자동으로 채우지 않는 이유: 한 번 자동으로
 * 올라간 정원은 아무도 내리지 않고, 그러면 캡이 사실상 사라진다.
 *
 * 🔴 B2-D1 — 이 값은 판매 재고가 아니다. 올려도 사이트에는 아무 일도
 * 일어나지 않는다(B2.5 회귀가 그걸 감시한다).
 */

const MAX_GROUP_CAPACITY = 200;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    await requireAdmin(req);
    const { roomId } = await params;
    const supabase = createServerClient();

    const room = await getOpsRoom(supabase, roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    if (!room.tour_id || !room.tour_date) {
      return NextResponse.json({ error: 'Room has no tour or date — no group to cap' }, { status: 409 });
    }

    const body = (await req.json().catch(() => ({}))) as { capacity?: unknown };
    const raw = body.capacity;

    let capacity: number | null;
    if (raw === null) {
      capacity = null; // 상품값으로 되돌린다
    } else if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0 && raw <= MAX_GROUP_CAPACITY) {
      capacity = Math.floor(raw);
    } else {
      return NextResponse.json(
        { error: `capacity must be null or an integer between 1 and ${MAX_GROUP_CAPACITY}` },
        { status: 400 },
      );
    }

    // 그룹은 파생 생성이다(B0-D4) — 없으면 여기서 만들어진다.
    const group = await ensureTourGroup(supabase as never, {
      tour_id: room.tour_id,
      tour_date: room.tour_date,
    });
    if (!group) return NextResponse.json({ error: 'Could not resolve the tour group' }, { status: 409 });

    const { error } = await supabase
      .from('ops_tour_groups')
      .update({ capacity, updated_at: new Date().toISOString() })
      .eq('id', group.id);
    if (error) throw error;

    return NextResponse.json({ groupId: group.id, capacity }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('PATCH /api/admin/tour-ops/rooms/[roomId]/group error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
