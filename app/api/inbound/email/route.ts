import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { Webhook } from 'svix';
import { createServerClient } from '@/lib/supabase';
import { classifyInbound } from '@/lib/ops/inbox/classify';
import { commitInboundEmail } from '@/lib/ops/inbox/commit';
import { bodyTextFrom, fetchReceivedEmail } from '@/lib/ops/inbox/received';
import { maskLine } from '@/lib/ops/parse/mask';
import { DEFAULT_TENANT_ID } from '@/lib/ops/parse/types';

export const dynamic = 'force-dynamic';

/**
 * AtoC 통합 Phase 1 slice 2 — Resend 인박스 webhook (plan §3 A-1~A-8).
 *
 * POST /api/inbound/email
 *   Resend `email.received` → svix 서명 검증 → 멱등 로그 선점(insert-first,
 *   message_id unique) → 본문 인메모리 fetch → 채널/의도 분류 →
 *   commitInboundEmail (파싱 → bookings/룸 커밋) → 로그 확정.
 *
 * 안전 원칙:
 *   - RESEND_WEBHOOK_SECRET 부재 → 501 fail-closed (검증 없는 수신 금지).
 *   - 원문 이메일은 인메모리 처리 후 폐기 — DB 저장 절대 금지 (A-2).
 *     ops_email_parse_logs.masked_summary에는 maskLine() 마스킹본만.
 *   - 멱등: 로그 행을 먼저 insert (unique message_id). 중복 웹훅 재전송은
 *     23505로 즉시 200 — 이중 커밋 원천 차단. 처리 도중 실패하면 로그 행을
 *     지우고 500 → Resend 재시도가 처음부터 다시 밟는다 (커밋 자체도
 *     (source, external_booking_id) 멱등이라 재처리 안전).
 */

type AddressLike = { email: string; name: string | null };

