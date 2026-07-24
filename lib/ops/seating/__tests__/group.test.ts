/**
 * §K B0.2 — 그룹 리졸버.
 *
 * 이 스위트가 지키는 계약:
 *   1. 그룹 키가 없는 룸은 조용히 아무 그룹에나 붙지 않는다.
 *   2. 동시 커밋 경합에서 그룹이 두 개 생기지 않는다.
 *   3. 인원 집계가 취소 예약을 세지 않는다 — 세면 정원 경고가 거짓말을 한다.
 */

import {
  ensureTourGroup,
  groupHeadcount,
  loadGroupRooms,
  readTourGroup,
  sameTourGroup,
  tourGroupKey,
} from '../group';

describe('tourGroupKey', () => {
  it('투어와 날짜가 둘 다 있어야 키가 된다', () => {
    expect(tourGroupKey({ tour_id: 'T1', tour_date: '2026-08-17' })).toEqual({
      tourId: 'T1',
      tourDate: '2026-08-17',
    });
  });

  it('하나라도 없으면 null — 기본값을 지어내지 않는다', () => {
    expect(tourGroupKey({ tour_id: 'T1', tour_date: null })).toBeNull();
    expect(tourGroupKey({ tour_id: null, tour_date: '2026-08-17' })).toBeNull();
    expect(tourGroupKey({})).toBeNull();
    expect(tourGroupKey(null)).toBeNull();
  });

  it('공백만 있는 값은 값이 아니다', () => {
    expect(tourGroupKey({ tour_id: '  ', tour_date: '2026-08-17' })).toBeNull();
  });
});

describe('sameTourGroup', () => {
  const a = { tour_id: 'T1', tour_date: '2026-08-17' };

  it('같은 투어·같은 날이면 같은 그룹이다', () => {
    expect(sameTourGroup(a, { tour_id: 'T1', tour_date: '2026-08-17' })).toBe(true);
  });

  it('날짜가 다르면 다른 그룹이다', () => {
    expect(sameTourGroup(a, { tour_id: 'T1', tour_date: '2026-08-18' })).toBe(false);
  });

  it('키를 못 만드는 쪽이 있으면 같다고 하지 않는다 — null끼리도 같지 않다', () => {
    expect(sameTourGroup(a, { tour_id: 'T1', tour_date: null })).toBe(false);
    expect(sameTourGroup(null, null)).toBe(false);
  });
});

