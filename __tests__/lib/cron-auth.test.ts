import { checkCronAuth, extractCronToken, readCronSecret } from '@/lib/cron-auth';

describe('extractCronToken', () => {
  it('reads the bearer token from an Authorization header', () => {
    expect(extractCronToken('Bearer s3cret', null)).toBe('s3cret');
  });

  it('falls back to the X-Cron-Secret header', () => {
    expect(extractCronToken(null, 's3cret')).toBe('s3cret');
  });

  it('prefers a valid Bearer header over X-Cron-Secret', () => {
    expect(extractCronToken('Bearer fromBearer', 'fromHeader')).toBe('fromBearer');
  });

  it('ignores a non-Bearer Authorization header and uses X-Cron-Secret', () => {
    expect(extractCronToken('Basic abc', 'fromHeader')).toBe('fromHeader');
  });

  it('returns undefined when no token is present', () => {
    expect(extractCronToken(null, null)).toBeUndefined();
    expect(extractCronToken(undefined, undefined)).toBeUndefined();
    expect(extractCronToken('Bearer', null)).toBeUndefined(); // no space → not a Bearer token
  });

  it('treats an empty bearer value as an empty string token', () => {
    expect(extractCronToken('Bearer ', null)).toBe('');
  });
});

describe('checkCronAuth', () => {
  const SECRET = 'top-secret';

  it('authorizes a matching Bearer token', () => {
    expect(checkCronAuth({ authorization: `Bearer ${SECRET}` }, SECRET)).toBe('authorized');
  });

  it('authorizes a matching X-Cron-Secret header', () => {
    expect(checkCronAuth({ xCronSecret: SECRET }, SECRET)).toBe('authorized');
  });

  it('forbids a wrong token', () => {
    expect(checkCronAuth({ authorization: 'Bearer nope' }, SECRET)).toBe('forbidden');
  });

  it('forbids a request with no credentials (PA-1 regression: unauthenticated GET/POST)', () => {
    expect(checkCronAuth({}, SECRET)).toBe('forbidden');
    expect(checkCronAuth({ authorization: null, xCronSecret: null }, SECRET)).toBe('forbidden');
  });

  it('fails closed (unconfigured) when no secret is set, even with a token', () => {
    expect(checkCronAuth({ authorization: 'Bearer anything' }, undefined)).toBe('unconfigured');
    expect(checkCronAuth({ authorization: 'Bearer anything' }, '')).toBe('unconfigured');
  });

  it('does not authorize an empty token against an empty/undefined secret', () => {
    // guards against the "" === "" false-positive: empty secret is unconfigured
    expect(checkCronAuth({ authorization: 'Bearer ' }, '')).toBe('unconfigured');
  });
});

describe('readCronSecret', () => {
  const orig = { ...process.env };
  afterEach(() => {
    process.env.CRON_SECRET = orig.CRON_SECRET;
    process.env.VERCEL_CRON_SECRET = orig.VERCEL_CRON_SECRET;
  });

  it('prefers CRON_SECRET over VERCEL_CRON_SECRET', () => {
    process.env.CRON_SECRET = 'primary';
    process.env.VERCEL_CRON_SECRET = 'fallback';
    expect(readCronSecret()).toBe('primary');
  });

  it('falls back to VERCEL_CRON_SECRET', () => {
    delete process.env.CRON_SECRET;
    process.env.VERCEL_CRON_SECRET = 'fallback';
    expect(readCronSecret()).toBe('fallback');
  });

  it('returns undefined when neither is set', () => {
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL_CRON_SECRET;
    expect(readCronSecret()).toBeUndefined();
  });
});
