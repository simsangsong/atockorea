import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { getOpsRoom } from '@/lib/ops/seating/access';
import { broadcastSeatUpdate } from '@/lib/ops/seating/service';
import { loadLayoutUsage, selectRoomVehicles } from '@/lib/ops/seating/layoutUsage';
import { roomIdsInGroup, vehicleInGroup } from '@/lib/ops/seating/dispatchScope';
import { ensureTourGroup } from '@/lib/ops/seating/group';
import {
  capacityVerdict,
  groupHeadcount,
  seatReductionVerdict,
  seatShortfallMessage,
} from '@/lib/ops/seating/capacity';
import { dropSimBookings } from '@/lib/ops/sim/simScope';
import { normalizeLayoutJson } from '@/lib/ops/seating/layoutEditor';
import { layoutPhotoSignedUrl, type LayoutPhotoStorageClient } from '@/lib/ops/seating/layoutPhoto';
import { recordRoomEvent } from '@/lib/tour-room/events';
import {
  formatPlate,
  readMasterVehicleRef,
  resolveDispatchVehicle,
  resolveSeatCapacity,
  VEHICLES_TENANT_ID,
  type VehicleRow as MasterVehicleRow,
} from '@/lib/ops/vehicles/registry';
import type { VehicleLayoutJson } from '@/lib/ops/seating/layouts';

export const dynamic = 'force-dynamic';

/**
 * 룸 차량 배정 — AtoC 통합 플랜 §4.1 B-2 / §5.6.
 *
 * ops_room_vehicles에는 지금까지 **쓰기 표면이 하나도 없었다**(읽기만:
 * lib/ops/report, lib/ops/seating/{manifest,service}). 그래서 룸에 차를
 * 붙이려면 SQL을 직접 쳐야 했고, §5.3 좌석 선택 플로우 전체가 그 수동
 * 작업에 매달려 있었다. 이 라우트가 그 구멍이다.
 *
 *   GET    /api/admin/tour-ops/rooms/[roomId]/vehicles
 *          배정된 차량 + 배치도 후보 + 기사 후보(룸에 입장한 driver 참가자)
 *          + **등록 차량 후보**(`master_vehicles`).
 *   POST   { layout_id?, master_vehicle_id?, plate_number?, driver_participant_id?, driver_name? }
 *   PATCH  { vehicle_id, master_vehicle_id?, ... , strategy?: 'block'|'keep'|'clear', confirm? }
 *          { undo_event_id }                      직전 변경 되돌리기
 *   DELETE ?vehicle_id=…&confirm=1
 *
 * 🔴 이름 충돌 (읽지 않고 고치면 오배차가 난다):
 *   · 요청의 `vehicle_id`        = `ops_room_vehicles.id`  (이 배차 행)
 *   · 요청의 `master_vehicle_id` = `ops_vehicles.id`       (차량 마스터)
 *   컬럼 이름은 `ops_room_vehicles.vehicle_id`로 마스터를 가리키지만, 요청 경계에서는
 *   절대 그 이름을 쓰지 않는다. 순수 규칙은 `lib/ops/vehicles/registry.ts`.
 *
 * 🔴 이미 좌석이 배정된 차량의 배치도를 바꾸는 것은 **기본적으로 막힌다**
 * (strategy 'block' = 기본값 → 409 + 영향받는 좌석·손님 목록). 운영자는
 * 결과를 보고 나서만 'keep'(새 배치도에 없는 좌석만 해제) 또는
 * 'clear'(전 좌석 해제)를 고를 수 있다. 해제된 배정은 이벤트 payload에
 * 통째로 스냅샷되고, 그 이벤트 id로 되돌릴 수 있다 — 비가역 액션을
 * 만들지 않는다는 원칙(§5.4b 비대칭 마찰)과 같은 결이다.
 */

type Strategy = 'block' | 'keep' | 'clear';

interface AssignmentRow {
  id: string;
  room_vehicle_id: string;
  booking_id: string;
  participant_id: string | null;
  seat_number: number;
  guest_label: string | null;
  checked_in_at: string | null;
  absent_at: string | null;
  locked: boolean | null;
}

const ASSIGNMENT_COLUMNS =
  'id, room_vehicle_id, booking_id, participant_id, seat_number, guest_label, checked_in_at, absent_at, locked';

async function loadAssignmentsFor(
  supabase: ReturnType<typeof createServerClient>,
  roomVehicleId: string,
): Promise<AssignmentRow[]> {
  const { data } = await supabase
    .from('ops_seat_assignments')
    .select(ASSIGNMENT_COLUMNS)
    .eq('room_vehicle_id', roomVehicleId);
  return ((data ?? []) as AssignmentRow[]).sort((a, b) => a.seat_number - b.seat_number);
}

/** 배차 화면이 고를 수 있는 등록 차량 한 대. */
interface MasterVehicleOption {
  id: string;
  plate_number: string;
  /** 사람이 읽는 번호판 ('12가 3456'). */
  display_plate: string;
  nickname: string | null;
  layout_id: string | null;
  /** 실효 정원 (seat_capacity ?? 배치도 total_seats). null = 미상. */
  capacity: number | null;
  active: boolean;
}

