import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { layoutPhotoSignedUrl, type LayoutPhotoStorageClient } from '@/lib/ops/seating/layoutPhoto';
import { selectRoomVehicles } from '@/lib/ops/seating/layoutUsage';

export const dynamic = 'force-dynamic';

/**
 * 배치도 라이브러리 목록 — AtoC 통합 플랜 §5.3b (관리자 배치도 에디터).
 *
 * GET /api/admin/vehicle-layouts
 *   ops_vehicle_layouts 전 행 + 확정(실차 사진 대조) 상태 + 사용 현황
 *   (몇 대의 실차가 이 배치도를 쓰는지, 그 중 오버라이드가 걸린 대수).
 *
 * 20260726090000 마이그레이션 미적용 환경에서는 확장 컬럼 select가 실패하므로
 * 기본 컬럼으로 물러서고 `migration_pending: true`를 실어 보낸다 — 화면이
 * "마이그레이션 적용 필요"를 말할 수 있게(빈 화면으로 죽지 않게).
 */

const BASE_COLUMNS = 'id, model, display_name, layout_json, total_seats, created_at, updated_at';
const VERIFY_COLUMNS = `${BASE_COLUMNS}, is_verified, verified_at, verified_by, reference_photo_path`;

export interface AdminLayoutRow {
  id: string;
  model: string;
  display_name: Record<string, string> | null;
  layout_json: unknown;
  total_seats: number;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  reference_photo_path: string | null;
  reference_photo_url?: string | null;
  updated_at: string | null;
  vehicle_count: number;
  override_count: number;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();

    let migrationPending = false;
    let rows: Record<string, unknown>[] = [];
    const verified = await supabase.from('ops_vehicle_layouts').select(VERIFY_COLUMNS).order('model');
    if (!verified.error && Array.isArray(verified.data)) {
      rows = verified.data as unknown as Record<string, unknown>[];
    } else {
      migrationPending = true;
      const base = await supabase.from('ops_vehicle_layouts').select(BASE_COLUMNS).order('model');
      if (base.error) {
        console.error('[GET /api/admin/vehicle-layouts]', base.error);
        return NextResponse.json(
          { error: 'Failed to load layouts', details: base.error.message },
          { status: 500 },
        );
      }
      rows = (base.data ?? []) as unknown as Record<string, unknown>[];
    }

    // 사용 현황 — 배치도 하나가 여러 실차에 붙는다.
    const { rows: vehicles, migrationPending: vehiclePending } = await selectRoomVehicles(supabase, {});
    if (vehiclePending) migrationPending = true;

    const data: AdminLayoutRow[] = await Promise.all(
      rows.map(async (row) => {
        const id = String(row.id);
        const mine = vehicles.filter((vehicle) => vehicle.layout_id === id);
        const photoPath = (row.reference_photo_path as string | null) ?? null;
        return {
          id,
          model: String(row.model),
          display_name: (row.display_name as Record<string, string> | null) ?? null,
          layout_json: row.layout_json,
          total_seats: Number(row.total_seats ?? 0),
          is_verified: Boolean(row.is_verified),
          verified_at: (row.verified_at as string | null) ?? null,
          verified_by: (row.verified_by as string | null) ?? null,
          reference_photo_path: photoPath,
          reference_photo_url: await layoutPhotoSignedUrl(
            supabase as unknown as LayoutPhotoStorageClient,
            photoPath,
          ),
          updated_at: (row.updated_at as string | null) ?? null,
          vehicle_count: mine.length,
          override_count: mine.filter((vehicle) => vehicle.layout_override_json).length,
        };
      }),
    );

    // 실차 오버라이드 목록 — 편집기 사이드바가 "표준 배치도 / 실차 오버라이드"
    // 두 그룹을 보여줄 수 있게 한다.
    const overrideRows = vehicles.filter((vehicle) => vehicle.layout_override_json);
    const overrideRoomIds = [...new Set(overrideRows.map((vehicle) => vehicle.room_id))];
    const roomLabels = new Map<string, string>();
    if (overrideRoomIds.length > 0) {
      const { data: rooms } = await supabase
        .from('tour_rooms')
        .select('id, tour_date')
        .in('id', overrideRoomIds);
      for (const room of (rooms ?? []) as Array<{ id: string; tour_date: string | null }>) {
        roomLabels.set(room.id, room.tour_date ?? '');
      }
    }

    return NextResponse.json({
      data,
      overrides: overrideRows.map((vehicle) => ({
        room_vehicle_id: vehicle.id,
        room_id: vehicle.room_id,
        layout_id: vehicle.layout_id,
        plate_number: vehicle.plate_number,
        note: vehicle.override_note,
        tour_date: roomLabels.get(vehicle.room_id) ?? null,
      })),
      migration_pending: migrationPending,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/vehicle-layouts]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
