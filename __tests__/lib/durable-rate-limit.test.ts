import {
  isDurableRateLimitConfigured,
  evaluatePriorAttemptWindows,
  evaluatePostIncrementWindow,
  evaluateSlidingWindow,
  durableIncrWindow,
  durableReadWithTtl,
  requestGate,
  clientIpKey,
  __resetRequestGateMemory,
  incrWindowCounted,
  readWindowCounted,
  incrLocalWindow,
  readLocalWindow,
  __resetLocalWindows,
} from '@/lib/durable-rate-limit';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('isDurableRateLimitConfigured', () => {
  const orig = { ...process.env };
  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = orig.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = orig.UPSTASH_REDIS_REST_TOKEN;
  });

  it('is false when either env var is missing', () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(isDurableRateLimitConfigured()).toBe(false);
    process.env.UPSTASH_REDIS_REST_URL = 'https://x.upstash.io';
    expect(isDurableRateLimitConfigured()).toBe(false);
  });

  it('is true when both env vars are present', () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://x.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
    expect(isDurableRateLimitConfigured()).toBe(true);
  });
});

describe('evaluatePriorAttemptWindows (check before record)', () => {
  const base = { perMinute: 5, perHour: 20, minuteMs: MINUTE, hourMs: HOUR };

  it('allows while under both caps', () => {
    expect(evaluatePriorAttemptWindows({ ...base, priorMinute: 4, priorHour: 10 })).toEqual({
      allowed: true,
      retryAfterMs: 0,
    });
  });

  it('blocks (minute) once prior minute attempts reach the cap', () => {
    expect(evaluatePriorAttemptWindows({ ...base, priorMinute: 5, priorHour: 6 })).toEqual({
      allowed: false,
      retryAfterMs: MINUTE,
    });
  });

  it('blocks (hour) once prior hour attempts reach the cap', () => {
    expect(evaluatePriorAttemptWindows({ ...base, priorMinute: 1, priorHour: 20 })).toEqual({
      allowed: false,
      retryAfterMs: HOUR,
    });
  });
});

describe('evaluatePostIncrementWindow (consume then check)', () => {
  it('allows up to max hits', () => {
    expect(evaluatePostIncrementWindow(5, 5, MINUTE)).toEqual({ allowed: true, retryAfterMs: 0 });
  });
  it('blocks once the count exceeds max', () => {
    expect(evaluatePostIncrementWindow(6, 5, MINUTE)).toEqual({
      allowed: false,
      retryAfterMs: MINUTE,
    });
  });
});

describe('evaluateSlidingWindow (in-memory fallback core)', () => {
  it('allows then blocks within the minute window and consumes only when allowed', () => {
    const now = 1_000_000;
    const r1 = evaluateSlidingWindow([now, now, now], 3, 100, now); // already 3 in last minute
    expect(r1.decision.allowed).toBe(false);
    expect(r1.kept).toHaveLength(3); // not consumed when blocked
    const r2 = evaluateSlidingWindow([now, now], 3, 100, now); // 2 so far → allowed
    expect(r2.decision.allowed).toBe(true);
    expect(r2.kept).toHaveLength(3); // consumed
  });

  it('drops timestamps older than an hour', () => {
    const now = 5_000_000;
    const old = now - 2 * 60 * 60 * 1000;
    const r = evaluateSlidingWindow([old, old], 3, 5, now);
    expect(r.decision.allowed).toBe(true);
    expect(r.kept).toEqual([now]); // old ones pruned, new one added
  });
});

describe('requestGate (unconfigured → in-memory)', () => {
  const orig = { ...process.env };
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __resetRequestGateMemory();
  });
  afterAll(() => {
    process.env.UPSTASH_REDIS_REST_URL = orig.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = orig.UPSTASH_REDIS_REST_TOKEN;
  });

  it('allows up to perMinute then blocks for that key', async () => {
    const opts = { namespace: 'contact', key: 'ip:1.2.3.4', perMinute: 2, perHour: 100 };
    expect((await requestGate(opts)).allowed).toBe(true);
    expect((await requestGate(opts)).allowed).toBe(true);
    const blocked = await requestGate(opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('isolates different keys', async () => {
    const base = { namespace: 'contact', perMinute: 1, perHour: 100 };
    expect((await requestGate({ ...base, key: 'ip:a' })).allowed).toBe(true);
    expect((await requestGate({ ...base, key: 'ip:a' })).allowed).toBe(false);
    expect((await requestGate({ ...base, key: 'ip:b' })).allowed).toBe(true);
  });
});

describe('clientIpKey', () => {
  it('uses the first x-forwarded-for hop', () => {
    expect(clientIpKey(new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }))).toBe('ip:9.9.9.9');
  });
  it('falls back to x-real-ip then unknown', () => {
    expect(clientIpKey(new Headers({ 'x-real-ip': '8.8.8.8' }))).toBe('ip:8.8.8.8');
    expect(clientIpKey(new Headers())).toBe('ip:unknown');
  });
});

