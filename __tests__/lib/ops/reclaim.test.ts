/**
 * §5.2 C-5 재claim 승인 큐 — 순수 계층.
 *
 * 이 큐의 계약은 claim 라우트와 **글자 그대로 같은 subject_key**다. 짝짓기가
 * 틀어지면 이미 승인한 요청이 영원히 "대기 중"으로 남고, 반대로 승인된
 * 요청이 다시 승인 가능해진다 (= 토큰 재발급 경로). 그래서 키 규약과 게이트를
 * 여기서 못 박는다.
 */
import {
  RECLAIM_APPROVED,
  RECLAIM_REJECTED,
  RECLAIM_REQUESTED,
  buildReclaimQueue,
  gateReclaimDecision,
  maskDeviceKey,
  parseReclaimSubjectKey,
  pendingReclaims,
  reclaimSubjectKey,
  type ReclaimEventLike,
} from '@/lib/ops/reclaim';

const BOOKING = '11111111-1111-4111-8111-111111111111';
const DEVICE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEVICE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function event(
  type: string,
  deviceKey: string,
  createdAt: string,
  payload: Record<string, unknown> = {},
): ReclaimEventLike {
  return {
    id: `${type}-${deviceKey}-${createdAt}`,
    room_id: 'room-1',
    booking_id: BOOKING,
    type,
    actor_role: type === RECLAIM_REQUESTED ? 'system' : 'admin',
    subject_key: reclaimSubjectKey(BOOKING, deviceKey),
    payload,
    created_at: createdAt,
  };
}

describe('subject key 규약 (claim 라우트와 동일해야 한다)', () => {
  it('builds and parses `reclaim:{bookingId}:{deviceKey}`', () => {
    const key = reclaimSubjectKey(BOOKING, DEVICE_A);
    expect(key).toBe(`reclaim:${BOOKING}:${DEVICE_A}`);
    expect(parseReclaimSubjectKey(key)).toEqual({ bookingId: BOOKING, deviceKey: DEVICE_A });
  });

  it('rejects foreign subject keys', () => {
    expect(parseReclaimSubjectKey('rally:abc:overdue')).toBeNull();
    expect(parseReclaimSubjectKey('reclaim:only-two')).toBeNull();
    expect(parseReclaimSubjectKey(null)).toBeNull();
  });

  it('masks device keys instead of printing them whole', () => {
    expect(maskDeviceKey(DEVICE_A)).toBe('aaaaaaaa…aaaa');
    expect(maskDeviceKey(null)).toBe('—');
    expect(maskDeviceKey('short')).toBe('short');
  });
});

describe('buildReclaimQueue', () => {
  it('marks an undecided request pending', () => {
    const rows = buildReclaimQueue([event(RECLAIM_REQUESTED, DEVICE_A, '2026-07-24T01:00:00Z')]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].deviceKey).toBe(DEVICE_A);
    expect(rows[0].decidedAt).toBeNull();
  });

  it('pairs a decision to its request by subject key', () => {
    const rows = buildReclaimQueue([
      event(RECLAIM_REQUESTED, DEVICE_A, '2026-07-24T01:00:00Z'),
      event(RECLAIM_APPROVED, DEVICE_A, '2026-07-24T02:00:00Z', { revoked_token_count: 2 }),
      event(RECLAIM_REQUESTED, DEVICE_B, '2026-07-24T03:00:00Z'),
    ]);
    const a = rows.find((row) => row.deviceKey === DEVICE_A)!;
    expect(a.status).toBe('approved');
    expect(a.decisionPayload).toEqual({ revoked_token_count: 2 });
    expect(rows.find((row) => row.deviceKey === DEVICE_B)!.status).toBe('pending');
  });

  it('reads a rejection as decided too', () => {
    const rows = buildReclaimQueue([
      event(RECLAIM_REQUESTED, DEVICE_A, '2026-07-24T01:00:00Z'),
      event(RECLAIM_REJECTED, DEVICE_A, '2026-07-24T02:00:00Z'),
    ]);
    expect(rows[0].status).toBe('rejected');
  });

  it('keeps the earliest request time and the latest decision', () => {
    const rows = buildReclaimQueue([
      event(RECLAIM_REQUESTED, DEVICE_A, '2026-07-24T05:00:00Z'),
      event(RECLAIM_REQUESTED, DEVICE_A, '2026-07-24T01:00:00Z'),
      event(RECLAIM_REJECTED, DEVICE_A, '2026-07-24T06:00:00Z'),
      event(RECLAIM_APPROVED, DEVICE_A, '2026-07-24T07:00:00Z'),
    ]);
    expect(rows[0].requestedAt).toBe('2026-07-24T01:00:00Z');
    expect(rows[0].status).toBe('approved');
  });

  it('sorts pending first, then newest request first', () => {
    const rows = buildReclaimQueue([
      event(RECLAIM_REQUESTED, DEVICE_A, '2026-07-24T09:00:00Z'),
      event(RECLAIM_APPROVED, DEVICE_A, '2026-07-24T09:30:00Z'),
      event(RECLAIM_REQUESTED, DEVICE_B, '2026-07-24T01:00:00Z'),
    ]);
    expect(rows.map((row) => row.status)).toEqual(['pending', 'approved']);
    expect(pendingReclaims(rows)).toHaveLength(1);
  });

  it('ignores events without a reclaim subject key', () => {
    expect(
      buildReclaimQueue([
        { ...event(RECLAIM_REQUESTED, DEVICE_A, '2026-07-24T01:00:00Z'), subject_key: null },
      ]),
    ).toHaveLength(0);
  });
});

describe('gateReclaimDecision — 기본은 항상 불가', () => {
  const queue = buildReclaimQueue([
    event(RECLAIM_REQUESTED, DEVICE_A, '2026-07-24T01:00:00Z'),
    event(RECLAIM_REQUESTED, DEVICE_B, '2026-07-24T02:00:00Z'),
    event(RECLAIM_APPROVED, DEVICE_B, '2026-07-24T02:30:00Z'),
  ]);

  it('refuses a device that never asked (no auto-grant path)', () => {
    const result = gateReclaimDecision(queue, {
      bookingId: BOOKING,
      deviceKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      confirm: true,
    });
    expect(result).toMatchObject({ ok: false, status: 404, error: 'reclaim_not_found' });
  });

  it('refuses a second decision on an already-decided request', () => {
    const result = gateReclaimDecision(queue, { bookingId: BOOKING, deviceKey: DEVICE_B, confirm: true });
    expect(result).toMatchObject({ ok: false, status: 409, error: 'already_decided' });
  });

  it('refuses without an explicit confirm (2단계 액션)', () => {
    for (const confirm of [undefined, false, 'true', 1]) {
      expect(gateReclaimDecision(queue, { bookingId: BOOKING, deviceKey: DEVICE_A, confirm })).toMatchObject({
        ok: false,
        error: 'confirm_required',
      });
    }
  });

  it('passes a pending request with confirm === true', () => {
    const result = gateReclaimDecision(queue, { bookingId: BOOKING, deviceKey: DEVICE_A, confirm: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.deviceKey).toBe(DEVICE_A);
  });
});
