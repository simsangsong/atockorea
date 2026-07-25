/**
 * @jest-environment node
 *
 * Slice 2 — POST /api/inbound/email (Resend inbox webhook, plan §3 A-1~A-8).
 * svix / Supabase / commit 전부 mock — 네트워크 0.
 */
import '@/test-utils/restoreWebPrimitives';

const mockVerify = jest.fn();
jest.mock('svix', () => ({
  Webhook: jest.fn().mockImplementation(() => ({ verify: mockVerify })),
}));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/ops/inbox/commit', () => ({
  commitInboundEmail: jest.fn(),
}));
jest.mock('resend', () => ({ Resend: jest.fn() }));

import { POST } from '@/app/api/inbound/email/route';
import { createServerClient } from '@/lib/supabase';
import { commitInboundEmail } from '@/lib/ops/inbox/commit';

const createServerClientMock = createServerClient as jest.Mock;
const commitMock = commitInboundEmail as jest.Mock;

interface FakeLogDb {
  inserts: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
  deletes: number;
}

function fakeDb(opts: { insertError?: { code: string } | null } = {}) {
  const state: FakeLogDb = { inserts: [], updates: [], deletes: 0 };
  const client = {
    state,
    from(_table: string) {
      return {
        insert: (row: Record<string, unknown>) => {
          state.inserts.push(row);
          return {
            select: () => ({
              single: async () =>
                opts.insertError ? { data: null, error: opts.insertError } : { data: { id: 'log-1' }, error: null },
            }),
          };
        },
        update: (row: Record<string, unknown>) => {
          state.updates.push(row);
          return { eq: jest.fn(async () => ({ error: null })) };
        },
        delete: () => ({
          eq: jest.fn(async () => {
            state.deletes += 1;
            return { error: null };
          }),
        }),
      };
    },
  };
  return client;
}

function webhookBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: 'email.received',
    data: {
      email_id: 'em_abc123',
      // 전용 인박스 주소 — 수신자 게이트(A-1)를 통과하는 기본 픽스처.
      to: 'bookings@atockorea.com',
      from: 'Klook <no-reply@klook.com>',
      subject: 'New booking received - KLK-1001',
      text: 'Booking Ref: KLK-1001\nLead: Massimo Cassina\nDate: 2026-08-17',
      ...overrides,
    },
  });
}

function fakeReq(body: string, headers: Record<string, string> = {}) {
  const allHeaders: Record<string, string> = {
    'svix-id': 'msg_1',
    'svix-timestamp': String(Math.floor(Date.now() / 1000)),
    'svix-signature': 'v1,sig',
    ...headers,
  };
  return {
    text: async () => body,
    headers: { get: (k: string) => allHeaders[k.toLowerCase()] ?? null },
  } as never;
}

function commitReturns(partial: Record<string, unknown> = {}) {
  commitMock.mockResolvedValue({
    items: [
      {
        externalBookingId: 'KLK-1001',
        commitResult: 'auto_committed',
        reason: null,
        bookingId: 'b-1',
        roomId: 'room-1',
        tourKind: 'join',
        confidence: 0.95,
        maskedSummary: { lead_name: 'Massimo C.' },
      },
    ],
    metrics: { total: 1, layers_used: ['l1'], elapsed_ms: 3 },
    aggregateResult: 'auto_committed',
    maxConfidence: 0.95,
    firstBookingId: 'b-1',
    alert: { sent: false, skipped: true },
    ...partial,
  });
}

const savedSecret = process.env.RESEND_WEBHOOK_SECRET;
const savedInbound = process.env.OPS_INBOUND_ADDRESSES;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = 'whsec_test';
  // 명시적으로 비워 기본 상수(bookings@atockorea.com)를 타게 한다 —
  // 로컬 env가 새어 들어와 게이트 테스트가 흔들리지 않도록.
  delete process.env.OPS_INBOUND_ADDRESSES;
  mockVerify.mockImplementation(() => undefined);
  createServerClientMock.mockReturnValue(fakeDb());
  commitReturns();
});

