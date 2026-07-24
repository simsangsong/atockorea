/**
 * @jest-environment node
 *
 * §5.4 C-17 — the start gate driven by the stored card set, and §11.D D3 — the
 * welcome/safety/lunch wording following the tour kind.
 *
 * What is locked down here:
 *   ① a room override actually changes what goes out (order AND inclusion);
 *   ② with no room override the product default drives it;
 *   ③ with neither, the code default stack still fans out in full — a missing
 *      config row can never produce a silent no-briefing tour;
 *   ④ the two per-card options do what the editor says they do;
 *   ⑤ the preview is byte-identical to what the gate then sends;
 *   ⑥ a private (vehicle-charter) tour gets the private wording everywhere it
 *      differs, and a join tour is unchanged from the shipped behaviour.
 */
import { fireTourStartBriefing, previewTourStartBriefing } from '@/lib/ops/seating/startBriefing';
import { makeFakeDb, filterArgs, type FakeQuery } from '@/test-utils/opsSeatingFakes';
import type { RoomDbClient } from '@/lib/tour-room/access';

jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));
jest.mock('@/lib/tour-room/guestPush', () => ({ sendGuestRoomPush: jest.fn(async () => ({ sent: 1, pruned: 0 })) }));

const TOUR_DATE = '2099-07-24';

interface CardSetRow {
  scope: 'tour' | 'room';
  scope_id: string;
  card_ids?: string[] | null;
  options?: Record<string, unknown>;
}

interface DbOptions {
  cardSets?: CardSetRow[];
  /** Make every ops_briefing_card_sets read fail (migration not applied). */
  cardSetTableMissing?: boolean;
  priceType?: string | null;
  lunchIncluded?: boolean;
  tourSchedule?: unknown;
  /** Existing tour_room_events rows (the re-boarding / already-sent ledger). */
  events?: Array<{ subject_key: string | null; type: string }>;
}

function db(options: DbOptions = {}) {
  const log: FakeQuery[] = [];
  const inserted: Array<Record<string, unknown>> = [];
  const client = makeFakeDb((q) => {
    if (q.table === 'ops_briefing_card_sets') {
      if (options.cardSetTableMissing) return { error: { code: '42P01', message: 'relation does not exist' } };
      const scope = filterArgs(q, 'eq', 0)?.[1];
      const scopeId = filterArgs(q, 'eq', 1)?.[1];
      const row = (options.cardSets ?? []).find((set) => set.scope === scope && set.scope_id === scopeId);
      return { data: row ? { options: {}, card_ids: null, ...row, updated_at: 'T' } : null };
    }
    if (q.table === 'tours') {
      return {
        data: {
          city: 'Jeju',
          lunch_included: options.lunchIncluded === true,
          schedule: options.tourSchedule ?? null,
          price_type: options.priceType ?? 'person',
        },
      };
    }
    if (q.table === 'bookings') {
      if (q.terminal === 'maybeSingle') return { data: { itinerary: null } };
      return { data: [{ id: 'b1', tour_id: 'tour-1', tour_date: TOUR_DATE, preferred_language: 'en' }] };
    }
    if (q.table === 'tour_rooms') {
      return {
        data: { id: 'room-1', booking_id: 'b1', tour_id: 'tour-1', tour_date: TOUR_DATE, status: 'active' },
      };
    }
    if (q.table === 'tour_day_plans') return { data: q.terminal === 'maybeSingle' ? null : [] };
    if (q.table === 'match_pois') return { data: [] };
    if (q.table === 'tour_room_events' && q.op === 'insert') {
      const payload = q.payload as { subject_key?: string };
      return { data: { id: `ev-${payload.subject_key}`, subject_key: payload.subject_key, created_at: 'T' } };
    }
    if (q.table === 'tour_room_events') return { data: options.events ?? [] };
    if (q.table === 'tour_room_messages' && q.op === 'insert') {
      inserted.push(q.payload as Record<string, unknown>);
      return { data: { id: `msg-${inserted.length}`, ...(q.payload as object) } };
    }
    return { data: null };
  }, log);
  return { client: client as unknown as RoomDbClient, log, inserted };
}

const kinds = (rows: Array<Record<string, unknown>>): string[] =>
  rows.map((row) => (row.metadata as { kind?: string }).kind ?? '');

const cardOf = (rows: Array<Record<string, unknown>>, kind: string) =>
  rows.find((row) => (row.metadata as { kind?: string }).kind === kind);

beforeEach(() => jest.clearAllMocks());

