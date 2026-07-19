/**
 * Kakao-grade chat (Phase 2d) — read receipts + typing indicator in ChatFeed.
 */
import { render, screen } from '@testing-library/react';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const mine: RoomMessage = {
  id: 'me-1',
  sender_role: 'customer',
  input_kind: 'text',
  source_text: 'on my way',
  translations: {},
  created_at: '2026-07-19T10:00:00.000Z',
};

describe('ChatFeed read receipts', () => {
  it('marks my last delivered bubble Read once others have read past it', () => {
    render(
      <ChatFeed
        messages={[mine]}
        viewerLocale="ko"
        viewerRole="customer"
        lastReadByOthersAt="2026-07-19T10:00:05.000Z"
      />,
    );
    expect(screen.getByTestId('read-mark')).toHaveTextContent('읽음');
  });

  it('shows no Read mark when others have not read up to my message', () => {
    render(
      <ChatFeed
        messages={[mine]}
        viewerLocale="ko"
        viewerRole="customer"
        lastReadByOthersAt="2026-07-19T09:59:00.000Z"
      />,
    );
    expect(screen.queryByTestId('read-mark')).not.toBeInTheDocument();
  });

  it('shows no Read mark without any read cursor', () => {
    render(<ChatFeed messages={[mine]} viewerLocale="ko" viewerRole="customer" />);
    expect(screen.queryByTestId('read-mark')).not.toBeInTheDocument();
  });
});

describe('ChatFeed typing indicator', () => {
  it('renders a typing bubble with the localized role label', () => {
    render(
      <ChatFeed
        messages={[mine]}
        viewerLocale="ko"
        viewerRole="customer"
        typingUsers={[{ role: 'guide', displayName: 'Kim' }]}
      />,
    );
    const t = screen.getByTestId('typing-indicator');
    expect(t).toHaveTextContent('가이드');
    expect(t).toHaveTextContent('입력 중…');
  });

  it('renders nothing when nobody is typing', () => {
    render(<ChatFeed messages={[mine]} viewerLocale="ko" viewerRole="customer" typingUsers={[]} />);
    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
  });
});
