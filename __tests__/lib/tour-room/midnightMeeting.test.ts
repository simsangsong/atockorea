/**
 * @jest-environment node
 *
 * The tour day does not end at midnight — feature audit F5 (boundary values).
 *
 * The edge was written down during the iOS sweep and never reproduced: a
 * meeting time past midnight was anchored to the START of the tour date, so
 * 00:30 announced at 23:00 produced a target 22½ hours in the past.
 * `activeNotice` expired it on arrival and the guests' countdown never came up.
 * Nothing errored — the guide saw a sent notice, the guests saw nothing.
 *
 * Reproduced on a real guest screen first (`scripts/qa-midnight-meeting.ts`):
 * a control meeting 35 minutes out drew the hero countdown; the same notice at
 * 00:30 drew nothing while the chat line still read "Meeting time is 00:30".
 *
 * These pin the resolution rule and, just as importantly, the two cases it must
 * NOT touch: a genuine early-morning meeting on the tour date, and the backdate
 * guard that refuses a staff typo.
 */
import { activeNotice, rallyResolution, wallClockToMs, RALLY_GRACE_MS } from '@/lib/tour-room/notices';
import { loadRallyNotice } from '@/lib/tour-room/rallyCrossing';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const TOUR_DATE = '2026-08-03';
/** 00:00 KST on the tour date. */
const DAY_START = Date.UTC(2026, 7, 2, 15, 0, 0);
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

const at = (hoursIntoDay: number) => DAY_START + hoursIntoDay * HOUR;

const notice = (metadata: Record<string, unknown>, createdMs: number, id = 'n1'): RoomMessage =>
  ({
    id,
    sender_role: 'system',
    created_at: new Date(createdMs).toISOString(),
    source_text: '',
    metadata,
  }) as RoomMessage;

describe('wallClockToMs — nearest occurrence', () => {
  it('without a reference it is exactly what it always was', () => {
    // Every existing caller keeps its behaviour byte for byte.
    expect(wallClockToMs(TOUR_DATE, '09:00')).toBe(at(9));
    expect(wallClockToMs(TOUR_DATE, '00:30')).toBe(at(0.5));
    expect(wallClockToMs(TOUR_DATE, 'nope')).toBeNull();
  });

  it('🔴 rolls a past-midnight clock into the night of the tour', () => {
    // Announced at 23:00. "00:30" cannot mean 22½ hours ago.
    expect(wallClockToMs(TOUR_DATE, '00:30', at(23))).toBe(at(24.5));
  });

  it('🔴 leaves a real early-morning meeting on the tour date', () => {
    // A sunrise hike that gathers at 03:30, announced at 02:30. A "before
    // 04:00 means tomorrow" cutoff would have moved this a whole day.
    expect(wallClockToMs(TOUR_DATE, '03:30', at(2.5))).toBe(at(3.5));
  });

  it('does not move a clock that is merely a few hours behind', () => {
    // 09:00 read at 14:00 is a typo, not tomorrow. Rolling it would turn a
    // refusal into a nineteen-hour countdown.
    expect(wallClockToMs(TOUR_DATE, '09:00', at(14))).toBe(at(9));
  });

  it('is stable: the same notice always means the same instant', () => {
    // Which is why the reference is the notice's creation and never `now`.
    const created = at(23);
    for (const readAt of [at(23), at(23.9), at(25), at(30)]) {
      void readAt;
      expect(wallClockToMs(TOUR_DATE, '00:30', created)).toBe(at(24.5));
    }
  });

  it('ignores an unparseable reference instead of producing NaN', () => {
    expect(wallClockToMs(TOUR_DATE, '00:30', Number.NaN)).toBe(at(0.5));
  });
});

