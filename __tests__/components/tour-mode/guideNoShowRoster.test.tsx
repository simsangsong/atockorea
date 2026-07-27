/**
 * N1 (owner report 2026-07-27) — "조인투어에서 아침에 손님이 노쇼일시 노쇼 증거
 * 남기기 버튼은 있어야 되는거 아니야?? 지금 없는데?"
 *
 * The evidence flow was built and well built — photo + GPS + timestamp, and it
 * refuses to close without them (§5.4b D12). It was also **unreachable**: both
 * `absent` and `no-show-evidence` required a seat, and ops has never assigned
 * one in production (ops_seat_assignments is empty). On a join tour the seat
 * map is blank, so the single path in was gone, and the roster card — where a
 * guide actually works in the morning — only rendered the no-show STATUS as a
 * badge.
 *
 * What is locked here: the roster card offers the action, marking demands
 * evidence first, and undoing does not.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import GuideGuestCard from '@/components/tour-mode/guide/GuideGuestCard';
import type { RosterRow } from '@/lib/ops/seating/dashboard';

function row(overrides: Partial<RosterRow> = {}): RosterRow {
  return {
    bookingId: 'b-1',
    name: 'Alex',
    partySize: 2,
    // 좌석이 배정된 적이 없는 조인투어의 실제 상태값이다.
    status: 'unseated',
    channel: 'direct',
    seatNumbers: [],
    highlights: [],
    pickupPoint: null,
    pickupTime: null,
    contactPhone: null,
    whatsapp: null,
    language: 'en',
    ...overrides,
  } as RosterRow;
}

describe('🔴 N1 — 노쇼 처리는 명단에서 닿아야 한다', () => {
  it('게스트 카드에 노쇼 처리 버튼이 있다', () => {
    render(<GuideGuestCard row={row()} onClose={() => {}} onNoShow={() => {}} />);
    expect(screen.getByTestId('guest-no-show')).toHaveTextContent('노쇼 처리');
  });

  it('마크는 mark로 부른다 — 증거 시트는 호출부가 연다', () => {
    const onNoShow = jest.fn();
    render(<GuideGuestCard row={row()} onClose={() => {}} onNoShow={onNoShow} />);
    fireEvent.click(screen.getByTestId('guest-no-show'));
    expect(onNoShow).toHaveBeenCalledWith('b-1', 'mark');
  });

  it('이미 노쇼면 취소를 제안한다 — 되돌리기는 마찰이 없다(D12)', () => {
    const onNoShow = jest.fn();
    render(<GuideGuestCard row={row({ status: 'absent' })} onClose={() => {}} onNoShow={onNoShow} />);
    const button = screen.getByTestId('guest-no-show');
    expect(button).toHaveTextContent('노쇼 취소');
    fireEvent.click(button);
    expect(onNoShow).toHaveBeenCalledWith('b-1', 'clear');
  });

  it('핸들러가 없으면 버튼도 없다 — 기존 호출부는 그대로다', () => {
    render(<GuideGuestCard row={row()} onClose={() => {}} />);
    expect(screen.queryByTestId('guest-no-show')).not.toBeInTheDocument();
  });
});
