/**
 * SG-2b-γ — the rejoin capsule card. Pinned: fact-first headline, the
 * Korean destination as the card's biggest text (a taxi driver reads it),
 * the no-destination degradation, and the aboard hedge — the server cannot
 * know who is missing, so the seated majority must be waved off in copy.
 */
import { render } from '@testing-library/react';
import WaitEndedCard from '@/components/tour-mode/WaitEndedCard';

const BASE_META = {
  kind: 'wait_ended' as const,
  departed_at_ms: Date.UTC(2026, 6, 28, 1, 30, 0), // 10:30 KST
  next_stop_name: '섭지코지 주차장',
  next_stop_time: '11:05',
};

describe('WaitEndedCard', () => {
  it('leads with the fact and shows the destination for a taxi driver', () => {
    const { getByText, getByTestId } = render(<WaitEndedCard meta={BASE_META} locale="en" />);
    expect(getByText(/The vehicle departed at/)).toBeInTheDocument();
    expect(getByText('섭지코지 주차장')).toBeInTheDocument();
    expect(getByText('Show this to any taxi driver')).toBeInTheDocument();
    expect(getByTestId('wait-ended-map')).toHaveAttribute(
      'href',
      expect.stringContaining('map.kakao.com'),
    );
    expect(getByText(/Already aboard\? Please ignore this card\./)).toBeInTheDocument();
  });

  it('degrades to the coordinator-only variant when the day had no later stop', () => {
    const { queryByTestId, getByText } = render(
      <WaitEndedCard meta={{ kind: 'wait_ended', departed_at_ms: BASE_META.departed_at_ms }} locale="en" />,
    );
    expect(queryByTestId('wait-ended-map')).not.toBeInTheDocument();
    expect(getByText(/The coordinator will arrange your rejoin/)).toBeInTheDocument();
  });

  it('speaks the guest locale', () => {
    const { getByText } = render(<WaitEndedCard meta={BASE_META} locale="ko" />);
    expect(getByText(/차량이 .*에 출발했습니다/)).toBeInTheDocument();
    expect(getByText('택시 기사님께 이 카드를 보여주세요')).toBeInTheDocument();
  });
});
