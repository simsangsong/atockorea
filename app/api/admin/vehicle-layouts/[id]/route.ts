import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import {
  hasBlockingIssues,
  issuesOfCode,
  normalizeLayoutJson,
  validateVehicleLayout,
} from '@/lib/ops/seating/layoutEditor';
import { loadLayoutUsage } from '@/lib/ops/seating/layoutUsage';
import {
  ensureLayoutPhotoBucket,
  layoutPhotoPath,
  layoutPhotoSignedUrl,
  uploadLayoutPhoto,
  validateLayoutPhoto,
  type LayoutPhotoStorageClient,
} from '@/lib/ops/seating/layoutPhoto';

export const dynamic = 'force-dynamic';

/**
 * 배치도 1행 — 조회 / 편집 / 실차 사진 / 확정 게이트 (§5.3b).
 *
 *   GET    /api/admin/vehicle-layouts/[id]
 *          배치도 + 사용 현황(어느 룸의 몇 번 좌석이 배정돼 있는지) + 사진 서명 URL.
 *
 *   PATCH  /api/admin/vehicle-layouts/[id]
 *          { layout_json, total_seats, confirm_in_use? }        배치도 저장
 *          { action: 'verify', confirm_photo_match: true }      실차 대조 확정
 *          { action: 'unverify' }                               확정 해제
 *
 *   POST   /api/admin/vehicle-layouts/[id]   (multipart: photo)
 *          실차 내부 사진 업로드 (private 버킷 경로만 저장).
 *
 * 게이트 두 개가 이 라우트의 존재 이유다:
 *   ① 확정(verify)은 실차 사진 + 사람의 명시적 확인 없이는 불가.
 *   ② 사용 중인 배치도에서 이미 배정된 좌석이 사라지는 저장은 409 —
 *      영향받는 룸을 이름으로 돌려주고, confirm_in_use=true 라야 통과한다.
 *
 * 배치도 JSON이 바뀌면 확정은 자동으로 풀린다(사진 경로는 유지) — 대조한
 * 그림이 더 이상 그 그림이 아니기 때문이다.
 */

const SELECT_COLUMNS =
  'id, model, display_name, layout_json, total_seats, is_verified, verified_at, verified_by, reference_photo_path, created_at, updated_at';

interface LayoutRow {
  id: string;
  model: string;
  display_name: Record<string, string> | null;
  layout_json: unknown;
  total_seats: number;
  is_verified?: boolean;
  verified_at?: string | null;
  verified_by?: string | null;
  reference_photo_path?: string | null;
  updated_at?: string | null;
}

