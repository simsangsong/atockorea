/**
 * @jest-environment node
 *
 * C-16 — the start-gate fan-out over the declarative card stack.
 *
 * What is locked down here:
 *   ① one capsule per card, each gated on its OWN subject key → a retried
 *      start gate posts nothing twice, not even partially;
 *   ② the re-boarding skip: an earlier day's safety event in the same room
 *      collapses the card instead of repeating it;
 *   ③ card ③'s "no schedule → no card" rule survives the fan-out;
 *   ④ only the welcome card pushes;
 *   ⑤ one card failing does not stop the rest.
 */
import { fireTourStartBriefing, hasSeenSafetyCard } from '@/lib/ops/seating/startBriefing';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { sendGuestRoomPush } from '@/lib/tour-room/guestPush';
import { makeFakeDb, queriesFor, type FakeQuery } from '@/test-utils/opsSeatingFakes';
import type { RoomDbClient } from '@/lib/tour-room/access';

jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/tour-room/guestPush', () => ({ sendGuestRoomPush: jest.fn(async () => ({ sent: 1, pruned: 0 })) }));

const broadcastMock = broadcastToRoom as jest.Mock;
const pushMock = sendGuestRoomPush as jest.Mock;

const TOUR_DATE = '2099-07-24';

interface DbOptions {
  /** Subject keys the events table should reject as duplicates (23505). */
  alreadySent?: string[];
  /** Existing tour_room_events rows (the seen-before ledger). */
  events?: Array<{ subject_key: string | null; type: string }>;
  /** tour_day_plans row for the schedule + dietary reads. */
  dayPlan?: Record<string, unknown> | null;
  tourSchedule?: unknown;
  lunchIncluded?: boolean;
  /** Make this metadata.kind's message insert fail. */
  failMessageKind?: string;
  bookings?: Array<{ id: string }>;
}

function db(options: DbOptions = {}) {
  const log: FakeQuery[] = [];
  const inserted: Array<Record<string, unknown>> = [];
  const client = makeFakeDb((q) => {
    if (q.table === 'tours') {
      return {
        data: { city: 'Jeju', lunch_included: options.lunchIncluded === true, schedule: options.tourSchedule ?? null },
      };
    }
    if (q.table === 'bookings') {
      // resolveDaySchedule stage ② re-reads the single booking's itinerary.
      if (q.terminal === 'maybeSingle') return { data: { itinerary: null } };
      return { data: options.bookings ?? [{ id: 'b1', tour_id: 'tour-1', tour_date: TOUR_DATE, preferred_language: 'en' }] };
    }
    if (q.table === 'tour_rooms') return { data: { id: 'room-1', booking_id: 'b1', status: 'active' } };
    if (q.table === 'tour_day_plans') {
      if (q.terminal === 'maybeSingle') return { data: options.dayPlan ?? null };
      return { data: options.dayPlan ? [options.dayPlan] : [] };
    }
    if (q.table === 'match_pois') return { data: [] };
    if (q.table === 'tour_room_events' && q.op === 'insert') {
      const payload = q.payload as { subject_key?: string };
      if ((options.alreadySent ?? []).includes(payload.subject_key ?? '')) {
        return { error: { code: '23505', message: 'duplicate key' } };
      }
      return { data: { id: `ev-${payload.subject_key}`, subject_key: payload.subject_key, created_at: 'T' } };
    }
    if (q.table === 'tour_room_events') return { data: options.events ?? [] };
    if (q.table === 'tour_room_messages' && q.op === 'insert') {
      const payload = q.payload as { metadata?: { kind?: string } };
      if (options.failMessageKind && payload.metadata?.kind === options.failMessageKind) {
        return { error: { message: 'insert blew up' } };
      }
      inserted.push(payload as Record<string, unknown>);
      return { data: { id: `msg-${inserted.length}`, ...payload } };
    }
    return { data: null };
  }, log);
  return { client: client as unknown as RoomDbClient, log, inserted };
}

