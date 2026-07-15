'use client';

/**
 * T2.4 — per-message listen button, riding the T2.9 ladder: device
 * speechSynthesis (verified locale voice) → server TTS (M-5 room-shared
 * cache) → a persistent "voice unavailable" badge (§O-2 ③ — text is always
 * the primary channel, so nothing is lost).
 *
 * The first tap also primes audio (T2.4): mobile engines only allow
 * playback started from a user gesture.
 */

import { useState } from 'react';
import { primeAudio, speakMessage } from '@/lib/tour-room/tts';
import { IconListen, IconMuted } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export default function AudioButton({
  text,
  bookingId,
  messageId,
  locale,
  roomSession,
}: {
  text: string;
  bookingId: string;
  messageId: string;
  locale: RoomLocale;
  roomSession: string;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'unavailable'>('idle');

  if (state === 'unavailable') {
    return (
      <span
        className="mt-0.5 inline-block px-1 text-[var(--tr-ink-3)]"
        title="voice unavailable"
        data-testid="tts-unavailable"
      >
        <IconMuted size={13} aria-hidden />
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label="listen"
      data-testid="tts-button"
      disabled={state === 'busy'}
      onClick={() => {
        primeAudio();
        setState('busy');
        void speakMessage(text, { bookingId, messageId, locale, roomSession }).then((tier) => {
          setState(tier === 'none' ? 'unavailable' : 'idle');
        });
      }}
      className="mt-1 inline-flex min-h-[28px] items-center gap-1 rounded-full px-1.5 py-0.5 text-[var(--tr-ink-3)] active:text-[var(--tr-accent-deep)] disabled:opacity-50"
    >
      {state === 'busy' ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--tr-accent)] border-t-transparent" aria-hidden />
      ) : (
        <IconListen size={14} aria-hidden />
      )}
    </button>
  );
}
