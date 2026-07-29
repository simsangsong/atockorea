/**
 * X20 — the operations corpus.
 *
 * Two things are being held here, and they pull in opposite directions:
 *
 *   1. Collect enough that the corpus is worth having.
 *   2. Collect nothing that can point back at a guest.
 *
 * The second is the one that cannot be fixed later, so it is tested hardest.
 * The privacy property is structural — a candidate has no field that could
 * carry an identifier — and the tests assert the structure, not just the values,
 * because a value test passes for a field that merely happens to be empty in
 * the fixture.
 */
import {
  roomQaCandidates,
  looksLikeQuestion,
  redactForCorpus,
  fingerprint,
  type RoomTurn,
} from '@/lib/rag/roomHarvest';

const ROOM = 'room-1';
let seq = 0;
function turn(partial: Partial<RoomTurn> & { senderRole: string; createdAt: string }): RoomTurn {
  seq += 1;
  return {
    id: `m${seq}`,
    roomId: ROOM,
    text: null,
    senderParticipantId: 'p-secret',
    ...partial,
  } as RoomTurn;
}

const T = (min: number) => new Date(Date.UTC(2026, 7, 4, 2, min, 0)).toISOString();

describe('pairing', () => {
  it('pairs a guest question with the guide reply that followed it', () => {
    const out = roomQaCandidates([
      turn({ senderRole: 'customer', text: 'Where is the toilet?', createdAt: T(0), locale: 'en' }),
      turn({ senderRole: 'guide', text: 'Behind the ticket office, to the left.', createdAt: T(1), locale: 'ko' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].question).toBe('Where is the toilet?');
    expect(out[0].answer).toBe('Behind the ticket office, to the left.');
    expect(out[0].answerLocale).toBe('ko');
  });

  it('accepts a driver as staff', () => {
    const out = roomQaCandidates([
      turn({ senderRole: 'customer', text: 'How long until we arrive?', createdAt: T(0) }),
      turn({ senderRole: 'driver', text: 'About twenty five minutes from here.', createdAt: T(2) }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].tags).toContain('answered_by:driver');
  });

  it('🔴 gives up rather than guessing when another guest speaks first', () => {
    // Two guests, one guide reply. Which question did it answer? Unknowable.
    // A confidently-wrong pair is worse than a smaller corpus, because the
    // reviewer approving drafts trusts the pairing and only reads the text.
    const out = roomQaCandidates([
      turn({ senderRole: 'customer', text: 'Where is the toilet?', createdAt: T(0) }),
      turn({ senderRole: 'customer', text: 'Can we stay longer here?', createdAt: T(1) }),
      turn({ senderRole: 'guide', text: 'Yes, we have about twenty minutes.', createdAt: T(2) }),
    ]);
    expect(out.map((c) => c.question)).toEqual(['Can we stay longer here?']);
  });

  it('does not reach past the answer window', () => {
    const out = roomQaCandidates(
      [
        turn({ senderRole: 'customer', text: 'Where is the toilet?', createdAt: T(0) }),
        turn({ senderRole: 'guide', text: 'Behind the ticket office, to the left.', createdAt: T(40) }),
      ],
      { answerWindowMs: 15 * 60 * 1000 },
    );
    expect(out).toHaveLength(0);
  });

  it('ignores capsules as questions — a quick reply is our sentence, not theirs', () => {
    // Learning from our own canned copy is circular.
    for (const kind of ['lost_me', 'quick_reply', 'onboard_ack']) {
      const out = roomQaCandidates([
        turn({ senderRole: 'customer', text: 'Where is the toilet?', createdAt: T(0), kind }),
        turn({ senderRole: 'guide', text: 'Behind the ticket office, to the left.', createdAt: T(1) }),
      ]);
      expect({ kind, n: out.length }).toEqual({ kind, n: 0 });
    }
  });

  it('🔴 accepts a guide caption as an answer — it is the guide s own voice', () => {
    // Live table check: `caption` (a voice transcription) is the single most
    // common thing a guide produces. A blanket "skip anything with a kind"
    // would have thrown away most of the human half this ticket exists for.
    const out = roomQaCandidates([
      turn({ senderRole: 'customer', text: 'How long do we have here?', createdAt: T(0) }),
      turn({ senderRole: 'guide', text: 'Fifty minutes, back at the bus by ten.', createdAt: T(1), kind: 'caption' }),
    ]);
    expect(out).toHaveLength(1);
  });

  it('still refuses app-generated capsules as answers', () => {
    for (const kind of ['meeting_notice', 'rally_overdue', 'quick_reply', 'driver_vehicle_issue']) {
      const out = roomQaCandidates([
        turn({ senderRole: 'customer', text: 'How long do we have here?', createdAt: T(0) }),
        turn({ senderRole: 'guide', text: 'Fifty minutes, back at the bus by ten.', createdAt: T(1), kind }),
      ]);
      expect({ kind, n: out.length }).toEqual({ kind, n: 0 });
    }
  });

  it('drops answers too short to carry anything', () => {
    const out = roomQaCandidates([
      turn({ senderRole: 'customer', text: 'Is there a toilet here?', createdAt: T(0) }),
      turn({ senderRole: 'guide', text: '네', createdAt: T(1) }),
    ]);
    expect(out).toHaveLength(0);
  });

  it('carries the stop the room had arrived at', () => {
    const out = roomQaCandidates([
      turn({ senderRole: 'system', kind: 'spot_arrival', poiKey: 'seongsan_ilchulbong', createdAt: T(0) }),
      turn({ senderRole: 'customer', text: 'How long do we have here?', createdAt: T(1) }),
      turn({ senderRole: 'guide', text: 'Fifty minutes, back at the bus by ten.', createdAt: T(2) }),
    ]);
    expect(out[0].poiKey).toBe('seongsan_ilchulbong');
    expect(out[0].tags).toContain('poi:seongsan_ilchulbong');
  });
});

describe('🔴 nothing that points at a person', () => {
  const out = roomQaCandidates(
    [
      turn({
        senderRole: 'customer',
        text: 'Can you call me on +82 10-1234-5678 or marta@example.com?',
        createdAt: T(0),
      }),
      turn({
        senderRole: 'guide',
        text: 'Sure — your room link is https://x.test/r?rt=abcdefghijklmnopqrstuvwxyz and booking d8e12b1d-1111-2222-3333-444455556666.',
        createdAt: T(1),
      }),
    ],
    { tourSlug: 'jeju-grand-highlights-loop' },
  );

  it('redacts contact details out of BOTH sides', () => {
    expect(out[0].question).not.toMatch(/1234/);
    expect(out[0].question).not.toMatch(/marta@/);
    expect(out[0].question).toContain('[phone]');
    expect(out[0].question).toContain('[email]');
    expect(out[0].answer).toContain('[id]');
    expect(out[0].answer).toContain('rt=[token]');
  });

  it('has no field that could hold an identifier at all', () => {
    // Structural, not value-based: a value test passes for a field that merely
    // happens to be empty in this fixture. The candidate must not HAVE a room
    // id, a booking id, a participant id or a name to put one in.
    const keys = Object.keys(out[0]).sort();
    expect(keys).toEqual(
      [
        'answer',
        'answerLocale',
        'fingerprint',
        'hourOfDay',
        'poiKey',
        'question',
        'questionLocale',
        'tags',
      ].sort(),
    );
  });

  it('carries the hour and not the date', () => {
    // "Guests ask this at 11am" is operations. "A guest asked this on 4 August"
    // is a pointer — one date plus one tour is often one small roster, and a
    // roster is a name.
    expect(out[0].hourOfDay).toBe(2);
    const serialised = JSON.stringify(out[0]);
    expect(serialised).not.toContain('2026-08-04');
    expect(serialised).not.toContain('2026');
  });

  it('never copies the participant id, which the source rows do carry', () => {
    expect(JSON.stringify(out)).not.toContain('p-secret');
    expect(JSON.stringify(out)).not.toContain(ROOM);
  });

  it('fingerprints are one-way and stable', () => {
    expect(fingerprint('m1|m2')).toBe(fingerprint('m1|m2'));
    expect(fingerprint('m1|m2')).not.toBe(fingerprint('m1|m3'));
    expect(fingerprint('m1|m2')).not.toContain('m1');
  });
});

describe('question detection', () => {
  it('catches a question mark in any script', () => {
    for (const q of ['Where is it?', '화장실 어디예요?', 'トイレはどこですか？', '¿Dónde está?']) {
      expect({ q, ok: looksLikeQuestion(q) }).toEqual({ q, ok: true });
    }
  });

  it('catches questions with no question mark', () => {
    // A Japanese guest may end with か and no mark; a Korean guest with 나요.
    for (const q of ['トイレはどこですか', '화장실이 있나요', 'Wo ist die Toilette', 'Где туалет']) {
      expect({ q, ok: looksLikeQuestion(q) }).toEqual({ q, ok: true });
    }
  });

  it('does not treat a statement as a question', () => {
    for (const q of ['Thank you so much', '고맙습니다', 'We are on board', 'ok']) {
      expect({ q, ok: looksLikeQuestion(q) }).toEqual({ q, ok: false });
    }
  });
});

describe('redaction', () => {
  it('leaves ordinary text alone', () => {
    expect(redactForCorpus('Back at the bus by 10:20 please')).toBe('Back at the bus by 10:20 please');
  });

  it('does not eat a price or a time as if it were a phone number', () => {
    // 8 digits is a phone; "50 minutes" and "10,000 won" are not.
    expect(redactForCorpus('It costs 10,000 won')).toContain('10,000');
    expect(redactForCorpus('We have 50 minutes')).toContain('50');
  });

  it('collapses whitespace so the same question written twice dedupes', () => {
    expect(redactForCorpus('Where   is\n the toilet?')).toBe('Where is the toilet?');
  });
});
