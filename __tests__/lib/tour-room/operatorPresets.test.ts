/**
 * T3-4 — operator situational presets (operator→guests, zero-LLM 5-locale).
 */
import { OPERATOR_PRESETS, getOperatorPreset } from '@/lib/tour-room/operatorPresets';

const LOCALES = ['en', 'ko', 'ja', 'es', 'zh'] as const;

describe('OPERATOR_PRESETS', () => {
  it('every preset has a unique key, an emoji, and all 5 room locales', () => {
    const keys = new Set<string>();
    for (const preset of OPERATOR_PRESETS) {
      expect(keys.has(preset.key)).toBe(false);
      keys.add(preset.key);
      expect(preset.emoji).toBeTruthy();
      for (const loc of LOCALES) expect((preset.text as Record<string, string>)[loc]?.trim()).toBeTruthy();
    }
    // The audit's named moments are covered.
    expect(keys.has('follow_me')).toBe(true);
    expect(keys.has('buy_tickets_here')).toBe(true);
  });

  it('getOperatorPreset resolves known keys and rejects unknown / non-strings', () => {
    expect(getOperatorPreset('follow_me')?.text.ko).toContain('따라오세요');
    expect(getOperatorPreset('buy_tickets_here')?.text.en.toLowerCase()).toContain('ticket');
    expect(getOperatorPreset('nope')).toBeNull();
    expect(getOperatorPreset(123)).toBeNull();
    expect(getOperatorPreset(null)).toBeNull();
  });
});
