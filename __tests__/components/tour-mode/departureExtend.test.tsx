/**
 * 🔴 §11.D D5 — 산 시간은 시계에 반영되어야 한다.
 *
 * `/extend`는 돈(초과근무 extras + 캡슐 + 기사 푸시)은 정확히 기록하는데,
 * `DepartureCountdown`은 `departure_time + baseHoursForCity(city)`만 계산했다 —
 * **피드를 읽지 않았다.** 그래서 손님이 [시간 추가]로 ₩30,000을 내고도 "ENDS
 * AROUND 6:00 PM"이 그대로였다(2026-07-28 실기 확인: POST 201 · 지출 캡슐 도착 ·
 * 시계 불변). 돈은 움직이고 손님이 그 시트를 연 유일한 이유는 안 움직였다.
 *
 * 이 테스트가 고정하는 계약 3가지:
 *   ① 산 시간만큼 종료 시각이 밀린다,
 *   ② **기사의 사후 초과근무는 밀지 않는다**(같은 `extra_kind: 'overtime'`을
 *      쓰지만 이미 쓴 시간이다 — 이걸 세면 시계가 거꾸로 거짓말한다),
 *   ③ 취소(voided)된 구매는 다시 빠진다.
 */
import { render, screen } from '@testing-library/react';
import DepartureCountdown from '@/components/tour-mode/DepartureCountdown';
import { kstToday } from '@/lib/tour-room/time';

/** The component only renders on the tour day — anchor every case to today. */
const TODAY = kstToday();

function capsule(meta: Record<string, unknown>) {
  return { metadata: { kind: 'extra_ledger', ...meta } };
}

function renderCountdown(messages?: Array<{ metadata?: Record<string, unknown> | null }>) {
  return render(
    <DepartureCountdown
      departureTime="09:00"
      tourDate={TODAY}
      city="Jeju"
      locale="en"
      bookingId="b1"
      roomSession="sess"
      canExtend
      messages={messages}
    />,
  );
}

/** Jeju base = 9h, so 09:00 + 9h = 18:00 with nothing bought. */
const BASE_END = /6:00\s*PM/i;

describe('departure countdown ↔ purchased time', () => {
  it('ends at the base included hours when nothing was bought', () => {
    renderCountdown([]);
    expect(screen.getByTestId('departure-countdown')).toHaveTextContent(BASE_END);
  });

  it('pushes the end time out by the hours the guest bought', () => {
    renderCountdown([capsule({ extra_id: 'e1', extend_hours: 2, status: 'logged', extra_kind: 'overtime' })]);
    expect(screen.getByTestId('departure-countdown')).toHaveTextContent(/8:00\s*PM/i);
  });

  it('ignores the driver\'s post-hoc overtime, which spends time rather than buying it', () => {
    // Same ledger kind, no `extend_hours` — the cockpit's 초과근무 sheet.
    renderCountdown([capsule({ extra_id: 'e2', status: 'logged', extra_kind: 'overtime', amount_krw: 30000 })]);
    expect(screen.getByTestId('departure-countdown')).toHaveTextContent(BASE_END);
  });

  it('takes the hours back when the purchase is voided', () => {
    // Newest capsule per extra wins — the void supersedes the logged one.
    renderCountdown([
      capsule({ extra_id: 'e3', extend_hours: 1, status: 'logged', extra_kind: 'overtime' }),
      capsule({ extra_id: 'e3', extend_hours: 1, status: 'voided', extra_kind: 'overtime' }),
    ]);
    expect(screen.getByTestId('departure-countdown')).toHaveTextContent(BASE_END);
  });

  it('sums several purchases', () => {
    renderCountdown([
      capsule({ extra_id: 'e4', extend_hours: 1, status: 'logged', extra_kind: 'overtime' }),
      capsule({ extra_id: 'e5', extend_hours: 2, status: 'confirmed', extra_kind: 'overtime' }),
    ]);
    expect(screen.getByTestId('departure-countdown')).toHaveTextContent(/9:00\s*PM/i);
  });
});
