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
 *   (tour_id, tour_date) 룸의 모든 게스트(이메일 있는)에게 룸 초대 링크를 한 번에
 *   이메일 발송한다. 링크 발급은 claim-link 라우트와 동일(room_claim 원장), 발송당
 *   게스트 마커 원장은 일일 보고서 §4 연락현황이 이메일 연락으로 집계한다.
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
