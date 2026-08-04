/**
 * Regression — the catalogue must not print a dollar amount under a won symbol.
 *
 * 🔴 Found on the live site, not in review. `fallbackPrice` read:
 *
 *     if (currency === 'KRW') return `₩${…}`;
 *     return `₩${…}`;                        // the USD path
 *
 * Both branches returned won, so /tours/list showed "₩93" for a $93 tour — about
 * seven cents — for every product in every locale, because every active tour is
 * priced in USD. The conditional looks like it branches, which is exactly why
 * reading the source did not catch it; only comparing the two return values does.
 *
 * The assertions below fail on that shape: they require the two currencies to
 * produce DIFFERENT symbols, so re-collapsing the branches cannot pass.
 */
import { fallbackPrice } from '@/components/tour/TourListCard';

describe('tour card price label', () => {
  it('prints USD with a dollar sign', () => {
    expect(fallbackPrice(93, 'USD')).toBe('$93');
    expect(fallbackPrice(39, 'USD')).toBe('$39');
    expect(fallbackPrice(456.99, 'USD')).toBe('$457');
  });

  it('prints KRW with a won sign', () => {
    expect(fallbackPrice(120000, 'KRW')).toBe('₩120,000');
  });

  it('never labels a non-KRW price with the won symbol', () => {
    // The mutation guard: identical branches make this fail.
    for (const currency of ['USD', 'EUR', 'JPY', '']) {
      expect(fallbackPrice(93, currency)).not.toContain('₩');
    }
    expect(fallbackPrice(93, 'USD')).not.toBe(fallbackPrice(93, 'KRW'));
  });

  it('is what the live catalogue actually needed — every active tour is USD', () => {
    // Live at the time of the fix: 17 active tours, all currency USD, $34–$456.99.
    // So the broken branch was not an edge case; it was the whole list page.
    expect(fallbackPrice(34, 'USD').startsWith('$')).toBe(true);
    expect(fallbackPrice(54, 'USD')).toBe('$54');
  });
});