const kinds = (inserted: Array<Record<string, unknown>>): string[] =>
  inserted.map((row) => (row.metadata as { kind?: string }).kind ?? '');

beforeEach(() => jest.clearAllMocks());

describe('fireTourStartBriefing — the stack', () => {
  it('fans out all five cards when everything resolves', async () => {
    const { client, inserted } = db({ tourSchedule: [{ time: '09:30', title: 'Seongsan' }] });
    const result = await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });

    expect(kinds(inserted)).toEqual([
      'tour_start_briefing',
      'briefing_safety',
      'briefing_schedule',
      'briefing_lunch',
      'briefing_etiquette',
    ]);
    expect(result).toEqual({ delivered: 1, skipped: 0, cards: 5 });
    expect(broadcastMock).toHaveBeenCalledTimes(5);
  });

  it('pushes once — the welcome card only', async () => {
    const { client } = db({ tourSchedule: [{ time: '09:30', title: 'Seongsan' }] });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock.mock.calls[0][2].translations.en).toMatch(/welcome aboard/i);
  });

  it('gates every card on its own subject key', async () => {
    const { client, log } = db({ tourSchedule: [{ title: 'Seongsan' }] });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    const keys = queriesFor(log, 'tour_room_events', 'insert').map(
      (q) => (q.payload as { subject_key?: string }).subject_key,
    );
    expect(keys).toEqual([
      'tour_start_briefing',
      `tour_start_briefing:safety:${TOUR_DATE}`,
      `tour_start_briefing:schedule:${TOUR_DATE}`,
      `tour_start_briefing:lunch:${TOUR_DATE}`,
      `tour_start_briefing:etiquette:${TOUR_DATE}`,
    ]);
  });

  it('a retried gate posts nothing twice', async () => {
    const all = [
      'tour_start_briefing',
      `tour_start_briefing:safety:${TOUR_DATE}`,
      `tour_start_briefing:schedule:${TOUR_DATE}`,
      `tour_start_briefing:lunch:${TOUR_DATE}`,
      `tour_start_briefing:etiquette:${TOUR_DATE}`,
    ];
    const { client, inserted } = db({ alreadySent: all, tourSchedule: [{ title: 'A' }] });
    const result = await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect(inserted).toHaveLength(0);
    expect(result).toEqual({ delivered: 0, skipped: 1, cards: 0 });
  });

  it('a PARTIAL retry re-sends only the cards that never landed', async () => {
    const { client, inserted } = db({
      alreadySent: ['tour_start_briefing', `tour_start_briefing:safety:${TOUR_DATE}`],
      tourSchedule: [{ title: 'A' }],
    });
    const result = await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect(kinds(inserted)).toEqual(['briefing_schedule', 'briefing_lunch', 'briefing_etiquette']);
    expect(result.cards).toBe(3);
  });

  it('card ③: no resolvable schedule → the card is simply not sent', async () => {
    const { client, inserted, log } = db({ tourSchedule: null });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect(kinds(inserted)).not.toContain('briefing_schedule');
    expect(kinds(inserted)).toHaveLength(4);
    // and it never even burned an idempotency key for a card it didn't send
    const keys = queriesFor(log, 'tour_room_events', 'insert').map(
      (q) => (q.payload as { subject_key?: string }).subject_key,
    );
    expect(keys).not.toContain(`tour_start_briefing:schedule:${TOUR_DATE}`);
  });

  it('card ③ prefers the day plan over the legacy tour schedule', async () => {
    const { client, inserted } = db({
      tourSchedule: [{ time: '08:00', title: 'Legacy stop' }],
      dayPlan: {
        id: 'p1',
        booking_id: 'b1',
        tour_date: TOUR_DATE,
        status: 'guide_confirmed',
        stops: [{ seq: 1, arrival_planned: '10:00', name_i18n: { en: 'Planned stop' } }],
        needs: null,
      },
    });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    const card = inserted.find((row) => (row.metadata as { kind?: string }).kind === 'briefing_schedule')!;
    expect((card.metadata as { source?: string }).source).toBe('day_plan');
    expect(card.source_text).toContain('10:00 · Planned stop');
    expect(card.source_text).not.toContain('Legacy stop');
  });

  it('card ④ pre-selects the dietary tags already on file', async () => {
    const { client, inserted } = db({
      dayPlan: {
        id: 'p1',
        booking_id: 'b1',
        tour_date: TOUR_DATE,
        status: 'guide_confirmed',
        stops: [],
        needs: { dietary: ['halal', 'no_nuts'], children: 2 },
      },
    });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    const card = inserted.find((row) => (row.metadata as { kind?: string }).kind === 'briefing_lunch')!;
    // `kids` is derived from needs.children and must never reach the chips.
    expect((card.metadata as { dietary?: string[] }).dietary).toEqual(['halal', 'no_nuts']);
  });

  it('card ④ reads lunch inclusion from the tour', async () => {
    const included = db({ lunchIncluded: true });
    await fireTourStartBriefing(included.client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    const card = included.inserted.find((r) => (r.metadata as { kind?: string }).kind === 'briefing_lunch')!;
    expect((card.metadata as { lunch_included?: boolean }).lunch_included).toBe(true);
  });

  it('one card failing does not stop the rest', async () => {
    const { client, inserted } = db({ failMessageKind: 'briefing_lunch', tourSchedule: [{ title: 'A' }] });
    const result = await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect(kinds(inserted)).toEqual([
      'tour_start_briefing',
      'briefing_safety',
      'briefing_schedule',
      'briefing_etiquette',
    ]);
    expect(result.cards).toBe(4);
    expect(result.delivered).toBe(1);
  });

  it('C-17 seam: cardIds selects and orders what goes out', async () => {
    const { client, inserted } = db({});
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE, cardIds: ['etiquette', 'safety'] });
    expect(kinds(inserted)).toEqual(['briefing_etiquette', 'briefing_safety']);
  });
});

