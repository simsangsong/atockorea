/**
 * @jest-environment node
 *
 * X7 — `POST /api/auth/confirm-email`, which nothing had ever called.
 *
 * 🔴 Why this route first, out of 128 uncovered (method, path) pairs.
 *
 * The handler carries a comment recording that it used to be an IDOR: the
 * ownership check only ran when a token happened to be supplied, so omitting
 * `accessToken` let anybody force-confirm any user's email. The fix (N16) is
 * four lines, it has no test, and it is the kind of fix a later refactor
 * "simplifies" back out — the code reads like an optional-parameter guard.
 *
 * So the assertions below are deliberately about the ADMIN CALL, not just the
 * status code. A 401 that still reached `admin.updateUserById` would be a
 * catastrophic pass; asserting the mutation never happened is what makes this a
 * security test rather than a shape test.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST } from '@/app/api/auth/confirm-email/route';
import { createServerClient } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const createServerClientMock = createServerClient as jest.Mock;

const OWNER = 'user-owner';
const ATTACKER = 'user-attacker';

let updateUserById: jest.Mock;
let getUser: jest.Mock;

function mockSupabase(tokenUser: { id: string } | null, tokenError: unknown = null) {
  getUser = jest.fn(async () => ({ data: { user: tokenUser }, error: tokenError }));
  updateUserById = jest.fn(async (id: string) => ({ data: { user: { id } }, error: null }));
  createServerClientMock.mockReturnValue({
    auth: { getUser, admin: { updateUserById } },
  });
}

const req = (body: unknown) =>
  ({ json: async () => body }) as unknown as import('next/server').NextRequest;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/auth/confirm-email', () => {
  it('rejects a missing userId with 400', async () => {
    mockSupabase({ id: OWNER });
    const res = await POST(req({ accessToken: 'tok' }));
    expect(res.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  /**
   * 🔴 The N16 regression itself. Before the fix this body confirmed the email
   * of an arbitrary user id with no credential at all.
   */
  it('🔴 refuses to confirm anything when no accessToken is supplied', async () => {
    mockSupabase({ id: OWNER });
    const res = await POST(req({ userId: OWNER }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Authentication required' });
    expect(getUser).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('🔴 refuses when the token belongs to a different user', async () => {
    // A real, valid session — for somebody else's account.
    mockSupabase({ id: ATTACKER });
    const res = await POST(req({ userId: OWNER, accessToken: 'attacker-token' }));
    expect(res.status).toBe(401);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('refuses when the token is invalid', async () => {
    mockSupabase(null, { message: 'bad jwt' });
    const res = await POST(req({ userId: OWNER, accessToken: 'garbage' }));
    expect(res.status).toBe(401);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('rejects a non-string userId rather than passing it through', async () => {
    mockSupabase({ id: OWNER });
    const res = await POST(req({ userId: { id: OWNER }, accessToken: 'tok' }));
    expect(res.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('confirms when the token is the user’s own', async () => {
    mockSupabase({ id: OWNER });
    const res = await POST(req({ userId: OWNER, accessToken: 'owner-token' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, user: OWNER });
    expect(updateUserById).toHaveBeenCalledWith(OWNER, { email_confirm: true });
  });

  it('surfaces an admin failure as 500 instead of reporting ok', async () => {
    mockSupabase({ id: OWNER });
    updateUserById.mockResolvedValueOnce({ data: null, error: { message: 'nope' } });
    const res = await POST(req({ userId: OWNER, accessToken: 'owner-token' }));
    expect(res.status).toBe(500);
  });

  it('treats an unparseable body as a missing userId, not a crash', async () => {
    mockSupabase({ id: OWNER });
    const res = await POST({
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});
