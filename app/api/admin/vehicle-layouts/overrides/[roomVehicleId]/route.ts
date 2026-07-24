import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import {
  hasBlockingIssues,
  issuesOfCode,
  normalizeLayoutJson,
  validateVehicleLayout,
} from '@/lib/ops/seating/layoutEditor';
import { loadLayoutUsage, selectRoomVehicles } from '@/lib/ops/seating/layoutUsage';
import { recordRoomEvent } from '@/lib/tour-room/events';
import type { VehicleLayoutJson } from '@/lib/ops/seating/layouts';

export const dynamic = 'force-dynamic';

/**
 * 실차 단위 배치도 오버라이드 — AtoC 통합 플랜 §5.3b 마지막 줄.
 *
 * "특정 차량이 표준 배치와 다르면 ops_room_vehicles 단위 오버라이드."
 * 즉 8/17에 들어온 그 카운티 한 대만 뒷줄이 3석이라면, 표준 county_20을
 * 고치는 게 아니라 이 실차에만 다른 layout_json을 붙인다.
 *
 *   GET    /api/admin/vehicle-layouts/overrides/[roomVehicleId]
 *   PUT    { layout_json, note?, confirm_in_use? }   오버라이드 저장/갱신
 *   DELETE ?confirm_in_use=1                         오버라이드 제거(표준 복귀)
 *
 * 표준 배치도(ops_vehicle_layouts.layout_json)는 이 라우트에서 절대 쓰이지
 * 않는다 — 읽기만 한다.
 */

interface BaseLayoutRow {
  id: string;
  model: string;
  display_name: Record<string, string> | null;
  layout_json: VehicleLayoutJson;
  total_seats: number;
}

async function loadContext(
  supabase: ReturnType<typeof createServerClient>,
  roomVehicleId: string,
) {
  const { rows } = await selectRoomVehicles(supabase, { ids: [roomVehicleId] });
  const vehicle = rows[0] ?? null;
  if (!vehicle) return { vehicle: null, base: null };
  const { data } = await supabase
    .from('ops_vehicle_layouts')
    .select('id, model, display_name, layout_json, total_seats')
    .eq('id', vehicle.layout_id)
    .maybeSingle();
  return { vehicle, base: (data as unknown as BaseLayoutRow) ?? null };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomVehicleId: string }> },
) {
  try {
    await requireAdmin(req);
    const { roomVehicleId } = await params;
    const supabase = createServerClient();

    const { vehicle, base } = await loadContext(supabase, roomVehicleId);
    if (!vehicle) return NextResponse.json({ error: 'Room vehicle not found' }, { status: 404 });

    const usage = await loadLayoutUsage(supabase, { roomVehicleId });
    return NextResponse.json({
      data: {
        room_vehicle_id: vehicle.id,
        room_id: vehicle.room_id,
        layout_id: vehicle.layout_id,
        plate_number: vehicle.plate_number,
        driver_name: vehicle.driver_name,
        override: vehicle.layout_override_json,
        override_note: vehicle.override_note,
      },
      base,
      usage: usage.vehicles,
      in_use_seats: usage.inUse,
      migration_pending: usage.migrationPending,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/vehicle-layouts/overrides/[roomVehicleId]]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roomVehicleId: string }> },
) {
  try {
    const admin = await requireAdmin(req);
    const { roomVehicleId } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const supabase = createServerClient();
    const { vehicle, base } = await loadContext(supabase, roomVehicleId);
    if (!vehicle) return NextResponse.json({ error: 'Room vehicle not found' }, { status: 404 });

    const layout = normalizeLayoutJson(body.layout_json);
    if (!layout) {
      return NextResponse.json(
        { error: 'invalid_layout', message: '배치도 JSON 형식이 올바르지 않아요.' },
        { status: 400 },
      );
    }

    const usage = await loadLayoutUsage(supabase, { roomVehicleId });
    const issues = validateVehicleLayout({
      layout,
      totalSeats: layout.seats.length,
      model: base?.model ?? null,
      inUse: usage.inUse,
    });
    if (hasBlockingIssues(issues)) {
      return NextResponse.json({ error: 'layout_invalid', issues }, { status: 400 });
    }
    const inUseIssues = issuesOfCode(issues, 'in_use_seat_removed');
    if (inUseIssues.length > 0 && body.confirm_in_use !== true) {
      return NextResponse.json(
        { error: 'seats_in_use', issues, message: inUseIssues[0].message },
        { status: 409 },
      );
    }

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : null;
    const { error } = await supabase
      .from('ops_room_vehicles')
      .update({
        layout_override_json: layout,
        override_note: note,
        override_updated_at: new Date().toISOString(),
      })
      .eq('id', roomVehicleId);
    if (error) throw error;

    await recordRoomEvent(supabase, {
      roomId: vehicle.room_id,
      type: 'vehicle_layout_override_set',
      actorRole: 'admin',
      payload: {
        room_vehicle_id: roomVehicleId,
        layout_id: vehicle.layout_id,
        seats: layout.seats.length,
        note,
        by: admin.id,
      },
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, issues });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PUT /api/admin/vehicle-layouts/overrides/[roomVehicleId]]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomVehicleId: string }> },
) {
  try {
    const admin = await requireAdmin(req);
    const { roomVehicleId } = await params;
    const supabase = createServerClient();

    const { vehicle, base } = await loadContext(supabase, roomVehicleId);
    if (!vehicle) return NextResponse.json({ error: 'Room vehicle not found' }, { status: 404 });
    if (!vehicle.layout_override_json) return NextResponse.json({ ok: true, cleared: false });

    // 표준으로 되돌리는 것도 좌석을 없앨 수 있다 (오버라이드가 좌석을 더한 경우).
    const usage = await loadLayoutUsage(supabase, { roomVehicleId });
    const confirmed = req.nextUrl.searchParams.get('confirm_in_use') === '1';
    if (base?.layout_json) {
      const issues = validateVehicleLayout({
        layout: base.layout_json,
        model: base.model,
        inUse: usage.inUse,
      });
      const inUseIssues = issuesOfCode(issues, 'in_use_seat_removed');
      if (inUseIssues.length > 0 && !confirmed) {
        return NextResponse.json(
          { error: 'seats_in_use', issues, message: inUseIssues[0].message },
          { status: 409 },
        );
      }
    }

    const { error } = await supabase
      .from('ops_room_vehicles')
      .update({ layout_override_json: null, override_note: null, override_updated_at: new Date().toISOString() })
      .eq('id', roomVehicleId);
    if (error) throw error;

    await recordRoomEvent(supabase, {
      roomId: vehicle.room_id,
      type: 'vehicle_layout_override_cleared',
      actorRole: 'admin',
      payload: { room_vehicle_id: roomVehicleId, layout_id: vehicle.layout_id, by: admin.id },
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, cleared: true });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DELETE /api/admin/vehicle-layouts/overrides/[roomVehicleId]]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
