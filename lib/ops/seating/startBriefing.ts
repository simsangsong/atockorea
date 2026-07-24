/**
 * 투어 시작 브리핑 팬아웃 — AtoC 통합 플랜 §5.4 C-16 ①~⑤ + C-17 카드 세트.
 *
 * 시작 게이트 통과([투어 시작] 탭, tour_start 이벤트가 실제 insert된 순간)에만
 * 호출되는 연결 지점. 기존 브리핑 경로를 그대로 재사용한다:
 *   - 문구: 5로케일 사전 번역 상수, LLM 0
 *     (카드 ① lib/tour-room/morningBriefing.ts composeMorningBriefing,
 *      카드 ②~⑤ lib/ops/seating/cards/*)
 *   - 전달: ensureRoom → tour_room_messages 캡슐 → broadcastToRoom('message')
 *     → sendGuestRoomPush — app/api/tour-rooms/[bookingId]/morning-briefing의
 *     팬아웃 계약과 동일 (metadata.kind만 카드별로 다름).
 *   - 멱등: 카드마다 고유한 recordRoomEvent subject_key — 게이트 라우트가
 *     재시도되어도 어떤 카드도 중복 발사되지 않는다.
 *
 * 🔴 카드 구성은 이 파일에 없다. 순서·포함 여부·kind·subject_key는 전부
 * `lib/ops/seating/cards/stack.ts`의 선언적 배열 BRIEFING_CARD_STACK 한 곳에
 * 있고, 이 함수는 그 배열을 순회할 뿐이다.
 *
 * C-17 (카드 세트 에디터): 어떤 카드를 어떤 순서로 보낼지는 **룸마다** 다시
 * 해석된다 — `cardSet.server.ts`의 룸 오버라이드 → 상품 기본값 → 코드 기본값.
 * 설정 행이 없거나 깨져 있으면 코드 기본 5장이 나가고, 브리핑이 조용히
 * 사라지는 경로는 존재하지 않는다.
 *
 * §11.D D3: 카드 ①은 `tours.price_type`이 정하는 투어 kind를 따른다. 예전에는
 * 'join'이 하드코딩돼 있어서, 좌석 게이트를 통과한 프라이빗 차터 손님이
 * "welcome aboard 🚌 / 점심 안내는 나중에" 같은 조인투어 문구를 받고 정작
 * 포함 시간·초과요금 현금정산 고지는 못 받았다. 카드 ②·④도 kind에 따라
 * 한 줄씩만 달라진다(스태프 vs 기사).
 */

import type { RoomDbClient } from '@/lib/tour-room/access';
import { ensureRoom } from '@/lib/tour-room/access';
import { recordRoomEvent, listRoomEvents } from '@/lib/tour-room/events';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { sendGuestRoomPush } from '@/lib/tour-room/guestPush';
import { composeMorningBriefing } from '@/lib/tour-room/morningBriefing';
import { baseHoursForCity, rateForCity } from '@/lib/tour-room/overtime';
import { resolveDaySchedule } from '@/lib/tour-room/dayPlan';
import { tourKindFromPriceType, type TourKind } from '@/lib/tour-room/tourKind';
import { needsToDietary } from '@/lib/ops/dining/dietary';
import { fetchSafetyVideoCard } from '@/lib/tour-room/safetyVideo.server';
import type { SafetyVideoCardMeta } from '@/lib/tour-room/safetyVideo';
import type { ComposedBriefingCard } from '@/lib/ops/seating/cards/types';
import {
  BRIEFING_CARD_EVENT_TYPE,
  SAFETY_SUBJECT_PREFIX,
  selectBriefingCards,
  type BriefingCardContext,
  type BriefingCardSpec,
} from '@/lib/ops/seating/cards/stack';
import {
  cardDescriptor,
  loadCardSet,
  resolveBriefingCardSet,
  type BriefingCardPreviewRow,
  type BriefingCardSetPreview,
  type ResolvedBriefingCardSet,
  type StoredCardSet,
} from '@/lib/ops/seating/cards/cardSet.server';

