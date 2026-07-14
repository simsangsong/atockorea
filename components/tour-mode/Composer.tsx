'use client';

/**
 * T1.7 — message composer: quick-reply preset chips (pre-translated, zero
 * LLM — §M-2 ②) + free-text input. Rapid taps stay optimistic and never
 * double-send: each preset gets a short cooldown, and the text form clears
 * before the request departs (push-to-talk recording lands with T2.1).
 */

import { useCallback, useRef, useState, type FormEvent } from 'react';
import { QUICK_REPLY_PRESETS, type QuickReplyPreset } from '@/lib/tour-room/quickReplies';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const PRESET_COOLDOWN_MS = 1500;

/** Pure double-tap guard: records the tap and reports whether it may fire. */
function shouldFirePreset(cooldowns: Map<string, number>, key: string, nowMs: number): boolean {
  const last = cooldowns.get(key) ?? 0;
  if (nowMs - last < PRESET_COOLDOWN_MS) return false;
  cooldowns.set(key, nowMs);
  return true;
}

export default function Composer({
  locale,
  onSendText,
  onSendPreset,
  disabled = false,
}: {
  locale: RoomLocale;
  onSendText: (text: string) => void;
  onSendPreset: (preset: QuickReplyPreset) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const cooldowns = useRef<Map<string, number>>(new Map());

  const tapPreset = useCallback(
    (preset: QuickReplyPreset) => {
      if (!shouldFirePreset(cooldowns.current, preset.key, Date.now())) return;
      onSendPreset(preset);
    },
    [onSendPreset],
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    onSendText(text);
  };

  if (disabled) return null;

  return (
    <div>
      <div className="-mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 pb-1" data-testid="quick-replies">
        {QUICK_REPLY_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => tapPreset(preset)}
            className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] text-gray-700 shadow-sm ring-1 ring-gray-100 active:bg-amber-50"
          >
            {preset.emoji} {preset.text[locale]}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[14px] focus:border-amber-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-2xl bg-amber-500 px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-40"
          aria-label="send"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
