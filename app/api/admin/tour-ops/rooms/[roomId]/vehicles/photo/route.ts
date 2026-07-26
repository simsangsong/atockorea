import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { getOpsRoom } from '@/lib/ops/seating/access';
import { selectRoomVehicles } from '@/lib/ops/seating/layoutUsage';
import {
  ensureLayoutPhotoBucket,
  layoutPhotoSignedUrl,
  roomVehiclePhotoPath,
  uploadLayoutPhoto,
  validateLayoutPhoto,
  type LayoutPhotoStorageClient,
} from '@/lib/ops/seating/layoutPhoto';

export const dynamic = 'force-dynamic';

/**
 * 배차 차량 사진 (옵션) — 렌트 운영 대응.
 *
 *   POST   /api/admin/tour-ops/rooms/[roomId]/vehicles/photo   multipart: vehicle_id, photo
 *   DELETE …/photo?vehicle_id=…
 *
 * 왜 별도 라우트인가: 형제 라우트(`…/vehicles`)의 POST는 JSON 배차 생성이다.
 * 같은 핸들러에서 content-type으로 갈라 두 가지 일을 시키면, 다음 사람이 둘 중
 * 하나만 보고 고친다.
 *
 * 🔴 `vehicle_id`는 **배차 행 id**(`ops_room_vehicles.id`)다. 차량 마스터가 아니다 —
 * 형제 라우트와 같은 규약이고, 마스터는 요청에서 `master_vehicle_id`로만 부른다.
 *
 * 저장 규약은 실차 사진과 동일하다: **private 버킷 + path 저장 + 단기 서명 URL.**
 * 차 안에는 기사·손님이 찍힐 수 있어서 public URL을 만들지 않는다. 버킷도 새로
 * 만들지 않고 `ops-vehicle-refs`를 경로로 나눠 쓴다.
 *
 * ⚠ 이미 있는 것과 구분: 기사 콕핏의 [차량사진]은 **손님 채팅으로 보내는** 사진이고
 * (Cockpit.tsx B1), 여기는 **관제가 보관하는** 배차 기록이다. 목적이 다르다.
 */

async function loadDispatch(
  supabase: ReturnType<typeof createServerClient>,
  roomId: string,
  vehicleId: string,
) {
  const { rows } = await selectRoomVehicles(supabase, { ids: [vehicleId] });
  const vehicle = rows[0];
  return vehicle && vehicle.room_id === roomId ? vehicle : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    await requireAdmin(req);
    const { roomId } = await params;
    const supabase = createServerClient();

    const room = await getOpsRoom(supabase, roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const form = await req.formData().catch(() => null);
    const vehicleId = typeof form?.get('vehicle_id') === 'string' ? String(form.get('vehicle_id')) : '';
    if (!vehicleId) return NextResponse.json({ error: 'vehicle_id is required' }, { status: 400 });

    const vehicle = await loadDispatch(supabase, roomId, vehicleId);
    if (!vehicle) return NextResponse.json({ error: 'Vehicle not found in this room' }, { status: 404 });

    const file = form?.get('photo');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'photo_required', message: '사진을 골라 주세요.' }, { status: 400 });
    }

    const blob = file as unknown as { type: string; size: number; name: string; arrayBuffer(): Promise<ArrayBuffer> };
    const validation = validateLayoutPhoto({ type: blob.type, size: blob.size, name: blob.name });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.code, message: validation.message }, { status: 400 });
    }

    const bytes = Buffer.from(await blob.arrayBuffer());
    const path = roomVehiclePhotoPath(vehicleId, validation.ext);
    const storage = supabase as unknown as LayoutPhotoStorageClient;
    await ensureLayoutPhotoBucket(storage);
    await uploadLayoutPhoto(storage, path, bytes, blob.type);

    const { error } = await supabase.from('ops_room_vehicles').update({ photo_path: path }).eq('id', vehicleId);
    if (error) throw error;

    return NextResponse.json(
      { ok: true, photo_url: await layoutPhotoSignedUrl(storage, path) },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/tour-ops/rooms/[roomId]/vehicles/photo]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

/**
 * 사진 지우기 — DB 참조만 끊는다. 스토리지 객체는 남긴다: 잘못 지운 사진을
 * 되돌릴 방법이 있어야 하고, 경로는 매번 새로 만들어져 덮어쓰기 사고도 없다.
 * (오래된 객체 정리는 보관 정책의 일이지 이 버튼의 일이 아니다.)
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    await requireAdmin(req);
    const { roomId } = await params;
    const supabase = createServerClient();

    const room = await getOpsRoom(supabase, roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const vehicleId = req.nextUrl.searchParams.get('vehicle_id') ?? '';
    if (!vehicleId) return NextResponse.json({ error: 'vehicle_id is required' }, { status: 400 });

    const vehicle = await loadDispatch(supabase, roomId, vehicleId);
    if (!vehicle) return NextResponse.json({ error: 'Vehicle not found in this room' }, { status: 404 });

    const { error } = await supabase.from('ops_room_vehicles').update({ photo_path: null }).eq('id', vehicleId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DELETE /api/admin/tour-ops/rooms/[roomId]/vehicles/photo]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
