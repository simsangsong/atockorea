import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { OPS_TENANT_ID } from '@/lib/ops/tenant';
import { resolveRate, type GuideRateRow } from '@/lib/ops/guides/rates';
import { ASSIGNMENT_NOTIFY_LIMIT } from '@/lib/ops/guides/bulkLimits';
import { issueGuideScheduleLink } from '@/lib/ops/guides/selfToken';
import {
  groupByGuide,
  noticeBody,
  noticeHtml,
  noticeSubject,
  type NoticeAssignment,
} from '@/lib/ops/guides/assignmentNotice';

export const dynamic = 'force-dynamic';


/**
 * 가이드 배정 안내 메일 (손님 안내 체인의 가이드 쪽 짝).
 *
 *   POST /api/admin/guides/assignments/notify   { ids: string[] }
 *
 * 손님에게는 D-1 안내가 나가는데 가이드에게는 아무것도 안 나가고 있었다. 배정은
 * 원장에만 적히고 실제 통보는 카톡·전화로 일어나 기록이 남지 않았다.
 *
 * · **가이드 1명당 메일 1통** — 8건 배정된 사람에게 8통을 보내면 안 읽는다.
 * · 손님 PII 없음 — 가이드에게 필요한 건 날짜·투어·시각·인원·단가다.
 * · 발송 결과는 `notified_at` 에 남고, 실패·주소없음은 **건별로 보고**한다.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const rawIds = Array.isArray(body?.ids) ? body!.ids : null;
    if (!rawIds || rawIds.length === 0) {
      return NextResponse.json({ error: '안내할 배정을 선택해 주세요.', code: 'ids_required' }, { status: 400 });
    }
    const ids = [...new Set(rawIds.filter((v): v is string => typeof v === 'string' && v.length > 0))];
    if (ids.length === 0) {
      return NextResponse.json({ error: '안내할 배정을 선택해 주세요.', code: 'ids_required' }, { status: 400 });
    }
    if (ids.length > ASSIGNMENT_NOTIFY_LIMIT) {
      return NextResponse.json(
        { error: `한 번에 ${ASSIGNMENT_NOTIFY_LIMIT}건까지만 안내할 수 있어요.`, code: 'too_many' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const { data: rows, error } = await supabase
      .from('ops_guide_assignments')
      .select('id, guide_id, tour_date, tour_type, role, start_time, end_time, amount_krw, note, status, booking_id')
      .eq('tenant_id', OPS_TENANT_ID)
      .in('id', ids);
    if (error) {
      console.error('[POST assignments/notify] load', error);
      return NextResponse.json({ error: '배정을 불러오지 못했습니다', details: error.message }, { status: 500 });
    }

    // 취소된 배정을 안내하면 가이드가 나온다. 조용히 빼지 않고 보고한다.
    const all = (rows ?? []) as Array<{
      id: string;
      guide_id: string;
      tour_date: string;
      tour_type: string;
      role: string;
      start_time: string | null;
      end_time: string | null;
      amount_krw: number | null;
      note: string | null;
      status: string;
      booking_id: string | null;
    }>;
    const live = all.filter((r) => r.status !== 'cancelled');
    const cancelled = all.filter((r) => r.status === 'cancelled');
    if (live.length === 0) {
      return NextResponse.json(
        { error: '안내할 수 있는 배정이 없습니다(전부 취소됨).', code: 'all_cancelled' },
        { status: 422 },
      );
    }

    const guideIds = [...new Set(live.map((r) => r.guide_id))];
    const bookingIds = [...new Set(live.map((r) => r.booking_id).filter(Boolean))] as string[];

    const [guidesRes, ratesRes, bookingsRes] = await Promise.all([
      supabase.from('ops_guides').select('id, name, email').in('id', guideIds),
      supabase
        .from('ops_guide_rates')
        .select('id, guide_id, tour_type, amount_krw, effective_from, note')
        .eq('tenant_id', OPS_TENANT_ID)
        .limit(2000),
      bookingIds.length
        ? supabase.from('bookings').select('id, number_of_guests, tour_id').in('id', bookingIds)
        : Promise.resolve({ data: [] as Array<{ id: string; number_of_guests: number | null; tour_id: string | null }> }),
    ]);

    const guides = new Map(
      ((guidesRes.data ?? []) as Array<{ id: string; name: string; email: string | null }>).map((g) => [
        g.id,
        { name: g.name, email: g.email },
      ]),
    );
    const rates = (ratesRes.data ?? []) as unknown as GuideRateRow[];
    const bookings = new Map(
      ((bookingsRes.data ?? []) as Array<{ id: string; number_of_guests: number | null; tour_id: string | null }>).map(
        (b) => [b.id, b],
      ),
    );
    const tourIds = [...new Set([...bookings.values()].map((b) => b.tour_id).filter(Boolean))] as string[];
    const { data: tours } = tourIds.length
      ? await supabase.from('tours').select('id, title').in('id', tourIds)
      : { data: [] as Array<{ id: string; title: string | null }> };
    const tourTitles = new Map((tours ?? []).map((t) => [t.id, t.title]));

    const enriched: Array<NoticeAssignment & { guideId: string }> = live.map((r) => {
      const booking = r.booking_id ? bookings.get(r.booking_id) : undefined;
      // 스냅샷이 없으면 단가표에서 푼다. 그래도 없으면 null — 0원으로 적으면
      // 무보수로 합의한 것처럼 읽힌다.
      const resolved =
        typeof r.amount_krw === 'number'
          ? r.amount_krw
          : (resolveRate(rates, { guideId: r.guide_id, tourType: r.tour_type, onDate: r.tour_date })?.amountKrw ?? null);
      return {
        id: r.id,
        guideId: r.guide_id,
        tourDate: r.tour_date,
        tourType: r.tour_type,
        role: r.role,
        startTime: r.start_time,
        endTime: r.end_time,
        note: r.note,
        amountKrw: resolved,
        guests: booking?.number_of_guests ?? null,
        tourTitle: booking?.tour_id ? (tourTitles.get(booking.tour_id) ?? null) : null,
      };
    });

    const plan = groupByGuide(enriched, guides);

    let sent = 0;
    const failures: Array<{ guideName: string; reason: string }> = [];
    const notifiedIds: string[] = [];

    for (const entry of plan) {
      if (!entry.email || !entry.email.includes('@')) {
        failures.push({ guideName: entry.guideName, reason: '이메일 주소 없음' });
        continue;
      }
      // §2-5 — 셀프 스케줄 링크. 지금까지 `noticeBody`가 받을 준비만 돼 있고
      // 아무도 채우지 않아, 가이드는 "일정 바뀌면 회신하세요"만 받았다. 링크
      // 발급은 서명 한 번이라 별도 라우트를 부를 이유가 없다(자기 API를 HTTP로
      // 다시 부르면 인증·타임아웃·리전 문제를 새로 만든다).
      const scheduleLink = issueGuideScheduleLink({
        guideId: entry.guideId,
        name: entry.guideName,
        origin: process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin,
      }).url;
      const text = noticeBody({ guideName: entry.guideName, assignments: entry.assignments, scheduleLink });
      try {
        const result = await sendEmail({
          to: entry.email,
          subject: noticeSubject({ guideName: entry.guideName, assignments: entry.assignments }),
          html: noticeHtml(text),
          text,
        });
        if (!result.success) throw new Error(result.error ?? 'send failed');
        sent += 1;
        notifiedIds.push(...entry.assignments.map((a) => a.id));
      } catch (e) {
        failures.push({ guideName: entry.guideName, reason: e instanceof Error ? e.message : String(e) });
      }
    }

    // 보낸 것만 표시한다. 실패한 사람의 배정은 계속 "안내 안 함"으로 남아야
    // 다음에 다시 시도할 대상으로 보인다.
    if (notifiedIds.length > 0) {
      const { error: markError } = await supabase
        .from('ops_guide_assignments')
        .update({ notified_at: new Date().toISOString() })
        .in('id', notifiedIds);
      if (markError) console.error('[POST assignments/notify] mark', markError);
    }

    return NextResponse.json({
      guides: plan.length,
      sent,
      failedCount: failures.length,
      failures,
      notifiedAssignments: notifiedIds.length,
      cancelledSkipped: cancelled.length,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/guides/assignments/notify]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
