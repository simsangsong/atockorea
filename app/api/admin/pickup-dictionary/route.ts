import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { normalizeForLookup } from '@/lib/ops/pickup/canonicalize';

export const dynamic = 'force-dynamic';

/**
 * DE7 — 픽업 표준지점 사전의 쓰기 표면.
 *
 * DE6에서 테이블 3개와 RPC 2개를 만들었지만 **행을 만들 길이 없었다.** 사전이
 * 비어 있으면 `canonicalizePickup` 은 모든 표기에 대해 계속 null 을 돌려주고,
 * OTA 예약의 픽업지는 영원히 손으로 고쳐야 한다.
 *
 * 파서 규칙(DE5)과 같은 구조다: 제안이 큐에 쌓이고, **사람이 승인해야** 사전에
 * 들어간다. 자동 승인은 없다 — 잘못 모인 별칭은 조용히 엉뚱한 곳으로 픽업을
 * 보내고, 그건 못 고친 것보다 나쁘다.
 *
 * 🔴 `alias_normalized` 는 **서버가 계산한다.** 조회가 쓰는 정규화와 어긋나면
 * 별칭을 넣어도 영원히 안 잡힌다.
 */

const TENANT = 'atockorea';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();

    const [locRes, aliasRes, queueRes] = await Promise.all([
      supabase
        .from('ops_pickup_locations')
        .select('id, canonical_name, display_name_ko, address, lat, lng, active')
        .eq('tenant_id', TENANT)
        .order('canonical_name', { ascending: true }),
      supabase.from('ops_pickup_aliases').select('id, pickup_location_id, alias, alias_normalized'),
      supabase
        .from('ops_pickup_learning_queue')
        .select('id, raw_value, proposed_canonical_id, proposed_by, confidence, occurrence_count, status, last_seen_at')
        .eq('tenant_id', TENANT)
        .eq('status', 'pending')
        .order('occurrence_count', { ascending: false })
        .limit(200),
    ]);

    const aliases = (aliasRes.data ?? []) as Array<{ pickup_location_id: string }>;
    const locations = ((locRes.data ?? []) as Array<{ id: string }>).map((l) => ({
      ...l,
      aliases: aliases.filter((a) => a.pickup_location_id === l.id),
    }));

    return NextResponse.json({ locations, queue: queueRes.data ?? [] });
  } catch (error: unknown) {
    if (error instanceof AdminAuthFailure) return adminAuthJsonResponse(error);
    console.error('[GET /api/admin/pickup-dictionary]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST { canonical_name, display_name_ko?, address?, lat?, lng? } — 표준지점 추가
 *      { location_id, alias }                                     — 별칭 추가
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (typeof body.location_id === 'string' && typeof body.alias === 'string') {
      const alias = body.alias.trim();
      if (!alias) return NextResponse.json({ error: '별칭이 비어 있습니다.' }, { status: 400 });
      const { data, error } = await supabase
        .from('ops_pickup_aliases')
        .insert({
          pickup_location_id: body.location_id,
          alias,
          alias_normalized: normalizeForLookup(alias),
        })
        .select()
        .single();
      if (error) {
        // 같은 지점에 같은 별칭은 UNIQUE 로 막힌다 — 중복은 실패가 아니다.
        if ((error as { code?: string }).code === '23505') {
          return NextResponse.json({ ok: true, duplicate: true });
        }
        throw error;
      }
      return NextResponse.json({ alias: data }, { status: 201 });
    }

    const canonicalName = String(body.canonical_name ?? '').trim();
    if (!canonicalName) {
      return NextResponse.json({ error: 'canonical_name is required' }, { status: 400 });
    }
    const lat = typeof body.lat === 'number' ? body.lat : null;
    const lng = typeof body.lng === 'number' ? body.lng : null;
    const { data, error } = await supabase
      .from('ops_pickup_locations')
      .insert({
        tenant_id: TENANT,
        canonical_name: canonicalName,
        display_name_ko: (body.display_name_ko as string) || null,
        address: (body.address as string) || null,
        lat,
        lng,
      })
      .select()
      .single();
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: '같은 이름의 표준지점이 이미 있습니다.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ location: data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AdminAuthFailure) return adminAuthJsonResponse(error);
    console.error('[POST /api/admin/pickup-dictionary]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH { queue_id, decision: 'approve' | 'reject', location_id? }
 *
 * 승인은 그 표기를 **별칭으로 사전에 넣는 것**이다 — 그래야 다음 예약부터 잡힌다.
 * 큐 행만 approved 로 바꾸고 별칭을 안 만들면 아무 일도 일어나지 않는다.
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as {
      queue_id?: string;
      decision?: string;
      location_id?: string;
    };
    const queueId = String(body.queue_id ?? '');
    if (!queueId || (body.decision !== 'approve' && body.decision !== 'reject')) {
      return NextResponse.json({ error: "queue_id and decision ('approve'|'reject') required" }, { status: 400 });
    }

    const { data: row } = await supabase
      .from('ops_pickup_learning_queue')
      .select('id, raw_value, proposed_canonical_id, status')
      .eq('id', queueId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });

    if (body.decision === 'reject') {
      const { error } = await supabase
        .from('ops_pickup_learning_queue')
        .update({ status: 'rejected' })
        .eq('id', queueId);
      if (error) throw error;
      return NextResponse.json({ ok: true, status: 'rejected' });
    }

    const target = body.location_id ?? (row as { proposed_canonical_id: string | null }).proposed_canonical_id;
    if (!target) {
      return NextResponse.json({ error: '어느 표준지점으로 보낼지 골라주세요.' }, { status: 400 });
    }
    const raw = (row as { raw_value: string }).raw_value;
    const { error: aliasError } = await supabase.from('ops_pickup_aliases').insert({
      pickup_location_id: target,
      alias: raw,
      alias_normalized: normalizeForLookup(raw),
    });
    // 이미 같은 별칭이 있으면 승인은 그대로 성립한다.
    if (aliasError && (aliasError as { code?: string }).code !== '23505') throw aliasError;

    const { error } = await supabase
      .from('ops_pickup_learning_queue')
      .update({ status: 'approved' })
      .eq('id', queueId);
    if (error) throw error;
    return NextResponse.json({ ok: true, status: 'approved' });
  } catch (error: unknown) {
    if (error instanceof AdminAuthFailure) return adminAuthJsonResponse(error);
    console.error('[PATCH /api/admin/pickup-dictionary]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
