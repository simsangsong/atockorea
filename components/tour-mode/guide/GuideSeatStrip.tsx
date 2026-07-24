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
        className="flex items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
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
            <GuideGuestCard row={openRow} onClose={() => setOpenBookingId(null)} />
          </div>
        </div>
      )}
    </>
  );
}
