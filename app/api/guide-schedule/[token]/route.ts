import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { GUIDES_TENANT_ID } from '@/lib/ops/guides/registry';
import { MAX_RANGE_DAYS, expandDateRange, isValidYmd, kstToday, monthBounds } from '@/lib/ops/guides/availability';
import { verifyGuideScheduleToken } from '@/lib/ops/guides/selfToken';

export const dynamic = 'force-dynamic';

/**
 * 가이드 셀프 스케줄 API — `/g/schedule/[token]` 화면의 백엔드 (§11.F).
 *
 *   GET    /api/guide-schedule/[token]?year=&month=   내 휴무 달력
 *   POST   /api/guide-schedule/[token]  {date} | {from,to}   내 휴무 등록
 *   DELETE /api/guide-schedule/[token]?date=                 내 휴무 해제
 *
 * 권한의 전부가 토큰이다. 그래서 이 파일에는 **guideId를 요청 본문에서 읽는 코드가
 * 한 줄도 없다** — 언제나 검증된 페이로드의 guideId만 쓴다. 남의 가이드 id를 body에
 * 실어 보내는 공격 경로 자체가 존재하지 않는다.
 *
 * 노출 범위도 최소다: 이름과 자기 휴무 날짜뿐. 연락처·주민번호·계좌·단가·다른
 * 가이드의 존재는 이 라우트로 절대 나가지 않는다.
 *
 * 지난 날짜는 수정할 수 없다 — 이미 지나간 날의 휴무를 소급해 바꾸면 정산 근거가
 * 흔들린다(과거 정정은 관리자 몫).
 */

function authorize(token: string) {
  const payload = verifyGuideScheduleToken(token);
  if (!payload) return null;
  return payload;
}

function unauthorized() {
  return NextResponse.json(
    { error: '링크가 만료되었거나 올바르지 않습니다. 담당자에게 새 링크를 요청해 주세요.' },
    { status: 401 },
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const payload = authorize(token);
    if (!payload) return unauthorized();

    const sp = req.nextUrl.searchParams;
    const today = kstToday();
    const yearRaw = Number(sp.get('year'));
    const monthRaw = Number(sp.get('month'));
    const [ty, tm] = today.split('-').map(Number);
    const year = Number.isInteger(yearRaw) && yearRaw > 2000 ? yearRaw : ty;
    const month = Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : tm;
    const { first, last } = monthBounds(year, month);

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('ops_guide_unavailable_dates')
      .select('date, reason, source')
      .eq('tenant_id', GUIDES_TENANT_ID)
      .eq('guide_id', payload.guideId)
      .gte('date', first)
      .lte('date', last)
      .order('date', { ascending: true });
    if (error) {
      console.error('[GET /api/guide-schedule]', error);
      return NextResponse.json({ error: '휴무를 불러오지 못했습니다' }, { status: 500 });
    }

    return NextResponse.json({
      guide: { name: payload.name },
      year,
      month,
      today,
      dates: (data ?? []) as Array<{ date: string; reason: string | null; source: string }>,
    });
  } catch (e) {
    console.error('[GET /api/guide-schedule]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const payload = authorize(token);
    if (!payload) return unauthorized();

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const from = typeof body.from === 'string' ? body.from : typeof body.date === 'string' ? body.date : '';
    const to = typeof body.to === 'string' ? body.to : null;
    const dates = expandDateRange(from, to);
    if (dates.length === 0) {
      return NextResponse.json(
        { error: `날짜를 확인해 주세요 (최대 ${MAX_RANGE_DAYS}일까지 한 번에 등록할 수 있어요)` },
        { status: 400 },
      );
    }

    const today = kstToday();
    if (dates.some((d) => d < today)) {
      return NextResponse.json(
        { error: '지난 날짜는 바꿀 수 없어요. 담당자에게 알려주세요.' },
        { status: 400 },
      );
    }

    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 200) : null;

    const supabase = createServerClient();
    const { error } = await supabase.from('ops_guide_unavailable_dates').upsert(
      dates.map((date) => ({
        tenant_id: GUIDES_TENANT_ID,
        guide_id: payload.guideId,
        date,
        reason,
        source: 'self',
      })),
      { onConflict: 'guide_id,date' },
    );
    if (error) {
      console.error('[POST /api/guide-schedule]', error);
      return NextResponse.json({ error: '휴무를 등록하지 못했습니다' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, count: dates.length, dates }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/guide-schedule]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const payload = authorize(token);
    if (!payload) return unauthorized();

    const date = req.nextUrl.searchParams.get('date') ?? '';
    if (!isValidYmd(date)) {
      return NextResponse.json({ error: '해제할 날짜를 지정해 주세요' }, { status: 400 });
    }
    if (date < kstToday()) {
      return NextResponse.json({ error: '지난 날짜는 바꿀 수 없어요. 담당자에게 알려주세요.' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('ops_guide_unavailable_dates')
      .delete()
      .eq('tenant_id', GUIDES_TENANT_ID)
      .eq('guide_id', payload.guideId)
      .eq('date', date);
    if (error) {
      console.error('[DELETE /api/guide-schedule]', error);
      return NextResponse.json({ error: '휴무를 해제하지 못했습니다' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, date });
  } catch (e) {
    console.error('[DELETE /api/guide-schedule]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
