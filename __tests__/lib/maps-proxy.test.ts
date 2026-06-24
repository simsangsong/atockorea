import {
  sanitizeStaticMapSearch,
  ALLOWED_STATIC_MAP_PARAMS,
  MAX_STATIC_MAP_QUERY_LENGTH,
} from '@/lib/maps-proxy';

describe('sanitizeStaticMapSearch (N19)', () => {
  it('keeps whitelisted parameters and preserves their values', () => {
    const res = sanitizeStaticMapSearch('?center=37.5,127.0&zoom=14&size=600x300&maptype=roadmap');
    expect(res.ok).toBe(true);
    if (res.ok) {
      const p = new URLSearchParams(res.search.slice(1));
      expect(p.get('center')).toBe('37.5,127.0');
      expect(p.get('zoom')).toBe('14');
      expect(p.get('size')).toBe('600x300');
      expect(p.get('maptype')).toBe('roadmap');
    }
  });

  it('drops a caller-supplied key (must never override the server key)', () => {
    const res = sanitizeStaticMapSearch('?center=0,0&zoom=5&key=STOLEN_KEY');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.search.includes('key=')).toBe(false);
      expect(res.search.includes('STOLEN_KEY')).toBe(false);
    }
  });

  it('drops unknown / arbitrary parameters', () => {
    const res = sanitizeStaticMapSearch('?center=0,0&evil=1&signature=abc&callback=x');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.search.includes('evil')).toBe(false);
      expect(res.search.includes('signature')).toBe(false);
      expect(res.search.includes('callback')).toBe(false);
      expect(res.search.includes('center=0%2C0')).toBe(true);
    }
  });

  it('works with or without a leading ?', () => {
    const a = sanitizeStaticMapSearch('center=0,0&zoom=3');
    const b = sanitizeStaticMapSearch('?center=0,0&zoom=3');
    expect(a).toEqual(b);
    expect(a.ok).toBe(true);
  });

  it('rejects a query with no valid parameters', () => {
    expect(sanitizeStaticMapSearch('?foo=1&bar=2')).toEqual({
      ok: false,
      reason: 'no_valid_params',
    });
    expect(sanitizeStaticMapSearch('')).toEqual({ ok: false, reason: 'no_valid_params' });
  });

  it('rejects an oversized query string', () => {
    const huge = '?center=' + '0'.repeat(MAX_STATIC_MAP_QUERY_LENGTH + 10);
    expect(sanitizeStaticMapSearch(huge)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('rejects a request that packs in too many parameters', () => {
    // 70 repeated markers exceeds MAX_STATIC_MAP_PARAMS (60)
    const many = '?' + Array.from({ length: 70 }, (_, i) => `markers=m${i}`).join('&');
    expect(sanitizeStaticMapSearch(many)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('does not allow key in the whitelist', () => {
    expect(ALLOWED_STATIC_MAP_PARAMS.has('key')).toBe(false);
  });
});
