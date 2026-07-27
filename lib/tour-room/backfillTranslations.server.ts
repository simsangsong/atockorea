/**
 * V0.5 백필 — 늦게 합류한 기기의 언어로 **과거 메시지**를 메운다.
 *
 * 왜 필요해졌나: 스태프 메시지의 팬아웃이 `CORE_TRANSLATION_LOCALES`(5종) 고정
 * 바닥을 갖고 있었다. 영어 손님 1명 + 한국어 기사인 방에서도 5개 언어를 번역했다는
 * 뜻이다. 참여자 기준으로 좁히면 -376ms + 번역 비용 60% 절감이지만, 그 5종 바닥이
 * **늦은 합류자의 구멍을 덮고 있었다** — 동행 기기가 나중에 들어와 과거 메시지를
 * 열면 자기 언어 번역이 없어 원문 그대로 보인다.
 *
 * 그래서 좁히되 구멍은 닫는다: 새 언어가 방에 들어오면 최근 메시지를 그 언어로
 * 메우고 브로드캐스트한다. 조용한 열화 대신 명시적인 복구다.
 *
 * 🔴 join 응답을 막지 않는다 — 호출부는 `after()` 로 예약할 것. 실패는 전부
 * 삼킨다: 백필이 안 된 방은 원문을 보는 예전 상태로 남을 뿐이고, 던지면 입장이
 * 깨진다.
 *
 * 비용: 메시지당 1로케일 1콜이지만 `tour_translation_cache` 가 앞에 있어 같은
 * 문구(프리셋·캡슐)는 공짜다. 그래도 상한을 둔다 — 상한이 없으면 긴 방에 늦게
 * 합류한 한 명이 수십 콜을 유발한다.
 */

import { translateTextForLocales } from '@/lib/openai-server';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import type { RoomDbClient, TourRoom } from '@/lib/tour-room/access';

/** 한 번의 백필이 건드릴 수 있는 최대 메시지 수. */
export const BACKFILL_MESSAGE_LIMIT = 20;

interface BackfillableMessage {
  id: string;
  source_text: string | null;
  translations: Record<string, string> | null;
  target_locales: string[] | null;
}

/**
 * `messages` 중 이 로케일 번역이 없는 것만. 순수 함수 — 상한 규칙을 테스트에서
 * 직접 확인할 수 있게 분리했다.
 */
export function messagesMissingLocale(
  messages: BackfillableMessage[],
  locale: string,
  limit: number = BACKFILL_MESSAGE_LIMIT,
): BackfillableMessage[] {
  const missing: BackfillableMessage[] = [];
  for (const message of messages) {
    if (missing.length >= limit) break;
    if (!message.source_text || !message.source_text.trim()) continue;
    const translations = message.translations ?? {};
    if (typeof translations[locale] === 'string' && translations[locale]) continue;
    missing.push(message);
  }
  return missing;
}

export interface BackfillResult {
  locale: string;
  scanned: number;
  repaired: number;
}

/**
 * 방의 최근 메시지를 `locale` 로 메운다. 이미 그 언어가 있는 메시지는 건드리지
 * 않으므로 여러 번 불러도 안전하다(같은 기기가 재입장해도 콜이 늘지 않는다).
 */
export async function backfillRoomLocale(
  supabase: RoomDbClient,
  room: TourRoom,
  locale: string,
  limit: number = BACKFILL_MESSAGE_LIMIT,
): Promise<BackfillResult> {
  const result: BackfillResult = { locale, scanned: 0, repaired: 0 };
  if (!locale) return result;

  try {
    // 최근 것부터 본다 — 늦게 합류한 사람이 스크롤해서 보는 것도 최근 대화다.
    const { data } = await supabase
      .from('tour_room_messages')
      .select('id, source_text, translations, target_locales')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })
      .limit(limit * 3); // 이미 번역된 것들을 걷어내고도 limit 을 채울 여유

    const rows = (data ?? []) as BackfillableMessage[];
    result.scanned = rows.length;

    const todo = messagesMissingLocale(rows, locale, limit);
    for (const message of todo) {
      try {
        const translated = await translateTextForLocales(message.source_text!.trim(), [locale]);
        const value = translated.translations[locale];
        if (!value) continue;

        const merged = { ...(message.translations ?? {}), [locale]: value };
        const targets = [...new Set([...(message.target_locales ?? []), locale])];
        const { data: updated, error } = await supabase
          .from('tour_room_messages')
          .update({ translations: merged, target_locales: targets })
          .eq('id', message.id)
          .eq('room_id', room.id)
          .select()
          .single();
        if (error) continue;

        result.repaired += 1;
        // 합류자는 join 응답 직후 스냅샷을 받으므로 백필이 그보다 늦을 수 있다.
        // 브로드캐스트가 실제 전달 경로다 — 있으면 좋은 게 아니라 필요하다.
        await broadcastToRoom(room, 'message', { message: updated }).catch(() => undefined);
      } catch {
        // 한 건 실패가 나머지를 막지 않는다.
      }
    }
  } catch {
    /* 백필 없음 = 예전 동작(원문 노출). 입장을 깨뜨리지는 않는다. */
  }

  return result;
}
