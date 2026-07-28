'use client';

/**
 * 가이드 채팅 헤더 좌석 스트립 — AtoC 통합 플랜 §11.B B1 (§12 Q6).
 *
 * 가이드 룸 채팅 헤더의 투어제목을 대체한다(가이드 뷰 한정). 가로 스크롤 칩:
 *   `3번 Massimo · 4번 Sofia …` (체크인 그린), 좌석 미지정 게스트는 회색
 *   "－ 이름" 칩(Q6). 칩 탭 → 게스트 카드. 데이터 = ops_seat_assignments 단일
 *   소스(useTourManifest). 투어제목은 메인화면·설정에만 유지된다.
 */

import { useMemo, useState } from 'react';
import { useTourManifest } from '@/hooks/useTourManifest';
import { useGuestNotes } from '@/hooks/useGuestNotes';
import { buildSeatStrip, buildRosterRows, type RosterRow } from '@/lib/ops/seating/dashboard';
import GuideGuestCard from '@/components/tour-mode/guide/GuideGuestCard';

export default function GuideSeatStrip({
  bookingId,
  token,
  fallbackTitle,
}: {
  bookingId: string;
  token: string;
  fallbackTitle?: string;
}) {
  const { data } = useTourManifest(bookingId, token);
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  /**
   * 🔴 이 카드는 명단에서 여는 것과 **같은 카드**인데, 여기서는 메모를 읽지
   * 않고 열었다. 카드의 메모 블록은 조건부가 아니라 항상 렌더되므로 결과는
   * "메모 없음"이 아니라 "운영 메모: (비어 있음)"이라는 **단언**이었다 —
   * 알레르기나 무릎 같은 것이 적혀 있어도 이 입구로 들어온 가이드에게는
   * 없는 것이 된다. 명단과 같은 훅을 쓴다(§K B4-D4).
   */
  const { notes, saveNote } = useGuestNotes(data?.anchorRoomId ?? null, token);

  const chips = useMemo(
    () => (data ? buildSeatStrip(data.bookings, data.assignments) : []),
    [data],
  );
  const rowsByBooking = useMemo(() => {
    const rows = data ? buildRosterRows(data.bookings, data.assignments) : [];
    return new Map<string, RosterRow>(rows.map((r) => [r.bookingId, r]));
  }, [data]);

  if (chips.length === 0) {
    return (
      <h1 className="tr-title truncate text-[var(--tr-ink)]" data-testid="seat-strip-fallback">
        {fallbackTitle ?? '투어'}
      </h1>
    );
  }

  const openRow = openBookingId ? rowsByBooking.get(openBookingId) ?? null : null;

  return (
    <>
      <div
        className="tr-chiprow flex items-center gap-1.5 py-1"
        data-testid="seat-strip"
      >
        {chips.map((chip) => {
          const tone = chip.absent
            ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)] line-through'
            : chip.checkedIn
              ? 'bg-[var(--tr-safe-soft)] text-[var(--tr-safe)]'
              : chip.unseated
                ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]'
                : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink)]';
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setOpenBookingId(chip.bookingId)}
              /* N5 — these had no edge at all, only a surface-2 fill roughly a
                 tenth of a step from the panel behind them. The guide taps them
                 on a moving bus to open a guest card, so "is this a button" has
                 to be answerable at a glance. */
              className={`tr-label tr-chip-tap tr-chip-tap--quiet shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 font-semibold ${tone}`}
              data-testid={chip.unseated ? 'seat-chip-unseated' : 'seat-chip'}
            >
              {chip.seatNumber != null ? `${chip.seatNumber}번 ` : '－ '}
              {chip.label}
            </button>
          );
        })}
      </div>

      {openRow && (
        <div className="fixed inset-0 z-40 flex items-start justify-center" data-testid="seat-strip-card">
          <button
            type="button"
            aria-label="닫기"
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpenBookingId(null)}
          />
          <div className="relative z-10 mt-16 w-full max-w-sm px-4">
            <GuideGuestCard
              row={openRow}
              onClose={() => setOpenBookingId(null)}
              note={notes.get(openRow.bookingId) ?? null}
              onSaveNote={saveNote}
            />
          </div>
        </div>
      )}
    </>
  );
}
