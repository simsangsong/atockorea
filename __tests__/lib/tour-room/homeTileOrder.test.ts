import {
  orderHomeTiles,
  peekedHomeTiles,
  PEEK_COUNT,
  TAB_TWIN_TILES,
  type HomeTileKey,
} from '@/lib/tour-room/homeTileOrder';
import type { NowCardState } from '@/lib/tour-room/nowCard';

/** The grid a live private tour actually builds, in HomeTab's own order. */
const LIVE_PRIVATE: HomeTileKey[] = [
  'smart-guide',
  'chat',
  'schedule',
  'map',
  'pickup',
  'signal',
  'timeline',
  'sos',
];

const ALL_STATES: NowCardState[] = [
  'rally_overdue',
  'free_time',
  'arrived',
  'pickup_window',
  'moving',
  'ended',
  'lobby',
];

describe('orderHomeTiles', () => {
  it('never loses or invents a tile (U-D25)', () => {
    for (const state of [...ALL_STATES, null]) {
      const out = orderHomeTiles(LIVE_PRIVATE, state);
      expect([...out].sort()).toEqual([...LIVE_PRIVATE].sort());
      expect(new Set(out).size).toBe(out.length);
    }
  });

  it('never promotes a tile that already owns a bottom tab (U-D24)', () => {
    for (const state of [...ALL_STATES, null]) {
      const peeked = peekedHomeTiles(LIVE_PRIVATE, state);
      for (const twin of TAB_TWIN_TILES) {
        expect({ state, twin, peeked }).toEqual({ state, twin, peeked: expect.not.arrayContaining([twin]) });
      }
    }
  });

  it('lets a twin into the first row only when nothing else is left', () => {
    // The rule is not "never show a twin" — it is "never let one displace
    // something that has nowhere else to be". With four tiles, three of them
    // twins, sos must still make the first row.
    const thin: HomeTileKey[] = ['chat', 'schedule', 'map', 'sos'];
    expect(peekedHomeTiles(thin, 'moving')[0]).toBe('sos');
    // And with literally nothing but twins, the row is twins rather than empty.
    const bare: HomeTileKey[] = ['chat', 'schedule', 'map'];
    expect(peekedHomeTiles(bare, 'moving')).toEqual(bare);
  });

  it('keeps the tab twins in the grid, just not in the first three', () => {
    const out = orderHomeTiles(LIVE_PRIVATE, 'arrived');
    for (const twin of TAB_TWIN_TILES) expect(out).toContain(twin);
  });

  it('puts the state s answer first', () => {
    expect(peekedHomeTiles(LIVE_PRIVATE, 'arrived')[0]).toBe('smart-guide');
    expect(peekedHomeTiles(LIVE_PRIVATE, 'rally_overdue')[0]).toBe('signal');
    expect(peekedHomeTiles(LIVE_PRIVATE, 'pickup_window')[0]).toBe('pickup');
  });

  it('fills the slot instead of leaving a hole when a preferred tile is absent', () => {
    // A join tour in the lobby has no plan editor — that entrance is private
    // only. The slot must go to the next real tile, not disappear.
    const joinLobby: HomeTileKey[] = ['smart-guide', 'chat', 'schedule', 'map', 'pickup', 'sos'];
    const peeked = peekedHomeTiles(joinLobby, 'lobby');
    expect(peeked).not.toContain('plan');
    expect(peeked).toHaveLength(PEEK_COUNT);
    expect(peeked).toEqual(['smart-guide', 'pickup', 'sos']);
  });

  it('leaves an all-twin grid in its natural order', () => {
    const bare: HomeTileKey[] = ['chat', 'schedule', 'map'];
    expect(orderHomeTiles(bare, 'moving')).toEqual(bare);
  });

  it('has an ordering for every state the now card can return', () => {
    // A new state added to the resolver without a row here would silently fall
    // through to whatever the object happened to hold. tsc catches the missing
    // key; this catches an empty one.
    for (const state of ALL_STATES) {
      expect({ state, n: peekedHomeTiles(LIVE_PRIVATE, state).length }).toEqual({
        state,
        n: PEEK_COUNT,
      });
    }
  });

  it('is stable — same input, same order', () => {
    const a = orderHomeTiles(LIVE_PRIVATE, 'free_time');
    const b = orderHomeTiles(LIVE_PRIVATE, 'free_time');
    expect(a).toEqual(b);
  });

  it('keeps the tail in the order the caller built it', () => {
    const out = orderHomeTiles(LIVE_PRIVATE, 'arrived');
    const tail = out.slice(PEEK_COUNT);
    const expectedTail = LIVE_PRIVATE.filter((k) => !out.slice(0, PEEK_COUNT).includes(k));
    expect(tail).toEqual(expectedTail);
  });

  it('does not mutate its input', () => {
    const input = [...LIVE_PRIVATE];
    orderHomeTiles(input, 'ended');
    expect(input).toEqual(LIVE_PRIVATE);
  });
});
