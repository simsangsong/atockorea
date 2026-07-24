'use client';

/**
 * 좌석 Realtime 구독 — AtoC 통합 플랜 §5.3 C-10 / §5.4b.
 *
 * 기존 broadcastToRoom/broadcastToRooms 가 쏘는 'seat_update' 이벤트를 룸
 * Broadcast 채널에서 받아 onUpdate를 호출한다 (게스트 좌석선택의 "타인 선택
 * 즉시 비활성", 가이드 대시보드의 실시간 카운터). 서버는 (tour_id, tour_date)
 * 형제 룸 전체로 팬아웃하므로 아무 형제 룸 토픽 하나만 구독하면 된다.
 *
 * 새 WebSocket을 열지 않고 기존 useTourRoomChannel과 동일한 anon 브라우저
 * 클라이언트/토픽 규약(lib/tour-room/realtime.ts roomChannelTopic)을 재사용한다.
 * 토픽이 없으면(차량 미배정 등) 아무것도 구독하지 않는다 — 소비 화면은 폴백
 * 폴링으로 degrade.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export function useSeatChannel(
  channelTopic: string | null | undefined,
  onUpdate: (payload: Record<string, unknown>) => void,
): void {
  const cbRef = useRef(onUpdate);
  useEffect(() => {
    cbRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!channelTopic || !supabase) return;
    const client = supabase;
    const channel = client.channel(channelTopic, { config: { broadcast: { self: true } } });
    channel.on('broadcast', { event: 'seat_update' }, (frame) => {
      cbRef.current((frame.payload as Record<string, unknown>) ?? {});
    });
    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [channelTopic]);
}
