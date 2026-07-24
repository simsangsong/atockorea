import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { loadUnifiedBookings } from '@/lib/ops/bookings/unified.server';
import { monthRangeOf, monthRange, weekRange } from '@/lib/ops/bookings/ranges';
import { unifiedCsv, unifiedCsvFilename } from '@/lib/ops/bookings/csv';

export const dynamic = 'force-dynamic';

/**
 * §K B1 — 전 채널 예약 통합 통계.
 *
 * GET /api/admin/tour-ops/bookings-overview?view=week|month&month=YYYY-MM&axis=tour_date|created_at
 *   &format=csv → 엑셀용 CSV(UTF-8 BOM). 화면과 같은 리졸버를 쓴다(B1.6).
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

    // §K B1.6 — 엑셀 열람용 CSV(UTF-8 BOM). 화면과 **같은 리졸버**를 쓴다:
    // 내보내기가 자기 쿼리를 갖는 순간 화면과 파일의 숫자가 어긋난다.
    if (req.nextUrl.searchParams.get('format') === 'csv') {
      return new NextResponse(unifiedCsv(data.records, range), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${unifiedCsvFilename(range)}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ view, axis, ...data }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('GET /api/admin/tour-ops/bookings-overview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
