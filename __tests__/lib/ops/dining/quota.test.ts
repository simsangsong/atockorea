/**
 * The daily quota counter (§5.7 R-3).
 *
 * 🔴 The regression this file exists for: with Upstash unconfigured, the durable
 * helpers THROW, and the old counters caught the throw and returned `used: 0`.
 * A seeding run that had just spent 10 Kakao calls reported `0/30000 (0.0%)`,
 * and the 70% brake it feeds could never fire. The counter is the only thing
 * standing between a runaway loop and a burned daily budget, so "it silently
 * counts nothing" is a real outage of a safety control, not a cosmetic bug.
 */

import {
  __resetLocalQuotaWindows,
  noteQuotaCall,
  readQuotaState,
} from '@/lib/ops/dining/quota';
import { incrWindowCounted, readWindowCounted } from '@/lib/durable-rate-limit';

// The fallback now lives in the shared primitive, so the mock wraps THAT and
// keeps the real implementation underneath: the "unavailable" block below runs
// the genuine code path (jest has no Upstash env, so the durable call really
// throws), while the "available" block overrides the return value.
jest.mock('@/lib/durable-rate-limit', () => {
  const actual = jest.requireActual('@/lib/durable-rate-limit');
  return {
    ...actual,
    incrWindowCounted: jest.fn(actual.incrWindowCounted),
    readWindowCounted: jest.fn(actual.readWindowCounted),
  };
});

const incrMock = incrWindowCounted as jest.Mock;
const readMock = readWindowCounted as jest.Mock;
const actualCounters = jest.requireActual('@/lib/durable-rate-limit');

beforeEach(() => {
  incrMock.mockImplementation(actualCounters.incrWindowCounted);
  readMock.mockImplementation(actualCounters.readWindowCounted);
});

const OPTS = { key: 'ops_dining:test_daily', windowSec: 86_400, cap: 100, alertRatio: 0.7 };

beforeEach(() => {
  jest.clearAllMocks();
  __resetLocalQuotaWindows();
});

describe('durable store available', () => {
  it('reports the durable count and flags itself trustworthy', async () => {
    incrMock.mockResolvedValue({ count: 42, durable: true });
    const state = await noteQuotaCall(OPTS);
    expect(state.used).toBe(42);
    expect(state.durable).toBe(true);
    expect(state.ratio).toBeCloseTo(0.42);
    expect(state.shouldAlert).toBe(false);
    expect(state.exhausted).toBe(false);
  });

  it('raises the alert and exhausted flags at the thresholds', async () => {
    readMock.mockResolvedValue({ count: 70, durable: true });
    expect((await readQuotaState(OPTS)).shouldAlert).toBe(true);
    readMock.mockResolvedValue({ count: 100, durable: true });
    expect((await readQuotaState(OPTS)).exhausted).toBe(true);
  });
});

describe('🔴 durable store unavailable (the measured bug)', () => {
  // No mocking here on purpose: jest runs without UPSTASH_REDIS_REST_URL, so
  // the durable call genuinely throws and we exercise the real fallback.

  it('counts calls in-process instead of silently reporting zero', async () => {
    for (let i = 0; i < 10; i += 1) await noteQuotaCall(OPTS);
    const state = await readQuotaState(OPTS);
    expect(state.used).toBe(10); // was 0 — the whole defect
    expect(state.ratio).toBeCloseTo(0.1);
  });

  it('admits the count is not authoritative', async () => {
    expect((await noteQuotaCall(OPTS)).durable).toBe(false);
    expect((await readQuotaState(OPTS)).durable).toBe(false);
  });

  it('🔴 still brakes: the in-process count reaches the alert ratio', async () => {
    // The realistic burn shape is one long-running process in a loop (the
    // seeding script over 30 POIs). In-process counting stops exactly that.
    for (let i = 0; i < 70; i += 1) await noteQuotaCall(OPTS);
    const state = await readQuotaState(OPTS);
    expect(state.shouldAlert).toBe(true);
    expect(state.exhausted).toBe(false);
  });

  it('keeps separate providers on separate counters', async () => {
    await noteQuotaCall(OPTS);
    await noteQuotaCall(OPTS);
    const other = { ...OPTS, key: 'ops_dining:other_daily' };
    await noteQuotaCall(other);
    expect((await readQuotaState(OPTS)).used).toBe(2);
    expect((await readQuotaState(other)).used).toBe(1);
  });

  it('never throws out of the counter, whatever the store does', async () => {
    // The no-throw guarantee lives in the shared primitive, so assert it there:
    // with no Upstash env the durable call really fails, and the caller still
    // gets a value. (Mocking the primitive itself to reject would be testing a
    // state that cannot occur — it is the thing that swallows the failure.)
    await expect(actualCounters.incrWindowCounted(OPTS.key, OPTS.windowSec)).resolves.toBeDefined();
    await expect(actualCounters.readWindowCounted(OPTS.key)).resolves.toBeDefined();
  });

  it('reads zero before anything has been counted', async () => {
    expect((await readQuotaState(OPTS)).used).toBe(0);
  });
});
