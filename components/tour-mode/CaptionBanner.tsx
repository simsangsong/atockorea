'use client';

/**
 * T2.8 — traveller-side live caption banner.
 *
 * Shows the newest guide utterance in the viewer's locale (original on tap),
 * fading out after a few seconds of silence. Optional auto-read speaks each
 * new caption through the device TTS (settings.autoRead — the same "guide
 * notices aloud" toggle; zero server TTS calls).
 */

import { useEffect, useRef, useState } from 'react';
import { speakWithDevice } from '@/lib/tour-room/tts';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';
import type { RoomCaption } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const HIDE_AFTER_MS = 8_000;

const LIVE_LABEL: Record<RoomLocale, string> = {
  en: 'Guide · live',
  ko: '가이드 · 실시간',
  ja: 'ガイド・ライブ',
  es: 'Guía · en vivo',
  zh: '导游 · 直播',
};

export default function CaptionBanner({
  caption,
  locale,
}: {
  caption: RoomCaption | null;
  locale: RoomLocale;
}) {
  const [visible, setVisible] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const { settings } = useTourRoomSettings();
  const spokenSeqRef = useRef(-1);

  useEffect(() => {
    if (!caption) return;
    setVisible(true);
    setShowOriginal(false);
    const timer = setTimeout(() => setVisible(false), HIDE_AFTER_MS);

    // Auto-read each caption once, device TTS only (T2.8 · T2.5 rules).
    if (settings.autoRead && caption.seq > spokenSeqRef.current && document.visibilityState === 'visible') {
      spokenSeqRef.current = caption.seq;
      const text = caption.translations?.[locale] || caption.source_text;
      void speakWithDevice(text, locale);
    }
    return () => clearTimeout(timer);
  }, [caption, locale, settings.autoRead]);

  if (!caption || !visible) return null;

  const translated = caption.translations?.[locale];
  const text = showOriginal || !translated ? caption.source_text : translated;
  const toggleable = Boolean(translated && translated !== caption.source_text);

  return (
    <button
      type="button"
      data-testid="caption-banner"
      onClick={toggleable ? () => setShowOriginal((v) => !v) : undefined}
      className="mb-2 w-full rounded-2xl bg-gray-900/95 px-4 py-3 text-left shadow-lg backdrop-blur dark:bg-black/80"
    >
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        {LIVE_LABEL[locale]}
      </span>
      <span className="mt-1 block text-[15px] leading-relaxed text-white">{text}</span>
      {toggleable && (
        <span className="mt-0.5 block text-[10px] text-gray-400">{showOriginal ? '↩' : '🌐'}</span>
      )}
    </button>
  );
}
