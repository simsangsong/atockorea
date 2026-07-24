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
import { durableIncrWindow, durableReadCount } from '@/lib/durable-rate-limit';

jest.mock('@/lib/durable-rate-limit', () => ({
  durableIncrWindow: jest.fn(),
  durableReadCount: jest.fn(),
}));

const incrMock = durableIncrWindow as jest.Mock;
const readMock = durableReadCount as jest.Mock;

const OPTS = { key: 'ops_dining:test_daily', windowSec: 86_400, cap: 100, alertRatio: 0.7 };

beforeEach(() => {
  jest.clearAllMocks();
  __resetLocalQuotaWindows();
});

describe('durable store available', () => {
  it('reports the durable count and flags itself trustworthy', async () => {
    incrMock.mockResolvedValue(42);
    const state = await noteQuotaCall(OPTS);
    expect(state.used).toBe(42);
    expect(state.durable).toBe(true);
    expect(state.ratio).toBeCloseTo(0.42);
    expect(state.shouldAlert).toBe(false);
    expect(state.exhausted).toBe(false);
  });

  it('raises the alert and exhausted flags at the thresholds', async () => {
    readMock.mockResolvedValue(70);
    expect((await readQuotaState(OPTS)).shouldAlert).toBe(true);
    readMock.mockResolvedValue(100);
    expect((await readQuotaState(OPTS)).exhausted).toBe(true);
  });
});

describe('🔴 durable store unavailable (the measured bug)', () => {
  beforeEach(() => {
    incrMock.mockRejectedValue(new Error('Upstash is not configured'));
    readMock.mockRejectedValue(new Error('Upstash is not configured'));
  });

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
    incrMock.mockRejectedValue(new Error('boom'));
    await expect(noteQuotaCall(OPTS)).resolves.toBeDefined();
    await expect(readQuotaState(OPTS)).resolves.toBeDefined();
  });

  it('reads zero before anything has been counted', async () => {
    expect((await readQuotaState(OPTS)).used).toBe(0);
  });
});
