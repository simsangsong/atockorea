import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { loadUnifiedBookings } from '@/lib/ops/bookings/unified.server';
import { monthRangeOf, monthRange, weekRange } from '@/lib/ops/bookings/ranges';

export const dynamic = 'force-dynamic';

/**
 * §K B1 — 전 채널 예약 통합 통계.
 *
 * GET /api/admin/tour-ops/bookings-overview?view=week|month&month=YYYY-MM&axis=tour_date|created_at
 *
 * 🔴 응답은 **티어별로만** 숫자를 준다(B1-D1). 총합 필드를 두지 않는 이유는
 * 이 화면의 가치가 총합이 아니라 **틈**(자동 커밋되지 못한 수요)에 있기 때문이다.
 *
 * 🔴 `inbox` 필드가 B1-D6이다: 티어 ②③이 0일 때 그것이 "실패 없음"인지
 * "인박스가 아직 안 켜짐"인지 화면이 구분해 말할 수 있어야 한다. 후자를
 * 침묵시키면 오너는 인박스가 도는 줄 알고 OTA 메일을 놓친다.
 */

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();

    const view = req.nextUrl.searchParams.get('view') === 'month' ? 'month' : 'week';
    const axis = req.nextUrl.searchParams.get('axis') === 'created_at' ? 'created_at' : 'tour_date';
    const monthParam = req.nextUrl.searchParams.get('month');

    const range =
      view === 'month'
        ? (monthParam ? monthRangeOf(monthParam) : null) ?? monthRange()
        : weekRange();

    const data = await loadUnifiedBookings(supabase, range, { axis });
    return NextResponse.json({ view, axis, ...data }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('GET /api/admin/tour-ops/bookings-overview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