type MasterVehicleFields = Pick<MasterVehicleRow, 'id' | 'plate_number' | 'layout_id' | 'active' | 'seat_capacity'>;

const MASTER_COLUMNS = 'id, plate_number, layout_id, active, seat_capacity';

/**
 * 등록 차량 한 대. 마스터 테이블이 없는 환경(마이그레이션 미적용)에서는 null이고,
 * 그때 라우트는 "차량을 찾지 못했다"로 답한다 — 배차 자체는 계속 된다(용차 경로).
 */
async function loadMasterVehicle(
  supabase: ReturnType<typeof createServerClient>,
  id: string,
): Promise<MasterVehicleFields | null> {
  const { data } = await supabase
    .from('ops_vehicles')
    .select(MASTER_COLUMNS)
    .eq('id', id)
    .eq('tenant_id', VEHICLES_TENANT_ID)
    .maybeSingle();
  return (data as MasterVehicleFields | null) ?? null;
}

/** 배치도의 좌석번호 집합 (오버라이드가 있으면 그쪽이 진실). */
function seatNumbersOf(layout: VehicleLayoutJson | null): Set<number> {
  return new Set((layout?.seats ?? []).map((seat) => seat.n));
}

/**
 * §K B2.4 — 이 룸이 속한 그룹의 룸 id 전부.
 * `lib/ops/seating/service.ts`의 같은 규칙(B0.4)과 짝을 맞춘다.
 */

/**
 * §K B2.4 — 이 그룹의 정원 판정. 배차 화면이 "2호차가 필요한가"를 스스로
 * 말할 수 있어야 한다.
 *
 * 🔴 B2-D1 — 판매 차단이 아니다. 이 값은 **운영자 화면 전용**이고, 손님
 * 표면에는 절대 닿지 않는다(B2.5 회귀가 그걸 파일시스템으로 감시한다).
 */
async function groupCapacity(
  supabase: ReturnType<typeof createServerClient>,
  room: { tour_id: string | null; tour_date: string | null },
  vehicleSeatTotals: Array<{ total_seats?: number | null }>,
): Promise<{
  headcount: number;
  capacity: number | null;
  over: boolean;
  overBy: number;
  /**
   * 무엇이 정원을 묶고 있나. 실효 정원은 min(상품, 좌석)이라, 병목이 상품이면
   * **2호차를 붙여도 정원이 그대로다** — 화면이 그걸 말할 수 있어야 운영자가
   * "차를 붙였는데 왜 아직 초과지"에 빠지지 않는다.
   */
  bottleneck: 'product' | 'seats' | 'group' | null;
  groupCapacity: number | null;
} | null> {
  if (!room.tour_id || !room.tour_date) return null;
  try {
    const [{ data: bookings }, { data: tour }, { data: group }] = await Promise.all([
      supabase
        .from('bookings')
        .select('number_of_guests, status, sim_tag, contact_email')
        .eq('tour_id', room.tour_id)
        .eq('tour_date', room.tour_date),
      supabase.from('tours').select('max_room_guests, price_type').eq('id', room.tour_id).maybeSingle(),
      supabase
        .from('ops_tour_groups')
        .select('capacity')
        .eq('tour_id', room.tour_id)
        .eq('tour_date', room.tour_date)
        .maybeSingle(),
    ]);
    // A0.1 — 시뮬 예약이 정원 카운트에 들어가면 빈 투어가 초과로 뜬다.
    const real = dropSimBookings((bookings ?? []) as Array<{ sim_tag?: string | null; contact_email?: string | null }>);
    const verdict = capacityVerdict(
      real as Array<{ number_of_guests?: number | null; status?: string | null }>,
      (tour ?? null) as { max_room_guests?: number | null; price_type?: string | null } | null,
      vehicleSeatTotals,
      (group ?? null) as { capacity?: number | null } | null,
    );
    const groupCap = ((group ?? null) as { capacity?: number | null } | null)?.capacity ?? null;
    const seatTotal = vehicleSeatTotals.reduce((sum, v) => sum + (v.total_seats ?? 0), 0);
    const productCap =
      groupCap ??
      ((tour ?? null) as { max_room_guests?: number | null } | null)?.max_room_guests ??
      null;

    let bottleneck: 'product' | 'seats' | 'group' | null = null;
    if (verdict.capacity !== null) {
      if (seatTotal > 0 && seatTotal === verdict.capacity && (productCap === null || productCap > seatTotal)) {
        bottleneck = 'seats';
      } else if (productCap !== null && productCap === verdict.capacity) {
        bottleneck = groupCap !== null ? 'group' : 'product';
      }
    }

    return {
      headcount: verdict.headcount,
      capacity: verdict.capacity,
      over: verdict.over,
      overBy: verdict.overBy,
      bottleneck,
      groupCapacity: groupCap,
    };
  } catch {
    return null; // 정원 표시 하나 때문에 배차 화면이 죽으면 안 된다
  }
}