describe('C-17 — the resolved card set drives the fan-out', () => {
  it('no config anywhere → the full code-default stack still goes out', async () => {
    const { client, inserted } = db({ tourSchedule: [{ title: 'A' }] });
    const result = await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect(kinds(inserted)).toEqual([
      'tour_start_briefing',
      'briefing_safety',
      'briefing_schedule',
      'briefing_lunch',
      'briefing_etiquette',
    ]);
    expect(result.cards).toBe(5);
  });

  it('the config table not existing yet degrades to the default stack, not to silence', async () => {
    const { client, inserted } = db({ cardSetTableMissing: true, tourSchedule: [{ title: 'A' }] });
    const result = await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect(kinds(inserted)).toHaveLength(5);
    expect(result.cards).toBe(5);
  });

  it('a stored EMPTY selection is inherited-through, never "send nothing"', async () => {
    const { client, inserted } = db({
      cardSets: [{ scope: 'tour', scope_id: 'tour-1', card_ids: [] }],
      tourSchedule: [{ title: 'A' }],
    });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect(kinds(inserted)).toHaveLength(5);
  });

  it('the product default selects and orders the cards', async () => {
    const { client, inserted } = db({
      cardSets: [{ scope: 'tour', scope_id: 'tour-1', card_ids: ['etiquette', 'start'] }],
    });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect(kinds(inserted)).toEqual(['briefing_etiquette', 'tour_start_briefing']);
  });

  it('the ROOM override wins over the product default', async () => {
    const { client, inserted } = db({
      cardSets: [
        { scope: 'tour', scope_id: 'tour-1', card_ids: ['etiquette', 'start'] },
        { scope: 'room', scope_id: 'room-1', card_ids: ['lunch'] },
      ],
    });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect(kinds(inserted)).toEqual(['briefing_lunch']);
  });

  it('an excluded card burns no idempotency key — it can be re-enabled later', async () => {
    const { client, log } = db({ cardSets: [{ scope: 'room', scope_id: 'room-1', card_ids: ['start'] }] });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    const keys = log
      .filter((q) => q.table === 'tour_room_events' && q.op === 'insert')
      .map((q) => (q.payload as { subject_key?: string }).subject_key);
    expect(keys).toEqual(['tour_start_briefing']);
  });
});

