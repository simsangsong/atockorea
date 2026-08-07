/**
 * `wmoWeatherLabel` returned English regardless of locale, so every non-English
 * tour page printed "Today · Mainly clear" inside an otherwise translated
 * weather card. The condition bucket and its wording are now separate, and the
 * wording is looked up per locale.
 */
import { wmoCondition, wmoWeatherLabel } from '@/lib/weather/open-meteo';

/** The ten the site routes — `lib/locale.ts` is the source of that list. */
const LOCALES = ['en', 'ko', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de', 'it', 'ru'] as const;

/** One representative code per bucket, so a missing bucket fails loudly. */
const CODES = [0, 1, 2, 3, 45, 51, 61, 71, 80, 85, 95, 99];

describe('weather condition wording', () => {
  it('every locale words every condition, and none of them fall back to English', () => {
    const english = new Map(CODES.map((c) => [c, wmoWeatherLabel(c, 'en')]));
    const leaks: string[] = [];
    for (const locale of LOCALES) {
      if (locale === 'en') continue;
      for (const code of CODES) {
        const label = wmoWeatherLabel(code, locale);
        if (!label) leaks.push(`${locale} ${code}: empty`);
        else if (label === english.get(code)) leaks.push(`${locale} ${code}: still "${label}"`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it('accepts the routing segment as well as the content locale', () => {
    // The site routes Simplified Chinese as `zh-CN`; the content locale is `zh`.
    // Both must resolve, or the weather card is English on /zh-CN/ alone.
    expect(wmoWeatherLabel(1, 'zh-CN')).toBe(wmoWeatherLabel(1, 'zh'));
    expect(wmoWeatherLabel(1, 'ZH-TW')).toBe(wmoWeatherLabel(1, 'zh-TW'));
  });

  it('falls back to English for an unknown locale rather than rendering blank', () => {
    expect(wmoWeatherLabel(0, 'pt')).toBe(wmoWeatherLabel(0, 'en'));
    expect(wmoWeatherLabel(0, null)).toBe(wmoWeatherLabel(0, 'en'));
    expect(wmoWeatherLabel(0)).toBe(wmoWeatherLabel(0, 'en'));
  });

  it('keeps the bucket mapping the advisory logic depends on', () => {
    expect(wmoCondition(0)).toBe('clear');
    expect(wmoCondition(48)).toBe('fog');
    expect(wmoCondition(65)).toBe('rain');
    expect(wmoCondition(86)).toBe('snowShowers');
    expect(wmoCondition(99)).toBe('thunderstorm');
    expect(wmoCondition(4)).toBe('mixed');
  });
});
