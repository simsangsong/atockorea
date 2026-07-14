/**
 * T1.7 — quick-reply preset constants: 8 presets, all 5 locales filled,
 * unique keys (§M-2 ② — these ARE the translations; no runtime LLM).
 */
import { getQuickReplyPreset, QUICK_REPLY_PRESETS } from '@/lib/tour-room/quickReplies';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

describe('QUICK_REPLY_PRESETS', () => {
  it('has exactly 8 presets with unique keys', () => {
    expect(QUICK_REPLY_PRESETS).toHaveLength(8);
    expect(new Set(QUICK_REPLY_PRESETS.map((p) => p.key)).size).toBe(8);
  });

  it('every preset carries a non-empty string for every room locale', () => {
    for (const preset of QUICK_REPLY_PRESETS) {
      for (const locale of ROOM_LOCALES) {
        expect(typeof preset.text[locale]).toBe('string');
        expect(preset.text[locale].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('getQuickReplyPreset resolves known keys and rejects garbage', () => {
    expect(getQuickReplyPreset('where_bus')?.text.ko).toBe('버스가 어디에 있나요?');
    expect(getQuickReplyPreset('nope')).toBeNull();
    expect(getQuickReplyPreset(null)).toBeNull();
    expect(getQuickReplyPreset(42)).toBeNull();
  });
});