describe('Upstash REST I/O (mocked fetch)', () => {
  const orig = { ...process.env };
  const realFetch = global.fetch;
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://x.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
  });
  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = orig.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = orig.UPSTASH_REDIS_REST_TOKEN;
    global.fetch = realFetch;
  });

  it('durableIncrWindow returns the post-increment count from the pipeline', async () => {
    const calls: any[] = [];
    global.fetch = (async (url: any, init: any) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return {
        ok: true,
        json: async () => [{ result: 3 }, { result: 1 }],
      } as any;
    }) as any;

    const count = await durableIncrWindow('bl:m:key', 60);
    expect(count).toBe(3);
    expect(calls[0].url).toBe('https://x.upstash.io/pipeline');
    expect(calls[0].body[0]).toEqual(['INCR', 'bl:m:key']);
    expect(calls[0].body[1]).toEqual(['EXPIRE', 'bl:m:key', 60, 'NX']);
  });

  it('durableReadWithTtl reports presence + positive ttl', async () => {
    global.fetch = (async () => ({
      ok: true,
      json: async () => [{ result: '1' }, { result: 1800000 }],
    })) as any;
    expect(await durableReadWithTtl('bl:lock:key')).toEqual({ present: true, pttlMs: 1800000 });
  });

  it('throws on a non-ok HTTP response (caller falls back)', async () => {
    global.fetch = (async () => ({ ok: false, status: 500, json: async () => [] })) as any;
    await expect(durableIncrWindow('k', 60)).rejects.toThrow(/HTTP 500/);
  });

  it('throws when a pipeline entry carries an error', async () => {
    global.fetch = (async () => ({
      ok: true,
      json: async () => [{ error: 'WRONGTYPE' }],
    })) as any;
    await expect(durableReadWithTtl('k')).rejects.toThrow(/Upstash error/);
  });
});

// ---------------------------------------------------------------------------
// 🔴 Budget counters that must not fail open (measured 2026-07-25)
//
// `requestGate` always degraded to an in-memory limiter when Upstash was
// absent, but every DIRECT caller of `durableIncrWindow` — the concierge
// Tier-1 daily cap, the generated-content budget, the dining translation
// budget — wrapped it in `catch { return false }`. Upstash is unconfigured, so
// those calls threw on EVERY invocation and each guard answered "budget
// available" forever. Three separate caps, none of which had ever bound.
// ---------------------------------------------------------------------------

describe('incrWindowCounted / readWindowCounted', () => {
  beforeEach(() => {
    __resetLocalWindows();
    // An earlier suite assigns these env vars and restores them to the STRING
    // "undefined" (Node stringifies), which reads as configured. Delete them so
    // this block really exercises the unconfigured path.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it('counts locally instead of throwing when the durable store is absent', async () => {
    expect(isDurableRateLimitConfigured()).toBe(false);
    const first = await incrWindowCounted('budget:test', 60);
    expect(first).toEqual({ count: 1, durable: false });
    const second = await incrWindowCounted('budget:test', 60);
    expect(second.count).toBe(2);
  });

  it('admits the count is process-local so callers do not print it as global', async () => {
    await incrWindowCounted('budget:test', 60);
    expect((await readWindowCounted('budget:test')).durable).toBe(false);
  });

  it('reads zero for an untouched key rather than throwing', async () => {
    await expect(readWindowCounted('budget:never-touched')).resolves.toEqual({
      count: 0,
      durable: false,
    });
  });

  it('🔴 a daily cap built on it actually fires — the whole point', async () => {
    // Mirrors the shape of tier1BudgetExhausted / generationBudgetExhausted.
    const cap = 5;
    const exhausted = async () => (await incrWindowCounted('budget:cap', 86_400)).count > cap;
    const verdicts: boolean[] = [];
    for (let i = 0; i < 7; i += 1) verdicts.push(await exhausted());
    // Under the old `catch { return false }` every entry here was `false`.
    expect(verdicts).toEqual([false, false, false, false, false, true, true]);
  });

  it('keeps separate keys on separate windows', async () => {
    await incrWindowCounted('budget:a', 60);
    await incrWindowCounted('budget:a', 60);
    await incrWindowCounted('budget:b', 60);
    expect((await readWindowCounted('budget:a')).count).toBe(2);
    expect((await readWindowCounted('budget:b')).count).toBe(1);
  });

  it('rolls the window over once it expires', async () => {
    const t0 = 1_000_000;
    expect(incrLocalWindow('budget:roll', 60, t0)).toBe(1);
    expect(incrLocalWindow('budget:roll', 60, t0 + 59_000)).toBe(2);
    expect(incrLocalWindow('budget:roll', 60, t0 + 60_001)).toBe(1);
    expect(readLocalWindow('budget:roll', t0 + 120_002)).toBe(0);
  });
});