/**
 * 설계안 §1-2 — 좌석 하드 블록이 쓰는 사실 두 가지: 그룹 인원과 배차별 좌석수.
 *
 * 좌석수는 GET이 쓰는 규칙과 같아야 한다(마스터 실차 정원 > 오버라이드 배치도 >
 * 표준 배치도). 여기서 다른 규칙을 쓰면 화면이 "24석"이라고 말하면서 저장은
 * "20석이라 막았다"고 답하게 된다.
 */
async function loadSeatContext(
  supabase: ReturnType<typeof createServerClient>,
  room: { id: string; tour_id: string | null; tour_date: string | null },
): Promise<{ headcount: number; seatsByDispatch: Map<string, number> }> {
  const groupRoomIds = await roomIdsInGroup(supabase, room);
  const { rows } = await selectRoomVehicles(supabase, { roomIds: groupRoomIds });

  const layoutIds = [...new Set(rows.map((r) => r.layout_id).filter(Boolean))];
  const masterIds = [...new Set(rows.map((r) => r.vehicle_id).filter(Boolean))] as string[];

  const [layoutRes, masterRes, bookingRes] = await Promise.all([
    layoutIds.length
      ? supabase.from('ops_vehicle_layouts').select('id, total_seats').in('id', layoutIds)
      : Promise.resolve({ data: [] }),
    masterIds.length
      ? supabase.from('ops_vehicles').select('id, seat_capacity, layout_id').in('id', masterIds)
      : Promise.resolve({ data: [] }),
    room.tour_id && room.tour_date
      ? supabase
          .from('bookings')
          .select('number_of_guests, status, sim_tag, contact_email')
          .eq('tour_id', room.tour_id)
          .eq('tour_date', room.tour_date)
      : Promise.resolve({ data: [] }),
  ]);

  const layoutSeats = new Map(
    (((layoutRes.data ?? []) as Array<{ id: string; total_seats: number | null }>) ?? []).map((l) => [
      l.id,
      Number(l.total_seats ?? 0),
    ]),
  );
  const masterById = new Map(
    (((masterRes.data ?? []) as Array<{ id: string; seat_capacity: number | null; layout_id: string | null }>) ?? []).map(
      (m) => [m.id, m],
    ),
  );

  const seatsByDispatch = new Map<string, number>();
  for (const row of rows) {
    const master = row.vehicle_id ? masterById.get(row.vehicle_id) ?? null : null;
    const layoutId = master?.layout_id ?? row.layout_id;
    const base = row.layout_override_json
      ? row.layout_override_json.seats.length
      : layoutSeats.get(layoutId) ?? null;
    const seats = resolveSeatCapacity(master, base);
    if (seats != null) seatsByDispatch.set(row.id, seats);
  }

  // A0.1 — 시뮬 예약이 섞이면 빈 투어가 좌석 부족으로 막힌다.
  const real = dropSimBookings(
    ((bookingRes.data ?? []) as Array<{ sim_tag?: string | null; contact_email?: string | null }>) ?? [],
  );
  return { headcount: groupHeadcount(real as Array<{ number_of_guests?: number | null; status?: string | null }>), seatsByDispatch };
}

/** 좌석을 줄이는 저장에 붙이는 409 본문. 숫자와 사유 요구를 함께 돌려준다. */
function seatShortfallResponse(verdict: ReturnType<typeof seatReductionVerdict>): NextResponse {
  return NextResponse.json(
    {
      error: 'capacity_short',
      message: seatShortfallMessage(verdict),
      headcount: verdict.headcount,
      seats_before: verdict.seatsBefore,
      seats_after: verdict.seatsAfter,
      shortfall: verdict.shortfall,
      // 막되 되돌릴 수 없게 만들지는 않는다 — 사유를 적으면 통과하고, 그 사유가 기록된다.
      requires: 'capacity_override_reason',
    },
    { status: 409 },
  );
}

