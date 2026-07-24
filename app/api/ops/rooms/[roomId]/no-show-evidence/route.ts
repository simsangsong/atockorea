import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { resolveOpsRoomActor, isStaffActor } from '@/lib/ops/seating/access';
import { loadRoomVehicles, loadAssignments } from '@/lib/ops/seating/service';
import { maskName } from '@/lib/ops/inbox/commit';
import { requestGate } from '@/lib/durable-rate-limit';
import {
  buildWatermarkLines,
  composeWatermark,
  ensureEvidenceBucket,
  evidencePaths,
  evidenceSignedUrl,
  uploadEvidenceObject,
  validateEvidenceInput,
  type EvidenceStorageClient,
} from '@/lib/ops/seating/evidence';

export const dynamic = 'force-dynamic';

/**
 * 노쇼 증거팩 — AtoC 통합 플랜 §5.4b / D12.
 *
 * POST (multipart/form-data)
 *   photo(필수 이미지) · roomVehicleId · seatNumber · capturedAt(ISO) ·
 *   latitude/longitude/accuracyM(옵션) · gpsUnavailableReason(좌표 없으면 필수) ·
 *   note(옵션)
 *   → private 버킷 `ops-evidence`에 원본 업로드 + sharp 워터마크 합성본 업로드
 *   → ops_no_show_evidence insert → tour_room_events('no_show_evidence')
 *   → { ok, evidenceId, previewUrl(10분 서명) }
 *
 *   이 라우트가 성공해야만 /absent 의 action='mark'가 통과한다 (증거 강제).
 *
 * GET
 *   룸의 증거 목록 + 항목별 단기 서명 URL. admin 인쇄용 증거 시트가 소비한다.
 *
 * 가이드/기사/admin 전용. 사진은 절대 public 버킷에 올리지 않는다 — 분쟁 증거에
 * 사람과 현장이 찍히므로 조회는 서명 URL로만.
 */

const MAX_NOTE_LEN = 500;

