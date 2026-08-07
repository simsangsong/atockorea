'use client';

/**
 * Composer emoji picker (사장님 2026-08-07) — the room's one home for emoticons.
 *
 * Until now the only emoji in the room lived in the bubble action sheet as a
 * 30-tile reaction grid, which meant a guest who wanted a 🎉 *in their message*
 * had no way to reach one without a system keyboard. This is the messenger
 * convention instead: an emoji button beside the "+", opening a tray docked on
 * the composer bar — same shell, same animation and safe-area handling as
 * ActionGrid, so the two trays are one language.
 *
 * It stays OPEN after a tap. Emoji come in runs ("😂😂"), and a picker that
 * closes on every pick makes the second one cost four taps.
 *
 * 「좀 더 고급스럽고 이쁘게」 (같은 날 후속) — the flat 30-tile wall became four
 * named shelves. The set change lives in `lib/tour-room/emoji.ts`; what changes
 * HERE is that the shelves are legible: a quiet 10px label above each, a tile
 * that lifts on press instead of flashing a grey box, and column gaps sized so
 * the glyphs breathe instead of touching.
 */

import { useEffect } from 'react';
import { EMOJI_GROUPS, type EmojiGroupKey } from '@/lib/tour-room/emoji';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const TITLE: Record<RoomLocale, string> = {
  en: 'Emoji',
  ko: '이모지',
  ja: '絵文字',
  es: 'Emojis',
  zh: '表情',
  'zh-TW': '表情',
  fr: 'Émojis',
  de: 'Emojis',
  ru: 'Эмодзи',
  it: 'Emoji',
};

/**
 * Shelf labels. Deliberately one short word each — they are wayfinding, not
 * headings, and a two-line label would out-shout the glyphs it sits over.
 */
const GROUP_LABEL: Record<EmojiGroupKey, Record<RoomLocale, string>> = {
  reactions: {
    en: 'Reactions', ko: '반응', ja: 'リアクション', es: 'Reacciones', zh: '互动',
    'zh-TW': '互動', fr: 'Réactions', de: 'Reaktionen', ru: 'Реакции', it: 'Reazioni',
  },
  mood: {
    en: 'Mood', ko: '기분', ja: '気持ち', es: 'Ánimo', zh: '心情',
    'zh-TW': '心情', fr: 'Humeur', de: 'Stimmung', ru: 'Настроение', it: 'Umore',
  },
  travel: {
    en: 'Travel', ko: '여행', ja: '旅', es: 'Viaje', zh: '旅行',
    'zh-TW': '旅行', fr: 'Voyage', de: 'Reise', ru: 'Путешествие', it: 'Viaggio',
  },
  day: {
    en: 'The day', ko: '하루', ja: '一日', es: 'El día', zh: '行程',
    'zh-TW': '行程', fr: 'La journée', de: 'Der Tag', ru: 'День', it: 'La giornata',
  },
};

export default function EmojiPicker({
  open,
  onClose,
  onPick,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  locale: RoomLocale;
}) {
  // Escape closes, matching ActionGrid and Sheet. Inline, not modal: it must
  // not trap focus or lock the body, because the input it feeds sits right
  // below it and the caret has to stay live.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="group"
      aria-label={TITLE[locale] ?? TITLE.en}
      data-testid="emoji-picker"
      className="tr-anim-panel-in max-h-[42dvh] overflow-y-auto border-t border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 pt-2.5"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      {EMOJI_GROUPS.map((group) => (
        <section key={group.key} className="mb-1 last:mb-0">
          <h3
            className="tr-meta text-cjk-safe px-2 pb-0.5 pt-1 font-semibold uppercase tracking-[0.08em] text-[var(--tr-ink-3)]"
            data-testid={`emoji-group-${group.key}`}
          >
            {GROUP_LABEL[group.key][locale] ?? GROUP_LABEL[group.key].en}
          </h3>
          <div className="grid grid-cols-8 justify-items-center">
            {group.emoji.map((emoji) => (
              <button
                key={emoji}
                type="button"
                // onMouseDown + preventDefault: a plain click blurs the textarea
                // first, and a blurred textarea reports selectionStart at its end —
                // which silently turned "insert at the caret" into "append".
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onPick(emoji)}
                // The press state is a scale, not a grey disc: at this tile size a
                // filled background reads as a chip and the glyph stops being the
                // object you are picking.
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl leading-none transition-transform duration-100 active:scale-90 active:bg-[var(--tr-surface-2)]"
                data-testid={`emoji-${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
