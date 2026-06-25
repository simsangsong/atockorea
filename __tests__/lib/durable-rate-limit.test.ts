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