export interface TourStartBriefingInput {
  tourId: string;
  /** YYYY-MM-DD (KST). */
  tourDate: string;
  /** tours.city — 조인 문구에는 rate 미표기이나 rateForCity 단일 소스 위해 전달. */
  city?: string | null;
  /** tours.lunch_included — 미전달 시 tours에서 조회 (카드 ④). */
  lunchIncluded?: boolean | null;
  /**
   * 호출자 명시 오버라이드: 보낼 카드 id와 순서. 저장된 설정 2레벨보다 우선한다.
   * 미전달(또는 빈 배열/미지의 id만)이면 룸 오버라이드 → 상품 기본값 →
   * 코드 기본 스택 순으로 해석된다.
   */
  cardIds?: readonly string[] | null;
}

export interface TourStartBriefingResult {
  /** 캡슐이 1장 이상 전달된 룸 수 (기존 계약 유지). */
  delivered: number;
  skipped: number;
  /** 실제로 insert된 카드 캡슐 총 개수 (룸 × 카드). */
  cards: number;
}

interface DayBookingRow {
  id: string;
  tour_id: string | null;
  tour_date: string | null;
  preferred_language?: string | null;
}

/**
 * 카드 ② 재탑승 판정 — 같은 예약(=같은 룸)이 "다른 날짜"에 이미 안전 카드를
 * 받았는가. 신규 테이블 없이 기존 tour_room_events 원장만 읽는다: 안전 카드의
 * subject_key는 `tour_start_briefing:safety:{tour_date}` 이므로 오늘 날짜가
 * 아닌 키가 하나라도 있으면 재탑승이다.
 */
export async function hasSeenSafetyCard(
  supabase: RoomDbClient,
  roomId: string,
  tourDate: string,
): Promise<boolean> {
  try {
    const events = await listRoomEvents(supabase, roomId, { types: [BRIEFING_CARD_EVENT_TYPE], limit: 50 });
    return events.some(
      (event) =>
        typeof event.subject_key === 'string' &&
        event.subject_key.startsWith(SAFETY_SUBJECT_PREFIX) &&
        event.subject_key !== `${SAFETY_SUBJECT_PREFIX}${tourDate}`,
    );
  } catch {
    // 판정 실패는 "처음 탑승"으로 degrade — 안전 안내를 빼먹는 것보다 낫다.
    return false;
  }
}

/** 예약에 이미 저장된 dietary 태그 (카드 ④ 칩 프리셀렉트). */
async function loadDietary(supabase: RoomDbClient, bookingId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('tour_day_plans')
      .select('needs, updated_at')
      .eq('booking_id', bookingId)
      .order('updated_at', { ascending: false })
      .limit(1);
    const row = Array.isArray(data) ? (data[0] as { needs?: unknown } | undefined) : undefined;
    return needsToDietary((row?.needs ?? null) as Parameters<typeof needsToDietary>[0]).tags.filter(
      (tag) => tag !== 'kids',
    );
  } catch {
    return [];
  }
}

interface TourMeta {
  city: string | null;
  lunchIncluded: boolean;
  /** resolveDaySchedule stage ③ input — the legacy join-tour schedule. */
  schedule: unknown;
  /** §11.D D3 — 'vehicle' ⇒ private charter, everything else ⇒ join. */
  kind: TourKind;
}

/** tours 한 행에서 카드 구성에 필요한 값만 (city·lunch_included·schedule·kind). */
async function loadTourMeta(supabase: RoomDbClient, tourId: string): Promise<TourMeta> {
  try {
    const { data } = await supabase
      .from('tours')
      .select('city, lunch_included, schedule, price_type')
      .eq('id', tourId)
      .maybeSingle();
    const row = (data ?? null) as
      | { city?: string | null; lunch_included?: boolean | null; schedule?: unknown; price_type?: string | null }
      | null;
    return {
      city: row?.city ?? null,
      lunchIncluded: row?.lunch_included === true,
      schedule: row?.schedule ?? null,
      kind: tourKindFromPriceType(row?.price_type ?? null),
    };
  } catch {
    // 조회 실패 = 안전 기본값 join (tourKind.ts의 판정 규칙과 동일한 방향).
    return { city: null, lunchIncluded: false, schedule: null, kind: 'join' };
  }
}

