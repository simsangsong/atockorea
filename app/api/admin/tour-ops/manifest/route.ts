import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import type { ManifestBooking } from '@/lib/ops/manifest/group';

export const dynamic = 'force-dynamic';

/**
 * AtoC 통합 Phase 2 — 명단(Roster) 데이터 (plan §3.2).
 *
 * GET /api/admin/tour-ops/manifest?tourId=<uuid>&date=YYYY-MM-DD
 * (tour_id, tour_date) 룸에 속한 bookings — 명단은 별도 테이블이 아니라
 * bookings의 파생 뷰다. 취소 예약은 자동 제외 (plan A-7d). 픽업지는
 * pickup_points(자체 주문) → ota_raw_meta.pickup_*(OTA 파싱) 순으로 해석.
 * ops_whatsapp_send_logs가 아직 미적용이면 wa 상태는 조용히 비운다
 * (graceful degrade — 마이그레이션 적용 전에도 명단은 동작).
 */

interface BookingRow {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  number_of_guests: number | null;
  preferred_language: string | null;
  status: string | null;
  source: string | null;
  external_booking_id: string | null;
  special_requests: string | null;
  ota_raw_meta: Record<string, unknown> | null;
  pickup_points: { name?: string | null; pickup_time?: string | null } | Array<{ name?: string | null; pickup_time?: string | null }> | null;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const tourId = req.nextUrl.searchParams.get('tourId') ?? '';
    const date = req.nextUrl.searchParams.get('date') ?? '';
    if (!tourId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'tourId and date (YYYY-MM-DD) required' }, { status: 400 });
    }

    const [{ data: tour }, { data: bookings, error }] = await Promise.all([
      supabase.from('tours').select('id, title, city').eq('id', tourId).maybeSingle(),
      supabase
        .from('bookings')
        .select(
          'id, contact_name, contact_phone, contact_email, number_of_guests, preferred_language, status, source, external_booking_id, special_requests, ota_raw_meta, pickup_points ( name, pickup_time )',
        )
        .eq('tour_id', tourId)
        .eq('tour_date', date)
        .neq('status', 'cancelled'),
    ]);
    if (error) throw error;

    const rows = (bookings ?? []) as unknown as BookingRow[];

    // wa 발송 로그 (테이블 미적용 시 조용히 스킵).
    const waByBooking = new Map<string, { openedAt: string | null; markedSentAt: string | null }>();
    if (rows.length > 0) {
      try {
        const { data: logs } = await supabase
          .from('ops_whatsapp_send_logs')
          .select('booking_id, opened_at, marked_sent_at, created_at')
          .in('booking_id', rows.map((r) => r.id))
          .order('created_at', { ascending: false });
        for (const log of (logs ?? []) as Array<{ booking_id: string; opened_at: string | null; marked_sent_at: string | null }>) {
          const existing = waByBooking.get(log.booking_id);
          if (!existing) {
            waByBooking.set(log.booking_id, { openedAt: log.opened_at, markedSentAt: log.marked_sent_at });
          } else if (!existing.markedSentAt && log.marked_sent_at) {
            existing.markedSentAt = log.marked_sent_at;
          }
        }
      } catch {
        /* graceful — ops_whatsapp_send_logs 미적용 */
      }
    }

    const manifest: ManifestBooking[] = rows.map((row) => {
      const point = Array.isArray(row.pickup_points) ? row.pickup_points[0] : row.pickup_points;
      const meta = row.ota_raw_meta ?? {};
      const pickupName =
        (point?.name as string | undefined) ??
        (typeof meta.pickup_normalized === 'string' ? meta.pickup_normalized : null) ??
        (typeof meta.pickup_raw === 'string' ? meta.pickup_raw : null);
      const pickupTime =
        (point?.pickup_time as string | undefined) ??
        (typeof meta.pickup_time === 'string' ? meta.pickup_time : null);
      const wa = waByBooking.get(row.id);
      return {
        id: row.id,
        contactName: row.contact_name,
        contactPhone: row.contact_phone,
        contactEmail: row.contact_email,
        partySize: row.number_of_guests ?? 1,
        preferredLanguage: row.preferred_language,
        status: row.status,
        source: row.source,
        externalBookingId: row.external_booking_id,
        pickupName: pickupName ?? null,
        pickupTime: pickupTime ?? null,
        specialRequests: row.special_requests,
        waOpenedAt: wa?.openedAt ?? null,
        waMarkedSentAt: wa?.markedSentAt ?? null,
      };
    });

    return NextResponse.json({
      tour: tour ?? null,
      date,
      bookings: manifest,
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('GET /api/admin/tour-ops/manifest error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