describe('C-17 — per-card options', () => {
  const seenBefore = [{ subject_key: 'tour_start_briefing:safety:2099-07-20', type: 'briefing_card' }];

  it('safety.skip_repeat_boarding=false sends the full drill to a returning guest', async () => {
    const off = db({
      events: seenBefore,
      cardSets: [{ scope: 'room', scope_id: 'room-1', options: { safety: { skip_repeat_boarding: false } } }],
    });
    await fireTourStartBriefing(off.client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    const card = cardOf(off.inserted, 'briefing_safety')!;
    expect((card.metadata as { collapsed?: boolean }).collapsed).toBe(false);

    // …and the shipped default (true) still collapses it.
    const on = db({ events: seenBefore });
    await fireTourStartBriefing(on.client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect((cardOf(on.inserted, 'briefing_safety')!.metadata as { collapsed?: boolean }).collapsed).toBe(true);
  });

  it('lunch.lunch_included overrides tours.lunch_included for this level only', async () => {
    const forced = db({
      lunchIncluded: false,
      cardSets: [{ scope: 'tour', scope_id: 'tour-1', options: { lunch: { lunch_included: true } } }],
    });
    await fireTourStartBriefing(forced.client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    const card = cardOf(forced.inserted, 'briefing_lunch')!;
    expect((card.metadata as { lunch_included?: boolean }).lunch_included).toBe(true);
    expect(String(card.source_text)).toMatch(/Lunch is included today/);
  });

  it('a null lunch option means "follow the product", not "not included"', async () => {
    const { client, inserted } = db({
      lunchIncluded: true,
      cardSets: [{ scope: 'room', scope_id: 'room-1', options: { lunch: { lunch_included: null } } }],
    });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect((cardOf(inserted, 'briefing_lunch')!.metadata as { lunch_included?: boolean }).lunch_included).toBe(true);
  });
});

describe('C-17 — the preview is what the gate would send', () => {
  it('same cards, same order, same 5-locale bodies — and it writes nothing', async () => {
    const config: DbOptions = {
      tourSchedule: [{ time: '09:30', title: 'Seongsan' }],
      cardSets: [{ scope: 'room', scope_id: 'room-1', card_ids: ['start', 'lunch', 'etiquette'] }],
    };

    const previewDb = db(config);
    const preview = (await previewTourStartBriefing(previewDb.client, { roomId: 'room-1' }))!;
    expect(preview.resolved.card_ids).toEqual(['start', 'lunch', 'etiquette']);
    expect(preview.resolved.card_ids_source).toBe('room');
    expect(preview.cards.every((card) => card.will_send)).toBe(true);
    // read-only: no event key burned, no message row written
    expect(previewDb.inserted).toHaveLength(0);
    expect(previewDb.log.some((q) => q.op === 'insert')).toBe(false);

    const gateDb = db(config);
    await fireTourStartBriefing(gateDb.client, { tourId: 'tour-1', tourDate: TOUR_DATE });

    expect(preview.cards.map((card) => card.kind)).toEqual(kinds(gateDb.inserted));
    preview.cards.forEach((card, index) => {
      expect(card.translations).toEqual(gateDb.inserted[index].translations);
      expect(card.subject_key).toBeTruthy();
    });
  });

  it('shows a conditional card as skipped instead of pretending it will go', async () => {
    const { client } = db({ tourSchedule: null });
    const preview = (await previewTourStartBriefing(client, { roomId: 'room-1' }))!;
    const schedule = preview.cards.find((card) => card.id === 'schedule')!;
    expect(schedule.will_send).toBe(false);
    expect(schedule.skipped_reason).toBe('no_content');
    expect(schedule.translations).toBeNull();
  });

  it('shows an already-sent card as already sent', async () => {
    const { client } = db({
      tourSchedule: [{ title: 'A' }],
      events: [{ subject_key: 'tour_start_briefing', type: 'tour_start_briefing' }],
    });
    const preview = (await previewTourStartBriefing(client, { roomId: 'room-1' }))!;
    const start = preview.cards.find((card) => card.id === 'start')!;
    expect(start.will_send).toBe(false);
    expect(start.skipped_reason).toBe('already_sent');
  });
});

describe('§11.D D3 — the wording follows the tour kind', () => {
  it('a JOIN tour is unchanged: bus welcome, staff-in-sight, staff at lunch', async () => {
    const { client, inserted } = db({ priceType: 'person', lunchIncluded: true });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });

    const start = cardOf(inserted, 'tour_start_briefing')!;
    expect(String(start.source_text)).toMatch(/welcome aboard/i);
    expect((start.metadata as { briefing_kind?: string }).briefing_kind).toBe('join');
    expect(String(cardOf(inserted, 'briefing_safety')!.source_text)).toMatch(/keep the staff in sight/i);
    expect(String(cardOf(inserted, 'briefing_lunch')!.source_text)).toMatch(/the staff will take you/i);
  });

  it('a PRIVATE charter gets the charter welcome — included hours + cash overtime', async () => {
    const { client, inserted } = db({ priceType: 'vehicle', lunchIncluded: true });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });

    const start = cardOf(inserted, 'tour_start_briefing')!;
    const en = String(start.source_text);
    expect(en).toMatch(/I'm your driver today/i);
    expect(en).toMatch(/hours of service/i);
    expect(en).toMatch(/overtime is ₩[\d,]+ per hour, payable in cash/i);
    expect(en).not.toMatch(/welcome aboard/i);
    expect((start.metadata as { briefing_kind?: string }).briefing_kind).toBe('private');
  });

  it('a PRIVATE charter is never told to watch for staff who are not there', async () => {
    const { client, inserted } = db({ priceType: 'vehicle', lunchIncluded: true });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });

    const safety = cardOf(inserted, 'briefing_safety')!;
    expect(String(safety.source_text)).not.toMatch(/staff/i);
    expect(String(safety.source_text)).toMatch(/your driver dropped you off/i);
    expect((safety.metadata as { tour_kind?: string }).tour_kind).toBe('private');
    // the shared lines are still there — only ONE line differs
    expect(String(safety.source_text)).toMatch(/Seatbelts stay fastened/i);
    expect(String(safety.source_text)).toMatch(/red SOS button/i);

    const lunch = cardOf(inserted, 'briefing_lunch')!;
    expect(String(lunch.source_text)).toMatch(/your driver will take you/i);
    expect((lunch.metadata as { tour_kind?: string }).tour_kind).toBe('private');
  });

  it('an unknown / missing price_type falls back to the safe join shape', async () => {
    const { client, inserted } = db({ priceType: null });
    await fireTourStartBriefing(client, { tourId: 'tour-1', tourDate: TOUR_DATE });
    expect((cardOf(inserted, 'tour_start_briefing')!.metadata as { briefing_kind?: string }).briefing_kind).toBe(
      'join',
    );
  });

  it('the preview reports the kind it resolved', async () => {
    const { client } = db({ priceType: 'vehicle' });
    const preview = (await previewTourStartBriefing(client, { roomId: 'room-1' }))!;
    expect(preview.tour_kind).toBe('private');
  });
});
