/**
 * V1 대면 통역 문구. 지키는 불변식은 하나가 결정적이다 — 상대 면은 **언제나
 * 한국어**여야 한다. 손님 로케일로 번역되면 식당 주인이 이탈리아어 버튼을 본다.
 */
import { INTERPRET_COPY, interpretCopyFor } from '@/lib/tour-room/interpretCopy';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

describe('interpretCopy', () => {
  it('ROOM_LOCALES 전부를 덮는다', () => {
    expect(Object.keys(INTERPRET_COPY).sort()).toEqual([...ROOM_LOCALES].sort());
  });

  it('🔴 상대 면 버튼은 어느 로케일에서도 한국어다', () => {
    for (const locale of ROOM_LOCALES) {
      expect(INTERPRET_COPY[locale].localPrompt).toBe('눌러서 한국어로 말하기');
    }
  });

  it('손님 면 버튼은 로케일마다 다르다 (복사 붙여넣기 사고 감지)', () => {
    const prompts = ROOM_LOCALES.map((l) => INTERPRET_COPY[l].guestPrompt);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it('빈 문구가 없다', () => {
    for (const locale of ROOM_LOCALES) {
      for (const [key, value] of Object.entries(INTERPRET_COPY[locale])) {
        expect(`${locale}.${key}=${value}`).toMatch(/=\S/);
      }
    }
  });

  it('모르는 로케일은 영어로 떨어진다 — 화면이 비면 안 된다', () => {
    expect(interpretCopyFor('pt')).toBe(INTERPRET_COPY.en);
    expect(interpretCopyFor(null)).toBe(INTERPRET_COPY.en);
    expect(interpretCopyFor('')).toBe(INTERPRET_COPY.en);
    expect(interpretCopyFor('ja')).toBe(INTERPRET_COPY.ja);
  });
});