/** 카드 ① 캡슐 — 투어 kind에 따라 조인/프라이빗 문구 (§11.D D3). */
function buildStartCapsule(meta: TourMeta, city: string | null): ComposedBriefingCard {
  return {
    ...composeMorningBriefing({
      kind: meta.kind,
      baseHours: baseHoursForCity(city),
      rateKrw: rateForCity(city),
    }),
    metadata: {
      kind: 'tour_start_briefing',
      briefing_kind: meta.kind,
      fanout: true,
    } as Record<string, unknown>,
  };
}

interface RoomBriefingPlan {
  specs: readonly BriefingCardSpec[];
  ctx: BriefingCardContext;
  resolved: ResolvedBriefingCardSet;
}

/**
 * 한 룸이 "무엇을 어떤 순서로" 받을지 + 그 카드들이 읽을 컨텍스트.
 *
 * 카드 세트 옵션은 여기서 소비되고 컨텍스트에는 남지 않는다:
 *   · safety.skipRepeatBoarding=false → 재탑승이어도 전체 안내를 보낸다
 *     (= safetySeenBefore를 아예 계산하지 않는다);
 *   · lunch.lunchIncluded(bool) → tours.lunch_included보다 우선한다.
 * 덕분에 stack.ts의 spec들은 설정 레이어의 존재를 알 필요가 없다.
 */
async function buildRoomBriefingPlan(
  supabase: RoomDbClient,
  args: {
    roomId: string;
    bookingId: string;
    tourDate: string;
    tourMeta: TourMeta;
    startCapsule: ComposedBriefingCard;
    getSafetyVideo: () => Promise<SafetyVideoCardMeta | null>;
    tourCardSet: StoredCardSet | null;
    explicitCardIds?: readonly string[] | null;
    lunchIncludedInput?: boolean | null;
  },
): Promise<RoomBriefingPlan> {
  const roomCardSet = (await loadCardSet(supabase, 'room', args.roomId)).set;
  const resolved = resolveBriefingCardSet({
    explicitCardIds: args.explicitCardIds ?? null,
    room: roomCardSet,
    tour: args.tourCardSet,
  });
  const specs = selectBriefingCards(resolved.cardIds);

  const wantsSafety = specs.some((spec) => spec.id === 'safety');
  const wantsSchedule = specs.some((spec) => spec.id === 'schedule');
  const wantsLunch = specs.some((spec) => spec.id === 'lunch');

  const resolvedSchedule = wantsSchedule
    ? await resolveDaySchedule(supabase, {
        bookingId: args.bookingId,
        tourDate: args.tourDate,
        tourSchedule: args.tourMeta.schedule,
      })
    : { source: 'none' as const, schedule: [], dayPlan: null };

  const lunchIncluded =
    typeof resolved.options.lunch.lunchIncluded === 'boolean'
      ? resolved.options.lunch.lunchIncluded
      : typeof args.lunchIncludedInput === 'boolean'
        ? args.lunchIncludedInput
        : args.tourMeta.lunchIncluded;

  const ctx: BriefingCardContext = {
    tourDate: args.tourDate,
    tourKind: args.tourMeta.kind,
    startCapsule: args.startCapsule,
    safetyVideo: wantsSafety ? await args.getSafetyVideo() : null,
    safetySeenBefore:
      wantsSafety && resolved.options.safety.skipRepeatBoarding
        ? await hasSeenSafetyCard(supabase, args.roomId, args.tourDate)
        : false,
    schedule: resolvedSchedule.schedule,
    scheduleSource: resolvedSchedule.source,
    lunchIncluded,
    dietary: wantsLunch ? await loadDietary(supabase, args.bookingId) : [],
  };

  return { specs, ctx, resolved };
}