describe('re-boarding skip (card ②)', () => {
  const seenEvents = [
    { subject_key: 'tour_start_briefing:safety:2099-07-20', type: 'briefing_card' },
    { subject_key: 'tour_start_briefing:lunch:2099-07-20', type: 'briefing_card' },
  ];

  it('hasSeenSafetyCard is true only for a DIFFERENT day', async () => {
    const seen = db({ events: seenEvents });
    await expect(hasSeenSafetyCard(seen.client, 'room-1', TOUR_DATE)).resolves.toBe(true);

    const sameDayOnly = db({
      events: [{ subject_key: `tour_start_briefing:safety:${TOUR_DATE}`, type: 'briefing_card' }],
    });
    await expect(hasSeenSafetyCard(sameDayOnly.client, 'room-1', TOUR_DATE)).resolves.toBe(false);

    const none = db({ events: [] });
    await expect(hasSeenSafetyCard(none.client, 'room-1', TOUR_DATE)).resolves.toBe(false);

    // Another card's key must not be mistaken for the safety one.
    const otherCard = db({ events: [{ subject_key: 'tour_start_briefing:lunch:2099-07-20', type: 'briefing_card' }] });
    await expect(hasSeenSafetyCard(otherCard.client, 'room-1', TOUR_DATE)).resolves.toBe(false);
  });

  it('a returning guest gets the collapsed safety card, a first-timer the full one', async () => {
    const returning = db({ events: seenEvents });
    await fireTourStartBriefing(returning.client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    const collapsed = returning.inserted.find((r) => (r.metadata as { kind?: string }).kind === 'briefing_safety')!;
    expect((collapsed.metadata as { collapsed?: boolean }).collapsed).toBe(true);
    expect(String(collapsed.source_text).split('\n')).toHaveLength(1);

    const first = db({ events: [] });
    await fireTourStartBriefing(first.client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    const full = first.inserted.find((r) => (r.metadata as { kind?: string }).kind === 'briefing_safety')!;
    expect((full.metadata as { collapsed?: boolean }).collapsed).toBe(false);
    expect(String(full.source_text).split('\n').length).toBeGreaterThan(1);
  });
});
