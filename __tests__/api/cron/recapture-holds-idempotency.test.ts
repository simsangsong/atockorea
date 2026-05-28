/**
 * Regression test for the recapture-holds cron idempotency bug.
 *
 * Scenario: Stripe returns a transient 5xx (or the network drops) AFTER the
 * PaymentIntent is created server-side but BEFORE the bookings row gets
 * payment_intent_id. The booking stays with payment_intent_id IS NULL, so
 * the next daily cron run picks it up again. Without an idempotencyKey, the
 * second run would create a SECOND hold on the customer's card.
 *
 * With the fix in place, both runs pass the same idempotencyKey
 * (`reauth-${bookingId}-${todayYmd}`), so Stripe returns the original PI
 * instead of authorizing twice.
 */

const stripeCreateMock = jest.fn();

const mockSupabase = {
  from: jest.fn(),
};

jest.mock('@/lib/supabase', () => ({
  createServerClient: jest.fn(() => mockSupabase),
}));

jest.mock('stripe', () => {
  const StripeMock = jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: stripeCreateMock,
    },
    paymentMethods: {
      list: jest.fn().mockResolvedValue({ data: [{ id: 'pm_default' }] }),
    },
  }));
  return { __esModule: true, default: StripeMock };
});

jest.mock('@/lib/email', () => ({
  sendCardReauthFailedEmail: jest.fn().mockResolvedValue(undefined),
}));

const bookingRow = {
  id: 'bk_abc',
  tour_id: 42,
  tour_date: '2030-01-10',
  final_price: 250,
  no_show_fee_usd_cents: 25000,
  stripe_customer_id: 'cus_test',
  stripe_payment_method_id: 'pm_test',
  contact_email: 'guest@example.com',
  contact_name: 'Guest',
  payment_intent_id: null,
  payment_intent_status: null,
  card_collection_method: 'setup_intent_then_hold',
  status: 'confirmed',
  tours: { title: 'Test Tour' },
};

function installSelectChain(rows: unknown[]) {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
  };
  Object.values(chain).forEach((m) => m.mockReturnValue(chain));
  // .lte() is the terminal call awaited by route.ts
  chain.lte.mockResolvedValue({ data: rows, error: null });
  return chain;
}

function installUpdateChain() {
  const updateEq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq: updateEq });
  return { update, updateEq };
}

function buildRequest(): any {
  return {
    headers: { get: () => 'Bearer test-secret' },
    nextUrl: { searchParams: { get: () => null } },
  };
}

describe('GET /api/cron/recapture-holds — idempotency', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    /** jest.setup.js replaces global.Response with a stub that lacks the
     *  static `.json()` factory; NextResponse.json delegates to it, so
     *  patch it here for the cron route's terminal `NextResponse.json` call. */
    (global as unknown as { Response: { json?: unknown } }).Response.json = (
      body: unknown,
      init?: { status?: number },
    ) => ({
      status: init?.status ?? 200,
      json: async () => body,
    });
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      CRON_SECRET: 'test-secret',
      STRIPE_SECRET_KEY: 'sk_test_x',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('passes an idempotencyKey of `reauth-${bookingId}-${todayYmd}` to Stripe', async () => {
    const selectChain = installSelectChain([bookingRow]);
    const { update } = installUpdateChain();
    mockSupabase.from.mockImplementation(() => ({
      ...selectChain,
      update,
    }));

    stripeCreateMock.mockResolvedValueOnce({
      id: 'pi_first',
      status: 'requires_capture',
    });

    const { GET } = await import('@/app/api/cron/recapture-holds/route');
    await GET(buildRequest());

    expect(stripeCreateMock).toHaveBeenCalledTimes(1);
    const [, options] = stripeCreateMock.mock.calls[0];
    expect(options).toBeDefined();
    expect(typeof options.idempotencyKey).toBe('string');
    expect(options.idempotencyKey).toMatch(/^reauth-bk_abc-\d{4}-\d{2}-\d{2}$/);
  });

  it('reuses the same idempotencyKey on a same-day retry so Stripe will not double-authorize', async () => {
    /**
     * Simulate the buggy interleaving: first run fails AFTER Stripe accepted
     * the PI (network drop on the response) so the DB never gets the id, and
     * the next run reads the same booking row (payment_intent_id still null).
     */
    const selectChain = installSelectChain([bookingRow]);
    const { update } = installUpdateChain();
    mockSupabase.from.mockImplementation(() => ({
      ...selectChain,
      update,
    }));

    // Run 1: Stripe-side success, then network/5xx swallows the response.
    stripeCreateMock.mockRejectedValueOnce(
      Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }),
    );
    // Run 2: same booking row, retried.
    stripeCreateMock.mockResolvedValueOnce({
      id: 'pi_first',
      status: 'requires_capture',
    });

    const { GET } = await import('@/app/api/cron/recapture-holds/route');
    await GET(buildRequest());
    await GET(buildRequest());

    expect(stripeCreateMock).toHaveBeenCalledTimes(2);
    const keyA = stripeCreateMock.mock.calls[0][1].idempotencyKey;
    const keyB = stripeCreateMock.mock.calls[1][1].idempotencyKey;
    expect(keyA).toBe(keyB);
    // Both runs key by today's date — same-day retry deduplicates at Stripe.
    expect(keyA).toMatch(/^reauth-bk_abc-\d{4}-\d{2}-\d{2}$/);
  });
});