/**
 * 같은 (tour_id, tour_date)의 모든 미취소 예약 룸에 시작 브리핑 카드 스택을
 * 팬아웃한다. 실패는 룸 단위로, 그리고 카드 단위로 격리 (한 카드 실패가 나머지
 * 카드를, 한 룸 실패가 나머지 룸을 막지 않음).
 */
export async function fireTourStartBriefing(
  supabase: RoomDbClient,
  input: TourStartBriefingInput,
): Promise<TourStartBriefingResult> {
  const tourMeta = await loadTourMeta(supabase, input.tourId);
  const city = input.city ?? tourMeta.city;
  const startCapsule = buildStartCapsule(tourMeta, city);

  // 상품 기본 세트는 투어당 1회만 읽는다 (룸 오버라이드는 룸마다).
  const tourCardSet = (await loadCardSet(supabase, 'tour', input.tourId)).set;

  // 승인된 안전 영상은 투어 전체에 공통 — 실제로 필요한 첫 룸에서 1회만 조회.
  let safetyVideo: SafetyVideoCardMeta | null | undefined;
  const getSafetyVideo = async () => {
    if (safetyVideo === undefined) safetyVideo = await fetchSafetyVideoCard(supabase);
    return safetyVideo;
  };

  const { data: dayBookings } = await supabase
    .from('bookings')
    .select('id, tour_id, tour_date, preferred_language')
    .eq('tour_id', input.tourId)
    .eq('tour_date', input.tourDate)
    .neq('status', 'cancelled');

  const targets = Array.isArray(dayBookings) ? (dayBookings as DayBookingRow[]) : [];
  let delivered = 0;
  let skipped = 0;
  let cards = 0;

  for (const target of targets) {
    try {
      const room = await ensureRoom(supabase, target);

      const { specs, ctx } = await buildRoomBriefingPlan(supabase, {
        roomId: room.id,
        bookingId: target.id,
        tourDate: input.tourDate,
        tourMeta,
        startCapsule,
        getSafetyVideo,
        tourCardSet,
        explicitCardIds: input.cardIds ?? null,
        lunchIncludedInput: input.lunchIncluded,
      });

      let sentHere = 0;
      for (const spec of specs) {
        try {
          const capsule = spec.compose(ctx);
          if (!capsule) continue; // 카드 ③: 해석된 일정이 없으면 카드 자체가 없다

          // 카드당 1회 멱등 게이트 — 이미 발사된 카드는 다시 만들지 않는다.
          const gate = await recordRoomEvent(supabase, {
            roomId: room.id,
            bookingId: target.id,
            type: spec.eventType,
            actorRole: 'system',
            subjectKey: spec.subjectKey(ctx),
          });
          if (!gate.inserted) continue;

          const { data: message, error: messageError } = await supabase
            .from('tour_room_messages')
            .insert({
              room_id: room.id,
              booking_id: target.id,
              sender_user_id: null,
              sender_role: 'system',
              input_kind: 'text',
              source_text: capsule.source_text,
              source_locale: capsule.source_locale,
              translations: capsule.translations,
              target_locales: Object.keys(capsule.translations),
              metadata: { ...capsule.metadata, fanout: true },
            })
            .select()
            .single();
          if (messageError) throw messageError;

          await broadcastToRoom(room, 'message', { message });
          if (spec.push) {
            void sendGuestRoomPush(supabase, target, {
              translations: capsule.translations,
              tag: `tour-start-${room.id}`,
            }).catch(() => undefined);
          }

          sentHere += 1;
          cards += 1;
        } catch (cardFailure) {
          console.warn('[ops-seating] briefing card failed:', target.id, spec.id, cardFailure);
        }
      }

      if (sentHere > 0) delivered += 1;
      else skipped += 1;
    } catch (failure) {
      console.warn('[ops-seating] tour-start briefing delivery failed:', target.id, failure);
      skipped += 1;
    }
  }

  return { delivered, skipped, cards };
}

