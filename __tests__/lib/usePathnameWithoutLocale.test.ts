import { stripLocalePrefix } from '@/lib/usePathnameWithoutLocale';

describe('stripLocalePrefix', () => {
  it('strips a locale prefix from rewritten paths', () => {
    expect(stripLocalePrefix('/ko/mypage')).toBe('/mypage');
    expect(stripLocalePrefix('/ja/tours/list')).toBe('/tours/list');
    expect(stripLocalePrefix('/zh-CN/cart')).toBe('/cart');
    expect(stripLocalePrefix('/zh-TW/support')).toBe('/support');
    expect(stripLocalePrefix('/es/mypage/wishlist')).toBe('/mypage/wishlist');
  });

  it('returns "/" for a bare locale root', () => {
    expect(stripLocalePrefix('/ko')).toBe('/');
  });

  it('leaves bare (EN-canonical) paths untouched', () => {
    expect(stripLocalePrefix('/mypage')).toBe('/mypage');
    expect(stripLocalePrefix('/tours/list')).toBe('/tours/list');
    expect(stripLocalePrefix('/')).toBe('/');
  });

  it('does not strip look-alike segments that are not locales', () => {
    // '/korea-tours' must not lose 'ko'; '/jazz' must not lose 'ja'.
    expect(stripLocalePrefix('/korea-tours')).toBe('/korea-tours');
    expect(stripLocalePrefix('/jazz')).toBe('/jazz');
  });

  it('handles null/undefined defensively', () => {
    expect(stripLocalePrefix(null)).toBe('/');
    expect(stripLocalePrefix(undefined)).toBe('/');
  });
});
