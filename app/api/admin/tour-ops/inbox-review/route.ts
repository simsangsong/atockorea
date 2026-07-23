import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { commitInboundEmail } from '@/lib/ops/inbox/commit';
import { bodyTextFrom, fetchReceivedEmail } from '@/lib/ops/inbox/received';
import { normalizeForLookup } from '@/lib/ops/parse/dictionary';
import { DEFAULT_TENANT_ID } from '@/lib/ops/parse/types';
import type { InboundChannel, InboundIntent } from '@/lib/ops/inbox/classify';

export const dynamic = 'force-dynamic';

/**
 * AtoC 통합 Phase 2 — 인박스 리뷰 큐 (plan §3.1 A-6 + §3.3 안전장치).
 *
 * GET  ?filter=review|all&limit=N
 *   review(기본): commit_result IN ('review_queued','failed') — 사람 처리 대기.
 *   all: 전체 로그 — auto_committed 건은 UI가 'auto' 뱃지로 병행 표시 (§3.3
 *   첫 2주 사후 검증).
 *
 * POST { action, ... } — 전부 admin 전용:
 *   ignore      { logId }                          → commit_result='ignored'
 *   map_product { channel, productNameRaw, tourId, tourKind, logId? }
 *     → ops_channel_product_map upsert (A-7b 미매핑 해결). logId가 있으면
 *       곧바로 approve 재커밋까지 이어서 실행 (원버튼 해결).
 *   approve     { logId }
 *     → 원문을 Resend Received API로 재fetch(무저장 원칙 유지 — 파싱 데이터를
 *       DB에 남기지 않았으므로 원문 재조회가 유일한 재커밋 경로) →
 *       commitInboundEmail(approveMode: 사람 확정이므로 confidence 게이트
 *       생략, 매핑/외부ID 요건은 유지) → 로그 갱신.
 *       Resend 보존기간 만료로 fetch가 실패하면 410 — 수동 붙여넣기 폴백 안내.
 */

