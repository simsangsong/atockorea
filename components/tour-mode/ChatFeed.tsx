'use client';

/**
 * T1.6 → U2/U3 — room message feed, messenger-grade (plan §F).
 *
 * - Bubble system: consecutive-sender grouping (avatar + name once, tail and
 *   timestamp on the group's last bubble), KST date-separator pills, centered
 *   system capsules, my-bubble in the warm-yellow brand grammar (U-D2).
 * - Viewer-locale translation shown first; tapping a translated bubble
 *   toggles the original text (per-message). The affordance lives in the
 *   side meta column (globe / undo), not inside the bubble (U-D11).
 * - Scroll-to-bottom FAB with a while-away counter, an unread divider on
 *   re-entry, and a 140ms rise-in on newly arrived bubbles only.
 * - Windowed rendering: only the latest WINDOW messages mount; "earlier"
 *   reveals more. Keeps 200+ message rooms smooth without a virtual-list
 *   dependency (feed is append-only, newest at the bottom).
 * - Auto-follows the bottom only when the user is already near it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AudioButton from '@/components/tour-mode/AudioButton';
import Avatar from '@/components/tour-mode/Avatar';
import SpotArrivalCard from '@/components/tour-mode/SpotArrivalCard';
import {
  IconOpsBadge,
  IconOriginal,
  IconRetry,
  IconScrollDown,
  IconSending,
  IconTranslated,
} from '@/components/tour-mode/icons';
import { buildFeedItems, kstDayKey, type FeedItem } from '@/lib/tour-room/messageGroups';
import { formatBubbleTime, formatDateSeparator } from '@/lib/tour-room/timeFormat';
import { kstToday } from '@/lib/tour-room/time';
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

const EMPTY_COPY: Record<RoomLocale, string> = {
  en: 'No messages yet — updates from your guide will appear here.',
  ko: '아직 메시지가 없어요 — 가이드의 안내가 여기에 도착해요.',
  ja: 'まだメッセージはありません — ガイドのご案内はここに届きます。',
  es: 'Aún no hay mensajes: los avisos de tu guía aparecerán aquí.',
  zh: '还没有消息 — 导游的通知会显示在这里。',
};

const UNREAD_LABEL: Record<RoomLocale, string> = {
  en: 'New messages',
  ko: '여기서부터 안 읽음',
  ja: 'ここから未読',
  es: 'Mensajes nuevos',
  zh: '以下为未读消息',
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

export default function ChatFeed({
  messages,
  viewerLocale,
  viewerRole = 'customer',
  textScale = 'normal',
  tts,
  opsHighlightAfter = null,
}: {
  messages: RoomMessage[];
  viewerLocale: RoomLocale;
  /** Bubbles from this role right-align as "mine". */
  viewerRole?: string;
  /** T1.12 settings: 'large' bumps bubble text for senior travellers. */
  textScale?: 'normal' | 'large';
  /** T2.4 — when set, incoming bubbles get a listen button (TTS ladder). */
  tts?: { bookingId: string; roomSession: string } | null;
  /** W4.3 — after an SOS, admin replies newer than this ISO time get the
   *  "ops responded" highlight so the traveller spots them instantly. */
  opsHighlightAfter?: string | null;
}) {
  const bubbleText = textScale === 'large' ? 'tr-body-lg' : 'tr-body';
  const systemText = textScale === 'large' ? 'tr-card-text' : 'tr-label';
  const [windowSize, setWindowSize] = useState(WINDOW);
  const [originals, setOriginals] = useState<Set<string>>(new Set());
  const [awayCount, setAwayCount] = useState(0);
  const [showFab, setShowFab] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);

  // U3.3 — everything present on mount predates this visit: no entrance
  // animation for those; only genuinely new arrivals rise in.
  const mountedIdsRef = useRef<Set<string> | null>(null);
  if (mountedIdsRef.current === null) {
    mountedIdsRef.current = new Set(messages.map((m) => m.id));
  }

  // U3.2 — unread divider: remember the newest id across an unmount (tab
  // switch); on re-entry, older-than-divider messages sit above the line.
  const unreadAfterRef = useRef<string | null>(null);
  const storageKey = tts ? `tour_mode_last_read:${tts.bookingId}` : null;
  if (unreadAfterRef.current === null && storageKey) {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      unreadAfterRef.current =
        stored && messages.some((m) => m.id === stored) && messages[messages.length - 1]?.id !== stored
          ? stored
          : '';
    } catch {
      unreadAfterRef.current = '';
    }
  }
  const lastIdRef = useRef<string | null>(null);
  lastIdRef.current = messages[messages.length - 1]?.id ?? null;
  useEffect(() => {
    return () => {
      if (!storageKey) return;
      try {
        if (lastIdRef.current) window.sessionStorage.setItem(storageKey, lastIdRef.current);
      } catch {
        /* divider is best-effort */
      }
    };
  }, [storageKey]);

  const visible = messages.length > windowSize ? messages.slice(messages.length - windowSize) : messages;
  const hiddenCount = messages.length - visible.length;
  const items: FeedItem[] = useMemo(() => buildFeedItems(visible, viewerRole), [visible, viewerRole]);
  const todayKey = kstToday();

  const onScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    nearBottomRef.current = near;
    setShowFab(!near);
    if (near) setAwayCount(0);
  }, []);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = feedRef.current;
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    }
    nearBottomRef.current = true;
    setShowFab(false);
    setAwayCount(0);
  }, []);

  const prevCountRef = useRef(messages.length);
  useEffect(() => {
    const grew = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;
    if (nearBottomRef.current) {
      scrollToBottom(false);
    } else if (grew) {
      setAwayCount((count) => count + 1);
    }
  }, [messages.length, scrollToBottom]);

  const toggleOriginal = (id: string) => {
    setOriginals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={feedRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto pb-2" data-testid="chat-feed">
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setWindowSize((s) => s + WINDOW)}
            className="tr-pill tr-meta mx-auto mb-2 mt-1 block px-4 py-1.5 font-medium"
          >
            {EARLIER_LABEL[viewerLocale]} (+{hiddenCount})
          </button>
        )}

        {messages.length === 0 && (
          <p className="tr-card-text mx-auto max-w-[240px] pt-16 text-center leading-relaxed text-[var(--tr-ink-3)]">
            {EMPTY_COPY[viewerLocale]}
          </p>
        )}

        {items.map((item) => {
          if (item.type === 'date') {
            return (
              <div key={item.key} className="my-3 flex justify-center" data-testid="date-separator">
                <span className="tr-pill tr-meta px-3.5 py-1 font-medium">
                  {formatDateSeparator(item.at, viewerLocale, { dayKey: item.dayKey, todayDayKey: todayKey })}
                </span>
              </div>
            );
          }

          const { message, mine, system, groupStart, groupEnd } = item;
          const isNew = !mountedIdsRef.current!.has(message.id);
          const animClass = isNew ? 'tr-anim-bubble-in' : '';
          const unreadDividerHere =
            Boolean(unreadAfterRef.current) && message.id === unreadAfterRef.current;

          // T4.5 — geofence arrivals with resolved content render as the rich
          // briefing card; content-less arrivals fall through to the plain
          // system capsule (3-tier degradation, T4.3).
          const arrivalContent =
            message.metadata?.kind === 'spot_arrival'
              ? (message.metadata.content as SpotArrivalContent | undefined)
              : undefined;

          const body = (() => {
            if (arrivalContent && Object.keys(arrivalContent).length > 0) {
              return (
                <div className={`mt-2 ${animClass}`}>
                  <SpotArrivalCard
                    content={arrivalContent}
                    messageText={displayText(message, viewerLocale, originals.has(message.id))}
                    audioUrl={(message.metadata?.audio_url as string | null | undefined) ?? null}
                    locale={viewerLocale}
                  />
                </div>
              );
            }
            if (system) {
              return (
                <div className={`my-2 flex justify-center ${animClass}`}>
                  <div className={`tr-pill max-w-[88%] px-4 py-1.5 text-center leading-relaxed ${systemText}`}>
                    {displayText(message, viewerLocale, originals.has(message.id))}
                  </div>
                </div>
              );
            }

            const translated = message.translations?.[viewerLocale];
            const translatable = Boolean(translated && translated !== message.source_text);
            const showingOriginal = originals.has(message.id);
            const roleLabel = !mine ? ROLE_LABEL[viewerLocale][message.sender_role] : null;
            // W4.3 — an admin reply after the traveller's SOS gets the highlight.
            const opsHighlighted =
              Boolean(opsHighlightAfter) &&
              !mine &&
              message.sender_role === 'admin' &&
              message.created_at > opsHighlightAfter!;
            // T2.4: listen button on delivered incoming bubbles only (optimistic
            // local sends have no server row for the TTS cache to key on).
            const listenable = Boolean(tts) && !mine && !message._local && !message.id.startsWith('local-');
            const sending = message._local === 'sending';
            const failed = message._local === 'failed';

            const tailClass = groupEnd ? (mine ? 'rounded-br-[var(--tr-radius-tail)]' : 'rounded-bl-[var(--tr-radius-tail)]') : '';
            const time = groupEnd ? formatBubbleTime(message.created_at, viewerLocale) : null;

            const metaColumn = (
              <div
                className={`tr-meta flex shrink-0 flex-col justify-end gap-0.5 pb-0.5 text-[var(--tr-ink-3)] ${
                  mine ? 'items-end' : 'items-start'
                }`}
              >
                {failed && (
                  <span className="text-[var(--tr-danger)]" data-testid="bubble-failed" aria-hidden>
                    <IconRetry size={13} strokeWidth={2.25} />
                  </span>
                )}
                {sending && !failed && (
                  <span data-testid="bubble-sending" aria-hidden>
                    <IconSending size={12} strokeWidth={2} />
                  </span>
                )}
                {translatable && (
                  <span aria-hidden>
                    {showingOriginal ? <IconOriginal size={12} strokeWidth={2} /> : <IconTranslated size={12} strokeWidth={2} />}
                  </span>
                )}
                {time && <span className="whitespace-nowrap tabular-nums">{time}</span>}
              </div>
            );

            const bubble = (
              <button
                type="button"
                onClick={translatable ? () => toggleOriginal(message.id) : undefined}
                data-ops-highlight={opsHighlighted ? 'true' : undefined}
                className={`select-text rounded-[var(--tr-radius-bubble)] px-3.5 py-2 text-left leading-relaxed ${bubbleText} ${tailClass} ${
                  mine
                    ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                    : 'bg-[var(--tr-bubble-in)] text-[var(--tr-bubble-in-ink)]'
                } ${opsHighlighted ? 'border-l-[3px] border-[var(--tr-safe)] pl-3' : ''} ${sending ? 'opacity-60' : ''} ${
                  failed ? 'opacity-60 outline outline-1 outline-[var(--tr-danger)]' : ''
                }`}
              >
                {displayText(message, viewerLocale, showingOriginal)}
              </button>
            );

            if (mine) {
              return (
                <div className={`flex justify-end pl-12 ${groupStart ? 'mt-2' : 'mt-0.5'} ${animClass}`}>
                  <div className="flex max-w-full items-end gap-1.5">
                    {metaColumn}
                    <div className="min-w-0">{bubble}</div>
                  </div>
                </div>
              );
            }

            return (
              <div className={`flex justify-start pr-10 ${groupStart ? 'mt-2' : 'mt-0.5'} ${animClass}`}>
                <div className="w-9 shrink-0 self-start pt-0.5">
                  {groupStart && <Avatar role={message.sender_role} size={34} />}
                </div>
                <div className="ml-2 min-w-0 max-w-full">
                  {groupStart && (
                    <div
                      className={`tr-meta mb-1 flex items-center gap-1 font-medium ${
                        opsHighlighted ? 'text-[var(--tr-safe)]' : 'text-[var(--tr-ink-2)]'
                      }`}
                    >
                      {roleLabel ?? ''}
                      {opsHighlighted && (
                        <span className="text-[var(--tr-safe)]" data-testid="ops-reply-dot" aria-hidden>
                          <IconOpsBadge size={13} strokeWidth={2.25} />
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-end gap-1.5">
                    <div className="min-w-0">{bubble}</div>
                    {metaColumn}
                  </div>
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
          })();

          return (
            <div key={item.key}>
              {body}
              {unreadDividerHere && (
                <div className="my-3 flex items-center gap-2 px-2" data-testid="unread-divider">
                  <span className="h-px flex-1 bg-[var(--tr-danger)] opacity-40" />
                  <span className="tr-meta font-medium text-[var(--tr-danger)]">{UNREAD_LABEL[viewerLocale]}</span>
                  <span className="h-px flex-1 bg-[var(--tr-danger)] opacity-40" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* U3.1 — scroll-to-bottom FAB with the while-away counter. */}
      {showFab && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label="scroll to latest messages"
          className="absolute bottom-3 right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tr-surface)] text-[var(--tr-ink-2)]"
          style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
          data-testid="scroll-to-bottom"
        >
          <IconScrollDown size={20} />
          {awayCount > 0 && (
            <span className="absolute -top-1.5 min-w-[18px] rounded-full bg-[var(--tr-accent)] px-1 py-0.5 text-center text-[10px] font-bold leading-none text-[var(--tr-bubble-me-ink)]">
              {awayCount > 99 ? '99+' : awayCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
