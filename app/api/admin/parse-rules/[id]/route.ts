import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { canPromoteToActive } from '@/lib/ops/parse/rule-governance';

export const dynamic = 'force-dynamic';

/**
 * DE5 — 규칙 상태 전이. rule-governance.ts 주석이 말하는 "the status route"가
 * 바로 이것이다. 그 주석은 있었지만 라우트는 없었다.
 *
 * PATCH { action: 'promote' | 'retire' | 'shadow', promotion_reason?, validated_fixture? }
 *
 * 활성화는 Hard Rule #20 "No silent active rule"을 따른다 — 통계 임계를 넘거나
 * 승급 사유+증거가 있어야 한다. DB CHECK(parse_rules_active_governed)가 하한이고,
 * 여기서 먼저 걸러 제약 위반 대신 읽을 수 있는 이유를 돌려준다.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      promotion_reason?: string;
      validated_fixture?: string;
    };
    const action = body.action;
    if (action !== 'promote' && action !== 'retire' && action !== 'shadow') {
      return NextResponse.json({ error: "action must be 'promote' | 'retire' | 'shadow'" }, { status: 400 });
    }

    const { data: rule } = await supabase
      .from('ops_parse_rules')
      .select('id, match_count, success_count, promotion_reason, validated_fixture, promoted_by, status')
      .eq('id', id)
      .maybeSingle();
    if (!rule) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });

    if (action === 'retire') {
      const { error } = await supabase
        .from('ops_parse_rules')
        .update({ status: 'retired', retired_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true, status: 'retired' });
    }

    if (action === 'shadow') {
      // 활성 규칙을 되돌리는 길. 되돌리기에는 마찰을 두지 않는다.
      const { error } = await supabase
        .from('ops_parse_rules')
        .update({ status: 'shadow', retired_at: null })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true, status: 'shadow' });
    }

    const row = rule as {
      match_count: number;
      success_count: number;
      promotion_reason: string | null;
      validated_fixture: string | null;
      promoted_by: string | null;
    };
    const decision = canPromoteToActive(row, {
      promotionReason: body.promotion_reason ?? null,
      validatedFixture: body.validated_fixture ?? null,
      promotedBy: admin.id,
    });
    if (!decision.ok) {
      return NextResponse.json({ error: decision.reason }, { status: 422 });
    }

    const { error } = await supabase
      .from('ops_parse_rules')
      .update({
        status: 'active',
        promoted_at: new Date().toISOString(),
        promoted_by: admin.id,
        promotion_reason: body.promotion_reason ?? row.promotion_reason,
        validated_fixture: body.validated_fixture ?? row.validated_fixture,
      })
      .eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true, status: 'active', via: decision.via });
  } catch (error: unknown) {
    if (error instanceof AdminAuthFailure) return adminAuthJsonResponse(error);
    console.error('[PATCH /api/admin/parse-rules/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
