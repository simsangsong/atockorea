import { serializeFilters } from '@/lib/admin/useUrlFilters';

describe('serializeFilters (W1.6)', () => {
  it('serializes set values in stable (sorted) order', () => {
    expect(serializeFilters({ status: 'paid', source: 'web' })).toBe('source=web&status=paid');
  });

  it('drops null, undefined and empty-string values', () => {
    expect(
      serializeFilters({ status: 'paid', source: null, q: undefined, range: '' }),
    ).toBe('status=paid');
  });

  it('returns an empty string when nothing is set', () => {
    expect(serializeFilters({ a: null, b: '', c: undefined })).toBe('');
  });

  it('url-encodes values', () => {
    expect(serializeFilters({ q: 'a b&c' })).toBe('q=a+b%26c');
  });

  it('is stable regardless of input key order', () => {
    const a = serializeFilters({ z: '1', a: '2', m: '3' });
    const b = serializeFilters({ a: '2', m: '3', z: '1' });
    expect(a).toBe(b);
  });
});
