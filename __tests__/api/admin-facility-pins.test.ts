/**
 * @jest-environment node
 *
 * Admin facility-pins editor API (F-D10 manual CRUD).
 * Plan: docs/tour-room-facility-pins-master-plan-2026-07-19.md, W1.1.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET, POST } from '@/app/api/admin/facility-pins/route';
import { PATCH, DELETE } from '@/app/api/admin/facility-pins/[id]/route';
import { requireAdmin, AdminAuthFailure } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

jest.mock('@/lib/auth', () => {
  const { NextResponse } = require('next/server');
  class AdminAuthFailure extends Error {
    status: number;
    code: string;
    constructor(status: number, message: string, code = 'AUTH') {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    requireAdmin: jest.fn(),
    AdminAuthFailure,
    adminAuthJsonResponse: (e: { code: string; message: string; status: number }) =>
      NextResponse.json({ ok: false, code: e.code, message: e.message }, { status: e.status }),
  };
});
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;

function fakeDb(opts: { listData?: unknown[]; rowData?: unknown; error?: unknown } = {}) {
  const listData = opts.listData ?? [];
  const rowData = opts.rowData ?? { id: 'p1' };
  const dbError = opts.error ?? null;
  const ops: { inserted: unknown; updated: unknown; deletedId: unknown; hardDeleted: boolean } = {
    inserted: null,
    updated: null,
    deletedId: null,
    hardDeleted: false,
  };
  const single = async () => ({ data: dbError ? null : rowData, error: dbError });
  const client = {
    ops,
    from() {
      const chain: Record<string, unknown> = {};
      chain.select = jest.fn(() => chain);
      chain.eq = jest.fn(() => chain);
      chain.order = jest.fn(() => chain);
      chain.single = jest.fn(single);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data: dbError ? null : listData, error: dbError }).then(res, rej);
      chain.insert = jest.fn((values: unknown) => {
        ops.inserted = values;
        return { select: () => ({ single }) };
      });
      chain.update = jest.fn((patch: unknown) => {
        ops.updated = patch;
        return { eq: () => ({ select: () => ({ single }) }) };
      });
      chain.delete = jest.fn(() => ({
        eq: async (_col: string, val: unknown) => {
          ops.deletedId = val;
          ops.hardDeleted = true;
          return { error: dbError };
        },
      }));
      return chain;
    },
  };
  return client;
}

function req({ search = '', body }: { search?: string; body?: unknown } = {}) {
  return {
    nextUrl: { searchParams: new URLSearchParams(search) },
    json: async () => body,
  } as never;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue({ id: 'admin-1' });
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('admin facility-pins — auth', () => {
  it('returns the auth status for non-admin callers on every verb', async () => {
    requireAdminMock.mockRejectedValue(new AdminAuthFailure(401, 'no', 'AUTH'));
    expect((await GET(req({ search: 'poi_key=x' }))).status).toBe(401);
    expect((await POST(req({ body: {} }))).status).toBe(401);
    expect((await PATCH(req({ body: {} }), ctx('p1'))).status).toBe(401);
    expect((await DELETE(req(), ctx('p1'))).status).toBe(401);
  });
});

describe('GET /api/admin/facility-pins', () => {
  it('requires poi_key', async () => {
    expect((await GET(req())).status).toBe(400);
  });

  it('lists pins for a poi_key', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ listData: [{ id: 'a' }, { id: 'b' }] }));
    const res = await GET(req({ search: 'poi_key=seongsan' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(2);
  });
});

describe('POST /api/admin/facility-pins', () => {
  it('rejects an invalid kind', async () => {
    const res = await POST(req({ body: { poi_key: 'x', kind: 'atm', lat: 33.5, lng: 126.5 } }));
    expect(res.status).toBe(400);
  });

  it('rejects out-of-range coordinates', async () => {
    const res = await POST(req({ body: { poi_key: 'x', kind: 'restroom', lat: 200, lng: 126.5 } }));
    expect(res.status).toBe(400);
  });

  it('creates a curated, verified pin', async () => {
    const db = fakeDb({ rowData: { id: 'new' } });
    createServerClientMock.mockReturnValue(db);
    const res = await POST(
      req({ body: { poi_key: 'seongsan', kind: 'photo', lat: 33.458, lng: 126.942, name: 'Crater rim' } }),
    );
    expect(res.status).toBe(201);
    const inserted = db.ops.inserted as Record<string, unknown>;
    expect(inserted.source).toBe('curated');
    expect(inserted.is_verified).toBe(true);
    expect(inserted.kind).toBe('photo');
    expect(inserted.name).toBe('Crater rim');
  });
});

describe('PATCH /api/admin/facility-pins/[id]', () => {
  it('rejects an empty patch', async () => {
    const res = await PATCH(req({ body: {} }), ctx('p1'));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid kind', async () => {
    const res = await PATCH(req({ body: { kind: 'atm' } }), ctx('p1'));
    expect(res.status).toBe(400);
  });

  it('auto-promotes is_verified when correcting placement', async () => {
    const db = fakeDb({ rowData: { id: 'p1' } });
    createServerClientMock.mockReturnValue(db);
    const res = await PATCH(req({ body: { lat: 33.46, lng: 126.94 } }), ctx('p1'));
    expect(res.status).toBe(200);
    const patch = db.ops.updated as Record<string, unknown>;
    expect(patch.is_verified).toBe(true);
    expect(patch.updated_at).toBeDefined();
  });

  it('honors an explicit is_verified without overriding it', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    await PATCH(req({ body: { name: 'x', is_verified: false } }), ctx('p1'));
    expect((db.ops.updated as Record<string, unknown>).is_verified).toBe(false);
  });
});

describe('DELETE /api/admin/facility-pins/[id]', () => {
  it('soft-deletes by default (is_active=false, not a hard delete)', async () => {
    const db = fakeDb({ rowData: { id: 'p1', is_active: false } });
    createServerClientMock.mockReturnValue(db);
    const res = await DELETE(req(), ctx('p1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toBe('soft');
    expect((db.ops.updated as Record<string, unknown>).is_active).toBe(false);
    expect(db.ops.hardDeleted).toBe(false);
  });

  it('hard-deletes when hard=1', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await DELETE(req({ search: 'hard=1' }), ctx('p1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toBe('hard');
    expect(db.ops.hardDeleted).toBe(true);
  });
});
