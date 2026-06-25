/**
 * Confirms the durable-aware wrappers behave identically to the in-memory
 * limiters when Upstash is NOT configured (the production-today path), so this
 * change is a no-op until UPSTASH_REDIS_REST_URL/TOKEN are provisioned.
 */
import { allowRequestDurable, __resetRequestRateLimit } from '@/lib/chatbot/requestRateLimit';
import {
  BOOKING_LOOKUP_LIMITS,
  checkBookingLookupAllowedDurable,
  recordBookingLookupAttemptDurable,
  recordBookingLookupFailureDurable,
  recordBookingLookupSuccessDurable,
  __resetBookingLookupRateLimit,
} from '@/lib/chatbot/bookingLookupRateLimit';

const origEnv = { ...process.env };

beforeEach(() => {
  // Ensure the durable path is OFF for these fallback tests.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  __resetRequestRateLimit();
  __resetBookingLookupRateLimit();
});

afterAll(() => {
  process.env.UPSTASH_REDIS_REST_URL = origEnv.UPSTASH_REDIS_REST_URL;
  process.env.UPSTASH_REDIS_REST_TOKEN = origEnv.UPSTASH_REDIS_REST_TOKEN;
});

describe('allowRequestDurable (unconfigured → in-memory fallback)', () => {
  it('allows up to perMinute then blocks', async () => {
    const cfg = { perMinute: 3, perHour: 100 };
    for (let i = 0; i < 3; i++) {
      const r = await allowRequestDurable('ns', 'k', cfg);
      expect(r.allowed).toBe(true);
    }
    const blocked = await allowRequestDurable('ns', 'k', cfg);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });
});

describe('booking lookup durable wrappers (unconfigured → in-memory fallback)', () => {
  const KEY = 'sess|1.2.3.4';

  it('rate-limits after perMinute attempts', async () => {
    for (let i = 0; i < BOOKING_LOOKUP_LIMITS.perMinute; i++) {
      expect((await checkBookingLookupAllowedDurable(KEY)).allowed).toBe(true);
      await recordBookingLookupAttemptDurable(KEY);
    }
    const gate = await checkBookingLookupAllowedDurable(KEY);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.reason).toBe('rate_limited');
  });

  it('locks after maxFailures and a success clears it', async () => {
    let tripped = false;
    for (let i = 0; i < BOOKING_LOOKUP_LIMITS.maxFailures; i++) {
      tripped = await recordBookingLookupFailureDurable(KEY);
    }
    expect(tripped).toBe(true);
    const locked = await checkBookingLookupAllowedDurable(KEY);
    expect(locked.allowed).toBe(false);
    if (!locked.allowed) expect(locked.reason).toBe('locked');

    await recordBookingLookupSuccessDurable(KEY);
    expect((await checkBookingLookupAllowedDurable(KEY)).allowed).toBe(true);
  });
});
