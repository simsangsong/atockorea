/**
 * @jest-environment node
 *
 * 룸 초대 이메일 일괄 발송 코어 — fake send + fake supabase로 네트워크/DB 0.
 * 이메일 있는 게스트만 발송, 마커 원장(daily.ts §4 집계 shape), 실패 격리, 카운트.
 */
import {
  buildBulkInvite,
  type BulkInviteDb,
  type InviteSend,
} from '@/lib/ops/seating/bulkInvite';
import { makeFakeDb, queriesFor, type FakeQuery } from '@/test-utils/opsSeatingFakes';

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const TOUR = 'tour-1';

const ROSTER = [
  { id: 'b1', contact_name: 'Massimo Colombo', contact_email: 'm@example.com', preferred_language: 'en', status: 'confirmed' },
  { id: 'b2', contact_name: 'No Email', contact_email: '  ', preferred_language: 'ko', status: 'confirmed' },
  { id: 'b3', contact_name: 'Tanaka Yuki', contact_email: 'tanaka@example.jp', preferred_language: 'ja', status: 'confirmed' },
];

function makeDb(opts: { rooms?: unknown[] } = {}) {
  const log: FakeQuery[] = [];
  const db = makeFakeDb((q) => {
    if (q.table === 'tour_rooms') {
      return { data: opts.rooms ?? [{ id: 'room-1', tour_id: TOUR, tour_date: FUTURE }] };
    }
    if (q.table === 'bookings') return { data: ROSTER };
    if (q.table === 'tour_room_invites' && q.op === 'insert') return { data: null };
    return { data: null };
  }, log);
  return { db: db as unknown as BulkInviteDb, log };
}

function fakeSend(behavior?: (to: string) => void): { fn: InviteSend; calls: string[] } {
  const calls: string[] = [];
  const fn: InviteSend = async (msg) => {
    calls.push(msg.to);
    behavior?.(msg.to);
    return { success: true };
  };
  return { fn, calls };
}

const baseDeps = (db: BulkInviteDb, send: InviteSend) => ({
  supabase: db,
  adminId: 'admin-1',
  tourId: TOUR,
  tourDate: FUTURE,
  tourTitle: 'Busan Highlights',
  send,
  now: 1_700_000_000_000,
});

describe('buildBulkInvite', () => {
  it('emails each guest with an email, skips no-email, and returns counts', async () => {
    const { db } = makeDb();
    const send = fakeSend();
    const outcome = await buildBulkInvite(baseDeps(db, send.fn));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.sent).toBe(2);
    expect(outcome.result.skippedNoEmail).toBe(1);
    expect(outcome.result.failed).toBe(0);
    expect(outcome.result.url).toContain('/tour-mode/join/');
    expect(typeof outcome.result.expires_at).toBe('string');

    // 실제 네트워크 0 — send는 fake, 두 게스트에게만 호출.
    expect(send.calls.sort()).toEqual(['m@example.com', 'tanaka@example.jp']);
  });

  it('writes one room_claim ledger row + one per-booking customer marker per send', async () => {
    const { db, log } = makeDb();
    await buildBulkInvite(baseDeps(db, fakeSend().fn));

    const inserts = queriesFor(log, 'tour_room_invites', 'insert');
    const roomClaim = inserts.filter((q) => (q.payload as { role: string }).role === 'room_claim');
    const markers = inserts.filter((q) => (q.payload as { role: string }).role === 'customer');

    // 룸 초대 링크 원장 1건 (claim-link 라우트 미러링).
    expect(roomClaim).toHaveLength(1);
    expect(roomClaim[0].payload).toMatchObject({ role: 'room_claim', sent_via: 'ops-link', tour_id: TOUR, tour_date: FUTURE, created_by: 'admin-1' });
    expect((roomClaim[0].payload as { token_hash: string }).token_hash).toMatch(/^[0-9a-f]{64}$/);

    // 게스트 마커 2건 — daily.ts §4가 이메일 연락으로 집계하는 shape:
    //   role='customer' + booking_id + sent_via='email' (+ sent_to).
    expect(markers).toHaveLength(2);
    for (const m of markers) {
      expect(m.payload).toMatchObject({ role: 'customer', sent_via: 'email', tour_id: TOUR, tour_date: FUTURE, created_by: 'admin-1' });
      const p = m.payload as { booking_id: string; sent_to: string; token_hash: string; revoked_at: string };
      expect(['b1', 'b3']).toContain(p.booking_id);
      expect(p.sent_to).toMatch(/@example\.(com|jp)$/);
      expect(p.token_hash).toMatch(/^[0-9a-f]{64}$/);
      // born-revoked: 개인초대 liveness 소비처(.is('revoked_at', null))에 안 잡히도록.
      expect(typeof p.revoked_at).toBe('string');
    }
    // 마커 token_hash는 서로 유니크(NOT NULL UNIQUE 제약 만족) + 링크 해시와 다름.
    const hashes = new Set(markers.map((m) => (m.payload as { token_hash: string }).token_hash));
    expect(hashes.size).toBe(2);
    expect(hashes.has((roomClaim[0].payload as { token_hash: string }).token_hash)).toBe(false);
  });

  it('one failing send does not abort the batch', async () => {
    const { db, log } = makeDb();
    const send = fakeSend((to) => {
      if (to === 'm@example.com') throw new Error('smtp boom');
    });
    const outcome = await buildBulkInvite(baseDeps(db, send.fn));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.failed).toBe(1);
    expect(outcome.result.sent).toBe(1);
    expect(outcome.result.skippedNoEmail).toBe(1);

    // 실패한 게스트는 마커가 남지 않는다 — 성공한 b3만.
    const markers = queriesFor(log, 'tour_room_invites', 'insert').filter(
      (q) => (q.payload as { role: string }).role === 'customer',
    );
    expect(markers).toHaveLength(1);
    expect((markers[0].payload as { booking_id: string }).booking_id).toBe('b3');
  });

  it('returns 409 when no room exists for the tour scope (no sends, no ledger)', async () => {
    const { db, log } = makeDb({ rooms: [] });
    const send = fakeSend();
    const outcome = await buildBulkInvite(baseDeps(db, send.fn));

    expect(outcome).toEqual({ ok: false, status: 409, error: 'no room for tour scope' });
    expect(send.calls).toHaveLength(0);
    expect(queriesFor(log, 'tour_room_invites', 'insert')).toHaveLength(0);
  });

  it('treats a send returning {success:false} as failed, not sent', async () => {
    const { db } = makeDb();
    const send = (async () => ({ success: false as const, error: 'resend down' })) as InviteSend;
    const outcome = await buildBulkInvite(baseDeps(db, send));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.sent).toBe(0);
    expect(outcome.result.failed).toBe(2);
  });
});
