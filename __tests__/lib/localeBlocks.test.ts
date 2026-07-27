/**
 * @jest-environment node
 *
 * The G1 gate is only worth having if it bites. A scanner that reports zero
 * because its regex never matched looks exactly like a clean codebase — the
 * "성공한 척하는 실패" this repo keeps running into. So the scanner is tested
 * against the real defect it exists to catch, and against the shapes it must
 * NOT flag.
 */
import { findIncompleteLocaleBlocks } from '@/lib/audit/localeBlocks';

const LOCALES = ['en', 'ko', 'zh', 'ja', 'es', 'fr', 'de', 'ru', 'it'] as const;
const scan = (src: string) => findIncompleteLocaleBlocks(src, LOCALES);

describe('findIncompleteLocaleBlocks', () => {
  it('🔴 catches the actual vision-ask defect (5 locales, room ships 9)', () => {
    // The exact shape that answered French guests in English for weeks.
    const src = `
      const LOCALE_NAME: Record<string, string> = {
        en: 'English',
        ko: 'Korean',
        ja: 'Japanese',
        es: 'Spanish',
        zh: 'Simplified Chinese',
      };
    `;
    const [block] = scan(src);
    expect(block).toBeDefined();
    expect(block.missing).toEqual(['fr', 'de', 'ru', 'it']);
  });

  it('is silent on a complete block', () => {
    const src = `
      const COPY: Record<string, string> = {
        en: 'a', ko: 'b', zh: 'c', ja: 'd', es: 'e', fr: 'f', de: 'g', ru: 'h', it: 'i',
      };
    `;
    expect(scan(src)).toEqual([]);
  });

  it('reports the line so the failure is actionable, not a scavenger hunt', () => {
    const src = ['// one', '// two', 'const C = {', "  en: 'a', ko: 'b', ja: 'c',", '};'].join('\n');
    expect(scan(src)[0].line).toBe(3);
  });

  describe('shapes it must not flag', () => {
    it('a Record keyed by a named type — tsc already guards that', () => {
      const src = `
        const LABELS: Record<WeatherLocale, string> = {
          en: 'clear', ko: '맑음', zh: '晴', es: 'despejado', ja: '晴れ',
        };
      `;
      expect(scan(src)).toEqual([]);
    });

    it('nested value objects that inherit an outer typed annotation', () => {
      // The real SKY_LABEL shape: the inner literals carry no annotation of
      // their own and sit far from the outer one.
      const entries = ['clear', 'cloudy', 'rain', 'snow', 'storm', 'fog']
        .map((k) => `  ${k}: { en: 'x', ko: 'x', zh: 'x', es: 'x', ja: 'x' },`)
        .join('\n');
      const src = `const SKY: Record<SkyState, Record<WeatherLocale, string>> = {\n${entries}\n};`;
      expect(scan(src)).toEqual([]);
    });

    it('a locale→locale mapping (no copy to translate)', () => {
      const src = `
        export const VIDEO_LANGUAGE_TO_ROOM_LOCALE: Record<string, RoomLocale> = {
          en: 'en', 'zh-Hant': 'zh', ja: 'ja', es: 'es',
        };
      `;
      expect(scan(src)).toEqual([]);
    });

    it('a config object with a stray locale-looking key', () => {
      const src = `
        const opts = { it: true, retries: 3, timeout: 500, verbose: false };
      `;
      expect(scan(src)).toEqual([]);
    });

    it('too few locale keys to be a locale map', () => {
      const src = `const x = { en: 1, de: 2 };`;
      expect(scan(src)).toEqual([]);
    });
  });

  it('handles several independent blocks in one file', () => {
    const src = `
      const A: Record<string, string> = { en: 'a', ko: 'b', ja: 'c' };
      const B: Record<string, string> = { en: 'a', ko: 'b', zh: 'c', ja: 'd', es: 'e', fr: 'f', de: 'g', ru: 'h', it: 'i' };
      const C: Record<string, string> = { en: 'a', ko: 'b', es: 'c' };
    `;
    expect(scan(src)).toHaveLength(2);
  });
});
