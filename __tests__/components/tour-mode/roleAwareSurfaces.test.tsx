/**
 * P1-1 / P1-4 — surfaces that must speak to the RIGHT role.
 *
 * Both defects had the same shape: the role was already in scope at the render
 * site and the code simply ignored it, so the guide was shown guest-facing
 * affordances ("가이드 따라가기 / 找到导游") and guest-facing copy ("가이드의
 * 안내가 여기에 도착해요") on their own screen.
 */
import { render, screen } from '@testing-library/react';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import LobbyCard from '@/components/tour-mode/LobbyCard';
import { MAP_FOLLOW_LABEL, isOperatorRole } from '@/components/tour-mode/map/RoomMapTab';

describe('P1-1 map action labels are role-keyed', () => {
  it('routes operators to the guest-watching label and guests to the follow-guide label', () => {
    expect(MAP_FOLLOW_LABEL.customer.ko).toBe('가이드 따라가기');
    expect(MAP_FOLLOW_LABEL.customer.zh).toBe('跟随导游');
    // The operator set must never contain the guest wording.
    for (const label of Object.values(MAP_FOLLOW_LABEL.operator)) {
      expect(label).not.toMatch(/따라가기|跟随导游|Follow guide/);
    }
    expect(MAP_FOLLOW_LABEL.operator.ko).toBe('손님 위치 보기');
  });

  it('classifies every operator role, and only those, as operators', () => {
    expect(isOperatorRole('guide')).toBe(true);
    expect(isOperatorRole('driver')).toBe(true);
    expect(isOperatorRole('admin')).toBe(true);
    expect(isOperatorRole('customer')).toBe(false);
    expect(isOperatorRole(undefined)).toBe(false);
  });
});

describe('P1-4 empty states address the viewer, not always the guest', () => {
  it('tells a guest their guide will write, and a guide to write first', () => {
    const { unmount } = render(<ChatFeed messages={[]} viewerLocale="ko" viewerRole="customer" />);
    expect(screen.getByText(/가이드의 안내가 여기에 도착해요/)).toBeInTheDocument();
    unmount();

    render(<ChatFeed messages={[]} viewerLocale="ko" viewerRole="guide" />);
    expect(screen.queryByText(/가이드의 안내가 여기에 도착해요/)).toBeNull();
    expect(screen.getByText(/손님에게 첫 안내를 보내보세요/)).toBeInTheDocument();
  });

  it('hides the guest lobby chat hint from an operator', () => {
    const { unmount } = render(<LobbyCard locale="ko" tourDate="2026-08-01" viewerRole="customer" />);
    expect(screen.getByText(/가이드의 안내 메시지가 여기에 도착해요/)).toBeInTheDocument();
    unmount();

    render(<LobbyCard locale="ko" tourDate="2026-08-01" viewerRole="guide" />);
    expect(screen.queryByText(/가이드의 안내 메시지가 여기에 도착해요/)).toBeNull();
  });
});
