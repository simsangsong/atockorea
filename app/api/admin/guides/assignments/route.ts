import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { GUIDES_TENANT_ID } from '@/lib/ops/guides/registry';
import {
  ASSIGNMENT_SELECT_COLUMNS,
  buildAssignmentWrite,
  isValidPeriod,
  isValidYmd,
  periodDateBounds,
  type AssignmentRow,
} from '@/lib/ops/tax/assignments';
import { blockCodeFromDbError, blockMessage, detectAssignmentConflicts } from '@/lib/ops/guides/conflicts';
import { loadConflictContext, normalizeTime } from '@/lib/ops/guides/conflictContext';

export const dynamic = 'force-dynamic';

/**
 * 가이드 × 투어 배정 원장 (§6.9).
 *
 *   GET  /api/admin/guides/assignments?period=YYYY-MM | ?date=YYYY-MM-DD
 *                                     [&guideId=][&status=worked|planned|cancelled|all]
 *   POST /api/admin/guides/assignments
 *
 * 이 원장이 없으면 월 정산 배치가 돌 데이터가 없다 — tour_rooms에는 guide_id가
 * 없고 가이드는 초대 링크로만 다뤄졌기 때문이다. **status='worked'인 행만 정산
 * 대상**이므로 "일했다" 표시는 사람이 명시적으로 해야 한다.
 *
 * 응답에 가이드 이름을 붙이지만 PII(주민번호·계좌)는 조회조차 하지 않는다 —
 * 배정 화면이 그 정보를 쓸 일이 없다.
 */

/** 목록에 붙일 가이드 이름 — PII 아닌 최소 필드만. */
async function guideNames(
  supabase: ReturnType<typeof createServerClient>,
  guideIds: string[],
): Promise<Map<string, { name: string; guideType: string | null }>> {
  const map = new Map<string, { name: string; guideType: string | null }>();
  if (guideIds.length === 0) return map;
  const { data } = await supabase
    .from('ops_guides')
    .select('id, name, guide_type')
    .in('id', [...new Set(guideIds)]);
  for (const row of (data ?? []) as Array<{ id: string; name: string; guide_type: string | null }>) {
    map.set(row.id, { name: row.name, guideType: row.guide_type });
  }
  return map;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const sp = req.nextUrl.searchParams;
    const period = sp.get('period');
    const date = sp.get('date');
    const guideId = sp.get('guideId')?.trim();
    const status = sp.get('status') ?? 'all';

    const supabase = createServerClient();
    let query = supabase
      .from('ops_guide_assignments')
      .select(ASSIGNMENT_SELECT_COLUMNS)
      .eq('tenant_id', GUIDES_TENANT_ID)
      .order('tour_date', { ascending: true })
      .limit(1000);

    if (date) {
      if (!isValidYmd(date)) {
        return NextResponse.json({ error: 'date=YYYY-MM-DD 가 필요합니다' }, { status: 400 });
      }
      query = query.eq('tour_date', date);
    } else if (period) {
      if (!isValidPeriod(period)) {
        return NextResponse.json({ error: 'period=YYYY-MM 가 필요합니다' }, { status: 400 });
      }
      const { first, last } = periodDateBounds(period);
      query = query.gte('tour_date', first).lte('tour_date', last);
    }
    if (guideId) query = query.eq('guide_id', guideId);
    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/admin/guides/assignments]', error);
      return NextResponse.json(
        { error: '배정 목록을 불러오지 못했습니다', details: error.message },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as unknown as AssignmentRow[];
    const names = await guideNames(supabase, rows.map((r) => r.guide_id));

    return NextResponse.json({
      data: rows.map((r) => ({
        ...r,
        guide_name: names.get(r.guide_id)?.name ?? null,
        guide_type: names.get(r.guide_id)?.guideType ?? null,
      })),
      count: rows.length,
      workedCount: rows.filter((r) => r.status === 'worked').length,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/guides/assignments]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

/**
 * W2 — 배정 저장(또는 `?dryRun=1` 이면 판정만).
 *
 * 응답 계약:
 *   201 { data, warnings }        저장됨. 경고는 사람이 봐야 하는 사실.
 *   409 { blocked, warnings, ... } 저장 거부. `overridable`이 true인 항목은
 *                                  `conflictOverride` + `conflictOverrideReason`으로 통과 가능.
 *   200 { dryRun:true, blocked, warnings } 판정만(저장 없음).
 *
 * 검증이 두 겹인 이유: 여기의 판정은 **경고까지 만들 수 있고** DB 트리거는
 * **동시 편집에서도 뚫리지 않는다.** 둘 중 하나만으로는 부족하다.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const built = buildAssignmentWrite(body, 'create');
    if (!built.ok) {
      return NextResponse.json({ error: built.message, code: built.code }, { status: 400 });
    }

    const supabase = createServerClient();
    const override = body.conflictOverride === true || body.conflict_override === true;
    const overrideReason =
      typeof body.conflictOverrideReason === 'string'
        ? body.conflictOverrideReason.trim()
        : typeof body.conflict_override_reason === 'string'
          ? (body.conflict_override_reason as string).trim()
          : '';

    if (override && !overrideReason) {
      // DB CHECK도 막지만, 사람에게는 "왜 막혔는지"가 필요하다.
      return NextResponse.json(
        { error: '충돌을 무시하고 배정하려면 사유를 적어 주세요.', code: 'override_reason_required' },
        { status: 400 },
      );
    }

    const candidate = {
      guideId: built.fields.guide_id as string,
      tourDate: built.fields.tour_date as string,
      tourType: built.fields.tour_type as string,
      bookingId: (built.fields.booking_id as string | null) ?? null,
      startTime: normalizeTime(body.startTime ?? body.start_time),
      endTime: normalizeTime(body.endTime ?? body.end_time),
      status: (built.fields.status as string) ?? 'planned',
      conflictOverride: override,
    };

    const { context, resolvedTimes } = await loadConflictContext(supabase, candidate, {
      amountKrw: (built.fields.amount_krw as number | null) ?? null,
    });
    const verdict = detectAssignmentConflicts({ ...candidate, ...resolvedTimes }, context);

    if (req.nextUrl.searchParams.get('dryRun') === '1') {
      return NextResponse.json({ dryRun: true, ...verdict, resolvedTimes });
    }
    if (verdict.blocked.length > 0) {
      return NextResponse.json({ error: verdict.blocked[0].message, ...verdict }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('ops_guide_assignments')
      .insert({
        tenant_id: GUIDES_TENANT_ID,
        ...built.fields,
        start_time: resolvedTimes.startTime,
        end_time: resolvedTimes.endTime,
        assigned_by: admin.email,
        assigned_at: new Date().toISOString(),
        conflict_override: override,
        conflict_override_reason: override ? overrideReason : null,
      })
      .select(ASSIGNMENT_SELECT_COLUMNS)
      .single();

    if (error) {
      // DB가 최종 방어선에서 잡아낸 경우 — 위 판정과 저장 사이의 동시 편집.
      const code = blockCodeFromDbError(error.message);
      if (code) {
        return NextResponse.json(
          {
            error: blockMessage(code),
            blocked: [{ code, message: blockMessage(code), overridable: code !== 'guide_inactive' && code !== 'duplicate_slot' }],
            warnings: verdict.warnings,
            source: 'db',
          },
          { status: 409 },
        );
      }
      console.error('[POST /api/admin/guides/assignments]', error);
      return NextResponse.json({ error: '배정을 저장하지 못했습니다', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, warnings: verdict.warnings }, { status: 201 });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/guides/assignments]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
