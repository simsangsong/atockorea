/**
 * P4 guide-console redesign — the guide reads previews in Korean (falls back to
 * the guest's original text). Layout (collapsible day-tools, plan/ledger sheets)
 * is a pixel/QA human gate; this locks the preview logic.
 */
import { koPreview } from '@/components/tour-mode/guide/GuideConsole';

describe('koPreview', () => {
  it('prefers the Korean translation', () => {
    expect(koPreview({ source_text: 'We are at the gate', translations: { ko: '문 앞이에요', en: 'We are at the gate' } })).toBe('문 앞이에요');
  });

  it('falls back to the original when no Korean translation exists', () => {
    expect(koPreview({ source_text: 'Nous sommes ici', translations: { fr: 'Nous sommes ici' } })).toBe('Nous sommes ici');
  });

  it('ignores an empty/whitespace Korean translation', () => {
    expect(koPreview({ source_text: 'hi', translations: { ko: '   ' } })).toBe('hi');
  });

  it('handles a missing message', () => {
    expect(koPreview(null)).toBe('아직 메시지 없음');
    expect(koPreview(undefined)).toBe('아직 메시지 없음');
  });
});
