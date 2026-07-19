/**
 * Kakao-grade chat (Phase 2c) — emoji reactions: pure aggregation helpers +
 * ChatFeed chips and the action-sheet emoji row.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import {
  applyReactionFrame,
  aggregateReactions,
  type ReactionEntry,
  type RoomMessage,
} from '@/hooks/useTourRoomChannel';

describe('reaction helpers', () => {
  it('applies add/remove frames idempotently', () => {
    let raw: Record<string, ReactionEntry[]> = {};
    raw = applyReactionFrame(raw, { message_id: 'm1', emoji: '👍', action: 'add', participant_id: 'p1' });
    raw = applyReactionFrame(raw, { message_id: 'm1', emoji: '👍', action: 'add', participant_id: 'p1' }); // dup no-op
    raw = applyReactionFrame(raw, { message_id: 'm1', emoji: '👍', action: 'add', participant_id: 'p2' });
    expect(raw.m1).toHaveLength(2);
    raw = applyReactionFrame(raw, { message_id: 'm1', emoji: '👍', action: 'remove', participant_id: 'p2' });
    expect(raw.m1).toHaveLength(1);
    raw = applyReactionFrame(raw, { message_id: 'm1', emoji: '👍', action: 'remove', participant_id: 'p1' });
    expect(raw.m1).toBeUndefined();
  });

  it('aggregates per-emoji counts and marks the viewer own', () => {
    const entries: ReactionEntry[] = [
      { emoji: '👍', participantId: 'p1' },
      { emoji: '👍', participantId: 'me' },
      { emoji: '❤️', participantId: 'p1' },
    ];
    const agg = aggregateReactions(entries, 'me');
    expect(agg).toEqual(
      expect.arrayContaining([
        { emoji: '👍', count: 2, mine: true },
        { emoji: '❤️', count: 1, mine: false },
      ]),
    );
  });
});

const msg: RoomMessage = {
  id: 'm1',
  sender_role: 'guide',
  input_kind: 'text',
  source_text: 'welcome!',
  translations: {},
  created_at: '2026-07-19T10:00:00.000Z',
};

describe('ChatFeed reactions', () => {
  it('renders reaction chips with counts and toggles on tap', () => {
    const onReact = jest.fn();
    render(
      <ChatFeed
        messages={[msg]}
        viewerLocale="en"
        viewerRole="customer"
        onReact={onReact}
        reactions={{ m1: [{ emoji: '👍', count: 3, mine: true }] }}
      />,
    );
    const row = screen.getByTestId('reaction-row');
    expect(row).toHaveTextContent('👍');
    expect(row).toHaveTextContent('3');
    fireEvent.click(screen.getByText('👍'));
    expect(onReact).toHaveBeenCalledWith('m1', '👍');
  });

  it('adds a reaction from the long-press emoji row', () => {
    const onReact = jest.fn();
    const { container } = render(
      <ChatFeed messages={[msg]} viewerLocale="en" viewerRole="customer" onReact={onReact} />,
    );
    fireEvent.contextMenu(container.querySelector('[data-msg-id="m1"]')!);
    fireEvent.click(screen.getByTestId('react-❤️'));
    expect(onReact).toHaveBeenCalledWith('m1', '❤️');
  });
});
