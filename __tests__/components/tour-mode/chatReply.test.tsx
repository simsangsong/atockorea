/**
 * Kakao-grade chat (Phase 2b) — reply/quote: ChatFeed snippet + long-press
 * action sheet, and the Composer reply bar.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import Composer from '@/components/tour-mode/Composer';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import type { ReplySnapshot } from '@/lib/tour-room/reply';

const AT = '2026-07-19T10:00:00.000Z';

const origin: RoomMessage = {
  id: 'm1',
  sender_role: 'customer',
  input_kind: 'text',
  source_text: 'Where do we meet?',
  translations: {},
  created_at: AT,
};
const reply: RoomMessage = {
  id: 'm2',
  sender_role: 'guide',
  input_kind: 'text',
  source_text: 'At the east gate.',
  translations: {},
  reply_to_message_id: 'm1',
  metadata: { reply_to: { id: 'm1', sender_role: 'customer', input_kind: 'text', excerpt: 'Where do we meet?' } satisfies ReplySnapshot },
  created_at: '2026-07-19T10:01:00.000Z',
};

describe('ChatFeed reply', () => {
  it('renders the quoted snippet above a reply bubble', () => {
    render(<ChatFeed messages={[origin, reply]} viewerLocale="en" viewerRole="customer" />);
    const snippet = screen.getByTestId('reply-snippet');
    expect(snippet).toHaveTextContent('Guest'); // localized sender label
    expect(snippet).toHaveTextContent('Where do we meet?');
  });

  it('long-press opens the action sheet; Reply fires onReply with the message', () => {
    const onReply = jest.fn();
    const { container } = render(
      <ChatFeed messages={[origin, reply]} viewerLocale="en" viewerRole="customer" onReply={onReply} />,
    );
    const row = container.querySelector('[data-msg-id="m2"]')!;
    fireEvent.contextMenu(row);
    expect(screen.getByTestId('action-reply')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('action-reply'));
    expect(onReply).toHaveBeenCalledWith(expect.objectContaining({ id: 'm2' }));
  });

  it('copies the message text via the action sheet', async () => {
    const writeText = jest.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { container } = render(
      <ChatFeed messages={[origin, reply]} viewerLocale="en" viewerRole="customer" onReply={jest.fn()} />,
    );
    fireEvent.contextMenu(container.querySelector('[data-msg-id="m2"]')!);
    fireEvent.click(screen.getByTestId('action-copy'));
    expect(writeText).toHaveBeenCalledWith('At the east gate.');
  });

  it('does not attach the long-press handler without onReply', () => {
    const { container } = render(<ChatFeed messages={[origin, reply]} viewerLocale="en" viewerRole="customer" />);
    fireEvent.contextMenu(container.querySelector('[data-msg-id="m2"]')!);
    expect(screen.queryByTestId('action-reply')).not.toBeInTheDocument();
  });
});

describe('Composer reply bar', () => {
  const snap: ReplySnapshot = { id: 'm1', sender_role: 'customer', input_kind: 'text', excerpt: 'Where do we meet?' };

  it('shows the reply bar with the quoted excerpt and cancels', () => {
    const onCancelReply = jest.fn();
    render(
      <Composer
        locale="en"
        onSendText={jest.fn()}
        onSendPreset={jest.fn()}
        replyTo={snap}
        onCancelReply={onCancelReply}
      />,
    );
    const bar = screen.getByTestId('reply-bar');
    expect(bar).toHaveTextContent('Guest');
    expect(bar).toHaveTextContent('Where do we meet?');
    fireEvent.click(screen.getByTestId('reply-cancel'));
    expect(onCancelReply).toHaveBeenCalled();
  });

  it('hides the reply bar when no reply is active', () => {
    render(<Composer locale="en" onSendText={jest.fn()} onSendPreset={jest.fn()} />);
    expect(screen.queryByTestId('reply-bar')).not.toBeInTheDocument();
  });
});
