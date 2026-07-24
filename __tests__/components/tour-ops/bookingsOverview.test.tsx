/**
 * §K B1.3/B1.4 — 주간 카드 · 월간 달력.
 *
 * 🔴 이 스위트의 핵심은 B1-D6이다: 티어 ②③이 0일 때 **"실패 없음"과
 * "인박스 미연결"이 화면에서 달라 보여야 한다.** 라이브에서 인박스는 아직
 * 안 켜져 있으므로, 이 구분이 없으면 오너는 매일 "0건"을 보며 파이프라인이
 * 도는 줄 알고 OTA 메일을 놓친다.
 */

import { render, screen, waitFor } from '@testing-library/react';
import OpsBookingsOverview, { maskName } from '@/components/tour-ops/OpsBookingsOverview';

function payload(over: Record<string, unknown> = {}) {
  return {
    view: 'week',
    axis: 'tour_date',
    range: { from: '2026-08-17', to: '2026-08-23' },
    records: [],
    summary: {
      counts: { confirmed: 0, pending_review: 0, unparsed: 0 },
      roomGaps: { no_room: 0, no_participant: 0, no_seat: 0 },
      confirmedGuests: 0,
      byChannel: [],
    },
    inbox: 'never_ran',
    ...over,
  };
}

function mockFetch(body: unknown) {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('maskName — B1-D5 상시 열려 있는 화면', () => {
  it('가운데를 가린다', () => {
    expect(maskName('Massimo')).toBe('M****o');
  });

  it('짧은 이름도 통째로 노출되지 않는다', () => {
    expect(maskName('Al')).toBe('A*');
    expect(maskName('김')).toBe('김*');
  });

  it('빈 이름은 자리표시자', () => {
    expect(maskName(null)).toBe('이름 없음');
    expect(maskName('   ')).toBe('이름 없음');
  });
});

describe('🔴 B1-D6 — 0건과 미연결을 구분한다', () => {
  it('인박스가 한 번도 안 돌았으면 "0"이 아니라 "미연결"을 보여준다', async () => {
    mockFetch(payload({ inbox: 'never_ran' }));
    render(<OpsBookingsOverview />);
    await waitFor(() => expect(screen.getByTestId('tier-unparsed')).toBeInTheDocument());

    expect(screen.getByTestId('tier-unparsed-disconnected')).toHaveTextContent('미연결');
    expect(screen.getByTestId('tier-pending_review-disconnected')).toHaveTextContent('미연결');
  });

  it('인박스가 돌고 있으면 0은 안심 신호로 그대로 보여준다', async () => {
    mockFetch(payload({ inbox: 'active' }));
    render(<OpsBookingsOverview />);
    await waitFor(() => expect(screen.getByTestId('tier-unparsed')).toBeInTheDocument());

    expect(screen.queryByTestId('tier-unparsed-disconnected')).toBeNull();
    expect(screen.getByTestId('tier-unparsed')).toHaveTextContent('0');
  });

  it('확정 예약은 미연결 표시 대상이 아니다 — 인박스와 무관한 평면이다', async () => {
    mockFetch(payload({ inbox: 'never_ran' }));
    render(<OpsBookingsOverview />);
    await waitFor(() => expect(screen.getByTestId('tier-confirmed')).toBeInTheDocument());

    expect(screen.queryByTestId('tier-confirmed-disconnected')).toBeNull();
  });
});

describe('B1-D1 — 총합 카드가 없다', () => {
  it('세 티어 카드만 뜬다', async () => {
    mockFetch(
      payload({
        inbox: 'active',
        summary: {
          counts: { confirmed: 2, pending_review: 1, unparsed: 3 },
          roomGaps: { no_room: 0, no_participant: 0, no_seat: 0 },
          confirmedGuests: 5,
          byChannel: [],
        },
      }),
    );
    render(<OpsBookingsOverview />);
    await waitFor(() => expect(screen.getByTestId('tier-confirmed')).toBeInTheDocument());

    expect(screen.getByTestId('tier-confirmed')).toHaveTextContent('2');
    expect(screen.getByTestId('tier-unparsed')).toHaveTextContent('3');
    // 2+1+3=6을 어디에도 쓰지 않는다 — 셋을 더한 숫자는 거짓말이다.
    expect(screen.queryByText('6')).toBeNull();
  });
});

describe('B1-D2 — 룸 누락 세 종류를 따로 보여준다', () => {
  it('원인별로 칩이 나온다', async () => {
    mockFetch(
      payload({
        inbox: 'active',
        summary: {
          counts: { confirmed: 3, pending_review: 0, unparsed: 0 },
          roomGaps: { no_room: 1, no_participant: 2, no_seat: 1 },
          confirmedGuests: 6,
          byChannel: [],
        },
      }),
    );
    render(<OpsBookingsOverview />);
    await waitFor(() => expect(screen.getByTestId('room-gaps')).toBeInTheDocument());

    expect(screen.getByTestId('gap-no_room')).toHaveTextContent('투어룸 없음 1');
    expect(screen.getByTestId('gap-no_participant')).toHaveTextContent('아무도 입장 안 함 2');
    expect(screen.getByTestId('gap-no_seat')).toHaveTextContent('좌석 미배정 1');
  });

  it('누락이 없으면 요주의 블록 자체가 안 뜬다', async () => {
    mockFetch(payload({ inbox: 'active' }));
    render(<OpsBookingsOverview />);
    await waitFor(() => expect(screen.getByTestId('tier-confirmed')).toBeInTheDocument());
    expect(screen.queryByTestId('room-gaps')).toBeNull();
  });
});

describe('빈 상태가 기본 상태다 (라이브 예약 3행)', () => {
  it('예약이 없어도 화면이 무너지지 않고 그렇게 말한다', async () => {
    mockFetch(payload({ inbox: 'active' }));
    render(<OpsBookingsOverview />);
    await waitFor(() => expect(screen.getByTestId('overview-empty')).toBeInTheDocument());
    expect(screen.getByTestId('week-cards')).toBeInTheDocument();
  });

  it('주간 카드는 예약이 없어도 7일을 전부 그린다 — 빠진 날이 안 보이면 안 된다', async () => {
    mockFetch(payload({ inbox: 'active' }));
    render(<OpsBookingsOverview />);
    await waitFor(() => expect(screen.getByTestId('week-cards')).toBeInTheDocument());
    expect(screen.getByTestId('week-cards').children).toHaveLength(7);
  });
});
