import { formatBubbleTime, formatDateSeparator, LOCALE_TAG } from '@/lib/tour-room/timeFormat';

const ISO = '2026-07-15T05:35:00Z'; // 14:35 KST, Wednesday

describe('formatBubbleTime', () => {
  // NOTE: assertions stay ICU-agnostic (a small-icu Node renders ko day
  // periods as "PM" instead of "오후"); we assert the clock reading, which is
  // locale-data independent.
  it('formats short time in the given zone for every locale', () => {
    expect(formatBubbleTime(ISO, 'ko', 'Asia/Seoul')).toContain('2:35');
    expect(formatBubbleTime(ISO, 'en', 'Asia/Seoul')).toMatch(/2:35\s?PM/i);
    expect(formatBubbleTime(ISO, 'ja', 'Asia/Seoul')).toContain('35');
    expect(formatBubbleTime(ISO, 'es', 'Asia/Seoul')).toContain('35');
    expect(formatBubbleTime(ISO, 'zh', 'Asia/Seoul')).toContain('35');
  });

  it('returns empty string on malformed input', () => {
    expect(formatBubbleTime('nope', 'en')).toBe('');
  });
});

describe('formatDateSeparator', () => {
  it('formats the KST day with weekday per locale', () => {
    expect(formatDateSeparator(ISO, 'en')).toMatch(/Wednesday, July 15/);
    // ICU-agnostic for non-English: must at least carry the day-of-month.
    expect(formatDateSeparator(ISO, 'ko')).toContain('15');
    expect(formatDateSeparator(ISO, 'zh')).toContain('15');
  });

  it('shows a localized Today for the current day key', () => {
    expect(formatDateSeparator(ISO, 'ko', { dayKey: '2026-07-15', todayDayKey: '2026-07-15' })).toBe('오늘');
    expect(formatDateSeparator(ISO, 'en', { dayKey: '2026-07-15', todayDayKey: '2026-07-16' })).toMatch(/July 15/);
  });

  it('has a BCP47 tag for every room locale', () => {
    expect(Object.keys(LOCALE_TAG).sort()).toEqual(['en', 'es', 'ja', 'ko', 'zh']);
  });
});
