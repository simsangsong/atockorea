import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { kstToday } from '@/lib/ops/guides/availability';
import { isScheduleAxis, matrixToAoa } from '@/lib/ops/schedule/matrix';
import { loadSchedule, serializeMatrix } from '@/lib/ops/schedule/load';
import { buildXlsx, xlsxDownloadHeaders } from '@/lib/ops/export/xlsx';

export const dynamic = 'force-dynamic';

/**
 * 가이드 근무 · 차량 배차 월 달력 (관제 W4).
 *
 *   GET /api/admin/tour-ops/schedule?period=YYYY-MM&axis=guide|vehicle[&format=xlsx]
 *
 * 축이 둘이지만 라우트는 하나다 — 응답 모양이 같기 때문이고, 나누면 화면도
 * 나뉘어 결국 달력 두 벌을 유지보수하게 된다(설계안 §1-3).
 *
 * 읽기 전용이다. 드래그 배정은 v2 — 모바일에서 드래그는 오조작 위험이 크고,
 * 배정은 충돌 판정을 거쳐야 하는 쓰기다(W2).
 */

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const sp = req.nextUrl.searchParams;
    const period = sp.get('period') || kstToday().slice(0, 7);
    const axis = sp.get('axis') ?? 'guide';
    const format = sp.get('format');

    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'period=YYYY-MM 가 필요합니다' }, { status: 400 });
    }
    if (!isScheduleAxis(axis)) {
      return NextResponse.json({ error: 'axis=guide|vehicle 가 필요합니다' }, { status: 400 });
    }

    const supabase = createServerClient();
    const loaded = await loadSchedule(supabase, axis, period, kstToday());

    if (format === 'xlsx') {
      const notes: Array<Array<string | number>> = [
        ['범례', '설명'],
        ['숫자', '그날 배정/배차 건수'],
        ['⚠', '시간 겹침 · 하루 2건 이상 · 휴무일 배정 · 정원 초과 중 하나'],
        ['휴무', '가이드 휴무일(배정 없음)'],
      ];
      if (loaded.truncated) {
        notes.push([], ['⚠ 주의', '조회 상한에 닿아 아래 표는 최소값입니다.']);
      }
      if (loaded.undatedCount) {
        notes.push([], ['⚠ 제외됨', `날짜를 확인할 수 없는 배차 ${loaded.undatedCount}건은 표에 없습니다.`]);
      }
      const file = buildXlsx([
        { name: axis === 'guide' ? '가이드 근무' : '차량 배차', rows: matrixToAoa(loaded.matrix), headerRowIndex: 0 },
        { name: '범례', rows: notes, headerRowIndex: 0 },
      ]);
      return new NextResponse(new Uint8Array(file), {
        headers: xlsxDownloadHeaders(`atockorea-schedule-${axis}-${period}.xlsx`),
      });
    }

    return NextResponse.json({
      ...serializeMatrix(loaded.matrix),
      truncated: loaded.truncated,
      undatedCount: loaded.undatedCount ?? 0,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/tour-ops/schedule]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
