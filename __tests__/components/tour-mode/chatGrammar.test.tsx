/**
 * §5 결정 구현 (2026-08-04) — the action sheet's new verbs, in one place: share
 * is text-only and always offered on text, promote appears only when a handler
 * is wired (guide surfaces).
 *
 * 사장님 2026-08-07 amended the reaction row: the sheet shows only the five
 * most-used, small; the other 25 moved to the composer's emoji picker. Both
 * halves are asserted here so the split cannot silently become a deletion.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import { COMPOSER_EMOJI, QUICK_REACTIONS } from '@/lib/tour-room/emoji';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const MSG: RoomMessage = {
  id: 'm-1',
  sender_role: 'guide',
  source_text: '점심은 12시에 성산에서 먹어요',
  created_at: new Date().toISOString(),
} as RoomMessage;

function mount(over: Partial<React.ComponentProps<typeof ChatFeed>> = {}) {
  return render(
    <ChatFeed
      messages={[MSG]}
      viewerLocale="ko"
      viewerRole="guide"
      tts={{ bookingId: 'b1', roomSession: 'sess' }}
      onReply={jest.fn()}
      onReact={jest.fn()}
      {...over}
    />,
  );
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
});

describe('chat grammar — §5 decisions', () => {
  it('offers only the five most-used reactions in the sheet (사장님 2026-08-07)', () => {
    mount();
    fireEvent.click(screen.getByTestId('msg-actions'));
    const reactions = screen.getAllByTestId(/^react-/);
    expect(reactions).toHaveLength(5);
    expect(reactions.map((el) => el.textContent)).toEqual(['👍', '❤️', '😂', '😮', '🙏']);
  });

  /**
   * 🔴 The five are a DB key, not a style choice: `tour_room_reactions` stores
   * the emoji character, so reordering or swapping one orphans every reaction
   * already aggregated. Pinned as a literal — reading them back off the
   * constant would assert nothing.
   */
  it('keeps the original five, in order, for aggregation continuity', () => {
    expect([...QUICK_REACTIONS]).toEqual(['👍', '❤️', '😂', '😮', '🙏']);
    expect(COMPOSER_EMOJI.slice(0, 5)).toEqual([...QUICK_REACTIONS]);
    expect(COMPOSER_EMOJI).toHaveLength(30);
    expect(new Set(COMPOSER_EMOJI).size).toBe(30);
  });

  it('share is present on a text message; promote only when wired', () => {
    mount();
    fireEvent.click(screen.getByTestId('msg-actions'));
    expect(screen.getByTestId('action-share')).toBeInTheDocument();
    expect(screen.queryByTestId('action-promote')).not.toBeInTheDocument();
  });

  it('promote hands the VIEWED text to the wired announce path', () => {
    const onPromote = jest.fn();
    mount({ onPromoteToNotice: onPromote });
    fireEvent.click(screen.getByTestId('msg-actions'));
    fireEvent.click(screen.getByTestId('action-promote'));
    expect(onPromote).toHaveBeenCalledWith('점심은 12시에 성산에서 먹어요');
  });

  it('a URL-bearing bubble grows a text-only preview card (no image, ever)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://visitjeju.net/x', host: 'visitjeju.net', title: '성산일출봉', description: '일출 명소' }),
    });
    mount({
      messages: [{ ...MSG, id: 'm-2', source_text: '여기 https://visitjeju.net/x 어때요' } as RoomMessage],
    });
    const card = await screen.findByTestId('link-preview-card');
    expect(card).toHaveTextContent('성산일출봉');
    expect(card).toHaveTextContent('visitjeju.net');
    expect(card.querySelector('img')).toBeNull();
  });
});