describe('groupHeadcount', () => {
  it('활성 예약의 게스트 수를 더한다', () => {
    expect(
      groupHeadcount([
        { number_of_guests: 2, status: 'confirmed' },
        { number_of_guests: 3, status: 'confirmed' },
      ]),
    ).toBe(5);
  });

  it('취소는 세지 않는다 — 세면 정원 경고가 거짓말이 된다', () => {
    expect(
      groupHeadcount([
        { number_of_guests: 2, status: 'confirmed' },
        { number_of_guests: 9, status: 'cancelled' },
        { number_of_guests: 9, status: 'canceled' },
        { number_of_guests: 9, status: 'refunded' },
      ]),
    ).toBe(2);
  });

  it('상태 대소문자는 판정을 바꾸지 않는다', () => {
    expect(groupHeadcount([{ number_of_guests: 4, status: 'CANCELLED' }])).toBe(0);
  });

  it('게스트 수가 없거나 이상하면 0으로 센다', () => {
    expect(
      groupHeadcount([
        { number_of_guests: null, status: 'confirmed' },
        { number_of_guests: -3, status: 'confirmed' },
        { status: 'confirmed' },
      ]),
    ).toBe(0);
  });

  it('빈 그룹은 0명이다', () => {
    expect(groupHeadcount([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// I/O — 인메모리 스텁 (네트워크 0)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function makeDb(seed: { groups?: Row[]; rooms?: Row[] } = {}) {
  const groups: Row[] = [...(seed.groups ?? [])];
  const rooms: Row[] = [...(seed.rooms ?? [])];
  let insertAttempts = 0;
  /** 첫 insert 직전에 다른 트랜잭션이 같은 그룹을 만든 상황을 모사한다. */
  let raceOnFirstInsert = false;

  function builder(table: string) {
    const preds: Array<(r: Row) => boolean> = [];
    const api = {
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        preds.push((r) => r[col] === val);
        return api;
      },
      maybeSingle() {
        const source = table === 'ops_tour_groups' ? groups : rooms;
        const hit = source.filter((r) => preds.every((p) => p(r)))[0] ?? null;
        return Promise.resolve({ data: hit, error: null });
      },
      single() {
        return api.maybeSingle();
      },
      insert(row: Row) {
        insertAttempts += 1;
        if (raceOnFirstInsert && insertAttempts === 1) {
          groups.push({ id: 'G-race', capacity: null, status: 'planned', started_at: null, ended_at: null, ...row });
          return {
            select: () => ({
              single: () =>
                Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } }),
            }),
          };
        }
        const created = {
          id: `G${groups.length + 1}`,
          capacity: null,
          status: 'planned',
          started_at: null,
          ended_at: null,
          ...row,
        };
        groups.push(created);
        return { select: () => ({ single: () => Promise.resolve({ data: created, error: null }) }) };
      },
      then(onFulfilled: (v: { data: Row[]; error: null }) => unknown) {
        const source = table === 'ops_tour_groups' ? groups : rooms;
        return Promise.resolve(onFulfilled({ data: source.filter((r) => preds.every((p) => p(r))), error: null }));
      },
    };
    return api;
  }

  return {
    client: { from: (t: string) => builder(t) } as never,
    groups,
    setRace: (v: boolean) => {
      raceOnFirstInsert = v;
    },
    attempts: () => insertAttempts,
  };
}

describe('ensureTourGroup', () => {
  it('없으면 만든다', async () => {
    const db = makeDb();
    const g = await ensureTourGroup(db.client, { tour_id: 'T1', tour_date: '2026-08-17' });
    expect(g).not.toBeNull();
    expect(db.groups).toHaveLength(1);
  });

  it('있으면 만들지 않고 그대로 준다 — capacity 같은 운영자 값이 덮이면 안 된다', async () => {
    const db = makeDb({
      groups: [
        { id: 'G9', tour_id: 'T1', tour_date: '2026-08-17', capacity: 14, status: 'planned', started_at: null, ended_at: null },
      ],
    });
    const g = await ensureTourGroup(db.client, { tour_id: 'T1', tour_date: '2026-08-17' });
    expect(g?.id).toBe('G9');
    expect(g?.capacity).toBe(14);
    expect(db.attempts()).toBe(0);
    expect(db.groups).toHaveLength(1);
  });

  it('동시 커밋 경합(23505)에서 그룹이 두 개 생기지 않는다', async () => {
    const db = makeDb();
    db.setRace(true);
    const g = await ensureTourGroup(db.client, { tour_id: 'T1', tour_date: '2026-08-17' });
    expect(g?.id).toBe('G-race');
    expect(db.groups).toHaveLength(1);
  });

  it('투어나 날짜가 없는 룸은 null — 아무 그룹에나 붙이지 않는다', async () => {
    const db = makeDb();
    expect(await ensureTourGroup(db.client, { tour_id: 'T1', tour_date: null })).toBeNull();
    expect(db.groups).toHaveLength(0);
  });
});

describe('readTourGroup / loadGroupRooms', () => {
  it('없는 그룹은 null이고 만들지 않는다', async () => {
    const db = makeDb();
    expect(await readTourGroup(db.client, { tourId: 'T1', tourDate: '2026-08-17' })).toBeNull();
    expect(db.groups).toHaveLength(0);
  });

  it('그룹의 룸을 전부 준다 — 룸 수 = 예약 수(룸은 예약당 1개)', async () => {
    const db = makeDb({
      rooms: [
        { id: 'R1', booking_id: 'B1', tour_id: 'T1', tour_date: '2026-08-17' },
        { id: 'R2', booking_id: 'B2', tour_id: 'T1', tour_date: '2026-08-17' },
        { id: 'R3', booking_id: 'B3', tour_id: 'T1', tour_date: '2026-08-18' },
      ],
    });
    const rooms = await loadGroupRooms(db.client, { tourId: 'T1', tourDate: '2026-08-17' });
    expect(rooms.map((r) => r.booking_id)).toEqual(['B1', 'B2']);
  });
});
