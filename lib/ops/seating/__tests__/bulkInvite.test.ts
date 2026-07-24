/**
 * @jest-environment node
 *
 * 룸 초대 이메일 일괄 발송 코어 — fake send + fake supabase로 네트워크/DB 0.
 *
 * §K B0.3 이후: 전원 공유 claim 링크가 아니라 **예약마다 개인 링크**를 보낸다.
 * 이 스위트가 지키는 계약:
 *   1. 손님이 받는 URL이 개인 룸 URL이다(claim 화면을 한 번도 보지 않는다).
 *   2. 재발송은 폐기-후-재발급 — 예약당 살아있는 토큰이 항상 1개 (B0-D1c).
 *   3. 이메일 없는 예약을 위해 claim 폴백은 계속 발급된다 (B0-D2).
 *   4. daily.ts §4 연락현황 집계 shape은 그대로다.
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
  { id: 'b1', contact_name: 'Massimo Colombo', contact_email: 'm@example.com', preferred_language: 'en', status: 'confirmed', tour_date: FUTURE },
  { id: 'b2', contact_name: 'No Email', contact_email: '  ', preferred_language: 'ko', status: 'confirmed', tour_date: FUTURE },
  { id: 'b3', contact_name: 'Tanaka Yuki', contact_email: 'tanaka@example.jp', preferred_language: 'ja', status: 'confirmed', tour_date: FUTURE },
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

  it('B0.3 — each guest gets their OWN room URL, not the shared claim link', async () => {
    const { db } = makeDb();
    const sent: Array<{ to: string; text: string }> = [];
    const send: InviteSend = async (msg) => {
      sent.push({ to: msg.to, text: `${msg.html} ${msg.text ?? ''}` });
      return { success: true };
    };
    const outcome = await buildBulkInvite(baseDeps(db, send));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(sent).toHaveLength(2);
    for (const msg of sent) {
      // 개인 링크: /tour-mode/room/<bookingId>?rt=<token>
      expect(msg.text).toMatch(/\/tour-mode\/room\/(b1|b3)\?rt=/);
      // 🔴 claim 링크가 손님에게 가면 B0.3이 실패한 것이다.
      expect(msg.text).not.toContain('/tour-mode/join/');
    }
    // 게스트마다 서로 다른 링크여야 한다 — 같으면 개인 링크가 아니다.
    const b1 = sent.find((m) => m.to === 'm@example.com')!;
    const b3 = sent.find((m) => m.to === 'tanaka@example.jp')!;
    expect(b1.text).toContain('/tour-mode/room/b1?rt=');
    expect(b3.text).toContain('/tour-mode/room/b3?rt=');
  });

  it('B0-D2 — the claim link is still minted as a fallback, but never sent', async () => {
    const { db, log } = makeDb();
    const outcome = await buildBulkInvite(baseDeps(db, fakeSend().fn));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // 폴백 링크는 결과로 돌아온다(운영자가 이메일 없는 예약·차량 QR에 쓴다).
    expect(outcome.result.url).toContain('/tour-mode/join/');
    expect(outcome.result.skippedNoEmail).toBe(1);

    const roomClaim = queriesFor(log, 'tour_room_invites', 'insert').filter(
      (q) => (q.payload as { role: string }).role === 'room_claim',
    );
    expect(roomClaim).toHaveLength(1);
    expect(roomClaim[0].payload).toMatchObject({ role: 'room_claim', sent_via: 'ops-link', tour_id: TOUR });
  });

  it('B0-D1c — re-sending revokes the live invite before minting a new one', async () => {
    const { db, log } = makeDb();
    await buildBulkInvite(baseDeps(db, fakeSend().fn));

    const revokes = queriesFor(log, 'tour_room_invites', 'update');
    // 이메일 있는 게스트 2명 → 폐기 2회.
    expect(revokes).toHaveLength(2);
    for (const r of revokes) {
      expect(typeof (r.payload as { revoked_at: string }).revoked_at).toBe('string');
      // 같은 규칙: 살아있는 것만, 그 예약의, 고객 역할만.
      const methods = r.filters.map((f) => f.method);
      expect(methods).toContain('is');
      expect(methods).toContain('eq');
    }

    // 🔴 순서가 전부다 — 발급 후에 폐기하면 방금 만든 토큰까지 죽는다.
    const invites = log.filter((q) => q.table === 'tour_room_invites');
    const firstUpdate = invites.findIndex((q) => q.op === 'update');
    const firstCustomerInsert = invites.findIndex(
      (q) => q.op === 'insert' && (q.payload as { role: string }).role === 'customer',
    );
    expect(firstUpdate).toBeLessThan(firstCustomerInsert);
  });

  it('the invite row is now a real live token AND the §4 contact record', async () => {
    const { db, log } = makeDb();
    await buildBulkInvite(baseDeps(db, fakeSend().fn));

    const invites = queriesFor(log, 'tour_room_invites', 'insert').filter(
      (q) => (q.payload as { role: string }).role === 'customer',
    );
    expect(invites).toHaveLength(2);
    for (const m of invites) {
      // daily.ts buildContactStatus가 읽는 shape — 여기는 바뀌지 않았다.
      expect(m.payload).toMatchObject({ role: 'customer', sent_via: 'email', tour_id: TOUR, tour_date: FUTURE, created_by: 'admin-1' });
      const pl = m.payload as { booking_id: string; sent_to: string; token_hash: string; revoked_at?: string };
      expect(['b1', 'b3']).toContain(pl.booking_id);
      expect(pl.sent_to).toMatch(/@example\.(com|jp)$/);
      expect(pl.token_hash).toMatch(/^[0-9a-f]{64}$/);
      // 🔴 born-revoked 우회가 사라졌다. 이제 토큰이 진짜 개인 것이라
      // "살아있다"고 적는 것이 사실이다 — 그래야 C-5 탈취 대응이 성립한다.
      expect(pl.revoked_at).toBeUndefined();
    }
    const hashes = new Set(invites.map((m) => (m.payload as { token_hash: string }).token_hash));
    expect(hashes.size).toBe(2);
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
