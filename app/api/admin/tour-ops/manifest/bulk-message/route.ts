import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { ensureRoom, type RoomDbClient } from '@/lib/tour-room/access';
import { hashToken, signCustomerRoomToken } from '@/lib/tour-room/token';
import { OPS_TENANT_ID } from '@/lib/ops/tenant';
import { WA_PRESET_KEYS, type WaPresetKey } from '@/lib/ops/whatsapp/presets';
import {
  composeForRecipient,
  isMessageChannel,
  planBulkEmail,
  type MessageChannel,
  type RecipientInput,
} from '@/lib/ops/messaging/guestMessage';
import { getForecastCached, loadTemplate, sendLogRow } from '@/lib/ops/messaging/guestMessageLoad';

export const dynamic = 'force-dynamic';

/**
 * 손님 안내 메시지 — 미리보기 + 원버튼 일괄 발송 (M3, 플랜 §13.3).
 *
 *   GET  ?tourId=&date=&preset=&channel=email|whatsapp
 *        → 수신자별 렌더된 제목·본문 + 개인 링크 + 날씨 줄. **보내기 전에 그대로 보여준다.**
 *   POST { tourId, date, preset, subject, body, bookingIds? }
 *        → 화면이 확인한 문구로 일괄 발송.
 *
 * 🔴 **미리보기에서 본 그대로 나간다.** POST는 화면이 보낸 본문을 받아 수신자별
 * 변수만 채운다 — 서버가 템플릿을 다시 읽으면, 운영자가 화면에서 고친 문구가
 * 아니라 저장된 문구가 나가는 사고가 생긴다.
 *
 * 🔴 이 라우트는 **이메일만 실제로 보낸다.** 왓츠앱은 wa.me 딥링크(사람이 탭)이고,
 * Business API 자동 발송은 이 저장소에서 금지다(v1.2 §4.4). 왓츠앱 채널로 부르면
 * 미리보기와 딥링크만 돌려준다.
 */

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com').replace(/\/$/, '');
}

interface BookingRow {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  preferred_language: string | null;
  status: string | null;
  pickup_points: { name?: string | null; pickup_time?: string | null } | Array<{ name?: string | null; pickup_time?: string | null }> | null;
}

function pickupOf(row: BookingRow): { name: string | null; time: string | null } {
  const p = Array.isArray(row.pickup_points) ? row.pickup_points[0] : row.pickup_points;
  return { name: p?.name ?? null, time: p?.pickup_time ?? null };
}

/**
 * 예약별 개인 링크를 발급한다(§K B0.3). 실패는 null — 상위가 발송에서 뺀다.
 * 링크 없는 안내 메일은 안 보낸 것보다 나쁘다(손님은 받았다고 생각하고 기다린다).
 */
async function mintRoomLink(
  supabase: ReturnType<typeof createServerClient>,
  booking: { id: string; tour_id: string | null; tour_date: string; contact_name: string | null },
  adminId: string,
): Promise<string | null> {
  try {
    await ensureRoom(supabase as unknown as RoomDbClient, {
      id: booking.id,
      tour_id: booking.tour_id,
      tour_date: booking.tour_date,
    });
    const minted = signCustomerRoomToken({
      bookingId: booking.id,
      displayName: booking.contact_name || 'Guest',
      tourDate: booking.tour_date,
    });
    const { error } = await supabase.from('tour_room_invites').insert({
      booking_id: booking.id,
      tour_id: booking.tour_id,
      tour_date: booking.tour_date,
      role: 'customer',
      display_name: booking.contact_name || 'Guest',
      token_hash: hashToken(minted.token),
      sent_via: 'ops-bulk-message',
      expires_at: new Date(minted.payload.exp * 1000).toISOString(),
      created_by: adminId,
    });
    if (error) return null;
    return `${appUrl()}/tour-mode/room/${booking.id}?rt=${minted.token}`;
  } catch {
    return null;
  }
}

