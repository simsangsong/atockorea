import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { getOpsRoom } from '@/lib/ops/seating/access';
import { broadcastSeatUpdate } from '@/lib/ops/seating/service';
import { loadLayoutUsage, selectRoomVehicles } from '@/lib/ops/seating/layoutUsage';
import { normalizeLayoutJson } from '@/lib/ops/seating/layoutEditor';
import { recordRoomEvent } from '@/lib/tour-room/events';
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
 *          배정된 차량 + 배치도 후보 + 기사 후보(룸에 입장한 driver 참가자).
 *   POST   { layout_id, plate_number?, driver_participant_id?, driver_name? }
 *   PATCH  { vehicle_id, ... , strategy?: 'block'|'keep'|'clear', confirm? }
 *          { undo_event_id }                      직전 변경 되돌리기
 *   DELETE ?vehicle_id=…&confirm=1
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

/** 배치도의 좌석번호 집합 (오버라이드가 있으면 그쪽이 진실). */
function seatNumbersOf(layout: VehicleLayoutJson | null): Set<number> {
  return new Set((layout?.seats ?? []).map((seat) => seat.n));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    await requireAdmin(req);
    const { roomId } = await params;
    const supabase = createServerClient();

    const room = await getOpsRoom(supabase, roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const { rows, migrationPending } = await selectRoomVehicles(supabase, { roomId });

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

    const vehicles = await Promise.all(
      rows.map(async (vehicle) => {
        const base = layoutById.get(vehicle.layout_id);
        const effective =
          vehicle.layout_override_json ?? ((base?.layout_json as VehicleLayoutJson | undefined) ?? null);
        const assignments = await loadAssignmentsFor(supabase, vehicle.id);
        return {
          id: vehicle.id,
          layout_id: vehicle.layout_id,
          model: base ? String(base.model) : null,
          display_name: (base?.display_name as Record<string, string> | undefined) ?? null,
          plate_number: vehicle.plate_number,
          driver_participant_id: vehicle.driver_participant_id,
          driver_name: vehicle.driver_name,
          has_override: Boolean(vehicle.layout_override_json),
          override_note: vehicle.override_note,
          total_seats: effective ? effective.seats.length : Number(base?.total_seats ?? 0),
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

    return NextResponse.json({
      room: { id: room.id, booking_id: room.booking_id, tour_id: room.tour_id, tour_date: room.tour_date },
      vehicles,
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

    const layoutId = typeof body.layout_id === 'string' ? body.layout_id : '';
    if (!layoutId) return NextResponse.json({ error: 'layout_id is required' }, { status: 400 });

    const { data: layout } = await supabase
      .from('ops_vehicle_layouts')
      .select('id, model, total_seats')
      .eq('id', layoutId)
      .maybeSingle();
    if (!layout) return NextResponse.json({ error: 'Layout not found' }, { status: 404 });

    const insert: Record<string, unknown> = {
      room_id: roomId,
      layout_id: layoutId,
      plate_number: typeof body.plate_number === 'string' && body.plate_number.trim()
        ? body.plate_number.trim().slice(0, 32)
        : null,
      driver_participant_id:
        typeof body.driver_participant_id === 'string' && body.driver_participant_id
          ? body.driver_participant_id
          : null,
    };
    if (typeof body.driver_name === 'string') {
      insert.driver_name = body.driver_name.trim().slice(0, 60) || null;
    }

    let created = await supabase.from('ops_room_vehicles').insert(insert).select('id').single();
    if (created.error && 'driver_name' in insert) {
      // 마이그레이션 미적용 환경 — 라벨 없이라도 배차는 되게 한다.
      delete insert.driver_name;
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

    const { rows } = await selectRoomVehicles(supabase, { ids: [vehicleId] });
    const vehicle = rows[0];
    if (!vehicle || vehicle.room_id !== roomId) {
      return NextResponse.json({ error: 'Vehicle not found in this room' }, { status: 404 });
    }

    const nextLayoutId = typeof body.layout_id === 'string' && body.layout_id ? body.layout_id : vehicle.layout_id;
    const layoutChanged = nextLayoutId !== vehicle.layout_id;
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
    if ('plate_number' in body) {
      update.plate_number =
        typeof body.plate_number === 'string' && body.plate_number.trim()
          ? body.plate_number.trim().slice(0, 32)
          : null;
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

    let updated = await supabase.from('ops_room_vehicles').update(update).eq('id', vehicleId);
    if (updated.error && 'driver_name' in update) {
      delete update.driver_name;
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

    const { rows } = await selectRoomVehicles(supabase, { ids: [vehicleId] });
    const vehicle = rows[0];
    if (!vehicle || vehicle.room_id !== roomId) {
      return NextResponse.json({ error: 'Vehicle not found in this room' }, { status: 404 });
    }

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