afterAll(() => {
  if (savedSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
  else process.env.RESEND_WEBHOOK_SECRET = savedSecret;
  if (savedInbound === undefined) delete process.env.OPS_INBOUND_ADDRESSES;
  else process.env.OPS_INBOUND_ADDRESSES = savedInbound;
});

describe('POST /api/inbound/email — recipient gate (A-1)', () => {
  it('ignores mail addressed to the support inbox without touching the parser', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await POST(
      fakeReq(
        webhookBody({
          to: 'support@atockorea.com',
          from: 'guest@example.com',
          subject: 'Re: Your AtoC Korea booking A2C-1B2C3D4E',
          text: 'Hi, I want to cancel my booking please. 취소 부탁드립니다.',
        }),
      ),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ignored).toBe('recipient_not_allowed');
    // 파서도, 멱등 로그 행도 건드리지 않는다.
    expect(commitMock).not.toHaveBeenCalled();
    expect(db.state.inserts).toHaveLength(0);
  });

  it('accepts the dedicated inbox address', async () => {
    const res = await POST(fakeReq(webhookBody({ to: 'bookings@atockorea.com' })));
    const json = await res.json();
    expect(json.ignored).toBeUndefined();
    expect(commitMock).toHaveBeenCalled();
  });

  it('accepts Gmail-forwarded mail via X-Forwarded-To when To: is the original OTA recipient', async () => {
    const res = await POST(
      fakeReq(
        webhookBody({
          to: 'jason@gmail.com',
          headers: { 'X-Forwarded-To': 'bookings@atockorea.com' },
        }),
      ),
    );
    expect((await res.json()).ignored).toBeUndefined();
    expect(commitMock).toHaveBeenCalled();
  });

  it('rejects fail-closed when no recipient can be read from the payload', async () => {
    const res = await POST(fakeReq(webhookBody({ to: undefined })));
    const json = await res.json();
    expect(json.ignored).toBe('recipient_not_allowed');
    expect(json.recipients).toEqual([]);
    expect(commitMock).not.toHaveBeenCalled();
  });

  it('honours the OPS_INBOUND_ADDRESSES override and the "*" escape hatch', async () => {
    process.env.OPS_INBOUND_ADDRESSES = 'ota@example.com';
    expect((await (await POST(fakeReq(webhookBody({ to: 'ota@example.com' })))).json()).ignored).toBeUndefined();
    expect((await (await POST(fakeReq(webhookBody()))).json()).ignored).toBe('recipient_not_allowed');

    process.env.OPS_INBOUND_ADDRESSES = '*';
    expect((await (await POST(fakeReq(webhookBody({ to: 'anything@wherever.com' })))).json()).ignored).toBeUndefined();
  });
});

describe('POST /api/inbound/email — signature gate', () => {
  it('returns 501 fail-closed when RESEND_WEBHOOK_SECRET is absent', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const res = await POST(fakeReq(webhookBody()));
    expect(res.status).toBe(501);
    expect(commitMock).not.toHaveBeenCalled();
  });

  it('returns 401 when svix headers are missing', async () => {
    const req = {
      text: async () => webhookBody(),
      headers: { get: () => null },
    } as never;
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 on an invalid signature', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const res = await POST(fakeReq(webhookBody()));
    expect(res.status).toBe(401);
    expect(commitMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/inbound/email — event + idempotency', () => {
  it('acks non-received events without processing', async () => {
    const res = await POST(fakeReq(JSON.stringify({ type: 'email.sent', data: {} })));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ignored: 'event_type' });
    expect(commitMock).not.toHaveBeenCalled();
  });

  it('answers 200 duplicate on a redelivered message_id (23505) without re-committing', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ insertError: { code: '23505' } }));
    const res = await POST(fakeReq(webhookBody()));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(commitMock).not.toHaveBeenCalled();
  });

  it('rejects a payload without a message id', async () => {
    const res = await POST(fakeReq(JSON.stringify({ type: 'email.received', data: { subject: 'x' } })));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/inbound/email — classification routing', () => {
  it('logs unrelated mail as ignored and never parses', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await POST(
      fakeReq(
        JSON.stringify({
          type: 'email.received',
          data: {
            email_id: 'em_x',
            to: 'bookings@atockorea.com',
            from: 'promo@random.io',
            subject: 'Big summer sale!',
            text: 'Buy now',
          },
        }),
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ignored: 'unrelated' });
    expect(commitMock).not.toHaveBeenCalled();
    expect(db.state.updates).toHaveLength(1);
    expect(db.state.updates[0]).toMatchObject({ commit_result: 'ignored', intent: 'unrelated' });
  });

  it('classifies channel+intent and hands the in-memory body to commit', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await POST(fakeReq(webhookBody()));
    expect(res.status).toBe(200);

    expect(commitMock).toHaveBeenCalledTimes(1);
    const arg = commitMock.mock.calls[0][0];
    expect(arg.channel).toBe('klook');
    expect(arg.intent).toBe('confirm');
    expect(arg.messageId).toBe('em_abc123');
    expect(arg.raw).toContain('Massimo Cassina');

    // 감사 로그 확정 — 원문 본문은 저장되지 않는다 (masked_summary만).
    expect(db.state.updates).toHaveLength(1);
    const update = db.state.updates[0];
    expect(update.commit_result).toBe('auto_committed');
    expect(update.booking_id).toBe('b-1');
    expect(JSON.stringify(update)).not.toContain('Massimo Cassina');
  });

  it('routes a cancel subject to the cancel intent', async () => {
    commitReturns({ aggregateResult: 'cancelled' });
    await POST(fakeReq(webhookBody({ subject: 'Booking cancelled - KLK-1001' })));
    expect(commitMock.mock.calls[0][0].intent).toBe('cancel');
  });
});

describe('POST /api/inbound/email — failure release', () => {
  it('releases the idempotency row and answers 500 when commit throws (retry-safe)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    commitMock.mockRejectedValue(new Error('boom'));
    const res = await POST(fakeReq(webhookBody()));
    expect(res.status).toBe(500);
    expect(db.state.deletes).toBe(1);
  });

  it('releases the row when the body cannot be fetched (no inline text, no API key)', async () => {
    const savedKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const db = fakeDb();
      createServerClientMock.mockReturnValue(db);
      const res = await POST(fakeReq(webhookBody({ text: undefined, html: undefined })));
      expect(res.status).toBe(500);
      expect(db.state.deletes).toBe(1);
      expect(commitMock).not.toHaveBeenCalled();
    } finally {
      if (savedKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = savedKey;
    }
  });
});
