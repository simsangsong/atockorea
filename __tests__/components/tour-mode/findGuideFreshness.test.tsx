/**
 * §D A1.4 P1 — "가이드에게 가기" 정직성 게이트.
 *
 * 🔴 이 카드는 손님이 **길을 잃었을 때** 쓴다. 낡은 좌표로 방향과 도보 링크를
 * 단언하면, 손님은 가이드가 **있었던** 곳으로 걸어간다 — 가장 나쁜 순간에
 * 오정보가 나가는 셈이다.
 *
 * 같은 폴더 `VehicleLocationCard`가 이미 같은 규율을 갖고 있고, 이 테스트는
 * 그 규율이 이 카드에도 적용됐다는 것을 고정한다.
 */

import { render, screen } from '@testing-library/react';
import FindGuideCard from '@/components/tour-mode/map/FindGuideCard';

const ME = { latitude: 33.45, longitude: 126.56 };
const GUIDE = { latitude: 33.4515, longitude: 126.5615 };
const NOW = Date.parse('2026-08-17T09:00:00Z');
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const renderCard = (recordedAt: string | null | undefined) =>
  render(<FindGuideCard me={ME} guide={GUIDE} guideRecordedAt={recordedAt} locale="ko" nowMs={NOW} />);

describe('신선한 좌표 — 기존 동작 그대로', () => {
  it('2분 전(live)이면 거리와 도보 링크가 나온다', () => {
    renderCard(at(60_000));
    expect(screen.getByTestId('find-guide-card')).toBeInTheDocument();
    expect(screen.getByText('도보 길찾기')).toBeInTheDocument();
    expect(screen.queryByTestId('find-guide-stale')).toBeNull();
  });

  it('9분 전(recent)까지도 링크를 유지한다 — 걷는 동안의 지연은 정상이다', () => {
    renderCard(at(9 * 60_000));
    expect(screen.getByText('도보 길찾기')).toBeInTheDocument();
    expect(screen.queryByTestId('find-guide-stale')).toBeNull();
  });
});

describe('🔴 낡은 좌표 — 방향은 주되 길찾기는 열지 않는다', () => {
  it('20분 전이면 나이를 말하고 도보 링크를 없앤다', () => {
    renderCard(at(20 * 60_000));
    expect(screen.getByTestId('find-guide-card')).toBeInTheDocument();
    expect(screen.getByTestId('find-guide-stale')).toHaveTextContent('20분 전 위치');
    expect(screen.getByTestId('find-guide-stale')).toHaveTextContent('이동했을 수 있어요');
    // 🔴 이게 이 티켓의 핵심이다.
    expect(screen.queryByText('도보 길찾기')).toBeNull();
  });

  it('거리는 계속 보여준다 — 방향 감각에는 여전히 쓸모가 있다', () => {
    renderCard(at(30 * 60_000));
    expect(screen.getByTestId('find-guide-card')).toHaveTextContent('거리');
  });
});

describe('🔴 아주 낡거나 알 수 없는 좌표 — 카드 자체가 뜨지 않는다', () => {
  it('한 시간을 넘기면 방향조차 말하지 않는다', () => {
    renderCard(at(61 * 60_000));
    expect(screen.queryByTestId('find-guide-card')).toBeNull();
  });

  it('기록 시각을 모르면 렌더하지 않는다 — 모르는 것을 "지금 여기"로 그리지 않는다', () => {
    renderCard(null);
    expect(screen.queryByTestId('find-guide-card')).toBeNull();
    renderCard(undefined);
    expect(screen.queryByTestId('find-guide-card')).toBeNull();
  });

  it('좌표가 하나라도 없으면 렌더하지 않는다 (기존 계약)', () => {
    const { container } = render(
      <FindGuideCard me={null} guide={GUIDE} guideRecordedAt={at(0)} locale="ko" nowMs={NOW} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
