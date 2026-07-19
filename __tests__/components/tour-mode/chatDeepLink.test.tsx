/**
 * Kakao-grade chat (Phase 3) — deep link: ChatFeed focusMessageId scroll/flash
 * and RoomShell initialTab.
 */
import { render, screen, waitFor } from '@testing-library/react';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import RoomShell from '@/components/tour-mode/RoomShell';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const m1: RoomMessage = { id: 'm1', sender_role: 'guide', input_kind: 'text', source_text: 'first', translations: {}, created_at: '2026-07-19T10:00:00.000Z' };
const m2: RoomMessage = { id: 'm2', sender_role: 'guide', input_kind: 'text', source_text: 'second', translations: {}, created_at: '2026-07-19T10:01:00.000Z' };

describe('ChatFeed focusMessageId (deep link)', () => {
  beforeEach(() => {
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = jest.fn();
  });

  it('scrolls to and flashes the focused message once it is in the feed', async () => {
    const { container } = render(
      <ChatFeed messages={[m1, m2]} viewerLocale="en" viewerRole="customer" focusMessageId="m1" />,
    );
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(container.querySelector('[data-msg-id="m1"]')?.classList.contains('tr-msg-flash')).toBe(true);
  });

  it('does nothing without a focus id', async () => {
    render(<ChatFeed messages={[m1, m2]} viewerLocale="en" viewerRole="customer" />);
    // give any rAF a chance
    await new Promise((r) => setTimeout(r, 0));
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});

describe('RoomShell initialTab (deep link)', () => {
  const base = {
    title: 'Tour',
    lifecycle: 'live' as const,
    connection: 'realtime' as const,
    locale: 'en' as const,
    schedule: [],
    settings: <div>settings</div>,
    home: () => <div>home dashboard</div>,
  };

  it('lands on the chat tab when initialTab="chat" despite a home dashboard', () => {
    render(<RoomShell {...base} chat={<div data-testid="chat-marker">chat here</div>} initialTab="chat" />);
    expect(screen.getByTestId('chat-marker')).toBeInTheDocument();
    expect(screen.queryByTestId('home-panel')).not.toBeInTheDocument();
  });

  it('defaults to the home tab without initialTab', () => {
    render(<RoomShell {...base} chat={<div data-testid="chat-marker">chat here</div>} />);
    expect(screen.getByTestId('home-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-marker')).not.toBeInTheDocument();
  });
});
