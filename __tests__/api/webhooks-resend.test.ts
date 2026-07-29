/**
 * @jest-environment node
 *
 * X7 — `POST /api/webhooks/resend`, which nothing had ever called.
 *
 * This is the only route in the uncovered set that a stranger on the internet
 * can address directly, and it writes to the support inbox. The handler is
 * already careful — it demands `RESEND_WEBHOOK_SECRET`, requires all three svix
 * headers, and verifies the signature over the RAW body. None of that had a
 * test, and every one of those is a line somebody could "clean up".
 *
 * So each negative case asserts that `storeReceivedEmail` was never reached.
 * A 401 that had already written the row would be a catastrophic pass, and
 * status-only assertions cannot tell the two apart.
 *
 * One more thing worth pinning: the signature is verified against the raw text,
 * BEFORE `JSON.parse`. If a refactor ever parses first and re-serialises for
 * verification, every message with different key order or unicode escaping
 * starts failing in production while the tests stay green — so the test asserts
 * the exact bytes handed to the verifier.
 */
import '@/test-utils/restoreWebPrimitives';
import { Webhook } from 'svix';
import { storeReceivedEmail } from '@/lib/support/storeReceivedEmail';

jest.mock('svix', () => ({ Webhook: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn(() => ({})) }));
jest.mock('@/lib/support/storeReceivedEmail', () => ({
  storeReceivedEmail: jest.fn(async () => ({ result: 'stored', emailId: 'email-1' })),
}));

const WebhookMock = Webhook as unknown as jest.Mock;
const storeMock = storeReceivedEmail as jest.Mock;

const SIGNED_HEADERS = {
  'svix-id': 'msg_1',
  'svix-timestamp': '1785344389',
  'svix-signature': 'v1,deadbeef',
};

/** `fakeNextRequest` has no `text()`, and this route reads the raw body. */
const req = (raw: string, headers: Record<string, string> = SIGNED_HEADERS) =>
  ({
    text: async () => raw,
    headers: new Headers(headers),
  }) as unknown as import('next/server').NextRequest;

let verify: jest.Mock;

async function route() {
  return (await import('@/app/api/webhooks/resend/route')).POST;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = 'whsec_test';
  delete process.env.RESEND_API_KEY; // skip the hydration fetch entirely
  verify = jest.fn();
  WebhookMock.mockImplementation(() => ({ verify }));
});

const received = JSON.stringify({ type: 'email.received', data: { email_id: 'e1', to: ['support@x'] } });

describe('POST /api/webhooks/resend', () => {
  it('🔴 refuses to run at all when the secret is unset — not a silent accept', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const POST = await route();
    const res = await POST(req(received));
    expect(res.status).toBe(503);
    expect(storeMock).not.toHaveBeenCalled();
  });

  it.each(['svix-id', 'svix-timestamp', 'svix-signature'])(
    '🔴 rejects a request missing %s, and stores nothing',
    async (missing) => {
      const headers = { ...SIGNED_HEADERS };
      delete (headers as Record<string, string>)[missing];
      const POST = await route();
      const res = await POST(req(received, headers));
      expect(res.status).toBe(401);
      expect(verify).not.toHaveBeenCalled();
      expect(storeMock).not.toHaveBeenCalled();
    },
  );

  it('🔴 rejects a bad signature, and stores nothing', async () => {
    verify.mockImplementation(() => {
      throw new Error('No matching signature found');
    });
    const POST = await route();
    const res = await POST(req(received));
    expect(res.status).toBe(401);
    expect(storeMock).not.toHaveBeenCalled();
  });

  it('🔴 verifies the RAW body, byte for byte, before parsing it', async () => {
    // Key order and a non-ASCII character that JSON.stringify would re-escape.
    const raw = '{"data":{"subject":"안녕하세요"},"type":"email.received"}';
    const POST = await route();
    await POST(req(raw));
    expect(verify).toHaveBeenCalledWith(raw, SIGNED_HEADERS);
  });

  it('acknowledges other event types without storing them', async () => {
    const POST = await route();
    const res = await POST(req(JSON.stringify({ type: 'email.delivered' })));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ event_type: 'email.delivered' });
    expect(storeMock).not.toHaveBeenCalled();
  });

  it('stores a verified inbound email', async () => {
    const POST = await route();
    const res = await POST(req(received));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, email_id: 'email-1' });
    expect(storeMock).toHaveBeenCalledTimes(1);
  });

  /**
   * The recorded failure this preserves: a normal support mail arriving by bcc
   * was dropped with a log line that could not be diagnosed. The route now
   * returns the recipients it actually saw.
   */
  it('says which recipients it saw when it decides a mail is not for support', async () => {
    storeMock.mockResolvedValueOnce({ result: 'not_support', recipients: ['bcc@elsewhere'] });
    const POST = await route();
    const res = await POST(req(received));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ recipients: ['bcc@elsewhere'] });
  });

  it('reports a storage failure as 500 rather than acknowledging it', async () => {
    storeMock.mockResolvedValueOnce({ result: 'error', stage: 'insert', message: 'db down' });
    const POST = await route();
    const res = await POST(req(received));
    expect(res.status).toBe(500);
  });

  it('acknowledges a duplicate without a second write', async () => {
    storeMock.mockResolvedValueOnce({ result: 'duplicate' });
    const POST = await route();
    const res = await POST(req(received));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
  });

  it('GET is 405 — the endpoint does not answer enumeration', async () => {
    const { GET } = await import('@/app/api/webhooks/resend/route');
    expect((await GET()).status).toBe(405);
  });
});
