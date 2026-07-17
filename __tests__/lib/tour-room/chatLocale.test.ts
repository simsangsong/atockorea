/**
 * Language-agnostic chat bridge (2026-07-18) — locale normalization, target
 * merging, and viewer chat-language derivation.
 */
import {
  deriveChatLocale,
  mergeTranslationTargets,
  normalizeChatLocale,
  MAX_TRANSLATION_TARGETS,
} from '@/lib/tour-room/chatLocale';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const msg = (over: Partial<RoomMessage> & Record<string, unknown>): RoomMessage => ({
  id: `m-${Math.abs(JSON.stringify(over).length)}-${String(over.source_locale)}`,
  sender_role: 'customer',
  source_text: 'x',
  created_at: '2026-07-18T00:00:00Z',
  ...over,
});

describe('normalizeChatLocale', () => {
  it('folds region variants to base codes and rejects junk', () => {
    expect(normalizeChatLocale('fr-FR')).toBe('fr');
    expect(normalizeChatLocale('PT_br')).toBe('pt');
    expect(normalizeChatLocale('tha')).toBe('tha');
    expect(normalizeChatLocale('und')).toBeNull();
    expect(normalizeChatLocale('')).toBeNull();
    expect(normalizeChatLocale('12')).toBeNull();
    expect(normalizeChatLocale(null)).toBeNull();
  });
});

describe('mergeTranslationTargets', () => {
  it('unions room locales with detected chat locales, room first, capped', () => {
    expect(mergeTranslationTargets(['en', 'ko'], ['fr-FR', 'ko', null, 'de'])).toEqual([
      'en',
      'ko',
      'fr',
      'de',
    ]);
    const many = mergeTranslationTargets(
      ['en', 'ko', 'zh', 'ja', 'es'],
      ['fr', 'de', 'th', 'it', 'ru'],
    );
    expect(many).toHaveLength(MAX_TRANSLATION_TARGETS);
    expect(many.slice(0, 5)).toEqual(['en', 'ko', 'zh', 'ja', 'es']); // cap never drops UI locales
  });
});

describe('deriveChatLocale', () => {
  it('uses the newest PLAIN customer message; presets/system/optimistic are ignored', () => {
    const messages = [
      msg({ source_locale: 'fr' }),
      msg({ sender_role: 'driver', source_locale: 'ko' }),
      msg({ source_locale: 'en', metadata: { kind: 'quick_reply' } }),
      msg({ source_locale: 'de', _local: 'sending' }),
    ];
    expect(deriveChatLocale(messages)).toBe('fr');
  });

  it('falls back to the participant row, then null', () => {
    expect(deriveChatLocale([], 'th')).toBe('th');
    expect(deriveChatLocale([], undefined)).toBeNull();
    expect(deriveChatLocale([msg({ source_locale: 'und' })], null)).toBeNull();
  });
});
