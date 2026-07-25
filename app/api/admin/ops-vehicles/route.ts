import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import {
  VEHICLE_SELECT_COLUMNS,
  VEHICLES_TENANT_ID,
  buildVehicleWrite,
  resolveSeatCapacity,
  type VehicleRow,
} from '@/lib/ops/vehicles/registry';

export const dynamic = 'force-dynamic';

/**
 * 차량 마스터 목록·등록 (관제 W1).
 *
 *   GET  /api/admin/ops-vehicles?active=all|true|false&q=
 *   POST /api/admin/ops-vehicles
 *
 * 응답에 `layout`(모델·좌석수)과 계산된 `capacity`를 함께 실어 준다. 화면이
 * 배치도를 따로 조회해서 정원을 합성하면 그 합성 규칙이 화면마다 갈라지고,
 * 갈라진 정원은 곧 잘못된 초과 경고가 된다 — 그래서 서버가 한 번만 푼다.
 */

interface LayoutJoin {
  id: string;
  model: string;
  display_name: Record<string, string> | null;
  total_seats: number;
}

/** 배치도 표시명 — jsonb 로케일 맵에서 한국어 우선, 없으면 모델 코드. */
function layoutLabel(layout: LayoutJoin | null): string | null {
  if (!layout) return null;
  const names = layout.display_name;
  if (names && typeof names === 'object') {
    const ko = names.ko ?? names.en;
    if (typeof ko === 'string' && ko.trim()) return ko;
  }
  return layout.model;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const activeParam = req.nextUrl.searchParams.get('active') ?? 'all';
    const q = req.nextUrl.searchParams.get('q')?.trim();

    let query = supabase
      .from('ops_vehicles')
      .select(`${VEHICLE_SELECT_COLUMNS}, layout:ops_vehicle_layouts(id, model, display_name, total_seats)`)
      .eq('tenant_id', VEHICLES_TENANT_ID)
      .order('active', { ascending: false })
      .order('plate_number', { ascending: true })
      .limit(500);
    if (activeParam === 'true') query = query.eq('active', true);
    else if (activeParam === 'false') query = query.eq('active', false);
    if (q) query = query.or(`plate_number.ilike.%${q}%,nickname.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/admin/ops-vehicles]', error);
      return NextResponse.json(
        { error: '차량 목록을 불러오지 못했습니다', details: error.message },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as unknown as Array<VehicleRow & { layout: LayoutJoin | null }>;
    return NextResponse.json({
      data: rows.map((row) => ({
        ...row,
        layout_label: layoutLabel(row.layout),
        layout_total_seats: row.layout?.total_seats ?? null,
        capacity: resolveSeatCapacity(row, row.layout?.total_seats ?? null),
      })),
      count: rows.length,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/ops-vehicles]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const built = buildVehicleWrite(body, 'create');
    if (!built.ok) return NextResponse.json({ error: built.message, code: built.code }, { status: 400 });

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('ops_vehicles')
      .insert({ tenant_id: VEHICLES_TENANT_ID, ...built.fields })
      .select(VEHICLE_SELECT_COLUMNS)
      .single();

    if (error) {
      // UNIQUE(tenant_id, plate_number) — 정규화 후에도 같은 번호판.
      if (/duplicate key|unique/i.test(error.message ?? '')) {
        return NextResponse.json(
          { error: '같은 번호판의 차량이 이미 등록되어 있어요.', code: 'duplicate' },
          { status: 409 },
        );
      }
      console.error('[POST /api/admin/ops-vehicles]', error);
      return NextResponse.json({ error: '차량을 등록하지 못했습니다', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/ops-vehicles]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
