/**
 * 입장 코드 리졸버 단위 테스트 (entry-code plan §C) — fake db 주입, 네트워크 0.
 * 판정 순서(①A2C → ②별칭 → ③OTA)·revoke/만료·취소 뭉개기·경합이 대상이다.
 */

import {
  canonicalBookingReference,
  ensureBookingReference,
  generateInviteShortCode,
  normalizeEntryInput,
  resolveEntryCode,
  shortLinkUrl,
  SHORT_CODE_LENGTH,
} from '@/lib/tour-room/entryCode';
import type { RoomDbClient } from '@/lib/tour-room/access';

/** thenable 체인 fake — 어떤 메서드 체인이든 마지막에 {data}를 돌려준다. */
function chain(result: unknown, error: unknown = null) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  for (const m of ['select', 'eq', 'is', 'ilike', 'limit', 'maybeSingle', 'update', 'insert']) {
    q[m] = jest.fn(self);
  }
  (q as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: result, error }).then(resolve);
  return q;
}

/** from(table) 호출 순서대로 준비된 체인을 내놓는 fake db. */
function fakeDb(queue: Array<{ table: string; result: unknown; error?: unknown }>): RoomDbClient {
  let i = 0;
  return {
    from(table: string) {
      const next = queue[i];
      if (!next) throw new Error(`unexpected from('${table}') — queue drained`);
      i += 1;
      expect(table).toBe(next.table);
      return chain(next.result, next.error ?? null);
    },
  } as RoomDbClient;
}

const FUTURE = '2999-01-01';
const PAST = '2020-01-01';

const baseBooking = {
  id: 'b-1',
  tour_id: 't-1',
  tour_date: FUTURE,
  status: 'confirmed',
  contact_name: 'Emily Johnson',
  preferred_language: 'en',
  booking_reference: 'A2C-12AB34CD',
};

describe('normalize / canonical', () => {
  test('공백·소문자·하이픈 유무를 흡수한다', () => {
    expect(normalizeEntryInput('  a2c 12ab34cd ')).toBe('A2C12AB34CD');
    expect(canonicalBookingReference('A2C12AB34CD')).toBe('A2C-12AB34CD');
    expect(canonicalBookingReference('A2C-12AB34CD')).toBe('A2C-12AB34CD');
    expect(canonicalBookingReference('GYGN6B27V8RZ')).toBeNull();
  });

  test('짧은 코드는 무혼동 알파벳 10자', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateInviteShortCode();
      expect(code).toHaveLength(SHORT_CODE_LENGTH);
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTVWXYZ23456789]+$/);
    }
  });

  test('shortLinkUrl 은 /r/{code} (+?to=plan)', () => {
    expect(shortLinkUrl('https://atockorea.com/', 'K7M2P9QX22')).toBe('https://atockorea.com/r/K7M2P9QX22');
    expect(shortLinkUrl('https://atockorea.com', 'K7M2P9QX22', 'plan')).toBe(
      'https://atockorea.com/r/K7M2P9QX22?to=plan',
    );
  });

});

describe('resolveEntryCode — ① 상설 예약 코드', () => {
  test('A2C 코드 → booking (하이픈 없이 입력해도)', async () => {
    const db = fakeDb([{ table: 'bookings', result: baseBooking }]);
    const res = await resolveEntryCode(db, 'a2c12ab34cd');
    expect(res).toEqual({ kind: 'booking', booking: baseBooking, via: 'reference' });
  });

  test('취소된 예약은 not_found 로 뭉갠다', async () => {
    const db = fakeDb([{ table: 'bookings', result: { ...baseBooking, status: 'cancelled' } }]);
    expect(await resolveEntryCode(db, 'A2C-12AB34CD')).toEqual({ kind: 'error', code: 'not_found' });
  });

  test('투어일이 지난 예약은 expired', async () => {
    const db = fakeDb([{ table: 'bookings', result: { ...baseBooking, tour_date: PAST } }]);
    expect(await resolveEntryCode(db, 'A2C-12AB34CD')).toEqual({ kind: 'error', code: 'expired' });
  });
});

