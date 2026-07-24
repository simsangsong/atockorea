import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { getOpsRoom } from '@/lib/ops/seating/access';
import { previewTourStartBriefing } from '@/lib/ops/seating/startBriefing';
import { recordRoomEvent } from '@/lib/tour-room/events';
import {
  clearCardSet,
  loadCardSetLevels,
  normalizeCardOptions,
  resolveBriefingCardSet,
  saveCardSet,
  serializeCardOptions,
} from '@/lib/ops/seating/cards/cardSet.server';

export const dynamic = 'force-dynamic';

/**
 * 룸 카드 세트 오버라이드 — AtoC 통합 플랜 §5.4 C-17.
 *
 *   GET    이 룸에 적용 중인 세트(해석 결과 + 어느 레벨에서 왔는지) +
 *          [투어 시작]을 지금 누르면 나갈 카드 미리보기(발송 없음).
 *   PUT    { card_ids: string[] | null, options }  룸 오버라이드 저장
 *   DELETE 룸 오버라이드 제거 → 상품 기본값(없으면 코드 기본값) 상속
 *
 * 🔴 미리보기는 팬아웃과 같은 계획 함수를 쓰고 마지막 세 줄(이벤트·메시지
 * insert·브로드캐스트)만 건너뛴다. 실발송과 갈라질 수 없고, 멱등 키도 태우지
 * 않는다 — 미리보기가 키를 태우면 미리 본 카드가 실제로는 영영 안 나간다.
 *
 * 문구는 여기서 편집할 수 없다. 5로케일 사전 번역 상수이기 때문에 자유 텍스트로
 * 열면 번역되지 않은 한국어가 손님 화면에 그대로 간다. 편집 가능한 것은
 * 포함 여부·순서·카드별 옵션 2개뿐이다.
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    await requireAdmin(req);
    const { roomId } = await params;
    const supabase = createServerClient();

    const room = await getOpsRoom(supabase, roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const levels = await loadCardSetLevels(supabase, { roomId: room.id, tourId: room.tour_id });
    const resolved = resolveBriefingCardSet({ room: levels.room, tour: levels.tour });
    // 이 레벨(룸)을 뺐을 때 적용될 값 — 에디터가 "무엇이 오버라이드인지"를
    // 값 비교만으로 판정할 수 있게 한다(별도 상속 토글 UI를 만들지 않는다).
    const inherited = resolveBriefingCardSet({ tour: levels.tour });

    let tourTitle: string | null = null;
    if (room.tour_id) {
      const { data } = await supabase.from('tours').select('title').eq('id', room.tour_id).maybeSingle();
      tourTitle = (data as { title?: string } | null)?.title ?? null;
    }

    // 미리보기 실패(일정 리졸버·영상 조회 등)가 편집 화면 전체를 막지 않는다.
    const preview = await previewTourStartBriefing(supabase, { roomId: room.id }).catch(() => null);

    return NextResponse.json({
      room: { id: room.id, booking_id: room.booking_id, tour_id: room.tour_id, tour_date: room.tour_date },
      tour_title: tourTitle,
      resolved: {
        card_ids: resolved.cardIds,
        card_ids_source: resolved.cardIdsSource,
        options: resolved.options,
        option_sources: resolved.optionSources,
      },
      inherited: { card_ids: inherited.cardIds, options: inherited.options },
      levels: {
        room: levels.room
          ? { card_ids: levels.room.cardIds, options: serializeCardOptions(levels.room.options) }
          : null,
        tour: levels.tour
          ? { card_ids: levels.tour.cardIds, options: serializeCardOptions(levels.tour.options) }
          : null,
      },
      preview,
      migration_pending: levels.migrationPending,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/tour-ops/rooms/[roomId]/card-set]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { roomId } = await params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const supabase = createServerClient();
    const room = await getOpsRoom(supabase, roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const outcome = await saveCardSet(supabase, {
      scope: 'room',
      scopeId: room.id,
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

    // 운영 감사 흔적 — 누가 이 룸의 브리핑 구성을 바꿨는지 남긴다.
    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: room.booking_id,
      type: 'briefing_card_set_changed',
      actorRole: 'admin',
      payload: { card_ids: outcome.set.cardIds, options: serializeCardOptions(outcome.set.options), by: admin.id },
    }).catch(() => undefined);

    const levels = await loadCardSetLevels(supabase, { roomId: room.id, tourId: room.tour_id });
    const resolved = resolveBriefingCardSet({ room: levels.room, tour: levels.tour });
    return NextResponse.json({
      ok: true,
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
    console.error('[PUT /api/admin/tour-ops/rooms/[roomId]/card-set]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { roomId } = await params;
    const supabase = createServerClient();

    const room = await getOpsRoom(supabase, roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const ok = await clearCardSet(supabase, 'room', room.id);
    if (!ok) return NextResponse.json({ error: 'clear_failed' }, { status: 409 });

    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: room.booking_id,
      type: 'briefing_card_set_changed',
      actorRole: 'admin',
      payload: { card_ids: null, cleared: true, by: admin.id },
    }).catch(() => undefined);

    const levels = await loadCardSetLevels(supabase, { roomId: room.id, tourId: room.tour_id });
    const resolved = resolveBriefingCardSet({ room: levels.room, tour: levels.tour });
    return NextResponse.json({
      ok: true,
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
    console.error('[DELETE /api/admin/tour-ops/rooms/[roomId]/card-set]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