/** 사유는 있어야 하고, 공백 두 글자는 사유가 아니다. */
function readOverrideReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= 2 ? trimmed.slice(0, 200) : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    await requireAdmin(req);
    const { roomId } = await params;
    const supabase = createServerClient();

    const room = await getOpsRoom(supabase, roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    // §K B2.4 — 배차는 그룹 단위다. 2호차가 어느 룸에서 붙었든 여기 보여야
    // 하고, 그렇지 않으면 좌석판(B0.4에서 이미 그룹을 본다)과 어긋난다.
    const groupRoomIds = await roomIdsInGroup(supabase, room);
    const { rows, migrationPending } = await selectRoomVehicles(supabase, { roomIds: groupRoomIds });

    const layoutsRes = await supabase
      .from('ops_vehicle_layouts')
      .select('id, model, display_name, total_seats, layout_json, is_verified')
      .order('model');
    let layouts = (layoutsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
    if (layoutsRes.error) {
      const fallback = await supabase
        .from('ops_vehicle_layouts')
        .select('id, model, display_name, total_seats, layout_json')
        .order('model');
      layouts = (fallback.data ?? []) as unknown as Array<Record<string, unknown>>;
    }
    const layoutById = new Map(layouts.map((layout) => [String(layout.id), layout]));

    // 기사 후보 = 이 룸에 입장한 driver 참가자 (배차는 보통 그 전에 확정되므로
    // driver_name 자유 입력도 함께 지원한다 — 마이그레이션 컬럼).
    const { data: driverRows } = await supabase
      .from('tour_room_participants')
      .select('id, display_name, role, last_seen_at')
      .eq('room_id', roomId)
      .in('role', ['driver', 'guide']);

    // §2-1 — 등록 차량 후보. 마스터 테이블이 없으면 빈 목록이고, 화면은 자유 입력
    // 번호판(용차 경로)만 보여준다.
    const { data: masterRows } = await supabase
      .from('ops_vehicles')
      .select(MASTER_COLUMNS)
      .eq('tenant_id', VEHICLES_TENANT_ID)
      .order('active', { ascending: false })
      .order('plate_number', { ascending: true })
      .limit(500);
    const masterList = (masterRows ?? []) as unknown as Array<MasterVehicleFields & { nickname?: string | null }>;
    const masterById = new Map(masterList.map((row) => [row.id, row]));
    const layoutSeatsOf = (layoutId: string | null | undefined): number | null => {
      if (!layoutId) return null;
      const layout = layoutById.get(layoutId);
      return layout ? Number(layout.total_seats ?? 0) || null : null;
    };
    const masterVehicles: MasterVehicleOption[] = masterList.map((row) => ({
      id: row.id,
      plate_number: row.plate_number,
      display_plate: formatPlate(row.plate_number),
      nickname: row.nickname ?? null,
      layout_id: row.layout_id,
      capacity: resolveSeatCapacity(row, layoutSeatsOf(row.layout_id)),
      active: row.active,
    }));

    const vehicles = await Promise.all(
      rows.map(async (vehicle) => {
        const base = layoutById.get(vehicle.layout_id);
        const effective =
          vehicle.layout_override_json ?? ((base?.layout_json as VehicleLayoutJson | undefined) ?? null);
        const assignments = await loadAssignmentsFor(supabase, vehicle.id);
        const layoutSeats = effective ? effective.seats.length : Number(base?.total_seats ?? 0);
        const master = vehicle.vehicle_id ? masterById.get(vehicle.vehicle_id) ?? null : null;
        return {
          id: vehicle.id,
          layout_id: vehicle.layout_id,
          model: base ? String(base.model) : null,
          display_name: (base?.display_name as Record<string, string> | undefined) ?? null,
          plate_number: vehicle.plate_number,
          // 🔴 요청의 `vehicle_id`(=이 행의 id)와 헷갈리지 않도록 응답에서도 이름을 나눈다.
          master_vehicle_id: vehicle.vehicle_id,
          master_plate: master ? formatPlate(master.plate_number) : null,
          master_active: master ? master.active : null,
          driver_participant_id: vehicle.driver_participant_id,
          driver_name: vehicle.driver_name,
          // 사진은 private 버킷에 있다 — 단기 서명 URL로만 내보낸다. 실패해도
          // 배차 화면은 그대로 뜬다(사진 칸만 빈다).
          photo_url: await layoutPhotoSignedUrl(
            supabase as unknown as LayoutPhotoStorageClient,
            vehicle.photo_path,
          ),
          has_override: Boolean(vehicle.layout_override_json),
          override_note: vehicle.override_note,
          total_seats: layoutSeats,
          // 정원 판정이 보는 값. 마스터에 실차 좌석수가 있으면 그것이 이긴다
          // (개조 차량). 미상은 0이 아니라 null이다.
          capacity: master ? resolveSeatCapacity(master, layoutSeats) : layoutSeats || null,
          assignments: assignments.map((a) => ({
            seat_number: a.seat_number,
            guest_label: a.guest_label,
            booking_id: a.booking_id,
            checked_in: Boolean(a.checked_in_at),
            absent: Boolean(a.absent_at),
            locked: Boolean(a.locked),
          })),
        };
      }),
    );

    // §K B2.4 — 실효 정원은 배정된 차량 좌석수도 본다(B2-D4: min(상품, 좌석)).
    // §2-1 이후 그 좌석수는 마스터의 실차 정원을 먼저 본다.
    const capacity = await groupCapacity(
      supabase,
      room,
      vehicles.map((v) => ({ total_seats: v.capacity ?? v.total_seats })),
    );

    return NextResponse.json({
      room: { id: room.id, booking_id: room.booking_id, tour_id: room.tour_id, tour_date: room.tour_date },
      capacity,
      vehicles,
      master_vehicles: masterVehicles,
      layouts: layouts.map((layout) => ({
        id: String(layout.id),
        model: String(layout.model),
        display_name: (layout.display_name as Record<string, string> | null) ?? null,
        total_seats: Number(layout.total_seats ?? 0),
        is_verified: Boolean(layout.is_verified),
      })),
      drivers: ((driverRows ?? []) as Array<{ id: string; display_name: string; role: string; last_seen_at: string | null }>).map(
        (participant) => ({
          id: participant.id,
          display_name: participant.display_name,
          role: participant.role,
          last_seen_at: participant.last_seen_at,
        }),
      ),
      migration_pending: migrationPending,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/tour-ops/rooms/[roomId]/vehicles]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { roomId } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const supabase = createServerClient();
    const room = await getOpsRoom(supabase, roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    // §2-1 — 등록 차량을 골랐으면 마스터가 정본이다(번호판·배치도 상속).
    const masterRef = readMasterVehicleRef(body);
    if ('error' in masterRef) return NextResponse.json({ error: masterRef.error }, { status: 400 });
    const masterId = masterRef.present ? masterRef.id : null;
    const master = masterId ? await loadMasterVehicle(supabase, masterId) : null;
    if (masterId && !master) {
      return NextResponse.json({ error: '등록된 차량을 찾지 못했어요.' }, { status: 404 });
    }

    const resolved = resolveDispatchVehicle({
      master,
      requestedLayoutId: typeof body.layout_id === 'string' ? body.layout_id : null,
      requestedPlate: typeof body.plate_number === 'string' ? body.plate_number : null,
    });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: 400 });
    }
    const layoutId = resolved.layoutId;

    const { data: layout } = await supabase
      .from('ops_vehicle_layouts')
      .select('id, model, total_seats')
      .eq('id', layoutId)
      .maybeSingle();
    if (!layout) return NextResponse.json({ error: 'Layout not found' }, { status: 404 });

    // §K B0.4 — 차량의 진짜 소유자는 그룹이다(B0-D3). room_id도 계속 채우지만
    // 그건 롤백용 레거시 앵커이고, 그 예약이 취소돼도 차량은 그룹에 남는다.
    const group = await ensureTourGroup(supabase as never, {
      tour_id: room.tour_id,
      tour_date: room.tour_date,
    });

    const insert: Record<string, unknown> = {
      room_id: roomId,
      ...(group ? { group_id: group.id } : {}),
      layout_id: layoutId,
      plate_number: resolved.plateNumber,
      driver_participant_id:
        typeof body.driver_participant_id === 'string' && body.driver_participant_id
          ? body.driver_participant_id
          : null,
    };
    if (resolved.vehicleId) insert.vehicle_id = resolved.vehicleId;
    if (typeof body.driver_name === 'string') {
      insert.driver_name = body.driver_name.trim().slice(0, 60) || null;
    }

    let created = await supabase.from('ops_room_vehicles').insert(insert).select('id').single();
    if (created.error && 'driver_name' in insert) {
      // 마이그레이션 미적용 환경 — 라벨 없이라도 배차는 되게 한다.
      delete insert.driver_name;
      created = await supabase.from('ops_room_vehicles').insert(insert).select('id').single();
    }
    if (created.error && 'vehicle_id' in insert) {
      // 마스터 연결 컬럼이 없는 환경 — 번호판 텍스트만으로 배차는 성사시킨다.
      delete insert.vehicle_id;
      created = await supabase.from('ops_room_vehicles').insert(insert).select('id').single();
    }
    if (created.error) throw created.error;

    const vehicleId = (created.data as { id: string }).id;
    await recordRoomEvent(supabase, {
      roomId,
      bookingId: room.booking_id,
      type: 'vehicle_assigned',
      actorRole: 'admin',
      payload: {
        room_vehicle_id: vehicleId,
        layout_id: layoutId,
        model: (layout as { model?: string }).model ?? null,
        plate_number: insert.plate_number,
        master_vehicle_id: resolved.vehicleId,
        by: admin.id,
      },
    }).catch(() => undefined);
    await broadcastSeatUpdate(supabase, room, { reason: 'vehicle_assigned', room_vehicle_id: vehicleId });

    return NextResponse.json({ ok: true, id: vehicleId }, { status: 201 });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/tour-ops/rooms/[roomId]/vehicles]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { roomId } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const supabase = createServerClient();
    const room = await getOpsRoom(supabase, roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    // ── 되돌리기: 직전 변경의 스냅샷을 그대로 복원한다.
    if (typeof body.undo_event_id === 'string' && body.undo_event_id) {
      return undoVehicleChange(supabase, room, body.undo_event_id, admin.id);
    }

    const vehicleId = typeof body.vehicle_id === 'string' ? body.vehicle_id : '';
    if (!vehicleId) return NextResponse.json({ error: 'vehicle_id is required' }, { status: 400 });

    // 🔴 그룹 스코프. 조회가 그룹 단위인데 여기만 룸 단위였고, 그래서 앵커가
    // 아닌 팀에서 열면 차가 보이는데 손대면 404 였다 (lib/ops/seating/dispatchScope.ts).
    const vehicle = await vehicleInGroup(supabase, room, vehicleId);
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found in this tour group' }, { status: 404 });
    }

    // §2-1 — 등록 차량 선택/해제. 키가 없으면 기존 연결을 그대로 둔다.
    const masterRef = readMasterVehicleRef(body);
    if ('error' in masterRef) return NextResponse.json({ error: masterRef.error }, { status: 400 });
    const nextMasterId = masterRef.present ? masterRef.id : vehicle.vehicle_id;
    const master = nextMasterId ? await loadMasterVehicle(supabase, nextMasterId) : null;
    if (nextMasterId && !master) {
      return NextResponse.json({ error: '등록된 차량을 찾지 못했어요.' }, { status: 404 });
    }
    // 이미 붙어 있던 연결을 유지만 하는 경우에는 운행 중지 여부를 따지지 않는다 —
    // 과거의 배차 사실을 지금의 상태로 되돌려 거절하면 기사 이름 한 줄도 못 고친다.
    const linkChanged = masterRef.present && masterRef.id !== vehicle.vehicle_id;
    const masterForResolve = master ? (linkChanged ? master : { ...master, active: true }) : null;

    const resolved = resolveDispatchVehicle({
      master: masterForResolve,
      requestedLayoutId:
        typeof body.layout_id === 'string' && body.layout_id ? body.layout_id : vehicle.layout_id,
      requestedPlate:
        'plate_number' in body && typeof body.plate_number === 'string' ? body.plate_number : vehicle.plate_number,
    });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: 400 });
    }

    const nextLayoutId = resolved.layoutId;
    const layoutChanged = nextLayoutId !== vehicle.layout_id;

    // 설계안 §1-2 — 좌석을 줄이는 저장은 사유 없이는 막는다(안전 문제).
    // 늘리거나 그대로인 저장은 판정하지 않는다: 2호차를 붙이러 온 사람을 막으면
    // 시스템이 오버부킹을 고치는 유일한 길을 스스로 닫는다.
    const overrideReason = readOverrideReason(body.capacity_override_reason);
    if (layoutChanged || resolved.vehicleId !== vehicle.vehicle_id) {
      const { headcount, seatsByDispatch } = await loadSeatContext(supabase, room);
      const { data: nextLayoutSeats } = await supabase
        .from('ops_vehicle_layouts')
        .select('total_seats')
        .eq('id', nextLayoutId)
        .maybeSingle();
      const baseSeats = vehicle.layout_override_json
        ? vehicle.layout_override_json.seats.length
        : Number((nextLayoutSeats as { total_seats?: number | null } | null)?.total_seats ?? 0) || null;
      const nextSeats = resolveSeatCapacity(
        master ? { seat_capacity: master.seat_capacity } : null,
        baseSeats,
      );
      if (nextSeats != null) {
        const seatsBefore = [...seatsByDispatch.values()].reduce((sum, n) => sum + n, 0);
        const verdict = seatReductionVerdict({
          headcount,
          seatsBefore,
          seatsAfter: seatsBefore - (seatsByDispatch.get(vehicleId) ?? 0) + nextSeats,
        });
        if (verdict.blocked && !overrideReason) return seatShortfallResponse(verdict);
        if (verdict.blocked && overrideReason) {
          await recordRoomEvent(supabase, {
            roomId,
            bookingId: room.booking_id,
            type: 'vehicle_capacity_override',
            actorRole: 'admin',
            payload: {
              room_vehicle_id: vehicleId,
              reason: overrideReason,
              headcount: verdict.headcount,
              seats_before: verdict.seatsBefore,
              seats_after: verdict.seatsAfter,
              by: admin.id,
            },
          }).catch(() => undefined);
        }
      }
    }

    const assignments = await loadAssignmentsFor(supabase, vehicleId);

    let released: AssignmentRow[] = [];
    let strategy: Strategy = 'block';

    if (layoutChanged && assignments.length > 0) {
      const raw = typeof body.strategy === 'string' ? body.strategy : 'block';
      strategy = raw === 'keep' || raw === 'clear' ? raw : 'block';

      const { data: nextLayoutRow } = await supabase
        .from('ops_vehicle_layouts')
        .select('id, model, layout_json, total_seats')
        .eq('id', nextLayoutId)
        .maybeSingle();
      if (!nextLayoutRow) return NextResponse.json({ error: 'Layout not found' }, { status: 404 });

      // 오버라이드가 걸린 차량은 오버라이드가 계속 진실이다 (표준 교체와 무관).
      const effective =
        vehicle.layout_override_json ??
        normalizeLayoutJson((nextLayoutRow as { layout_json?: unknown }).layout_json);
      const available = seatNumbersOf(effective);
      const lost = assignments.filter((a) => !available.has(a.seat_number));

      if (strategy === 'block' || body.confirm !== true) {
        return NextResponse.json(
          {
            error: 'seats_assigned',
            message: `이 차량에 이미 ${assignments.length}석이 배정돼 있어요. 배치도를 바꾸면 ${
              lost.length > 0 ? `${lost.length}석이 해제돼요.` : '좌석 번호는 유지되지만 배치가 달라져요.'
            }`,
            assigned: assignments.map((a) => ({
              seat_number: a.seat_number,
              guest_label: a.guest_label,
              checked_in: Boolean(a.checked_in_at),
            })),
            lost: lost.map((a) => ({
              seat_number: a.seat_number,
              guest_label: a.guest_label,
              checked_in: Boolean(a.checked_in_at),
            })),
            strategies: ['keep', 'clear'],
          },
          { status: 409 },
        );
      }

      released = strategy === 'clear' ? assignments : lost;
      if (released.length > 0) {
        const { error } = await supabase
          .from('ops_seat_assignments')
          .delete()
          .in('id', released.map((a) => a.id));
        if (error) throw error;
      }
    }

    const update: Record<string, unknown> = { layout_id: nextLayoutId };
    // 마스터가 붙으면 번호판은 마스터에서 온다(정본 하나). 용차는 입력값 그대로.
    if ('plate_number' in body || resolved.vehicleId !== vehicle.vehicle_id) {
      update.plate_number = resolved.plateNumber;
    }
    if ('driver_participant_id' in body) {
      update.driver_participant_id =
        typeof body.driver_participant_id === 'string' && body.driver_participant_id
          ? body.driver_participant_id
          : null;
    }
    if ('driver_name' in body) {
      update.driver_name =
        typeof body.driver_name === 'string' && body.driver_name.trim()
          ? body.driver_name.trim().slice(0, 60)
          : null;
    }

    if (masterRef.present) update.vehicle_id = resolved.vehicleId;

    let updated = await supabase.from('ops_room_vehicles').update(update).eq('id', vehicleId);
    if (updated.error && 'driver_name' in update) {
      delete update.driver_name;
      updated = await supabase.from('ops_room_vehicles').update(update).eq('id', vehicleId);
    }
    if (updated.error && 'vehicle_id' in update) {
      delete update.vehicle_id;
      updated = await supabase.from('ops_room_vehicles').update(update).eq('id', vehicleId);
    }
    if (updated.error) throw updated.error;

    let undoEventId: string | null = null;
    if (layoutChanged) {
      const event = await recordRoomEvent(supabase, {
        roomId,
        bookingId: room.booking_id,
        type: 'vehicle_changed',
        actorRole: 'admin',
        payload: {
          room_vehicle_id: vehicleId,
          from_layout_id: vehicle.layout_id,
          to_layout_id: nextLayoutId,
          strategy,
          by: admin.id,
          // 되돌리기용 스냅샷 — 해제된 배정을 통째로 남긴다.
          released: released.map((a) => ({
            booking_id: a.booking_id,
            participant_id: a.participant_id,
            seat_number: a.seat_number,
            guest_label: a.guest_label,
            checked_in_at: a.checked_in_at,
            absent_at: a.absent_at,
            locked: a.locked,
          })),
        },
      }).catch(() => ({ inserted: false, event: null }));
      undoEventId = event.event?.id ?? null;
      await broadcastSeatUpdate(supabase, room, {
        reason: 'vehicle_changed',
        room_vehicle_id: vehicleId,
        released: released.map((a) => a.seat_number),
      });
    }

    return NextResponse.json({
      ok: true,
      released: released.map((a) => a.seat_number),
      strategy,
      undo_event_id: undoEventId,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PATCH /api/admin/tour-ops/rooms/[roomId]/vehicles]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { roomId } = await params;
    const supabase = createServerClient();

    const room = await getOpsRoom(supabase, roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const vehicleId = req.nextUrl.searchParams.get('vehicle_id') ?? '';
    if (!vehicleId) return NextResponse.json({ error: 'vehicle_id is required' }, { status: 400 });

    // 🔴 그룹 스코프. 조회가 그룹 단위인데 여기만 룸 단위였고, 그래서 앵커가
    // 아닌 팀에서 열면 차가 보이는데 손대면 404 였다 (lib/ops/seating/dispatchScope.ts).
    const vehicle = await vehicleInGroup(supabase, room, vehicleId);
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found in this tour group' }, { status: 404 });
    }

    // 설계안 §1-2 — 배차 해제는 좌석을 확실히 줄인다. 줄인 뒤 앉을 자리가 없어지면
    // 사유 없이는 막는다(`capacity_reason=`).
    const overrideReason = readOverrideReason(req.nextUrl.searchParams.get('capacity_reason'));
    const { headcount, seatsByDispatch } = await loadSeatContext(supabase, room);
    const seatsBefore = [...seatsByDispatch.values()].reduce((sum, n) => sum + n, 0);
    const verdict = seatReductionVerdict({
      headcount,
      seatsBefore,
      seatsAfter: seatsBefore - (seatsByDispatch.get(vehicleId) ?? 0),
    });
    if (verdict.blocked && !overrideReason) return seatShortfallResponse(verdict);

    const assignments = await loadAssignmentsFor(supabase, vehicleId);
    if (assignments.length > 0 && req.nextUrl.searchParams.get('confirm') !== '1') {
      return NextResponse.json(
        {
          error: 'seats_assigned',
          message: `배차를 해제하면 ${assignments.length}석의 좌석 배정이 함께 사라져요.`,
          assigned: assignments.map((a) => ({
            seat_number: a.seat_number,
            guest_label: a.guest_label,
            checked_in: Boolean(a.checked_in_at),
          })),
        },
        { status: 409 },
      );
    }

    // 스냅샷 먼저 (행 삭제는 ON DELETE CASCADE로 배정까지 지운다).
    const event = await recordRoomEvent(supabase, {
      roomId,
      bookingId: room.booking_id,
      type: 'vehicle_unassigned',
      actorRole: 'admin',
      payload: {
        room_vehicle_id: vehicleId,
        layout_id: vehicle.layout_id,
        plate_number: vehicle.plate_number,
        by: admin.id,
        // 좌석이 모자라지는 것을 알고도 해제했다면, 그 사유가 기록으로 남는다.
        ...(verdict.blocked && overrideReason
          ? { capacity_override_reason: overrideReason, headcount: verdict.headcount, seats_after: verdict.seatsAfter }
          : {}),
        released: assignments.map((a) => ({
          booking_id: a.booking_id,
          participant_id: a.participant_id,
          seat_number: a.seat_number,
          guest_label: a.guest_label,
          checked_in_at: a.checked_in_at,
          absent_at: a.absent_at,
          locked: a.locked,
        })),
      },
    }).catch(() => ({ inserted: false, event: null }));

    const { error } = await supabase.from('ops_room_vehicles').delete().eq('id', vehicleId);
    if (error) throw error;

    await broadcastSeatUpdate(supabase, room, { reason: 'vehicle_unassigned', room_vehicle_id: vehicleId });
    return NextResponse.json({ ok: true, released: assignments.length, event_id: event.event?.id ?? null });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DELETE /api/admin/tour-ops/rooms/[roomId]/vehicles]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

