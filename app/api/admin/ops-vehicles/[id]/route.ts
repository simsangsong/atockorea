import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import {
  VEHICLE_SELECT_COLUMNS,
  VEHICLES_TENANT_ID,
  buildVehicleWrite,
} from '@/lib/ops/vehicles/registry';

export const dynamic = 'force-dynamic';

/**
 * 차량 마스터 수정·삭제 (관제 W1).
 *
 *   PATCH  /api/admin/ops-vehicles/[id]
 *   DELETE /api/admin/ops-vehicles/[id]
 *
 * DELETE는 **배차 이력이 있으면 물리 삭제하지 않고 `active=false`로 내린다.**
 * FK가 ON DELETE SET NULL이라 하드 삭제해도 배차 행은 살아남지만, 그 순간
 * "8월 3일에 무슨 차가 갔는가"의 답이 영원히 사라진다. 응답의 `mode` 필드가
 * 무엇이 일어났는지 화면에 그대로 말해 준다 — 지운 줄 알았는데 비활성이었다는
 * 상황을 만들지 않기 위해서다.
 */

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const built = buildVehicleWrite(body, 'update');
    if (!built.ok) return NextResponse.json({ error: built.message, code: built.code }, { status: 400 });

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('ops_vehicles')
      .update(built.fields)
      .eq('id', id)
      .eq('tenant_id', VEHICLES_TENANT_ID)
      .select(VEHICLE_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      if (/duplicate key|unique/i.test(error.message ?? '')) {
        return NextResponse.json(
          { error: '같은 번호판의 차량이 이미 등록되어 있어요.', code: 'duplicate' },
          { status: 409 },
        );
      }
      console.error('[PATCH /api/admin/ops-vehicles/[id]]', error);
      return NextResponse.json({ error: '차량을 수정하지 못했습니다', details: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: '차량을 찾을 수 없어요.' }, { status: 404 });

    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PATCH /api/admin/ops-vehicles/[id]]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await ctx.params;
    const supabase = createServerClient();

    const { count, error: countError } = await supabase
      .from('ops_room_vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('vehicle_id', id);
    if (countError) {
      console.error('[DELETE /api/admin/ops-vehicles/[id]] usage lookup', countError);
      return NextResponse.json(
        { error: '배차 이력을 확인하지 못해 삭제를 중단했습니다', details: countError.message },
        { status: 500 },
      );
    }

    if ((count ?? 0) > 0) {
      const { data, error } = await supabase
        .from('ops_vehicles')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', VEHICLES_TENANT_ID)
        .select(VEHICLE_SELECT_COLUMNS)
        .maybeSingle();
      if (error) {
        console.error('[DELETE /api/admin/ops-vehicles/[id]] soft', error);
        return NextResponse.json({ error: '차량을 비활성화하지 못했습니다', details: error.message }, { status: 500 });
      }
      if (!data) return NextResponse.json({ error: '차량을 찾을 수 없어요.' }, { status: 404 });
      return NextResponse.json({
        mode: 'deactivated',
        assignmentCount: count ?? 0,
        message: `배차 이력 ${count}건이 있어 삭제 대신 운행 중지로 처리했어요.`,
        data,
      });
    }

    const { error } = await supabase
      .from('ops_vehicles')
      .delete()
      .eq('id', id)
      .eq('tenant_id', VEHICLES_TENANT_ID);
    if (error) {
      console.error('[DELETE /api/admin/ops-vehicles/[id]]', error);
      return NextResponse.json({ error: '차량을 삭제하지 못했습니다', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ mode: 'deleted', assignmentCount: 0 });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DELETE /api/admin/ops-vehicles/[id]]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