async function loadLayout(
  supabase: ReturnType<typeof createServerClient>,
  id: string,
): Promise<{ row: LayoutRow | null; migrationPending: boolean }> {
  const full = await supabase.from('ops_vehicle_layouts').select(SELECT_COLUMNS).eq('id', id).maybeSingle();
  if (!full.error) return { row: (full.data as unknown as LayoutRow) ?? null, migrationPending: false };
  const base = await supabase
    .from('ops_vehicle_layouts')
    .select('id, model, display_name, layout_json, total_seats, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  return { row: (base.data as unknown as LayoutRow) ?? null, migrationPending: true };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const supabase = createServerClient();

    const { row, migrationPending } = await loadLayout(supabase, id);
    if (!row) return NextResponse.json({ error: 'Layout not found' }, { status: 404 });

    const usage = await loadLayoutUsage(supabase, { layoutId: id });
    return NextResponse.json({
      data: {
        ...row,
        is_verified: Boolean(row.is_verified),
        reference_photo_url: await layoutPhotoSignedUrl(
          supabase as unknown as LayoutPhotoStorageClient,
          row.reference_photo_path ?? null,
        ),
      },
      usage: usage.vehicles,
      in_use_seats: usage.inUse,
      migration_pending: migrationPending || usage.migrationPending,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/vehicle-layouts/[id]]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const supabase = createServerClient();
    const { row } = await loadLayout(supabase, id);
    if (!row) return NextResponse.json({ error: 'Layout not found' }, { status: 404 });

    const action = typeof body.action === 'string' ? body.action : null;

    // ── ① 확정 게이트 (§5.3b) — 사진 + 사람의 확인 둘 다 있어야 통과.
    if (action === 'verify') {
      if (!row.reference_photo_path) {
        return NextResponse.json(
          {
            error: 'photo_required',
            message: '실차 내부 사진을 먼저 올려야 확정할 수 있어요.',
          },
          { status: 409 },
        );
      }
      if (body.confirm_photo_match !== true) {
        return NextResponse.json(
          {
            error: 'confirm_required',
            message: '사진과 배치도를 대조했다는 확인이 필요해요.',
          },
          { status: 400 },
        );
      }
      const { error } = await supabase
        .from('ops_vehicle_layouts')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
          verified_by: admin.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true, is_verified: true });
    }

    if (action === 'unverify') {
      const { error } = await supabase
        .from('ops_vehicle_layouts')
        .update({
          is_verified: false,
          verified_at: null,
          verified_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true, is_verified: false });
    }

    // ── ② 배치도 저장.
    const layout = normalizeLayoutJson(body.layout_json);
    if (!layout) {
      return NextResponse.json(
        { error: 'invalid_layout', message: '배치도 JSON 형식이 올바르지 않아요.' },
        { status: 400 },
      );
    }
    const totalSeats =
      typeof body.total_seats === 'number' ? body.total_seats : layout.seats.length;

    const usage = await loadLayoutUsage(supabase, { layoutId: id });
    const issues = validateVehicleLayout({
      layout,
      totalSeats,
      model: row.model,
      inUse: usage.inUse,
    });

    if (hasBlockingIssues(issues)) {
      return NextResponse.json({ error: 'layout_invalid', issues }, { status: 400 });
    }

    // 사용 중 좌석 소실 — 이름을 대고, 명시적 확인을 받는다.
    const inUseIssues = issuesOfCode(issues, 'in_use_seat_removed');
    if (inUseIssues.length > 0 && body.confirm_in_use !== true) {
      return NextResponse.json(
        { error: 'seats_in_use', issues, message: inUseIssues[0].message },
        { status: 409 },
      );
    }

    const { error } = await supabase
      .from('ops_vehicle_layouts')
      .update({
        layout_json: layout,
        total_seats: totalSeats,
        // 그림이 바뀌었으니 대조는 다시 해야 한다 (사진 경로는 남긴다).
        is_verified: false,
        verified_at: null,
        verified_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true, issues, verification_reset: Boolean(row.is_verified) });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PATCH /api/admin/vehicle-layouts/[id]]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

/** 실차 내부 사진 업로드 (multipart). 새 사진 = 새 대조 → 확정 해제. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const supabase = createServerClient();

    const { row } = await loadLayout(supabase, id);
    if (!row) return NextResponse.json({ error: 'Layout not found' }, { status: 404 });

    const form = await req.formData().catch(() => null);
    const file = form?.get('photo');
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error: 'photo_required', message: '실차 내부 사진이 필요해요.' },
        { status: 400 },
      );
    }

    const blob = file as unknown as { type: string; size: number; name: string; arrayBuffer(): Promise<ArrayBuffer> };
    const validation = validateLayoutPhoto({ type: blob.type, size: blob.size, name: blob.name });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.code, message: validation.message }, { status: 400 });
    }

    const bytes = Buffer.from(await blob.arrayBuffer());
    const path = layoutPhotoPath(id, validation.ext);
    const storage = supabase as unknown as LayoutPhotoStorageClient;
    await ensureLayoutPhotoBucket(storage);
    await uploadLayoutPhoto(storage, path, bytes, blob.type);

    const { error } = await supabase
      .from('ops_vehicle_layouts')
      .update({
        reference_photo_path: path,
        is_verified: false,
        verified_at: null,
        verified_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;

    return NextResponse.json(
      { ok: true, reference_photo_path: path, reference_photo_url: await layoutPhotoSignedUrl(storage, path) },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/vehicle-layouts/[id]]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
