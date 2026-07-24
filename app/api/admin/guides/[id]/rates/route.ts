import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { GUIDES_TENANT_ID } from '@/lib/ops/guides/registry';
import { isValidYmd, kstToday } from '@/lib/ops/guides/availability';
import { currentRateTable, type GuideRateRow } from '@/lib/ops/guides/rates';

export const dynamic = 'force-dynamic';

/**
 * 가이드 단가 (§6.9).
 *
 *   GET  /api/admin/guides/[id]/rates?on=YYYY-MM-DD
 *        → 이 가이드에 적용되는 행들(본인 오버라이드 + 테넌트 기본단가) + `on`
 *          시점의 유효 단가표(resolved).
 *   POST /api/admin/guides/[id]/rates  {tourType, amountKrw, effectiveFrom?, note?}
 *
 * `[id]`가 리터럴 `default`이면 테넌트 기본단가(guide_id IS NULL)를 다룬다 —
 * 기본단가에 별도 라우트를 파는 대신 같은 문법을 쓴다.
 *
 * 단가는 수정하지 않고 쌓는다(설계 결정 4): 새 effective_from 행을 넣으면 그날부터
 * 새 단가가 적용되고, 지난 달 정산을 다시 돌려도 그때의 단가가 그대로 나온다.
 */

const DEFAULT_KEY = 'default';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const isDefault = id === DEFAULT_KEY;

    const onParam = req.nextUrl.searchParams.get('on');
    const on = onParam && isValidYmd(onParam) ? onParam : kstToday();

    const supabase = createServerClient();
    let query = supabase
      .from('ops_guide_rates')
      .select('id, guide_id, tour_type, amount_krw, effective_from, note, created_at')
      .eq('tenant_id', GUIDES_TENANT_ID)
      .order('tour_type', { ascending: true })
      .order('effective_from', { ascending: false })
      .limit(500);
    // 가이드별 화면은 "내 오버라이드 + 기본단가"를 함께 봐야 우선순위가 읽힌다.
    query = isDefault ? query.is('guide_id', null) : query.or(`guide_id.eq.${id},guide_id.is.null`);

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/admin/guides/:id/rates]', error);
      return NextResponse.json({ error: '단가를 불러오지 못했습니다', details: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as GuideRateRow[];
    const resolved = currentRateTable(rows, { guideId: isDefault ? '' : id, onDate: on });
    return NextResponse.json({ data: rows, resolved, on });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/guides/:id/rates]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const tourType = typeof body.tourType === 'string' ? body.tourType.trim() : '';
    if (!tourType) return NextResponse.json({ error: '투어 타입을 입력해 주세요' }, { status: 400 });

    const amountRaw = typeof body.amountKrw === 'number' ? body.amountKrw : Number(body.amountKrw);
    if (!Number.isFinite(amountRaw) || amountRaw < 0) {
      return NextResponse.json({ error: '단가는 0원 이상의 숫자여야 합니다' }, { status: 400 });
    }
    const amountKrw = Math.round(amountRaw);

    const effectiveFrom =
      typeof body.effectiveFrom === 'string' && isValidYmd(body.effectiveFrom)
        ? body.effectiveFrom
        : kstToday();
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

    const supabase = createServerClient();
    const guideId = id === DEFAULT_KEY ? null : id;
    const SELECT = 'id, guide_id, tour_type, amount_krw, effective_from, note, created_at';

    // upsert를 쓰지 않는 이유: 기본단가는 guide_id가 NULL이라 UNIQUE 제약이 잡지
    // 못하고(부분 유니크 인덱스가 따로 있다) onConflict 컬럼 목록과도 맞지 않는다.
    // 같은 날 같은 타입을 두 번 적는 건 "고쳐 적은 것"이므로 명시적으로 찾아 갱신한다.
    let existing = supabase
      .from('ops_guide_rates')
      .select('id')
      .eq('tenant_id', GUIDES_TENANT_ID)
      .eq('tour_type', tourType)
      .eq('effective_from', effectiveFrom);
    existing = guideId === null ? existing.is('guide_id', null) : existing.eq('guide_id', guideId);
    const { data: prior } = await existing.maybeSingle();

    const priorId = (prior as { id?: string } | null)?.id;
    const { data, error } = priorId
      ? await supabase
          .from('ops_guide_rates')
          .update({ amount_krw: amountKrw, note })
          .eq('id', priorId)
          .select(SELECT)
          .single()
      : await supabase
          .from('ops_guide_rates')
          .insert({
            tenant_id: GUIDES_TENANT_ID,
            guide_id: guideId,
            tour_type: tourType,
            amount_krw: amountKrw,
            effective_from: effectiveFrom,
            note,
          })
          .select(SELECT)
          .single();
    if (error) {
      console.error('[POST /api/admin/guides/:id/rates]', error);
      return NextResponse.json({ error: '단가를 저장하지 못했습니다', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data, replaced: Boolean(priorId) }, { status: 201 });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/guides/:id/rates]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
