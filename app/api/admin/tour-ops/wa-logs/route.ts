import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * AtoC 통합 Phase 2 — wa.me 발송 로그 (plan §4.2).
 *
 * POST /api/admin/tour-ops/wa-logs
 *   { action: 'opened', bookingId, presetKey, locale?, waUrl?, renderedMessage? }
 *     → wa.me 탭 오픈 시각 기록 (opened_at = now). returns { logId }.
 *   { action: 'mark_sent', logId }            → [발송 완료] 수동 체크.
 *   { action: 'mark_sent', bookingId }        → 해당 예약의 최신 로그에 체크
 *     (opened 로그가 없으면 새 행을 만들어 체크 — 테이블만 있으면 항상 기록).
 *
 * ops_whatsapp_send_logs 마이그레이션이 아직 미적용이면 { ok:true, logged:false }
 * 로 조용히 성공 — UI는 로그 없이도 wa.me 오픈을 막지 않는다 (graceful).
 */

function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return Boolean(
    e && (e.code === '42P01' || (typeof e.message === 'string' && e.message.includes('ops_whatsapp_send_logs'))),
  );
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action === 'mark_sent' ? 'mark_sent' : body.action === 'opened' ? 'opened' : null;
    if (!action) return NextResponse.json({ error: 'action (opened|mark_sent) required' }, { status: 400 });

    if (action === 'opened') {
      const bookingId = typeof body.bookingId === 'string' ? body.bookingId : '';
      const presetKey = typeof body.presetKey === 'string' ? body.presetKey.slice(0, 40) : '';
      if (!bookingId || !presetKey) {
        return NextResponse.json({ error: 'bookingId and presetKey required' }, { status: 400 });
      }
      try {
        const { data, error } = await supabase
          .from('ops_whatsapp_send_logs')
          .insert({
            booking_id: bookingId,
            preset_key: presetKey,
            locale: typeof body.locale === 'string' ? body.locale.slice(0, 10) : null,
            wa_url: typeof body.waUrl === 'string' ? body.waUrl.slice(0, 4000) : null,
            rendered_message: typeof body.renderedMessage === 'string' ? body.renderedMessage.slice(0, 4000) : null,
            created_by: admin.id ?? null,
          })
          .select('id')
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, logged: true, logId: (data as { id: string }).id });
      } catch (error) {
        if (isMissingTable(error)) return NextResponse.json({ ok: true, logged: false });
        throw error;
      }
    }

    // mark_sent
    const logId = typeof body.logId === 'string' ? body.logId : null;
    const bookingId = typeof body.bookingId === 'string' ? body.bookingId : null;
    if (!logId && !bookingId) {
      return NextResponse.json({ error: 'logId or bookingId required' }, { status: 400 });
    }
    try {
      const now = new Date().toISOString();
      if (logId) {
        const { error } = await supabase.from('ops_whatsapp_send_logs').update({ marked_sent_at: now }).eq('id', logId);
        if (error) throw error;
        return NextResponse.json({ ok: true, logged: true, logId });
      }
      // bookingId 경로: 최신 로그에 체크, 없으면 수동 행 생성.
      const { data: latest } = await supabase
        .from('ops_whatsapp_send_logs')
        .select('id, marked_sent_at')
        .eq('booking_id', bookingId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) {
        const { error } = await supabase
          .from('ops_whatsapp_send_logs')
          .update({ marked_sent_at: now })
          .eq('id', (latest as { id: string }).id);
        if (error) throw error;
        return NextResponse.json({ ok: true, logged: true, logId: (latest as { id: string }).id });
      }
      const { data, error } = await supabase
        .from('ops_whatsapp_send_logs')
        .insert({ booking_id: bookingId!, preset_key: 'manual', marked_sent_at: now, created_by: admin.id ?? null })
        .select('id')
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, logged: true, logId: (data as { id: string }).id });
    } catch (error) {
      if (isMissingTable(error)) return NextResponse.json({ ok: true, logged: false });
      throw error;
    }
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('POST /api/admin/tour-ops/wa-logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
