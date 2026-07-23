/**
 * @jest-environment node
 *
 * Phase 2 — 인박스 리뷰 큐 API (plan A-6 승인 경로 + A-7b 매핑 해결).
 * requireAdmin / Supabase / commit / Resend received fetch 전부 mock.
 */
import '@/test-utils/restoreWebPrimitives';

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/ops/inbox/commit', () => ({ commitInboundEmail: jest.fn() }));
jest.mock('@/lib/ops/inbox/received', () => ({
  fetchReceivedEmail: jest.fn(),
  bodyTextFrom: jest.requireActual('@/lib/ops/inbox/received').bodyTextFrom,
}));

import { GET, POST } from '@/app/api/admin/tour-ops/inbox-review/route';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { commitInboundEmail } from '@/lib/ops/inbox/commit';
import { fetchReceivedEmail } from '@/lib/ops/inbox/received';

const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const commitMock = commitInboundEmail as jest.Mock;
const fetchReceivedMock = fetchReceivedEmail as jest.Mock;

const LOG_ROW = {
  id: 'log-1',
  channel: 'klook',
  intent: 'confirm',
  message_id: 'em_1',
  confidence: 0.7,
  commit_result: 'review_queued',
  booking_id: null,
  external_booking_id: null,
  masked_summary: { items: [{ lead_name: 'Massimo C.', reason: 'confidence_below_auto' }] },
  error: null,
  created_at: '2026-07-24T00:00:00Z',
};

function fakeDb() {
  const state = {
    logs: [LOG_ROW] as Array<Record<string, unknown>>,
    logUpdates: [] as Array<Record<string, unknown>>,
    mapUpserts: [] as Array<Record<string, unknown>>,
    lastLogFilter: null as unknown,
  };
  const client = {
    state,
    from(table: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      chain.select = jest.fn(() => chain);
      chain.order = jest.fn(() => chain);
      chain.limit = jest.fn(() => chain);
      chain.eq = jest.fn(() => chain);
      chain.in = jest.fn((_col: string, values: unknown) => {
        state.lastLogFilter = values;
        return chain;
      });
      chain.maybeSingle = jest.fn(async () => {
        if (table === 'ops_email_parse_logs') return { data: state.logs[0] ?? null, error: null };
        if (table === 'tours') return { data: { id: 'tour-1' }, error: null };
        return { data: null, error: null };
      });
      chain.update = jest.fn((row: Record<string, unknown>) => {
        if (table === 'ops_email_parse_logs') state.logUpdates.push(row);
        return { eq: jest.fn(async () => ({ error: null })) };
      });
      chain.upsert = jest.fn(async (row: Record<string, unknown>) => {
        if (table === 'ops_channel_product_map') state.mapUpserts.push(row);
        return { error: null };
      });
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data: state.logs, error: null }).then(res, rej);
      return chain;
    },
  };
  return client;
}

function fakeReq(json?: unknown, params: Record<string, string> = {}) {
  return {
    headers: { get: () => null },
    nextUrl: { searchParams: new URLSearchParams(params) },
    json: async () => json ?? {},
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue({ id: 'admin-1' });
  createServerClientMock.mockReturnValue(fakeDb());
  fetchReceivedMock.mockResolvedValue({
    ok: true,
    data: { subject: 'New booking', text: 'Booking Ref: KLK-1 Lead: Massimo' },
  });
  commitMock.mockResolvedValue({
    items: [
      {
        externalBookingId: 'KLK-1',
        commitResult: 'auto_committed',
        reason: null,
        bookingId: 'b-1',
        roomId: 'room-1',
        tourKind: 'join',
        confidence: 0.7,
        maskedSummary: { lead_name: 'Massimo C.' },
      },
    ],
    metrics: null,
    aggregateResult: 'auto_committed',
    maxConfidence: 0.7,
    firstBookingId: 'b-1',
    alert: { sent: false, skipped: true },
  });
});

describe('inbox-review GET', () => {
  it('rejects non-admin', async () => {
    requireAdminMock.mockRejectedValue(new Error('Unauthorized'));
    expect((await GET(fakeReq(undefined, {}))).status).toBe(403);
  });

  it('review filter narrows to review_queued/failed', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await GET(fakeReq(undefined, { filter: 'review' }));
    expect(res.status).toBe(200);
    expect(db.state.lastLogFilter).toEqual(['review_queued', 'failed']);
  });

  it('all filter returns everything (auto 뱃지 병행 표시용)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await GET(fakeReq(undefined, { filter: 'all' }));
    expect(res.status).toBe(200);
    expect(db.state.lastLogFilter).toBeNull(); // .in() not applied
    const json = await res.json();
    expect(json.logs).toHaveLength(1);
  });
});

describe('inbox-review POST approve', () => {
  it('re-fetches the original mail and re-commits in approveMode', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await POST(fakeReq({ action: 'approve', logId: 'log-1' }));
    expect(res.status).toBe(200);

    expect(fetchReceivedMock).toHaveBeenCalledWith('em_1');
    expect(commitMock).toHaveBeenCalledTimes(1);
    const arg = commitMock.mock.calls[0][0];
    expect(arg.approveMode).toBe(true);
    expect(arg.channel).toBe('klook');
    expect(arg.intent).toBe('confirm');
    expect(arg.raw).toContain('Massimo');

    // 로그 갱신 — 원문은 저장되지 않는다.
    expect(db.state.logUpdates).toHaveLength(1);
    const update = db.state.logUpdates[0];
    expect(update.commit_result).toBe('auto_committed');
    expect(update.booking_id).toBe('b-1');
    expect(JSON.stringify(update)).not.toContain('Booking Ref: KLK-1 Lead: Massimo');
  });

  it('answers 410 with the paste-fallback hint when the original mail expired', async () => {
    fetchReceivedMock.mockResolvedValue({ ok: false, error: 'not found' });
    const res = await POST(fakeReq({ action: 'approve', logId: 'log-1' }));
    expect(res.status).toBe(410);
    expect(commitMock).not.toHaveBeenCalled();
  });
});

describe('inbox-review POST map_product', () => {
  it('upserts the normalized mapping and chains the re-commit', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await POST(
      fakeReq({
        action: 'map_product',
        logId: 'log-1',
        channel: 'klook',
        productNameRaw: 'Jeju East Bus Tour',
        tourId: 'tour-1',
        tourKind: 'join',
      }),
    );
    expect(res.status).toBe(200);
    expect(db.state.mapUpserts).toHaveLength(1);
    const row = db.state.mapUpserts[0];
    expect(row.product_name_normalized).toBe('jejueastbustour');
    expect(row.tour_kind).toBe('join');
    expect(row.channel).toBe('klook');
    // logId가 있으므로 재커밋까지 이어진다
    expect(commitMock).toHaveBeenCalledTimes(1);
  });

  it('validates the channel enum', async () => {
    const res = await POST(
      fakeReq({ action: 'map_product', channel: 'evil', productNameRaw: 'x', tourId: 't' }),
    );
    expect(res.status).toBe(400);
  });
});

describe('inbox-review POST ignore', () => {
  it('marks the log ignored', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await POST(fakeReq({ action: 'ignore', logId: 'log-1' }));
    expect(res.status).toBe(200);
    expect(db.state.logUpdates).toEqual([{ commit_result: 'ignored' }]);
    expect(commitMock).not.toHaveBeenCalled();
  });
});
