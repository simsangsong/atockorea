import {
  isDurableRateLimitConfigured,
  evaluatePriorAttemptWindows,
  evaluatePostIncrementWindow,
  durableIncrWindow,
  durableReadWithTtl,
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
