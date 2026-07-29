/**
 * X20 — the DB half.
 *
 * The pure logic is covered in `roomHarvest.test.ts`. What this adds is the one
 * thing that can only go wrong here: the query returns every room interleaved
 * in one chronological list, and the pairing rule is per-room. Group them wrong
 * and a guide's reply in room A becomes the answer to a question in room B —
 * which produces a plausible-looking pair that is simply false, and a reviewer
 * approving drafts would never catch it because both halves read fine.
 */
import { harvestRoomQaCandidates } from '@/lib/rag/roomHarvest.server';

type Row = Record<string, unknown>;

/** Minimal Supabase stand-in: enough surface for the two tables this touches. */
function fakeClient(messages: Row[], existingQuestions: string[] = []) {
  const inserted: Row[] = [];
  const client = {
    from(table: string) {
      if (table === 'tour_room_messages') {
        const chain = {
          select: () => chain,
          gte: () => chain,
          order: () => chain,
          limit: () => Promise.resolve({ data: messages, error: null }),
        };
        return chain;
      }
      if (table === 'qa_pairs') {
        let wanted = '';
        const chain = {
          select: () => chain,
          eq: (_col: string, val: string) => {
            wanted = val;
            return chain;
          },
          maybeSingle: () =>
            Promise.resolve({ data: existingQuestions.includes(wanted) ? { id: 1 } : null, error: null }),
          insert: (row: Row) => {
            inserted.push(row);
            return Promise.resolve({ error: null });
          },
        };
        return chain;
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client, inserted };
}

const at = (min: number) => new Date(Date.UTC(2026, 7, 4, 2, min, 0)).toISOString();
const msg = (over: Row): Row => ({
  id: `m-${Math.random().toString(36).slice(2)}`,
  room_id: 'A',
  sender_role: 'customer',
  source_text: null,
  source_locale: 'en',
  metadata: null,
  ...over,
});

describe('room harvest against the database', () => {
  it('🔴 does not pair across rooms', () => {
    // Chronologically interleaved: A asks, B's guide answers, A's guide answers.
    // Only A's pair is real.
    const { client, inserted } = fakeClient([
      msg({ room_id: 'A', sender_role: 'customer', source_text: 'Where is the toilet?', created_at: at(0) }),
      msg({ room_id: 'B', sender_role: 'guide', source_text: 'We leave at nine tomorrow morning.', created_at: at(1) }),
      msg({ room_id: 'A', sender_role: 'guide', source_text: 'Behind the ticket office, on the left.', created_at: at(2) }),
    ]);
    return harvestRoomQaCandidates(client as never, {}).then((report) => {
      expect(report.roomsScanned).toBe(2);
      expect(inserted).toHaveLength(1);
      expect(inserted[0].answer).toBe('Behind the ticket office, on the left.');
    });
  });

  it('reads the capsule kind out of metadata, where it actually lives', () => {
    // Live check: the kind is `metadata->>'kind'`, not a column. Reading the
    // wrong place would silently harvest every quick reply as a question.
    const { client, inserted } = fakeClient([
      msg({
        sender_role: 'customer',
        source_text: 'Where is the toilet?',
        created_at: at(0),
        metadata: { kind: 'quick_reply' },
      }),
      msg({ sender_role: 'guide', source_text: 'Behind the ticket office, on the left.', created_at: at(1) }),
    ]);
    return harvestRoomQaCandidates(client as never, {}).then(() => {
      expect(inserted).toHaveLength(0);
    });
  });

  it('writes a draft, never something live', () => {
    const { client, inserted } = fakeClient([
      msg({ sender_role: 'customer', source_text: 'How long do we have here?', created_at: at(0) }),
      msg({ sender_role: 'guide', source_text: 'Fifty minutes, back at the bus by ten.', created_at: at(1) }),
    ]);
    return harvestRoomQaCandidates(client as never, {}).then(() => {
      expect(inserted[0].review_status).toBe('draft');
      expect(inserted[0].is_active).toBe(false);
      expect(inserted[0].source).toBe('room_message');
      // bigint column, uuid ids — it has to stay null or the insert throws at
      // runtime and gets swallowed by the catch.
      expect(inserted[0].source_message_id).toBeNull();
    });
  });

  it('carries no booking, room or participant reference into the row', () => {
    const { client, inserted } = fakeClient([
      msg({ room_id: 'room-uuid-here', sender_role: 'customer', source_text: 'How long do we have here?', created_at: at(0) }),
      msg({ room_id: 'room-uuid-here', sender_role: 'guide', source_text: 'Fifty minutes, back at the bus by ten.', created_at: at(1) }),
    ]);
    return harvestRoomQaCandidates(client as never, {}).then(() => {
      expect(JSON.stringify(inserted)).not.toContain('room-uuid-here');
    });
  });

  it('skips a question already in the corpus', () => {
    const { client, inserted } = fakeClient(
      [
        msg({ sender_role: 'customer', source_text: 'How long do we have here?', created_at: at(0) }),
        msg({ sender_role: 'guide', source_text: 'Fifty minutes, back at the bus by ten.', created_at: at(1) }),
      ],
      ['How long do we have here?'],
    );
    return harvestRoomQaCandidates(client as never, {}).then((report) => {
      expect(report.dupes).toBe(1);
      expect(inserted).toHaveLength(0);
    });
  });

  it('a dry run proposes without writing', () => {
    const lines: string[] = [];
    const { client, inserted } = fakeClient([
      msg({ sender_role: 'customer', source_text: 'How long do we have here?', created_at: at(0) }),
      msg({ sender_role: 'guide', source_text: 'Fifty minutes, back at the bus by ten.', created_at: at(1) }),
    ]);
    return harvestRoomQaCandidates(client as never, { dryRun: true, log: (l) => lines.push(l) }).then(
      (report) => {
        expect(report.created).toBe(1);
        expect(inserted).toHaveLength(0);
        expect(lines.join('\n')).toContain('[draft]');
      },
    );
  });

  it('returns a report instead of throwing when the read fails', () => {
    const client = {
      from: () => {
        const chain = {
          select: () => chain,
          gte: () => chain,
          order: () => chain,
          limit: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
        };
        return chain;
      },
    };
    return harvestRoomQaCandidates(client as never, {}).then((report) => {
      expect(report).toEqual({ roomsScanned: 0, pairsFound: 0, created: 0, dupes: 0, tooThin: 0 });
    });
  });
});
