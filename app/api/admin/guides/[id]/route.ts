import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import {
  GUIDE_SELECT_COLUMNS,
  GUIDES_TENANT_ID,
  buildGuideWrite,
} from '@/lib/ops/guides/registry';
import { piiEncryptionAvailable } from '@/lib/ops/guides/pii';

export const dynamic = 'force-dynamic';

/**
 * 가이드 상세 조회·수정·비활성 (§6.9).
 *
 *   GET    /api/admin/guides/[id]          → 프로필(마스킹) + 단가 + 휴무 요약
 *   PATCH  /api/admin/guides/[id]          → 부분 수정
 *   DELETE /api/admin/guides/[id]          → 비활성화 (기본, 되돌릴 수 있음)
 *   DELETE /api/admin/guides/[id]?hard=1   → 완전 삭제
 *
 * 기본 DELETE가 소프트인 이유: 하드 삭제는 CASCADE로 단가 이력과 휴무 기록까지
 * 지운다. 그런데 그 단가 이력은 지난 달 지급액을 다시 계산할 때 필요한 증빙이다
 * (원천징수·지급명세서는 3년 보관 대상). "이제 같이 일 안 함"은 비활성화이지
 * 삭제가 아니다 — 하드 삭제는 오등록을 지우는 용도로만 남긴다.
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('ops_guides')
      .select(GUIDE_SELECT_COLUMNS)
      .eq('id', id)
      .eq('tenant_id', GUIDES_TENANT_ID)
      .maybeSingle();
    if (error) {
      console.error('[GET /api/admin/guides/:id]', error);
      return NextResponse.json({ error: '가이드를 불러오지 못했습니다', details: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: '가이드를 찾을 수 없습니다' }, { status: 404 });

    return NextResponse.json({ data, piiKeyConfigured: piiEncryptionAvailable() });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/guides/:id]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const built = buildGuideWrite(body, 'update');
    if (!built.ok) {
      return NextResponse.json({ error: built.message, code: built.code }, { status: 400 });
    }
    // updated_at만 남으면 실제로 바뀐 게 없다는 뜻.
    if (Object.keys(built.fields).length <= 1) {
      return NextResponse.json({ error: '변경할 내용이 없습니다' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('ops_guides')
      .update(built.fields)
      .eq('id', id)
      .eq('tenant_id', GUIDES_TENANT_ID)
      .select(GUIDE_SELECT_COLUMNS)
      .single();
    if (error) {
      console.error('[PATCH /api/admin/guides/:id]', error);
      return NextResponse.json({ error: '가이드를 수정하지 못했습니다', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PATCH /api/admin/guides/:id]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const hard = req.nextUrl.searchParams.get('hard') === '1';
    const supabase = createServerClient();

    if (hard) {
      const { error } = await supabase
        .from('ops_guides')
        .delete()
        .eq('id', id)
        .eq('tenant_id', GUIDES_TENANT_ID);
      if (error) {
        console.error('[DELETE /api/admin/guides/:id hard]', error);
        return NextResponse.json({ error: '삭제하지 못했습니다', details: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, deleted: 'hard' });
    }

    const { data, error } = await supabase
      .from('ops_guides')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', GUIDES_TENANT_ID)
      .select(GUIDE_SELECT_COLUMNS)
      .single();
    if (error) {
      console.error('[DELETE /api/admin/guides/:id]', error);
      return NextResponse.json({ error: '비활성화하지 못했습니다', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deleted: 'soft', data });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DELETE /api/admin/guides/:id]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
