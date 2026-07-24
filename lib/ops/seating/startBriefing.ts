/**
 * 투어 시작 브리핑 팬아웃 — AtoC 통합 플랜 §5.4 C-16 ①~⑤.
 *
 * 시작 게이트 통과([투어 시작] 탭, tour_start 이벤트가 실제 insert된 순간)에만
 * 호출되는 연결 지점. 기존 브리핑 경로를 그대로 재사용한다:
 *   - 문구: 5로케일 사전 번역 상수, LLM 0
 *     (카드 ① lib/tour-room/morningBriefing.ts composeMorningBriefing('join'),
 *      카드 ②~⑤ lib/ops/seating/cards/*)
 *   - 전달: ensureRoom → tour_room_messages 캡슐 → broadcastToRoom('message')
 *     → sendGuestRoomPush — app/api/tour-rooms/[bookingId]/morning-briefing의
 *     팬아웃 계약과 동일 (metadata.kind만 카드별로 다름).
 *   - 멱등: 카드마다 고유한 recordRoomEvent subject_key — 게이트 라우트가
 *     재시도되어도 어떤 카드도 중복 발사되지 않는다.
 *
 * 🔴 카드 구성은 이 파일에 없다. 순서·포함 여부·kind·subject_key는 전부
 * `lib/ops/seating/cards/stack.ts`의 선언적 배열 BRIEFING_CARD_STACK 한 곳에
 * 있고, 이 함수는 그 배열을 순회할 뿐이다 (§5.4 C-17 카드 세트 에디터가
 * `cardIds`만 넘기면 되도록 설계).
 */

import type { RoomDbClient } from '@/lib/tour-room/access';
import { ensureRoom } from '@/lib/tour-room/access';
import { recordRoomEvent, listRoomEvents } from '@/lib/tour-room/events';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { sendGuestRoomPush } from '@/lib/tour-room/guestPush';
import { composeMorningBriefing } from '@/lib/tour-room/morningBriefing';
import { baseHoursForCity, rateForCity } from '@/lib/tour-room/overtime';
import { resolveDaySchedule } from '@/lib/tour-room/dayPlan';
import { needsToDietary } from '@/lib/ops/dining/dietary';
import { fetchSafetyVideoCard } from '@/lib/tour-room/safetyVideo.server';
import type { SafetyVideoCardMeta } from '@/lib/tour-room/safetyVideo';
import {
  BRIEFING_CARD_EVENT_TYPE,
  SAFETY_SUBJECT_PREFIX,
  selectBriefingCards,
  type BriefingCardContext,
} from '@/lib/ops/seating/cards/stack';

export interface TourStartBriefingInput {
  tourId: string;
  /** YYYY-MM-DD (KST). */
  tourDate: string;
  /** tours.city — 조인 문구에는 rate 미표기이나 rateForCity 단일 소스 위해 전달. */
  city?: string | null;
  /** tours.lunch_included — 미전달 시 tours에서 조회 (카드 ④). */
  lunchIncluded?: boolean | null;
  /** C-17 선행 훅: 보낼 카드 id와 순서. 미전달 = 기본 스택 전체. */
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
}

/** tours 한 행에서 카드 구성에 필요한 값만 (city·lunch_included·schedule). */
async function loadTourMeta(supabase: RoomDbClient, tourId: string): Promise<TourMeta> {
  try {
    const { data } = await supabase
      .from('tours')
      .select('city, lunch_included, schedule')
      .eq('id', tourId)
      .maybeSingle();
    const row = (data ?? null) as
      | { city?: string | null; lunch_included?: boolean | null; schedule?: unknown }
      | null;
    return {
      city: row?.city ?? null,
      lunchIncluded: row?.lunch_included === true,
      schedule: row?.schedule ?? null,
    };
  } catch {
    return { city: null, lunchIncluded: false, schedule: null };
  }
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
  const specs = selectBriefingCards(input.cardIds);

  const tourMeta = await loadTourMeta(supabase, input.tourId);
  const city = input.city ?? tourMeta.city;
  const lunchIncluded =
    typeof input.lunchIncluded === 'boolean' ? input.lunchIncluded : tourMeta.lunchIncluded;

  const startCapsule = {
    ...composeMorningBriefing({
      kind: 'join',
      baseHours: baseHoursForCity(city),
      rateKrw: rateForCity(city),
    }),
    metadata: { kind: 'tour_start_briefing', fanout: true } as Record<string, unknown>,
  };

  // 승인된 안전 영상은 투어 전체에 공통 — 룸마다 다시 조회하지 않는다.
  let safetyVideo: SafetyVideoCardMeta | null = null;
  if (specs.some((spec) => spec.id === 'safety')) {
    safetyVideo = await fetchSafetyVideoCard(supabase);
  }

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

      const wantsSchedule = specs.some((spec) => spec.id === 'schedule');
      const wantsLunch = specs.some((spec) => spec.id === 'lunch');
      const wantsSafety = specs.some((spec) => spec.id === 'safety');

      const resolved = wantsSchedule
        ? await resolveDaySchedule(supabase, {
            bookingId: target.id,
            tourDate: input.tourDate,
            tourSchedule: tourMeta.schedule,
          })
        : { source: 'none' as const, schedule: [], dayPlan: null };

      const ctx: BriefingCardContext = {
        tourDate: input.tourDate,
        startCapsule,
        safetyVideo,
        safetySeenBefore: wantsSafety ? await hasSeenSafetyCard(supabase, room.id, input.tourDate) : false,
        schedule: resolved.schedule,
        scheduleSource: resolved.source,
        lunchIncluded,
        dietary: wantsLunch ? await loadDietary(supabase, target.id) : [],
      };

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
