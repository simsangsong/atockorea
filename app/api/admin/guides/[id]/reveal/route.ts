import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { GUIDES_TENANT_ID, logPiiAccess } from '@/lib/ops/guides/registry';
import { decryptGuidePii, GuidePiiKeyMissingError } from '@/lib/ops/guides/pii';

export const dynamic = 'force-dynamic';

/**
 * PII 원문 열람 (바인딩 결정 2의 유일한 예외 경로).
 *
 *   POST /api/admin/guides/[id]/reveal   {field: 'rrn'|'bank_account', purpose: string}
 *
 * 규칙:
 *   1. 목적(purpose)이 없으면 열지 않는다. "왜 열었는지"가 없는 열람 기록은 감사
 *      기록이 아니라 그냥 로그다.
 *   2. 감사로그 기입이 먼저다. insert가 실패하면 복호화도 하지 않는다(fail-closed)
 *      — 흔적 없는 열람이 가능한 순간 이 라우트의 존재 의의가 사라진다.
 *   3. GET이 아니라 POST인 이유: 열람은 부수효과(감사로그 1행)를 남기는 행위다.
 *      링크·프리페치·브라우저 캐시로 우연히 일어나선 안 된다.
 */

const FIELDS = {
  rrn: { column: 'rrn_enc', label: '주민등록번호' },
  bank_account: { column: 'bank_account_enc', label: '계좌번호' },
} as const;

type RevealField = keyof typeof FIELDS;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const field = typeof body.field === 'string' ? body.field : '';
    if (!(field in FIELDS)) {
      return NextResponse.json({ error: 'field는 rrn 또는 bank_account 여야 합니다' }, { status: 400 });
    }
    const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : '';
    if (purpose.length < 2) {
      return NextResponse.json(
        { error: '열람 목적을 입력해 주세요 (예: 2026-07 지급명세서 작성). 기록으로 남습니다.' },
        { status: 400 },
      );
    }

    const spec = FIELDS[field as RevealField];
    const supabase = createServerClient();

    // 설계 결정 2: 로그가 먼저. 기입 실패 = 열람 불가.
    const logged = await logPiiAccess(supabase, {
      guideId: id,
      field: field as RevealField,
      actor: admin.email || admin.id || null,
      purpose,
    });
    if (!logged) {
      return NextResponse.json(
        { error: '열람 기록을 남기지 못해 원문을 열지 않았습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 503 },
      );
    }

    const { data, error } = await supabase
      .from('ops_guides')
      .select(`id, name, ${spec.column}`)
      .eq('id', id)
      .eq('tenant_id', GUIDES_TENANT_ID)
      .maybeSingle();
    if (error) {
      console.error('[POST /api/admin/guides/:id/reveal]', error);
      return NextResponse.json({ error: '가이드를 불러오지 못했습니다', details: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: '가이드를 찾을 수 없습니다' }, { status: 404 });

    const envelope = (data as unknown as Record<string, unknown>)[spec.column];
    if (typeof envelope !== 'string' || !envelope) {
      return NextResponse.json({ error: `등록된 ${spec.label}가 없습니다` }, { status: 404 });
    }

    let value: string | null;
    try {
      value = decryptGuidePii(envelope);
    } catch (err) {
      if (err instanceof GuidePiiKeyMissingError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
      }
      // 봉투 변조 또는 키 교체 후 복호화 불가 — 조용히 넘기지 않는다.
      console.error('[POST /api/admin/guides/:id/reveal] decrypt failed', err);
      return NextResponse.json(
        { error: `${spec.label}를 복호화하지 못했습니다. 암호화 키가 바뀌었을 수 있습니다.` },
        { status: 500 },
      );
    }

    return NextResponse.json({ field, value, logged: true });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/guides/:id/reveal]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
