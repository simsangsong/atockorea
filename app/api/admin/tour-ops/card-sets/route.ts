import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { tourKindFromPriceType } from '@/lib/tour-room/tourKind';
import {
  CARD_SET_TABLE,
  cardSetFromRow,
  clearCardSet,
  loadCardSet,
  normalizeCardOptions,
  resolveBriefingCardSet,
  saveCardSet,
  serializeCardOptions,
} from '@/lib/ops/seating/cards/cardSet.server';

export const dynamic = 'force-dynamic';

/**
 * 투어 상품별 기본 카드 세트 — AtoC 통합 플랜 §5.4 C-17
 * ("기본값 = 투어 상품별 기본 세트, 룸 단위 오버라이드" 중 앞쪽 절반).
 *
 *   GET            상품 목록 + 각 상품의 기본 세트 설정 여부
 *   GET ?tour_id=  그 상품의 기본 세트(해석 결과 포함)
 *   PUT  { tour_id, card_ids: string[] | null, options }
 *   DELETE ?tour_id=   기본 세트 제거 → 코드 기본값 상속
 *
 * 룸 오버라이드는 /api/admin/tour-ops/rooms/[roomId]/card-set 가 담당한다.
 */

interface TourRow {
  id: string;
  title: string | null;
  price_type: string | null;
  city: string | null;
  lunch_included: boolean | null;
  is_active?: boolean | null;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const tourId = req.nextUrl.searchParams.get('tour_id');

    if (tourId) {
      const { data } = await supabase
        .from('tours')
        .select('id, title, price_type, city, lunch_included')
        .eq('id', tourId)
        .maybeSingle();
      const tour = (data ?? null) as TourRow | null;
      if (!tour) return NextResponse.json({ error: 'Tour not found' }, { status: 404 });

      const { set, migrationPending } = await loadCardSet(supabase, 'tour', tourId);
      const resolved = resolveBriefingCardSet({ tour: set });
      // 이 레벨(상품)을 뺐을 때 적용될 값 = 코드 기본값.
      const inherited = resolveBriefingCardSet({});
      return NextResponse.json({
        tour: {
          id: tour.id,
          title: tour.title,
          city: tour.city,
          lunch_included: tour.lunch_included === true,
          tour_kind: tourKindFromPriceType(tour.price_type),
        },
        level: set ? { card_ids: set.cardIds, options: serializeCardOptions(set.options) } : null,
        resolved: {
          card_ids: resolved.cardIds,
          card_ids_source: resolved.cardIdsSource,
          options: resolved.options,
          option_sources: resolved.optionSources,
        },
        inherited: { card_ids: inherited.cardIds, options: inherited.options },
        migration_pending: migrationPending,
      });
    }

    const { data: tourRows } = await supabase
      .from('tours')
      .select('id, title, price_type, city, lunch_included')
      .order('title');
    const tours = (tourRows ?? []) as TourRow[];

    // 설정된 상품 세트를 한 번에 읽어 목록에 배지로 표시한다.
    let configured = new Map<string, ReturnType<typeof cardSetFromRow>>();
    let migrationPending = false;
    try {
      const { data, error } = await supabase
        .from(CARD_SET_TABLE)
        .select('scope, scope_id, card_ids, options, updated_at')
        .eq('scope', 'tour');
      if (error) migrationPending = true;
      else {
        configured = new Map(
          ((data ?? []) as unknown[])
            .map((row) => cardSetFromRow(row))
            .filter((set): set is NonNullable<typeof set> => Boolean(set))
            .map((set) => [set.scopeId, set]),
        );
      }
    } catch {
      migrationPending = true;
    }

    return NextResponse.json({
      tours: tours.map((tour) => {
        const set = configured.get(tour.id) ?? null;
        return {
          id: tour.id,
          title: tour.title,
          city: tour.city,
          tour_kind: tourKindFromPriceType(tour.price_type),
          lunch_included: tour.lunch_included === true,
          card_ids: set?.cardIds ?? null,
          has_options: Boolean(set && Object.keys(set.options).length > 0),
          updated_at: set?.updatedAt ?? null,
        };
      }),
      migration_pending: migrationPending,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/tour-ops/card-sets]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const tourId = typeof body.tour_id === 'string' ? body.tour_id : '';
    if (!tourId) return NextResponse.json({ error: 'tour_id is required' }, { status: 400 });

    const supabase = createServerClient();
    const { data: tour } = await supabase.from('tours').select('id').eq('id', tourId).maybeSingle();
    if (!tour) return NextResponse.json({ error: 'Tour not found' }, { status: 404 });

    const outcome = await saveCardSet(supabase, {
      scope: 'tour',
      scopeId: tourId,
      cardIds: Array.isArray(body.card_ids) ? (body.card_ids as string[]) : null,
      options: normalizeCardOptions(body.options),
      updatedBy: admin.id,
    });
    if (!outcome.ok) {
      return NextResponse.json(
        { error: outcome.error, message: outcome.message },
        { status: outcome.error === 'empty_selection' ? 400 : 409 },
      );
    }

    const resolved = resolveBriefingCardSet({ tour: outcome.set });
    return NextResponse.json({
      ok: true,
      level: { card_ids: outcome.set.cardIds, options: serializeCardOptions(outcome.set.options) },
      resolved: {
        card_ids: resolved.cardIds,
        card_ids_source: resolved.cardIdsSource,
        options: resolved.options,
        option_sources: resolved.optionSources,
      },
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PUT /api/admin/tour-ops/card-sets]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req);
    const tourId = req.nextUrl.searchParams.get('tour_id') ?? '';
    if (!tourId) return NextResponse.json({ error: 'tour_id is required' }, { status: 400 });

    const supabase = createServerClient();
    const ok = await clearCardSet(supabase, 'tour', tourId);
    if (!ok) return NextResponse.json({ error: 'clear_failed' }, { status: 409 });

    const resolved = resolveBriefingCardSet({});
    return NextResponse.json({
      ok: true,
      level: null,
      resolved: {
        card_ids: resolved.cardIds,
        card_ids_source: resolved.cardIdsSource,
        options: resolved.options,
        option_sources: resolved.optionSources,
      },
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DELETE /api/admin/tour-ops/card-sets]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
