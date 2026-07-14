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
      <span className="mt-0.5 inline-block px-1 text-[11px] text-gray-400" title="voice unavailable" data-testid="tts-unavailable">
        🔇
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
      className="mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[12px] text-gray-400 active:text-amber-600 disabled:opacity-50 dark:text-gray-500"
    >
      {state === 'busy' ? '…' : '🔊'}
    </button>
  );
}
