/**
 * 로케일 매핑 단일 기준 — M2.
 *
 * `waLocaleKey`가 저장된 문구 조회와 코드 프리셋 선택 **양쪽**의 기준이다.
 * 두 곳이 다르게 접히면 같은 손님이 채널마다 다른 언어의 문구를 받는다.
 */

import { WA_LOCALES, WA_PRESETS, presetBodyForLocale, waLocaleKey } from '../presets';

describe('waLocaleKey', () => {
  it('keeps 번체 and 간체 apart — they are different work', () => {
    expect(waLocaleKey('zh-TW')).toBe('zh-TW');
    expect(waLocaleKey('zh_TW')).toBe('zh-TW');
    expect(waLocaleKey('zh-Hant')).toBe('zh-TW');
    expect(waLocaleKey('zh-CN')).toBe('zh');
    expect(waLocaleKey('zh')).toBe('zh');
  });

  it('drops the region for ordinary locales', () => {
    expect(waLocaleKey('en-GB')).toBe('en');
    expect(waLocaleKey('ja_JP')).toBe('ja');
    expect(waLocaleKey('es-MX')).toBe('es');
  });

  it('falls back to English for a language with no copy', () => {
    // fr/de/it/ru 은 아직 문구가 없다 — 빈 메시지 대신 영어가 나가야 한다.
    for (const missing of ['fr', 'de', 'it', 'ru']) {
      expect(waLocaleKey(missing)).toBe('en');
    }
    expect(waLocaleKey(null)).toBe('en');
    expect(waLocaleKey('')).toBe('en');
  });

  it('only ever returns a key the presets actually have', () => {
    for (const input of ['en', 'ko', 'zh-TW', 'pt-BR', 'xx', null, undefined]) {
      expect(WA_LOCALES).toContain(waLocaleKey(input));
    }
  });
});

describe('presetBodyForLocale', () => {
  const preset = WA_PRESETS.find((p) => p.key === 'pickup_d1')!;

  it('agrees with waLocaleKey for every input', () => {
    for (const input of ['en', 'ko', 'ja', 'zh-CN', 'zh-TW', 'es-MX', 'de', null]) {
      expect(presetBodyForLocale(preset, input)).toBe(preset.bodies[waLocaleKey(input)]);
    }
  });

  it('carries the weather tokens in every locale of the D-1 preset', () => {
    // 한 로케일이라도 빠지면 그 언어 손님만 날씨 안내를 못 받는다.
    for (const locale of WA_LOCALES) {
      expect(preset.bodies[locale]).toContain('{weather}');
      expect(preset.bodies[locale]).toContain('{clothing}');
    }
  });

  it('does not put weather in presets where it would be wrong', () => {
    // D-7 확정 안내의 예보는 맞을 수 없고, 종료 감사 문구에는 의미가 없다.
    for (const key of ['confirm_d7', 'thanks'] as const) {
      const other = WA_PRESETS.find((p) => p.key === key)!;
      for (const locale of WA_LOCALES) {
        expect(other.bodies[locale]).not.toContain('{weather}');
      }
    }
  });
});
