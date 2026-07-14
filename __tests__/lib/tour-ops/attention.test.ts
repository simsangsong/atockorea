/**
 * W4.2 — attention-queue rules: need_help preset, distress keywords with
 * proper token boundaries, the 5-minute unanswered window, and SOS exclusion.
 */
import {
  computeAttention,
  matchesAttentionKeyword,
  UNANSWERED_AFTER_MS,
  type RoomAttentionInput,
} from '@/lib/tour-ops/attention';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const NOW = Date.parse('2099-07-20T12:00:00Z');
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function msg(id: string, msAgo: number, extra?: Partial<RoomMessage>): RoomMessage {
  return { id, sender_role: 'customer', source_text: id, created_at: at(msAgo), ...extra };
}

function room(overrides: Partial<RoomAttentionInput>): RoomAttentionInput {
  return { roomId: 'room-1', hasSos: false, messages: [], lastMessage: null, ...overrides };
}

describe('matchesAttentionKeyword (W4.2)', () => {
  it('matches Latin distress words only at token boundaries', () => {
    expect(matchesAttentionKeyword('please help me')).toBe(true);
    expect(matchesAttentionKeyword('HELP!')).toBe(true);
    // The chatbot includes() lesson: substrings must NOT fire.
    expect(matchesAttentionKeyword('the guide was very helpful')).toBe(false);
    expect(matchesAttentionKeyword('great hospitality')).toBe(false);
  });

  it('matches CJK keywords as substrings (no \\b in CJK)', () => {
    expect(matchesAttentionKeyword('도와주세요')).toBe(true);
    expect(matchesAttentionKeyword('病院はどこですか')).toBe(true);
    expect(matchesAttentionKeyword('我迷路了')).toBe(true);
    expect(matchesAttentionKeyword('오늘 날씨 좋네요')).toBe(false);
  });
});

describe('computeAttention (W4.2)', () => {
  it('flags the need_help preset above a keyword hit and excerpts the message', () => {
    const items = computeAttention(
      [
        room({
          roomId: 'room-1',
          messages: [
            msg('m1', 10 * 60_000, { source_text: 'where is the hospital' }),
            msg('m2', 3 * 60_000, {
              source_text: 'I need help.',
              metadata: { kind: 'quick_reply', preset_key: 'need_help' },
            }),
          ],
        }),
      ],
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe('need_help');
    expect(items[0].excerpt).toBe('I need help.');
  });

  it('flags unanswered customer messages after 5 minutes, not before', () => {
    const fresh = computeAttention(
      [room({ lastMessage: { sender_role: 'customer', source_text: 'hi', created_at: at(UNANSWERED_AFTER_MS - 60_000) } })],
      NOW,
    );
    expect(fresh).toHaveLength(0);

    const stale = computeAttention(
      [room({ lastMessage: { sender_role: 'customer', source_text: 'hi', created_at: at(UNANSWERED_AFTER_MS + 60_000) } })],
      NOW,
    );
    expect(stale).toHaveLength(1);
    expect(stale[0].reason).toBe('unanswered');
  });

  it('a guide/admin reply clears unanswered — live stream tail beats the stale aggregate', () => {
    const items = computeAttention(
      [
        room({
          messages: [
            msg('m1', 10 * 60_000, { source_text: 'question?' }),
            msg('m2', 2 * 60_000, { sender_role: 'admin', source_text: 'on it' }),
          ],
          lastMessage: { sender_role: 'customer', source_text: 'question?', created_at: at(10 * 60_000) },
        }),
      ],
      NOW,
    );
    expect(items).toHaveLength(0);
  });

  it('excludes SOS rooms and sorts by priority then recency', () => {
    const items = computeAttention(
      [
        room({ roomId: 'sos-room', hasSos: true, messages: [msg('m0', 60_000, { source_text: 'help' })] }),
        room({ roomId: 'kw-room', messages: [msg('m1', 4 * 60_000, { source_text: 'I lost my bag' })] }),
        room({
          roomId: 'nh-room',
          messages: [msg('m2', 8 * 60_000, { source_text: 'Help please', metadata: { kind: 'quick_reply', preset_key: 'need_help' } })],
        }),
      ],
      NOW,
    );
    expect(items.map((item) => item.roomId)).toEqual(['nh-room', 'kw-room']);
  });

  it('ignores optimistic locals and messages outside the 2h window', () => {
    const items = computeAttention(
      [
        room({
          messages: [
            msg('old', 3 * 60 * 60_000, { source_text: 'help' }),
            msg('local-1', 60_000, { source_text: 'help', _local: 'sending' }),
          ],
        }),
      ],
      NOW,
    );
    expect(items).toHaveLength(0);
  });
});
