/**
 * 투어 시작 브리핑 팬아웃 — AtoC 통합 플랜 §5.4 C-16 ①.
 *
 * 시작 게이트 통과([투어 시작] 탭, tour_start 이벤트가 실제 insert된 순간)에만
 * 호출되는 연결 지점. 기존 브리핑 경로를 그대로 재사용한다:
 *   - 문구: lib/tour-room/morningBriefing.ts composeMorningBriefing('join')
 *     (5로케일 사전 번역 상수, LLM 0)
 *   - 전달: ensureRoom → tour_room_messages 캡슐 → broadcastToRoom('message')
 *     → sendGuestRoomPush — app/api/tour-rooms/[bookingId]/morning-briefing의
 *     팬아웃 계약과 동일 (metadata.kind만 'tour_start_briefing').
 *   - 멱등: 룸당 recordRoomEvent subject_key 'tour_start_briefing' — 게이트
 *     라우트가 재시도되어도 캡슐이 중복 발사되지 않는다.
 *
 * C-16 ②~⑤ 카드 스택(안전 비디오·일정 프리뷰·점심·매너)은 Phase 2 후속
 * 슬라이스가 이 함수 내부의 캡슐 구성만 확장하면 된다 — 게이트 라우트는
 * 이 함수 시그니처만 알고, 카드 구성은 여기 한 곳에 응집된다.
 */

import type { RoomDbClient } from '@/lib/tour-room/access';
import { ensureRoom } from '@/lib/tour-room/access';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { sendGuestRoomPush } from '@/lib/tour-room/guestPush';
import { composeMorningBriefing } from '@/lib/tour-room/morningBriefing';
import { baseHoursForCity, rateForCity } from '@/lib/tour-room/overtime';

export interface TourStartBriefingInput {
  tourId: string;
  /** YYYY-MM-DD (KST). */
  tourDate: string;
  /** tours.city — 조인 문구에는 rate 미표기이나 rateForCity 단일 소스 위해 전달. */
  city?: string | null;
}

export interface TourStartBriefingResult {
  delivered: number;
  skipped: number;
}

/**
 * 같은 (tour_id, tour_date)의 모든 미취소 예약 룸에 시작 브리핑 캡슐을
 * 팬아웃한다. 실패는 룸 단위로 격리 (한 룸 실패가 나머지를 막지 않음).
 */
export async function fireTourStartBriefing(
  supabase: RoomDbClient,
  input: TourStartBriefingInput,
): Promise<TourStartBriefingResult> {
  const bundle = composeMorningBriefing({
    kind: 'join',
    baseHours: baseHoursForCity(input.city ?? null),
    rateKrw: rateForCity(input.city ?? null),
  });

  const { data: dayBookings } = await supabase
    .from('bookings')
    .select('id, tour_id, tour_date')
    .eq('tour_id', input.tourId)
    .eq('tour_date', input.tourDate)
    .neq('status', 'cancelled');

  const targets = Array.isArray(dayBookings) ? dayBookings : [];
  let delivered = 0;
  let skipped = 0;

  for (const target of targets as Array<{ id: string; tour_id: string | null; tour_date: string | null }>) {
    try {
      const room = await ensureRoom(supabase, target);

      // 룸당 1회 멱등 게이트 — 이미 발사된 룸은 캡슐을 다시 만들지 않는다.
      const gate = await recordRoomEvent(supabase, {
        roomId: room.id,
        bookingId: target.id,
        type: 'tour_start_briefing',
        actorRole: 'system',
        subjectKey: 'tour_start_briefing',
      });
      if (!gate.inserted) {
        skipped += 1;
        continue;
      }

      const { data: message, error: messageError } = await supabase
        .from('tour_room_messages')
        .insert({
          room_id: room.id,
          booking_id: target.id,
          sender_user_id: null,
          sender_role: 'system',
          input_kind: 'text',
          source_text: bundle.source_text,
          source_locale: bundle.source_locale,
          translations: bundle.translations,
          target_locales: Object.keys(bundle.translations),
          metadata: { kind: 'tour_start_briefing', fanout: true },
        })
        .select()
        .single();
      if (messageError) throw messageError;

      await broadcastToRoom(room, 'message', { message });
      void sendGuestRoomPush(supabase, target, {
        translations: bundle.translations,
        tag: `tour-start-${room.id}`,
      }).catch(() => undefined);

      delivered += 1;
    } catch (failure) {
      console.warn('[ops-seating] tour-start briefing delivery failed:', target.id, failure);
      skipped += 1;
    }
  }

  return { delivered, skipped };
}
