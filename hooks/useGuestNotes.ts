'use client';

/**
 * §K B4 — 그룹 운영자 메모를, 이것을 보여주는 **모든** 표면이 한 소스에서 읽게 한다.
 *
 * 🔴 왜 훅으로 빼는가: 원래 로딩·저장이 `GuideSeatDashboard` 안에만 있었고,
 * 그 파일의 주석이 이미 이렇게 경고하고 있었다 —
 *   "명단 행(아이콘)과 게스트 카드(전문)가 같은 소스를 읽는다(B4-D4)
 *    — 두 곳에서 따로 부르면 반드시 어긋난다."
 * 그런데 세 번째 표면인 헤더 좌석 스트립(`GuideSeatStrip`)이 같은
 * `GuideGuestCard` 를 열면서 메모를 **아예 읽지 않았다.** 카드의 메모 블록은
 * 조건부가 아니라 항상 렌더되므로, 결과는 "메모 없음"이 아니라
 * **"운영 메모: (비어 있음)"이라는 단언**이었다. 알레르기·무릎 같은 것이
 * 적혀 있어도 그 입구로 들어온 가이드에게는 없는 것이 된다.
 *
 * 그래서 표면이 늘어도 갈라질 수 없도록 여기 하나만 둔다.
 *
 * 전부 best-effort 다. 메모 조회가 실패해도 명단·카드는 그대로 떠야 한다
 * (다른 ops_* 표면과 같은 graceful degrade).
 */

import { useCallback, useEffect, useState } from 'react';
import type { GuestNote } from '@/lib/ops/seating/guestNotes';

export interface GuestNotesApi {
  notes: Map<string, GuestNote>;
  /** 저장 실패 메시지. null = 문제 없음. 화면이 사용자에게 보여줄 몫이다. */
  error: string | null;
  saveNote: (bookingId: string, note: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useGuestNotes(anchorRoomId: string | null, token: string | null): GuestNotesApi {
  const [notes, setNotes] = useState<Map<string, GuestNote>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!anchorRoomId || !token) return;
    try {
      const res = await fetch(`/api/ops/rooms/${anchorRoomId}/notes?rt=${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = (await res.json()) as { notes?: GuestNote[] };
      setNotes(new Map((json.notes ?? []).map((n) => [n.bookingId, n])));
    } catch {
      /* 메모 없이 명단이 뜬다 */
    }
  }, [anchorRoomId, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveNote = useCallback(
    async (bookingId: string, text: string) => {
      if (!anchorRoomId || !token) return;
      // 낙관적 저장: 승차 중에 쓰는 물건이라 왕복을 기다리게 하지 않는다.
      // 실패하면 서버 상태로 되돌린다 — 실패가 조용히 "저장됨"으로 보이면 안 된다.
      const previous = notes;
      const optimistic = new Map(previous);
      if (text.trim()) {
        optimistic.set(bookingId, {
          bookingId,
          note: text.trim(),
          updatedByRole: 'guide',
          updatedByName: null,
          updatedAt: new Date().toISOString(),
        });
      } else {
        optimistic.delete(bookingId);
      }
      setNotes(optimistic);
      setError(null);
      try {
        const res = await fetch(`/api/ops/rooms/${anchorRoomId}/notes?rt=${encodeURIComponent(token)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId, note: text }),
        });
        if (!res.ok) throw new Error('save_failed');
        await reload();
      } catch {
        setNotes(previous);
        setError('메모 저장에 실패했습니다');
      }
    },
    [anchorRoomId, token, notes, reload],
  );

  return { notes, error, saveNote, reload };
}
