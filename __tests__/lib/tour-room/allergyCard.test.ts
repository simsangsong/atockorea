/**
 * W4.3 / F1 — Korean restaurant card generator.
 */
import { koreanAllergyCardLines, ALLERGY_CARD_HEADER } from '@/lib/tour-room/allergyCard';

describe('koreanAllergyCardLines', () => {
  it('builds header + dietary lines + allergy note + closer', () => {
    const lines = koreanAllergyCardLines({ dietary: ['halal', 'no_seafood'], allergy_note: 'peanuts' })!;
    expect(lines[0]).toBe(ALLERGY_CARD_HEADER);
    expect(lines.join('\n')).toContain('할랄');
    expect(lines.join('\n')).toContain('해산물');
    expect(lines.join('\n')).toContain('⚠ 알레르기: peanuts');
    expect(lines[lines.length - 1]).toContain('감사');
  });

  it('ignores unknown dietary tags; null when nothing dietary', () => {
    expect(koreanAllergyCardLines({ dietary: ['unknown_tag'] })).toBeNull();
    expect(koreanAllergyCardLines({ dietary: [], allergy_note: '' })).toBeNull();
    expect(koreanAllergyCardLines(null)).toBeNull();
  });

  it('allergy note alone still makes a card', () => {
    const lines = koreanAllergyCardLines({ allergy_note: '갑각류' })!;
    expect(lines.join('\n')).toContain('갑각류');
  });
});
