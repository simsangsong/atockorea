import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { maskGuestName } from '@/lib/ops/seating/claim';
import {
  RECLAIM_EVENT_TYPES,
  buildReclaimQueue,
  maskDeviceKey,
  type ReclaimEventLike,
} from '@/lib/ops/reclaim';

export const dynamic = 'force-dynamic';

/**
 * 재claim 승인 큐 — AtoC 통합 플랜 §5.2 C-5.
 *
 * GET /api/admin/tour-ops/reclaims?status=pending|all&days=30
 *
 * 서버는 이미 "이미 등록된 예약에 다른 디바이스가 재등록을 시도했다"를
 * tour_room_events(`reclaim_requested`)로 남기고 ops 푸시를 쏜다. 지금까지는
 * 그 푸시를 본 사람이 SQL로 처리해야 했다. 이 라우트가 그 큐의 조회면이다.
 *
 * 반환 정보는 판정에 필요한 최소치만: 예약(마스킹 이름·인원)·투어일·
 * 요청 디바이스(마스킹 키)·요청 시각·현재 등록된 디바이스의 마지막 접속.
 * 연락처는 담지 않는다 (§5.2 C-1 PII 최소화 규약).
 */

const DEFAULT_DAYS = 30;

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();

    const status = req.nextUrl.searchParams.get('status') === 'all' ? 'all' : 'pending';
    const days = Math.min(180, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || DEFAULT_DAYS));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('tour_room_events')
      .select('id, room_id, booking_id, type, actor_role, subject_key, payload, created_at')
      .in('type', [...RECLAIM_EVENT_TYPES])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;

    const queue = buildReclaimQueue((data ?? []) as ReclaimEventLike[]);
    const rows = status === 'pending' ? queue.filter((row) => row.status === 'pending') : queue;

    // 예약·투어·현재 디바이스 보강.
    const bookingIds = [...new Set(rows.map((row) => row.bookingId))];
    const bookings = new Map<
      string,
      { contact_name: string | null; number_of_guests: number | null; tour_id: string | null; tour_date: string | null }
    >();
    if (bookingIds.length > 0) {
      const { data: bookingRows } = await supabase
        .from('bookings')
        .select('id, contact_name, number_of_guests, tour_id, tour_date')
        .in('id', bookingIds);
      for (const row of (bookingRows ?? []) as Array<{
        id: string;
        contact_name: string | null;
        number_of_guests: number | null;
        tour_id: string | null;
        tour_date: string | null;
      }>) {
        bookings.set(row.id, row);
      }
    }

    const tourIds = [...new Set([...bookings.values()].map((b) => b.tour_id).filter(Boolean))] as string[];
    const tourTitles = new Map<string, string | null>();
    if (tourIds.length > 0) {
      const { data: tourRows } = await supabase.from('tours').select('id, title').in('id', tourIds);
      for (const row of (tourRows ?? []) as Array<{ id: string; title: string | null }>) {
        tourTitles.set(row.id, row.title);
      }
    }

    const incumbents = new Map<string, { device_key: string; display_name: string; last_seen_at: string | null }>();
    if (bookingIds.length > 0) {
      const { data: participantRows } = await supabase
        .from('tour_room_participants')
        .select('booking_id, device_key, display_name, last_seen_at, is_lead, created_at')
        .in('booking_id', bookingIds)
        .eq('role', 'customer');
      for (const row of (participantRows ?? []) as Array<{
        booking_id: string;
        device_key: string;
        display_name: string;
        last_seen_at: string | null;
        is_lead: boolean;
      }>) {
        const existing = incumbents.get(row.booking_id);
        if (!existing || row.is_lead) {
          incumbents.set(row.booking_id, {
            device_key: row.device_key,
            display_name: row.display_name,
            last_seen_at: row.last_seen_at,
          });
        }
      }
    }

    return NextResponse.json({
      data: rows.map((row) => {
        const booking = bookings.get(row.bookingId) ?? null;
        const incumbent = incumbents.get(row.bookingId) ?? null;
        return {
          subject_key: row.subjectKey,
          room_id: row.roomId,
          booking_id: row.bookingId,
          device_key: row.deviceKey,
          device_key_masked: maskDeviceKey(row.deviceKey),
          requested_at: row.requestedAt,
          status: row.status,
          decided_at: row.decidedAt,
          decision_payload: row.decisionPayload,
          guest_name: maskGuestName(booking?.contact_name ?? null),
          party_size: Math.max(1, booking?.number_of_guests ?? 1),
          tour_date: booking?.tour_date ?? null,
          tour_title: booking?.tour_id ? tourTitles.get(booking.tour_id) ?? null : null,
          current_device_masked: incumbent ? maskDeviceKey(incumbent.device_key) : null,
          current_device_is_requester: incumbent ? incumbent.device_key === row.deviceKey : false,
          current_device_last_seen: incumbent?.last_seen_at ?? null,
        };
      }),
      pending_count: queue.filter((row) => row.status === 'pending').length,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/tour-ops/reclaims]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