/**
 * C-17 미리보기 — "이 룸이 지금 [투어 시작]을 누르면 무엇이 나가는가".
 *
 * 팬아웃과 **같은 계획 함수**(buildRoomBriefingPlan)와 같은 spec 배열을 쓰고,
 * 마지막 세 줄(events insert · messages insert · broadcast/push)만 하지 않는다.
 * 그래서 미리보기와 실제 발송이 갈라질 수 없다 — 갈라지면 미리보기는 무의미한
 * 장식이 된다. 읽기 전용이라 멱등 키도 태우지 않는다.
 */
export async function previewTourStartBriefing(
  supabase: RoomDbClient,
  args: { roomId: string; cardIds?: readonly string[] | null },
): Promise<BriefingCardSetPreview | null> {
  const { data: roomRow } = await supabase
    .from('tour_rooms')
    .select('id, booking_id, tour_id, tour_date')
    .eq('id', args.roomId)
    .maybeSingle();
  const room = (roomRow ?? null) as
    | { id: string; booking_id: string; tour_id: string | null; tour_date: string | null }
    | null;
  if (!room) return null;

  const tourMeta = room.tour_id
    ? await loadTourMeta(supabase, room.tour_id)
    : ({ city: null, lunchIncluded: false, schedule: null, kind: 'join' } as TourMeta);
  const tourDate = room.tour_date ?? '';
  const startCapsule = buildStartCapsule(tourMeta, tourMeta.city);
  const tourCardSet = room.tour_id ? (await loadCardSet(supabase, 'tour', room.tour_id)).set : null;

  const { specs, ctx, resolved } = await buildRoomBriefingPlan(supabase, {
    roomId: room.id,
    bookingId: room.booking_id,
    tourDate,
    tourMeta,
    startCapsule,
    getSafetyVideo: () => fetchSafetyVideoCard(supabase),
    tourCardSet,
    explicitCardIds: args.cardIds ?? null,
  });

  // 이미 발사된 카드는 게이트가 다시 보내지 않는다 — 미리보기도 그렇게 보인다.
  const events = await listRoomEvents(supabase, room.id, {
    types: ['tour_start_briefing', BRIEFING_CARD_EVENT_TYPE],
    limit: 100,
  });
  const alreadySent = new Set(
    events.map((event) => (typeof event.subject_key === 'string' ? event.subject_key : '')).filter(Boolean),
  );

  const cards: BriefingCardPreviewRow[] = specs.map((spec) => {
    const capsule = spec.compose(ctx);
    const subjectKey = spec.subjectKey(ctx);
    const sentBefore = alreadySent.has(subjectKey);
    const skippedReason = !capsule ? 'no_content' : sentBefore ? 'already_sent' : null;
    return {
      id: spec.id,
      kind: spec.kind,
      subject_key: subjectKey,
      will_send: Boolean(capsule) && !sentBefore,
      skipped_reason: skippedReason,
      pushes: spec.push,
      translations: capsule ? (capsule.translations as Record<string, string>) : null,
      metadata: capsule ? capsule.metadata : null,
    };
  });

  return {
    room_id: room.id,
    booking_id: room.booking_id,
    tour_id: room.tour_id,
    tour_date: room.tour_date,
    tour_kind: tourMeta.kind,
    resolved: {
      card_ids: resolved.cardIds,
      card_ids_source: resolved.cardIdsSource,
      options: resolved.options,
      option_sources: resolved.optionSources,
    },
    cards,
  };
}

/** 미리보기 행의 사람용 라벨 (에디터·미리보기 공용). */
export function previewRowLabel(row: BriefingCardPreviewRow): string {
  return cardDescriptor(row.id)?.label ?? row.id;
}