describe('activeNotice — the guest countdown survives midnight', () => {
  const meeting = (time: string, createdMs: number) =>
    [notice({ kind: 'meeting_notice', meeting_time: time, meeting_point: 'Car park' }, createdMs)];

  it('🔴 a 00:30 meeting announced at 23:00 still counts down at 23:10', () => {
    const state = activeNotice(meeting('00:30', at(23)), TOUR_DATE, at(23) + 10 * MIN);
    expect(state).not.toBeNull();
    expect(state!.targetMs).toBe(at(24.5));
    expect(state!.remainingMs).toBe(80 * MIN);
  });

  it('and expires after the meeting, not before it', () => {
    // The old behaviour expired it on arrival; the new one expires it when the
    // wait is genuinely over.
    expect(activeNotice(meeting('00:30', at(23)), TOUR_DATE, at(24.5) + RALLY_GRACE_MS + MIN)).toBeNull();
  });

  it('a free-time timer past midnight behaves the same way', () => {
    const rows = [notice({ kind: 'free_time_timer', until_time: '01:00' }, at(23.5))];
    const state = activeNotice(rows, TOUR_DATE, at(23.5) + 5 * MIN);
    expect(state?.targetMs).toBe(at(25));
  });

  it('a daytime meeting is untouched', () => {
    const state = activeNotice(meeting('14:00', at(13)), TOUR_DATE, at(13.5));
    expect(state?.targetMs).toBe(at(14));
  });
});

describe('rallyResolution — the firing derivation agrees', () => {
  it('🔴 fires for a past-midnight meeting instead of refusing it as backdated', () => {
    const rows = [notice({ kind: 'meeting_notice', meeting_time: '00:30' }, at(23))];
    const state = rallyResolution(rows, TOUR_DATE, at(24.5) + RALLY_GRACE_MS + MIN);
    expect(state).not.toBeNull();
    expect(state!.phase).toBe('window');
  });

  it('still refuses a notice created after its own target', () => {
    // The 2차 P0. A staff typo must not become an instant departure capsule.
    const rows = [notice({ kind: 'meeting_notice', meeting_time: '09:00' }, at(14))];
    expect(rallyResolution(rows, TOUR_DATE, at(14.5))).toBeNull();
  });
});

describe('loadRallyNotice — the server re-derives it the same way', () => {
  function client(row: { id: string; created_at: string; metadata: Record<string, unknown> } | null) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
          }),
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  it('🔴 accepts a past-midnight meeting the old arithmetic called backdated', async () => {
    const row = {
      id: 'n1',
      created_at: new Date(at(23)).toISOString(),
      metadata: { kind: 'meeting_notice', meeting_time: '00:30', meeting_point: 'Car park' },
    };
    const loaded = await loadRallyNotice(client(row), 'room-1', TOUR_DATE, 'n1');
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.targetMs).toBe(at(24.5));
  });

  it('still rejects a genuinely backdated one', async () => {
    const row = {
      id: 'n1',
      created_at: new Date(at(14)).toISOString(),
      metadata: { kind: 'meeting_notice', meeting_time: '09:00', meeting_point: 'Car park' },
    };
    const loaded = await loadRallyNotice(client(row), 'room-1', TOUR_DATE, 'n1');
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error).toBe('notice_backdated');
  });

  it('🔴 client and server land on the same instant, which is the whole point', async () => {
    // Two independent derivations of one meeting. If they disagree the banner
    // counts to one time and the departure capsule fires at another.
    const createdMs = at(22.75);
    const row = {
      id: 'n1',
      created_at: new Date(createdMs).toISOString(),
      metadata: { kind: 'meeting_notice', meeting_time: '00:15', meeting_point: 'Car park' },
    };
    const server = await loadRallyNotice(client(row), 'room-1', TOUR_DATE, 'n1');
    const clientSide = activeNotice(
      [notice(row.metadata, createdMs)],
      TOUR_DATE,
      createdMs + MIN,
    );
    expect(server.ok).toBe(true);
    if (server.ok) expect(clientSide?.targetMs).toBe(server.targetMs);
  });
});