/**
 * 되돌리기 — `vehicle_changed` 이벤트의 스냅샷으로 배치도와 좌석을 복원한다.
 * 그 사이 다른 손님이 같은 번호를 잡았다면 그 좌석만 건너뛰고(UNIQUE 충돌),
 * 복원된 좌석 수를 응답에 그대로 돌려준다 — 조용히 덮어쓰지 않는다.
 */
async function undoVehicleChange(
  supabase: ReturnType<typeof createServerClient>,
  room: { id: string; booking_id: string; tour_id: string | null; tour_date: string | null; status: string },
  eventId: string,
  adminId: string,
): Promise<NextResponse> {
  const { data } = await supabase
    .from('tour_room_events')
    .select('id, room_id, type, payload')
    .eq('id', eventId)
    .maybeSingle();
  const event = data as { id: string; room_id: string; type: string; payload: Record<string, unknown> } | null;
  if (!event || event.room_id !== room.id || event.type !== 'vehicle_changed') {
    return NextResponse.json({ error: 'undo_target_not_found' }, { status: 404 });
  }

  const payload = event.payload ?? {};
  const vehicleId = String(payload.room_vehicle_id ?? '');
  const fromLayoutId = String(payload.from_layout_id ?? '');
  const released = Array.isArray(payload.released) ? (payload.released as Array<Record<string, unknown>>) : [];
  if (!vehicleId || !fromLayoutId) {
    return NextResponse.json({ error: 'undo_target_incomplete' }, { status: 409 });
  }

  const { error: layoutError } = await supabase
    .from('ops_room_vehicles')
    .update({ layout_id: fromLayoutId })
    .eq('id', vehicleId);
  if (layoutError) throw layoutError;

  let restored = 0;
  const skipped: number[] = [];
  for (const row of released) {
    const seatNumber = Number(row.seat_number);
    if (!Number.isInteger(seatNumber)) continue;
    const { error } = await supabase.from('ops_seat_assignments').insert({
      room_vehicle_id: vehicleId,
      booking_id: row.booking_id,
      participant_id: row.participant_id ?? null,
      seat_number: seatNumber,
      guest_label: row.guest_label ?? null,
      checked_in_at: row.checked_in_at ?? null,
      absent_at: row.absent_at ?? null,
      locked: row.locked ?? false,
    });
    if (error) skipped.push(seatNumber);
    else restored += 1;
  }

  await recordRoomEvent(supabase, {
    roomId: room.id,
    bookingId: room.booking_id,
    type: 'vehicle_change_undone',
    actorRole: 'admin',
    payload: { room_vehicle_id: vehicleId, undo_of: eventId, restored, skipped, by: adminId },
  }).catch(() => undefined);
  await broadcastSeatUpdate(supabase, room, { reason: 'vehicle_change_undone', room_vehicle_id: vehicleId });

  return NextResponse.json({ ok: true, restored, skipped });
}