describe('resolveEntryCode — ② 발송 별칭', () => {
  const invite = {
    id: 'inv-1',
    role: 'customer',
    booking_id: 'b-1',
    tour_id: 't-1',
    tour_date: FUTURE,
    display_name: 'Emily Johnson',
    expires_at: '2999-01-02T00:00:00Z',
    revoked_at: null,
    short_code: 'K7M2P9QX22',
  };

  test('customer 별칭 → invite-booking', async () => {
    const db = fakeDb([
      { table: 'tour_room_invites', result: invite },
      { table: 'bookings', result: baseBooking },
    ]);
    const res = await resolveEntryCode(db, 'K7M2P9QX22');
    expect(res).toEqual({ kind: 'invite-booking', booking: baseBooking, inviteId: 'inv-1' });
  });

  test('revoke 된 별칭은 revoked — 재발송이 옛 짧은 링크를 죽인다', async () => {
    const db = fakeDb([
      { table: 'tour_room_invites', result: { ...invite, revoked_at: '2026-08-08T00:00:00Z' } },
    ]);
    expect(await resolveEntryCode(db, 'K7M2P9QX22')).toEqual({ kind: 'error', code: 'revoked' });
  });

  test('만료된 별칭은 expired', async () => {
    const db = fakeDb([
      { table: 'tour_room_invites', result: { ...invite, expires_at: '2020-01-01T00:00:00Z' } },
    ]);
    expect(await resolveEntryCode(db, 'K7M2P9QX22')).toEqual({ kind: 'error', code: 'expired' });
  });

  test('driver 별칭 → staff 스코프 (tour-date)', async () => {
    const db = fakeDb([
      {
        table: 'tour_room_invites',
        result: { ...invite, role: 'driver', booking_id: null, display_name: '기사님' },
      },
    ]);
    expect(await resolveEntryCode(db, 'K7M2P9QX22')).toEqual({
      kind: 'staff',
      role: 'driver',
      tourId: 't-1',
      tourDate: FUTURE,
      displayName: '기사님',
    });
  });

  test('room_claim 별칭은 이 문으로 열지 않는다', async () => {
    const db = fakeDb([
      { table: 'tour_room_invites', result: { ...invite, role: 'room_claim', booking_id: null } },
    ]);
    expect(await resolveEntryCode(db, 'K7M2P9QX22')).toEqual({ kind: 'error', code: 'not_found' });
  });

  test('별칭 미적중이면 ③ OTA 로 내려간다 (10자 입력)', async () => {
    const db = fakeDb([
      { table: 'tour_room_invites', result: null },
      { table: 'bookings', result: [{ ...baseBooking, booking_reference: null }] },
    ]);
    const res = await resolveEntryCode(db, 'GYG32L3Z8K');
    expect(res.kind).toBe('booking');
    expect((res as { via: string }).via).toBe('external');
  });
});

describe('resolveEntryCode — ③ OTA 예약번호', () => {
  test('GYG 번호 → booking (대소문자 무시)', async () => {
    const db = fakeDb([{ table: 'bookings', result: [baseBooking] }]);
    const res = await resolveEntryCode(db, 'gygn6b27v8rz');
    expect(res).toEqual({ kind: 'booking', booking: baseBooking, via: 'external' });
  });

  test('두 소스에서 같은 번호가 나오면 어느 쪽도 열지 않는다', async () => {
    const db = fakeDb([{ table: 'bookings', result: [baseBooking, { ...baseBooking, id: 'b-2' }] }]);
    expect(await resolveEntryCode(db, 'GYGN6B27V8RZ')).toEqual({ kind: 'error', code: 'not_found' });
  });

  test('빈/터무니없는 입력은 DB 를 건드리지 않는다', async () => {
    const db = fakeDb([]);
    expect(await resolveEntryCode(db, '')).toEqual({ kind: 'error', code: 'not_found' });
    expect(await resolveEntryCode(db, 'ab')).toEqual({ kind: 'error', code: 'not_found' });
    expect(await resolveEntryCode(db, 'x'.repeat(50))).toEqual({ kind: 'error', code: 'not_found' });
  });
});

describe('ensureBookingReference', () => {
  test('이미 있으면 그대로 반환', async () => {
    const db = fakeDb([{ table: 'bookings', result: { booking_reference: 'A2C-AAAAAAAA' } }]);
    expect(await ensureBookingReference(db, 'b-1')).toBe('A2C-AAAAAAAA');
  });

  test('없으면 발급 (A2C-8HEX)', async () => {
    let stored: string | null = null;
    const db = {
      from(table: string) {
        expect(table).toBe('bookings');
        const q: Record<string, unknown> = {};
        const self = () => q;
        for (const m of ['select', 'eq', 'is', 'maybeSingle']) q[m] = jest.fn(self);
        q.update = jest.fn((payload: { booking_reference: string }) => {
          stored = payload.booking_reference;
          return q;
        });
        (q as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({
            data: stored ? [{ booking_reference: stored }] : { booking_reference: null },
            error: null,
          }).then(resolve);
        return q;
      },
    } as RoomDbClient;
    const ref = await ensureBookingReference(db, 'b-1');
    expect(ref).toMatch(/^A2C-[0-9A-F]{8}$/);
    expect(ref).toBe(stored);
  });

  test('경합에서 졌으면(0행 갱신) 이긴 쪽 값을 읽는다', async () => {
    const db = fakeDb([
      { table: 'bookings', result: { booking_reference: null } }, // 첫 조회: 비어 있음
      { table: 'bookings', result: [] }, // update … is null → 0행 (다른 프로세스가 선점)
      { table: 'bookings', result: { booking_reference: 'A2C-WINNER01' } }, // 재조회
    ]);
    expect(await ensureBookingReference(db, 'b-1')).toBe('A2C-WINNER01');
  });
});