async function loadContext(
  supabase: ReturnType<typeof createServerClient>,
  tourId: string,
  date: string,
) {
  const [{ data: tour }, { data: bookings, error }] = await Promise.all([
    supabase.from('tours').select('id, title, city').eq('id', tourId).maybeSingle(),
    supabase
      .from('bookings')
      .select(
        'id, contact_name, contact_phone, contact_email, preferred_language, status, pickup_points ( name, pickup_time )',
      )
      .eq('tour_id', tourId)
      .eq('tour_date', date)
      .neq('status', 'cancelled'),
  ]);
  if (error) throw new Error(error.message);
  return {
    tour: (tour as { id: string; title: string | null; city: string | null } | null) ?? null,
    rows: (bookings ?? []) as unknown as BookingRow[],
  };
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const sp = req.nextUrl.searchParams;
    const tourId = sp.get('tourId') ?? '';
    const date = sp.get('date') ?? '';
    const preset = (sp.get('preset') ?? 'pickup_d1') as WaPresetKey;
    const channelParam = sp.get('channel') ?? 'email';

    if (!tourId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'tourId and date (YYYY-MM-DD) required' }, { status: 400 });
    }
    if (!(WA_PRESET_KEYS as readonly string[]).includes(preset)) {
      return NextResponse.json({ error: 'unknown preset' }, { status: 400 });
    }
    if (!isMessageChannel(channelParam)) {
      return NextResponse.json({ error: 'channel must be email or whatsapp' }, { status: 400 });
    }
    const channel: MessageChannel = channelParam;

    const supabase = createServerClient();
    const { tour, rows } = await loadContext(supabase, tourId, date);
    if (rows.length === 0) {
      return NextResponse.json({ tourId, date, preset, channel, recipients: [], forecast: null, template: null });
    }

    // 예보는 **투어일** 기준이다. D-1 안내를 전날 저녁에 보내므로 "내일 날씨"가 곧 투어일 날씨.
    const forecast = await getForecastCached(supabase, tour?.city ?? null, date);

    // 미리보기는 링크를 발급하지 않는다 — 확인만 하려고 토큰을 20개 찍어내면
    // 실제로 보내지 않은 링크가 원장에 남는다. 자리표시자로 모양만 보여준다.
    const previewLink = `${appUrl()}/tour-mode/room/…`;

    const recipients = [];
    let templateSource: string | null = null;
    for (const row of rows) {
      const locale = row.preferred_language ?? 'en';
      const tpl = await loadTemplate(supabase, { tourId, presetKey: preset, locale, channel });
      templateSource = tpl.source;
      const pickup = pickupOf(row);
      const input: RecipientInput = {
        bookingId: row.id,
        guestName: row.contact_name ?? 'Guest',
        email: row.contact_email,
        phone: row.contact_phone,
        locale,
        pickupPoint: pickup.name,
        pickupTime: pickup.time,
        roomLink: previewLink,
        passLink: previewLink,
      };
      const composed = composeForRecipient(
        { body: tpl.body, subject: tpl.subject ?? defaultSubject(preset, tour?.title ?? null) },
        input,
        { tourName: tour?.title ?? null, tourDate: date, operatorName: 'AtoC Korea', forecast },
      );
      recipients.push({
        ...composed,
        email: row.contact_email,
        phone: row.contact_phone,
        canEmail: Boolean(row.contact_email?.includes('@')),
        templateSource: tpl.source,
      });
    }

    return NextResponse.json({
      tourId,
      date,
      preset,
      channel,
      tourTitle: tour?.title ?? null,
      city: tour?.city ?? null,
      forecast,
      templateSource,
      recipients,
      previewedBy: admin.email,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/tour-ops/manifest/bulk-message]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

/** 프리셋별 기본 이메일 제목. 투어명이 있으면 붙인다. */
export function defaultSubject(preset: WaPresetKey, tourName: string | null): string {
  const suffix = tourName ? ` — ${tourName}` : '';
  switch (preset) {
    case 'confirm_d7':
      return `Your booking is confirmed${suffix}`;
    case 'pickup_d1':
      return `Tomorrow's pickup details${suffix}`;
    case 'room_invite':
      return `Your tour room link${suffix}`;
    case 'day_pass':
      return `Today's tour — meeting point${suffix}`;
    case 'thanks':
      return `Thank you for travelling with us${suffix}`;
    default:
      return `AtoC Korea${suffix}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const tourId = String(body.tourId ?? '');
    const date = String(body.date ?? '');
    const preset = String(body.preset ?? 'pickup_d1') as WaPresetKey;
    const editedBody = typeof body.body === 'string' ? body.body : '';
    const editedSubject = typeof body.subject === 'string' ? body.subject : '';
    const onlyIds = Array.isArray(body.bookingIds)
      ? new Set(body.bookingIds.filter((v): v is string => typeof v === 'string'))
      : null;

    if (!tourId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'tourId and date (YYYY-MM-DD) required' }, { status: 400 });
    }
    if (!editedBody.trim()) {
      return NextResponse.json({ error: '보낼 내용이 비어 있습니다.', code: 'body_required' }, { status: 400 });
    }
    if (!editedSubject.trim()) {
      return NextResponse.json({ error: '제목이 비어 있습니다.', code: 'subject_required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { tour, rows } = await loadContext(supabase, tourId, date);
    const targets = onlyIds ? rows.filter((r) => onlyIds.has(r.id)) : rows;
    if (targets.length === 0) {
      return NextResponse.json({ error: '보낼 대상이 없습니다.', code: 'no_recipients' }, { status: 422 });
    }

    const forecast = await getForecastCached(supabase, tour?.city ?? null, date);

    // 발송 대상에게만 개인 링크를 발급한다(미리보기는 발급하지 않는다).
    const recipients: RecipientInput[] = [];
    for (const row of targets) {
      const pickup = pickupOf(row);
      const roomLink = await mintRoomLink(
        supabase,
        { id: row.id, tour_id: tourId, tour_date: date, contact_name: row.contact_name },
        admin.id,
      );
      recipients.push({
        bookingId: row.id,
        guestName: row.contact_name ?? 'Guest',
        email: row.contact_email,
        phone: row.contact_phone,
        locale: row.preferred_language ?? 'en',
        pickupPoint: pickup.name,
        pickupTime: pickup.time,
        roomLink,
        passLink: roomLink,
      });
    }

    // 🔴 화면이 확인한 문구를 그대로 쓴다. 저장된 템플릿을 다시 읽지 않는다.
    const plan = planBulkEmail(
      { body: editedBody, subject: editedSubject },
      recipients,
      { tourName: tour?.title ?? null, tourDate: date, operatorName: 'AtoC Korea', forecast },
    );

    let sent = 0;
    let failed = 0;
    const logs: Record<string, unknown>[] = [];
    const failures: Array<{ bookingId: string; guestName: string; error: string }> = [];

    for (const message of plan.sendable) {
      const recipient = recipients.find((r) => r.bookingId === message.bookingId)!;
      try {
        await sendEmail({
          to: recipient.email!,
          subject: message.subject ?? editedSubject,
          html: toHtml(message.body),
          text: message.body,
        });
        sent += 1;
        logs.push(
          sendLogRow({
            bookingId: message.bookingId,
            presetKey: preset,
            locale: message.locale,
            channel: 'email',
            subject: message.subject,
            renderedMessage: message.body,
            status: 'sent',
            createdBy: admin.email,
            tourId,
            tourDate: date,
          }),
        );
      } catch (error) {
        failed += 1;
        const reason = error instanceof Error ? error.message : String(error);
        failures.push({ bookingId: message.bookingId, guestName: message.guestName, error: reason });
        logs.push(
          sendLogRow({
            bookingId: message.bookingId,
            presetKey: preset,
            locale: message.locale,
            channel: 'email',
            subject: message.subject,
            status: 'failed',
            error: reason,
            createdBy: admin.email,
            tourId,
            tourDate: date,
          }),
        );
      }
    }

    for (const skip of plan.skipped) {
      logs.push(
        sendLogRow({
          bookingId: skip.bookingId,
          presetKey: preset,
          locale: null,
          channel: 'email',
          status: 'skipped',
          error: skip.reason,
          createdBy: admin.email,
          tourId,
          tourDate: date,
        }),
      );
    }

    if (logs.length > 0) {
      const { error } = await supabase.from('ops_whatsapp_send_logs').insert(logs);
      // 로그 실패가 발송을 무효로 만들지는 않는다 — 이미 나갔다. 대신 응답에 싣는다.
      if (error) console.error('[bulk-message] log insert', error);
    }

    return NextResponse.json({
      targeted: targets.length,
      sent,
      failed,
      skipped: plan.skipped.length,
      failures,
      skippedDetail: plan.skipped,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/tour-ops/manifest/bulk-message]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

/** 평문 본문 → 최소 HTML. 링크만 클릭 가능하게 만들고 나머지는 그대로 둔다. */
export function toHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#2563eb">$1</a>',
  );
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.7;color:#111827;white-space:pre-wrap">${linked}</div>`;
}
