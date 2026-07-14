'use client';

/**
 * T1.6 — room message feed.
 *
 * - Viewer-locale translation shown first; tapping a translated bubble
 *   toggles the original text (per-message).
 * - System / spot-arrival / meeting-notice messages render as centered cards
 *   (the rich SpotArrivalCard replaces the arrival card in T4.5).
 * - Windowed rendering: only the latest WINDOW messages mount; "earlier"
 *   reveals more. Keeps 200+ message rooms smooth without a virtual-list
 *   dependency (feed is append-only, newest at the bottom).
 * - Auto-follows the bottom only when the user is already near it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AudioButton from '@/components/tour-mode/AudioButton';
import SpotArrivalCard from '@/components/tour-mode/SpotArrivalCard';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import type { SpotArrivalContent } from '@/lib/tour-room/spotContent';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const WINDOW = 60;
const NEAR_BOTTOM_PX = 120;

const EARLIER_LABEL: Record<RoomLocale, string> = {
  en: 'Show earlier messages',
  ko: '이전 메시지 보기',
  ja: '以前のメッセージを表示',
  es: 'Ver mensajes anteriores',
  zh: '查看更早的消息',
};

const ORIGINAL_HINT: Record<RoomLocale, string> = {
  en: 'original',
  ko: '원문',
  ja: '原文',
  es: 'original',
  zh: '原文',
};

const ROLE_LABEL: Record<RoomLocale, Record<string, string>> = {
  en: { guide: 'Guide', admin: 'AtoC Korea' },
  ko: { guide: '가이드', admin: 'AtoC Korea' },
  ja: { guide: 'ガイド', admin: 'AtoC Korea' },
  es: { guide: 'Guía', admin: 'AtoC Korea' },
  zh: { guide: '导游', admin: 'AtoC Korea' },
};

function displayText(message: RoomMessage, locale: RoomLocale, showOriginal: boolean): string {
  const translated = message.translations?.[locale];
  if (!translated || showOriginal) return message.source_text;
  return translated;
}

function isSystemKind(message: RoomMessage): boolean {
  return message.sender_role === 'system';
}

export default function ChatFeed({
  messages,
  viewerLocale,
  viewerRole = 'customer',
  textScale = 'normal',
  tts,
}: {
  messages: RoomMessage[];
  viewerLocale: RoomLocale;
  /** Bubbles from this role right-align as "mine". */
  viewerRole?: string;
  /** T1.12 settings: 'large' bumps bubble text for senior travellers. */
  textScale?: 'normal' | 'large';
  /** T2.4 — when set, incoming bubbles get a listen button (TTS ladder). */
  tts?: { bookingId: string; roomSession: string } | null;
}) {
  const bubbleText = textScale === 'large' ? 'text-[17px]' : 'text-[14px]';
  const systemText = textScale === 'large' ? 'text-[14px]' : 'text-[12px]';
  const [windowSize, setWindowSize] = useState(WINDOW);
  const [originals, setOriginals] = useState<Set<string>>(new Set());
  const feedRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);

  const visible = messages.length > windowSize ? messages.slice(messages.length - windowSize) : messages;
  const hiddenCount = messages.length - visible.length;

  const onScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (el && nearBottomRef.current && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight });
    }
  }, [messages.length]);

  const toggleOriginal = (id: string) => {
    setOriginals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div ref={feedRef} onScroll={onScroll} className="flex-1 space-y-2 overflow-y-auto pb-2" data-testid="chat-feed">
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setWindowSize((s) => s + WINDOW)}
          className="mx-auto block rounded-full bg-gray-100 px-4 py-1.5 text-[12px] text-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          {EARLIER_LABEL[viewerLocale]} (+{hiddenCount})
        </button>
      )}

      {messages.length === 0 && <p className="pt-10 text-center text-[13px] text-gray-400">—</p>}

      {visible.map((message) => {
        // T4.5 — geofence arrivals with resolved content render as the rich
        // briefing card; content-less arrivals fall through to the plain
        // system bubble (3-tier degradation, T4.3).
        const arrivalContent =
          message.metadata?.kind === 'spot_arrival' ? (message.metadata.content as SpotArrivalContent | undefined) : undefined;
        if (arrivalContent && Object.keys(arrivalContent).length > 0) {
          return (
            <SpotArrivalCard
              key={message.id}
              content={arrivalContent}
              messageText={displayText(message, viewerLocale, originals.has(message.id))}
              audioUrl={(message.metadata?.audio_url as string | null | undefined) ?? null}
              locale={viewerLocale}
            />
          );
        }
        if (isSystemKind(message)) {
          return (
            <div
              key={message.id}
              className={`mx-auto max-w-[90%] rounded-xl bg-gray-100 px-3.5 py-2 text-center leading-relaxed text-gray-600 dark:bg-gray-800 dark:text-gray-300 ${systemText}`}
            >
              {displayText(message, viewerLocale, originals.has(message.id))}
            </div>
          );
        }

        const mine = message.sender_role === viewerRole;
        const translated = message.translations?.[viewerLocale];
        const translatable = Boolean(translated && translated !== message.source_text);
        const showingOriginal = originals.has(message.id);
        const roleLabel = !mine ? ROLE_LABEL[viewerLocale][message.sender_role] : null;
        // T2.4: listen button on delivered incoming bubbles only (optimistic
        // local sends have no server row for the TTS cache to key on).
        const listenable = Boolean(tts) && !mine && !message._local && !message.id.startsWith('local-');

        return (
          <div key={message.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
            <div className="max-w-[85%]">
              {roleLabel && <div className="mb-0.5 px-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">{roleLabel}</div>}
              <button
                type="button"
                onClick={translatable ? () => toggleOriginal(message.id) : undefined}
                className={`w-full rounded-2xl px-3.5 py-2.5 text-left leading-relaxed shadow-sm ${bubbleText} ${
                  mine
                    ? 'bg-amber-500 text-white'
                    : 'bg-white text-gray-900 ring-1 ring-gray-100 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-800'
                } ${message._local === 'sending' ? 'opacity-60' : ''} ${
                  message._local === 'failed' ? 'ring-2 ring-red-300' : ''
                }`}
              >
                {displayText(message, viewerLocale, showingOriginal)}
                {translatable && (
                  <span className={`mt-1 block text-[10px] ${mine ? 'text-amber-100' : 'text-gray-400'}`}>
                    {showingOriginal ? '↩' : '🌐'} {ORIGINAL_HINT[viewerLocale]}
                  </span>
                )}
              </button>
              {listenable && tts && (
                <AudioButton
                  text={displayText(message, viewerLocale, showingOriginal)}
                  bookingId={tts.bookingId}
                  messageId={message.id}
                  locale={viewerLocale}
                  roomSession={tts.roomSession}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
