import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { OPS_TENANT_ID } from '@/lib/ops/tenant';
import { WA_LOCALES, WA_PRESET_KEYS, type WaLocale, type WaPresetKey } from '@/lib/ops/whatsapp/presets';
import { isMessageChannel, type MessageChannel } from '@/lib/ops/messaging/guestMessage';
import { loadTemplate } from '@/lib/ops/messaging/guestMessageLoad';

export const dynamic = 'force-dynamic';

/**
 * 투어별 안내 문구 (M2, 플랜 §13.2).
 *
 *   GET    ?tourId=&preset=&channel=      → 로케일 6개의 **해석된** 문구 + 출처
 *   PUT    { tourId, preset, channel, locale, subject, body }  → 투어 전용으로 저장
 *   DELETE ?tourId=&preset=&channel=&locale=                   → 전용 문구 삭제(전역으로 복귀)
 *
 * GET이 "저장된 것"이 아니라 **해석된 것**을 돌려주는 이유: 화면이 편집을 시작할
 * 지점은 지금 실제로 나가는 문구여야 한다. 빈 칸에서 시작하게 하면 운영자가
 * 전역 문구를 통째로 다시 쓰게 되고, 그 순간 두 벌이 갈라지기 시작한다.
 */

function parseQuery(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tourId = sp.get('tourId') ?? '';
  const preset = (sp.get('preset') ?? 'pickup_d1') as WaPresetKey;
  const channel = sp.get('channel') ?? 'whatsapp';
  if (!tourId) return { error: 'tourId required' as const };
  if (!(WA_PRESET_KEYS as readonly string[]).includes(preset)) return { error: 'unknown preset' as const };
  if (!isMessageChannel(channel)) return { error: 'channel must be whatsapp or email' as const };
  return { tourId, preset, channel: channel as MessageChannel };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const q = parseQuery(req);
    if ('error' in q) return NextResponse.json({ error: q.error }, { status: 400 });

    const supabase = createServerClient();
    const locales: Record<string, { body: string; subject: string | null; source: string }> = {};
    for (const locale of WA_LOCALES) {
      const tpl = await loadTemplate(supabase, {
        tourId: q.tourId,
        presetKey: q.preset,
        locale,
        channel: q.channel,
      });
      locales[locale] = { body: tpl.body, subject: tpl.subject, source: tpl.source };
    }
    return NextResponse.json({ tourId: q.tourId, preset: q.preset, channel: q.channel, locales });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/tour-ops/tour-templates]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const tourId = String(body.tourId ?? '');
    const preset = String(body.preset ?? '') as WaPresetKey;
    const channelRaw = String(body.channel ?? 'whatsapp');
    const locale = String(body.locale ?? '') as WaLocale;
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';

    if (!tourId) return NextResponse.json({ error: 'tourId required' }, { status: 400 });
    if (!(WA_PRESET_KEYS as readonly string[]).includes(preset)) {
      return NextResponse.json({ error: 'unknown preset' }, { status: 400 });
    }
    if (!(WA_LOCALES as readonly string[]).includes(locale)) {
      return NextResponse.json({ error: 'unknown locale' }, { status: 400 });
    }
    if (!isMessageChannel(channelRaw)) {
      return NextResponse.json({ error: 'channel must be whatsapp or email' }, { status: 400 });
    }
    if (!text) {
      // 빈 본문을 저장하면 전역 문구를 가린 채 아무것도 안 보내게 된다.
      // 지우고 싶으면 DELETE 를 쓴다 — 그 의도는 명시적이어야 한다.
      return NextResponse.json(
        { error: '내용이 비어 있습니다. 전용 문구를 없애려면 [기본으로 되돌리기]를 쓰세요.', code: 'body_required' },
        { status: 400 },
      );
    }
    if (channelRaw === 'email' && !subject) {
      return NextResponse.json({ error: '이메일 문구는 제목이 필요합니다.', code: 'subject_required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('ops_tour_message_templates')
      .upsert(
        {
          tenant_id: OPS_TENANT_ID,
          tour_id: tourId,
          preset_key: preset,
          locale,
          channel: channelRaw,
          subject: channelRaw === 'email' ? subject : null,
          body: text,
          updated_by: admin.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,tour_id,preset_key,locale,channel' },
      )
      .select('id, tour_id, preset_key, locale, channel, subject, body, updated_by, updated_at')
      .single();

    if (error) {
      console.error('[PUT /api/admin/tour-ops/tour-templates]', error);
      return NextResponse.json({ error: '문구를 저장하지 못했습니다', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data, source: 'tour' });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PUT /api/admin/tour-ops/tour-templates]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req);
    const q = parseQuery(req);
    if ('error' in q) return NextResponse.json({ error: q.error }, { status: 400 });
    const locale = req.nextUrl.searchParams.get('locale') ?? '';
    if (!(WA_LOCALES as readonly string[]).includes(locale)) {
      return NextResponse.json({ error: 'unknown locale' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('ops_tour_message_templates')
      .delete()
      .eq('tenant_id', OPS_TENANT_ID)
      .eq('tour_id', q.tourId)
      .eq('preset_key', q.preset)
      .eq('locale', locale)
      .eq('channel', q.channel);

    if (error) {
      console.error('[DELETE /api/admin/tour-ops/tour-templates]', error);
      return NextResponse.json({ error: '문구를 되돌리지 못했습니다', details: error.message }, { status: 500 });
    }
    // 전역 문구로 복귀한 결과를 그대로 돌려준다 — 화면이 다시 조회할 필요가 없다.
    const tpl = await loadTemplate(supabase, {
      tourId: q.tourId,
      presetKey: q.preset,
      locale,
      channel: q.channel,
    });
    return NextResponse.json({ reverted: true, body: tpl.body, subject: tpl.subject, source: tpl.source });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DELETE /api/admin/tour-ops/tour-templates]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