function parseAddress(value: unknown): AddressLike {
  if (typeof value === 'string') {
    const match = value.trim().match(/^(.+?)\s*<([^>]+)>$/);
    if (match) {
      return { email: match[2].trim().toLowerCase(), name: match[1].trim().replace(/^["']|["']$/g, '') || null };
    }
    return { email: value.trim().toLowerCase(), name: null };
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return parseAddress(record.email ?? record.address ?? record.value ?? '');
  }
  if (Array.isArray(value) && value.length > 0) return parseAddress(value[0]);
  return { email: '', name: null };
}

// A-2 — 본문 헬퍼는 lib/ops/inbox/received.ts로 승격 (Phase 2 리뷰 큐
// [승인 커밋]과 공유). 인메모리 전용 계약은 동일.

export async function POST(req: NextRequest) {
  // fail-closed: 서명 비밀 없이는 어떤 수신도 처리하지 않는다.
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'inbound webhook not configured' }, { status: 501 });
  }

  const rawBody = await req.text();
  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'missing webhook signature headers' }, { status: 401 });
  }
  try {
    new Webhook(webhookSecret).verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  } catch {
    return NextResponse.json({ error: 'invalid webhook signature' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON payload' }, { status: 400 });
  }

  const eventType = (body.type ?? body.event) as string | undefined;
  if (eventType !== 'email.received') {
    return NextResponse.json({ ok: true, ignored: 'event_type', event_type: eventType ?? null }, { status: 200 });
  }

  const data = (body.data ?? {}) as Record<string, unknown>;
  const messageIdRaw = data.email_id ?? data.id ?? data.message_id;
  const messageId = typeof messageIdRaw === 'string' && messageIdRaw.trim() ? messageIdRaw.trim() : null;
  if (!messageId) {
    return NextResponse.json({ error: 'missing message id' }, { status: 400 });
  }

  const from = parseAddress(data.from ?? data.from_email);
  const subject = typeof data.subject === 'string' ? data.subject : '';

  const supabase = createServerClient();

  // 멱등 선점 (insert-first): unique(message_id) — 재전송 웹훅은 여기서 끝.
  const { data: logRow, error: logInsertError } = await supabase
    .from('ops_email_parse_logs')
    .insert({ tenant_id: DEFAULT_TENANT_ID, message_id: messageId, channel: 'unknown' })
    .select('id')
    .single();
  if (logInsertError) {
    if ((logInsertError as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }
    console.error('inbound/email: idempotency insert failed:', logInsertError);
    return NextResponse.json({ error: 'log insert failed' }, { status: 500 });
  }
  const logId = (logRow as { id: string }).id;

  const releaseIdempotency = async () => {
    try {
      await supabase.from('ops_email_parse_logs').delete().eq('id', logId);
    } catch {
      /* best-effort */
    }
  };

  try {
    // 본문 확보: webhook payload 인라인 우선, 없으면 Received API (A-2).
    // 어느 쪽이든 인메모리 문자열로만 존재하고 이 핸들러를 벗어나지 않는다.
    let text = bodyTextFrom(data);
    if (!text) {
      const fetched = await fetchReceivedEmail(messageId);
      if (!fetched.ok) {
        await releaseIdempotency();
        return NextResponse.json({ error: `body fetch failed: ${fetched.error}` }, { status: 500 });
      }
      text = bodyTextFrom(fetched.data);
    }

    // A-3/A-4 — 결정론 분류. unrelated는 즉시 ignored 로그 후 종료.
    const { channel, intent } = classifyInbound({ fromEmail: from.email, subject, bodyExcerpt: text });
    const fingerprint = createHash('sha256')
      .update(`${from.email}\n${subject}\n${text.slice(0, 4096)}`, 'utf8')
      .digest('hex');

    if (intent === 'unrelated') {
      await supabase
        .from('ops_email_parse_logs')
        .update({
          channel,
          intent,
          fingerprint,
          commit_result: 'ignored',
          masked_summary: { subject_masked: maskLine(subject).masked.slice(0, 300) },
        })
        .eq('id', logId);
      return NextResponse.json({ ok: true, ignored: 'unrelated', channel }, { status: 200 });
    }

    // A-5~A-7 — 파싱 + 커밋 (원문은 commit 내부에서도 저장되지 않음).
    const result = await commitInboundEmail({
      supabase,
      tenantId: DEFAULT_TENANT_ID,
      channel,
      intent,
      raw: `Subject: ${subject}\n\n${text}`,
      messageId,
    });

    // A-8 — 감사 로그 확정 (마스킹 요약만).
    await supabase
      .from('ops_email_parse_logs')
      .update({
        channel,
        intent,
        fingerprint,
        confidence: result.maxConfidence,
        commit_result: result.aggregateResult,
        booking_id: result.firstBookingId,
        external_booking_id: result.items.find((i) => i.externalBookingId)?.externalBookingId ?? null,
        masked_summary: {
          items: result.items.map((i) => ({
            ...i.maskedSummary,
            commit_result: i.commitResult,
            reason: i.reason,
            booking_id: i.bookingId,
            room_id: i.roomId,
            tour_kind: i.tourKind,
          })),
          metrics: result.metrics
            ? { total: result.metrics.total, layers_used: result.metrics.layers_used, elapsed_ms: result.metrics.elapsed_ms }
            : null,
          alert: result.alert,
        },
      })
      .eq('id', logId);

    return NextResponse.json(
      {
        ok: true,
        channel,
        intent,
        commit_result: result.aggregateResult,
        items: result.items.map((i) => ({
          external_booking_id: i.externalBookingId,
          commit_result: i.commitResult,
          reason: i.reason,
          booking_id: i.bookingId,
          room_id: i.roomId,
        })),
      },
      { status: 200 },
    );
  } catch (e) {
    // 재시도 가능해야 하므로 멱등 행을 반납하고 500 (커밋은 자체 멱등).
    console.error('inbound/email: processing failed:', e);
    await releaseIdempotency();
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
