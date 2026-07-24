import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { buildBulkInvite, type BulkInviteDb } from '@/lib/ops/seating/bulkInvite';

export const dynamic = 'force-dynamic';

/**
 * 조인투어 룸 초대 링크 이메일 일괄 발송 — AtoC 통합 플랜 §4.2① + §5.1.
 *
 * POST /api/admin/tour-ops/manifest/bulk-invite
 *   Body: { tourId, tourDate }
 *   (tour_id, tour_date) 룸의 게스트 중 이메일이 있는 예약마다 **그 예약의 개인
 *   링크**를 발송한다(§K B0.3). 이메일이 없는 예약을 위해 claim 링크는 폴백으로
 *   계속 발급되지만 **발송되지는 않는다**(B0-D2) — 응답의 `url`이 그것이고,
 *   운영자가 차량 QR·수동 전달에 쓴다.
 *
 *   재발송은 폐기-후-재발급이다(B0-D1c): 예약당 살아있는 토큰이 항상 1개로
 *   수렴하고, 먼저 받은 링크는 무효화된다.
 *
 * 얇은 라우트: 인증 + 파라미터 검증만 하고 핵심은 buildBulkInvite(주입식 send/
 * supabase)에 위임한다 — 단위 테스트는 fake로 네트워크/DB 0.
 */

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const supabase = createServerClient();
    const body = await req.json().catch(() => ({}));

    const tourId = String(body?.tourId ?? '');
    const tourDate = String(body?.tourDate ?? '');
    if (!tourId || !/^\d{4}-\d{2}-\d{2}$/.test(tourDate)) {
      return NextResponse.json({ error: 'tourId and tourDate (YYYY-MM-DD) required' }, { status: 400 });
    }

    // 이메일 본문의 투어명(선택) — 없어도 발송은 진행.
    const { data: tour } = await supabase.from('tours').select('title').eq('id', tourId).maybeSingle();

    const outcome = await buildBulkInvite({
      supabase: supabase as unknown as BulkInviteDb,
      adminId: admin.id,
      tourId,
      tourDate,
      tourTitle: (tour as { title?: string | null } | null)?.title ?? null,
      send: sendEmail,
    });

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }
    return NextResponse.json(outcome.result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AdminAuthFailure) return adminAuthJsonResponse(error);
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('POST /api/admin/tour-ops/manifest/bulk-invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
