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
 */

import { useEffect } from 'react';
import { COMPOSER_EMOJI } from '@/lib/tour-room/emoji';
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
      className="tr-anim-panel-in max-h-[38dvh] overflow-y-auto border-t border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 pt-3"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="grid grid-cols-8 justify-items-center gap-y-1">
        {COMPOSER_EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            // onMouseDown + preventDefault: a plain click blurs the textarea
            // first, and a blurred textarea reports selectionStart at its end —
            // which silently turned "insert at the caret" into "append".
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(emoji)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none active:bg-[var(--tr-surface-2)]"
            data-testid={`emoji-${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