function num(value: FormDataEntryValue | null): number {
  return Number(typeof value === 'string' ? value : NaN);
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const supabase = createServerClient();

    const resolved = await resolveOpsRoomActor(req, supabase, roomId);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { room, actor } = resolved;
    if (!isStaffActor(actor)) {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'ops_no_show_evidence',
      key: `room:${roomId}`,
      perMinute: 10,
      perHour: 120,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'multipart_required' }, { status: 400 });
    }
    const form = await req.formData();
    const photo = form.get('photo');
    if (!(photo instanceof File)) {
      return NextResponse.json({ error: 'photo_required', message: '현장 사진이 필요해요.' }, { status: 400 });
    }

    const roomVehicleId = str(form.get('roomVehicleId'));
    const seatNumber = num(form.get('seatNumber'));
    if (!roomVehicleId || !Number.isInteger(seatNumber)) {
      return NextResponse.json({ error: 'roomVehicleId, seatNumber are required' }, { status: 400 });
    }

    const validation = validateEvidenceInput({
      file: { type: photo.type, size: photo.size, name: photo.name },
      capturedAt: form.get('capturedAt'),
      latitude: form.get('latitude'),
      longitude: form.get('longitude'),
      accuracyM: form.get('accuracyM'),
      gpsUnavailableReason: form.get('gpsUnavailableReason'),
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.code, message: validation.message }, { status: 400 });
    }
    const value = validation.value;

    // 좌석 실재 확인 — absent 라우트와 동일한 방식(차량이 이 룸 소속인지 → 배정 행).
    const vehicles = await loadRoomVehicles(supabase, roomId);
    if (!vehicles.some((v) => v.id === roomVehicleId)) {
      return NextResponse.json({ error: 'vehicle_not_in_room' }, { status: 404 });
    }
    const rows = await loadAssignments(supabase, [roomVehicleId]);
    const target = rows.find((a) => a.seat_number === seatNumber);
    if (!target) return NextResponse.json({ error: 'seat_not_assigned' }, { status: 404 });

    // 표시명은 마스킹본만 저장한다 (§5.2 — "Massimo Cassina" → "Massimo C.").
    let rawLabel = target.guest_label ?? '';
    if (!rawLabel) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, contact_name')
        .eq('id', target.booking_id)
        .maybeSingle();
      rawLabel = ((booking as { contact_name?: string | null } | null)?.contact_name) ?? '';
    }
    const guestLabel = maskName(rawLabel);

    const bytes = Buffer.from(await photo.arrayBuffer());
    const paths = evidencePaths(roomId, value.ext);
    const recordedAt = new Date().toISOString();

    const storage = supabase as unknown as EvidenceStorageClient;
    await ensureEvidenceBucket(storage);
    try {
      await uploadEvidenceObject(storage, paths.originalPath, bytes, photo.type || 'image/jpeg');
    } catch (uploadError) {
      console.error('[ops-evidence] original upload failed:', uploadError);
      return NextResponse.json({ error: 'evidence_upload_failed' }, { status: 502 });
    }

    // 워터마크는 best-effort — 실패해도 원본으로 증거는 성립한다.
    const lines = buildWatermarkLines({
      capturedAt: value.capturedAt,
      recordedAt,
      latitude: value.latitude,
      longitude: value.longitude,
      accuracyM: value.accuracyM,
      gpsUnavailableReason: value.gpsUnavailableReason,
      seatNumber,
      guestLabel,
      tourDate: room.tour_date,
      roomId,
      actorRole: actor.role,
    });
    let watermarkedPath: string | null = null;
    const stamped = await composeWatermark(bytes, lines);
    if (stamped) {
      try {
        await uploadEvidenceObject(storage, paths.watermarkedPath, stamped, 'image/jpeg');
        watermarkedPath = paths.watermarkedPath;
      } catch (stampError) {
        console.warn('[ops-evidence] watermark upload failed; original kept:', stampError);
      }
    }

    const note = str(form.get('note')).slice(0, MAX_NOTE_LEN) || null;
    const { data: inserted, error: insertError } = await supabase
      .from('ops_no_show_evidence')
      .insert({
        room_id: roomId,
        room_vehicle_id: roomVehicleId,
        seat_number: seatNumber,
        booking_id: target.booking_id,
        seat_assignment_id: target.id,
        guest_label: guestLabel,
        photo_path: paths.originalPath,
        watermarked_path: watermarkedPath,
        captured_at: value.capturedAt,
        recorded_at: recordedAt,
        latitude: value.latitude,
        longitude: value.longitude,
        accuracy_m: value.accuracyM,
        gps_unavailable_reason: value.gpsUnavailableReason,
        actor_role: actor.role,
        actor_participant_id: null,
        device_user_agent: (req.headers.get('user-agent') ?? '').slice(0, 400) || null,
        note,
      })
      .select('id')
      .single();
    if (insertError || !inserted) {
      console.error('[ops-evidence] insert failed:', insertError);
      return NextResponse.json({ error: 'evidence_save_failed' }, { status: 500 });
    }
    const evidenceId = (inserted as { id: string }).id;

    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: target.booking_id,
      type: 'no_show_evidence',
      actorRole: actor.role === 'admin' ? 'admin' : actor.role,
      payload: {
        evidence_id: evidenceId,
        room_vehicle_id: roomVehicleId,
        seat_number: seatNumber,
        captured_at: value.capturedAt,
        has_gps: value.latitude !== null,
        watermarked: Boolean(watermarkedPath),
        actor_name: actor.role === 'admin' ? 'admin' : actor.displayName,
      },
    }).catch(() => undefined);

    const previewUrl = await evidenceSignedUrl(storage, watermarkedPath ?? paths.originalPath);
    return NextResponse.json({
      ok: true,
      evidenceId,
      previewUrl,
      watermarked: Boolean(watermarkedPath),
    });
  } catch (error) {
    console.error('POST /api/ops/rooms/[roomId]/no-show-evidence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface EvidenceRow {
  id: string;
  room_vehicle_id: string;
  seat_number: number;
  booking_id: string;
  guest_label: string | null;
  photo_path: string;
  watermarked_path: string | null;
  captured_at: string;
  recorded_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  gps_unavailable_reason: string | null;
  actor_role: string | null;
  device_user_agent: string | null;
  note: string | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const supabase = createServerClient();

    const resolved = await resolveOpsRoomActor(req, supabase, roomId);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { room, actor } = resolved;
    if (!isStaffActor(actor)) {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('ops_no_show_evidence')
      .select(
        'id, room_vehicle_id, seat_number, booking_id, guest_label, photo_path, watermarked_path, captured_at, recorded_at, latitude, longitude, accuracy_m, gps_unavailable_reason, actor_role, device_user_agent, note',
      )
      .eq('room_id', roomId)
      .order('recorded_at', { ascending: false })
      .limit(200);
    if (error) {
      // 마이그레이션 미적용(42P01)은 읽기에서만 관대하게 — 빈 시트로 렌더한다.
      console.warn('[ops-evidence] list failed:', error);
      return NextResponse.json({ ok: true, room: { id: room.id, tourDate: room.tour_date }, evidence: [] });
    }

    const storage = supabase as unknown as EvidenceStorageClient;
    const rows = (Array.isArray(data) ? data : []) as EvidenceRow[];
    const evidence = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        roomVehicleId: row.room_vehicle_id,
        seatNumber: row.seat_number,
        bookingId: row.booking_id,
        guestLabel: row.guest_label,
        capturedAt: row.captured_at,
        recordedAt: row.recorded_at,
        latitude: row.latitude,
        longitude: row.longitude,
        accuracyM: row.accuracy_m,
        gpsUnavailableReason: row.gps_unavailable_reason,
        actorRole: row.actor_role,
        deviceUserAgent: row.device_user_agent,
        note: row.note,
        photoUrl: await evidenceSignedUrl(storage, row.photo_path),
        watermarkedUrl: await evidenceSignedUrl(storage, row.watermarked_path),
      })),
    );

    return NextResponse.json({
      ok: true,
      room: { id: room.id, tourDate: room.tour_date, bookingId: room.booking_id },
      evidence,
    });
  } catch (error) {
    console.error('GET /api/ops/rooms/[roomId]/no-show-evidence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