interface LogRow {
  id: string;
  channel: string | null;
  intent: string | null;
  message_id: string | null;
  confidence: number | null;
  commit_result: string | null;
  booking_id: string | null;
  external_booking_id: string | null;
  masked_summary: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const filter = req.nextUrl.searchParams.get('filter') === 'all' ? 'all' : 'review';
    const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 100));

    let query = supabase
      .from('ops_email_parse_logs')
      .select('id, channel, intent, message_id, confidence, commit_result, booking_id, external_booking_id, masked_summary, error, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (filter === 'review') query = query.in('commit_result', ['review_queued', 'failed']);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ logs: (data ?? []) as LogRow[], filter });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('GET /api/admin/tour-ops/inbox-review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const CHANNELS: ReadonlySet<string> = new Set(['klook', 'viator', 'gyg', 'kkday', 'atoc']);

async function approveLog(
  supabase: ReturnType<typeof createServerClient>,
  log: LogRow,
): Promise<NextResponse> {
  if (!log.message_id) {
    return NextResponse.json({ error: '메시지 ID가 없어 재커밋할 수 없습니다' }, { status: 409 });
  }
  const intent = (log.intent ?? 'confirm') as InboundIntent;
  if (intent === 'unrelated') {
    return NextResponse.json({ error: 'unrelated 로그는 승인 대상이 아닙니다' }, { status: 409 });
  }

  // 원문 재fetch (인메모리 전용, A-2 — DB에는 여전히 아무 원문도 저장 안 함).
  const fetched = await fetchReceivedEmail(log.message_id);
  if (!fetched.ok) {
    return NextResponse.json(
      { error: `원문을 다시 가져올 수 없습니다 (${fetched.error}) — 수동 붙여넣기 폴백을 사용하세요` },
      { status: 410 },
    );
  }
  const text = bodyTextFrom(fetched.data);
  const subject = typeof fetched.data.subject === 'string' ? fetched.data.subject : '';
  if (!text) {
    return NextResponse.json({ error: '원문 본문이 비어 있습니다' }, { status: 410 });
  }

  const channel = (log.channel && (CHANNELS.has(log.channel) ? log.channel : 'unknown')) ?? 'unknown';
  const result = await commitInboundEmail({
    supabase,
    tenantId: DEFAULT_TENANT_ID,
    channel: channel as InboundChannel,
    intent: intent as Exclude<InboundIntent, 'unrelated'>,
    raw: `Subject: ${subject}\n\n${text}`,
    messageId: log.message_id,
    approveMode: true,
  });

  await supabase
    .from('ops_email_parse_logs')
    .update({
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
        approved: true,
      },
      error: null,
    })
    .eq('id', log.id);

  return NextResponse.json({
    ok: true,
    commit_result: result.aggregateResult,
    items: result.items.map((i) => ({
      external_booking_id: i.externalBookingId,
      commit_result: i.commitResult,
      reason: i.reason,
      booking_id: i.bookingId,
      room_id: i.roomId,
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'ignore') {
      const logId = typeof body.logId === 'string' ? body.logId : '';
      if (!logId) return NextResponse.json({ error: 'logId required' }, { status: 400 });
      const { error } = await supabase
        .from('ops_email_parse_logs')
        .update({ commit_result: 'ignored' })
        .eq('id', logId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'map_product') {
      const channel = typeof body.channel === 'string' && CHANNELS.has(body.channel) ? body.channel : null;
      const productNameRaw = typeof body.productNameRaw === 'string' ? body.productNameRaw.trim().slice(0, 300) : '';
      const tourId = typeof body.tourId === 'string' ? body.tourId : '';
      const tourKind = body.tourKind === 'private' ? 'private' : 'join';
      if (!channel || !productNameRaw || !tourId) {
        return NextResponse.json({ error: 'channel, productNameRaw, tourId required' }, { status: 400 });
      }
      const normalized = normalizeForLookup(productNameRaw);
      if (!normalized) return NextResponse.json({ error: 'product name normalizes to empty' }, { status: 400 });

      const { data: tour } = await supabase.from('tours').select('id').eq('id', tourId).maybeSingle();
      if (!tour) return NextResponse.json({ error: 'Tour not found' }, { status: 404 });

      const { error } = await supabase.from('ops_channel_product_map').upsert(
        {
          tenant_id: DEFAULT_TENANT_ID,
          channel,
          product_name_raw: productNameRaw,
          product_name_normalized: normalized,
          tour_id: tourId,
          tour_kind: tourKind,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,channel,product_name_normalized' },
      );
      if (error) throw error;

      // 원버튼: 매핑 저장 직후 해당 로그 재커밋 (A-7b 해결 → 즉시 배치).
      const logId = typeof body.logId === 'string' ? body.logId : null;
      if (logId) {
        const { data: log } = await supabase
          .from('ops_email_parse_logs')
          .select('id, channel, intent, message_id, confidence, commit_result, booking_id, external_booking_id, masked_summary, error, created_at')
          .eq('id', logId)
          .maybeSingle();
        if (log) return approveLog(supabase, log as LogRow);
      }
      return NextResponse.json({ ok: true, mapped: true });
    }

    if (action === 'approve') {
      const logId = typeof body.logId === 'string' ? body.logId : '';
      if (!logId) return NextResponse.json({ error: 'logId required' }, { status: 400 });
      const { data: log } = await supabase
        .from('ops_email_parse_logs')
        .select('id, channel, intent, message_id, confidence, commit_result, booking_id, external_booking_id, masked_summary, error, created_at')
        .eq('id', logId)
        .maybeSingle();
      if (!log) return NextResponse.json({ error: 'Log not found' }, { status: 404 });
      return approveLog(supabase, log as LogRow);
    }

    return NextResponse.json({ error: 'action (ignore|map_product|approve) required' }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('POST /api/admin/tour-ops/inbox-review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
