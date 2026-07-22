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
import ExtraLedgerCard, { type ExtraLedgerMeta } from '@/components/tour-mode/ExtraLedgerCard';
import SpotArrivalCard from '@/components/tour-mode/SpotArrivalCard';
import ArrivalBundleCard from '@/components/tour-mode/ArrivalBundleCard';
import ArrivalVideoCard from '@/components/tour-mode/ArrivalVideoCard';
import { isVideoCardMeta } from '@/lib/tour-room/poiVideos';
import type { ArrivalBundleMeta } from '@/lib/tour-room/arrivalBundle';
import Lightbox from '@/components/tour-mode/Lightbox';
import LocationPreview from '@/components/tour-mode/LocationPreview';
import ReplyPreview from '@/components/tour-mode/ReplyPreview';
import { parseLocationMessage } from '@/lib/tour-room/locationMessage';
import Sheet from '@/components/tour-mode/Sheet';
import {
  IconCopy,
  IconFile,
  IconInstall,
  IconMore,
  IconOpsBadge,
  IconOriginal,
  IconReply,
  IconRetry,
  IconScrollDown,
  IconSending,
  IconTranslated,
} from '@/components/tour-mode/icons';
import type { ReplySnapshot } from '@/lib/tour-room/reply';
import type { ReactionAgg } from '@/hooks/useTourRoomChannel';

/** Quick emoji set for the reaction row (Phase 2c). */
const REACTION_EMOJI = ['👍', '❤️', '😂', '😮', '🙏'];

const READ_LABEL: Record<RoomLocale, string> = { en: 'Read', ko: '읽음', ja: '既読', es: 'Leído', zh: '已读' };
const TYPING_LABEL: Record<RoomLocale, string> = {
  en: 'typing…',
  ko: '입력 중…',
  ja: '入力中…',
  es: 'escribiendo…',
  zh: '正在输入…',
};
import { buildFeedItems, type FeedItem } from '@/lib/tour-room/messageGroups';
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
  en: { guide: 'Guide', admin: 'AtoC Korea', driver: 'Driver' },
  ko: { guide: '가이드', admin: 'AtoC Korea', driver: '기사님' },
  ja: { guide: 'ガイド', admin: 'AtoC Korea', driver: 'ドライバー' },
  es: { guide: 'Guía', admin: 'AtoC Korea', driver: 'Conductor' },
  zh: { guide: '导游', admin: 'AtoC Korea', driver: '司机' },
};

/** Long-press action-sheet labels (Phase 2b). */
const ACTION_COPY: Record<RoomLocale, { title: string; reply: string; copy: string; original: string; translated: string; close: string; copied: string }> = {
  en: { title: 'Message', reply: 'Reply', copy: 'Copy', original: 'Show original', translated: 'Show translation', close: 'Close', copied: 'Copied' },
  ko: { title: '메시지', reply: '답장', copy: '복사', original: '원문 보기', translated: '번역 보기', close: '닫기', copied: '복사됨' },
  ja: { title: 'メッセージ', reply: '返信', copy: 'コピー', original: '原文を表示', translated: '翻訳を表示', close: '閉じる', copied: 'コピーしました' },
  es: { title: 'Mensaje', reply: 'Responder', copy: 'Copiar', original: 'Ver original', translated: 'Ver traducción', close: 'Cerrar', copied: 'Copiado' },
  zh: { title: '消息', reply: '回复', copy: '复制', original: '查看原文', translated: '查看翻译', close: '关闭', copied: '已复制' },
};

/** Attachment metadata carried on image/file messages (Phase 1 route). */
interface AttachmentMeta {
  url?: string;
  mime?: string;
  name?: string;
  size?: number;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function displayText(
  message: RoomMessage,
  locale: RoomLocale,
  showOriginal: boolean,
  preferredLocale?: string | null,
): string {
  // Language-agnostic bridge: a guest who writes French reads driver/guide
  // bubbles in French when that translation exists; fixed-locale capsules
  // (POI cards, notices, signals) fall through to the folded room locale.
  const translated =
    (preferredLocale ? message.translations?.[preferredLocale] : undefined) ??
    message.translations?.[locale];
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
  onExtraConfirm,
  preferredLocale = null,
  onReply,
  reactions,
  onReact,
  lastReadByOthersAt = null,
  typingUsers = [],
  focusMessageId = null,
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
  /** W2.4 — customer one-tap confirm on a logged extras capsule (LEDGER). */
  onExtraConfirm?: (extraId: string) => Promise<boolean>;
  /** Language-agnostic bridge: the viewer's detected chat language ('fr' …) —
   *  preferred over the folded room locale when a translation exists. */
  preferredLocale?: string | null;
  /** Kakao-grade reply (Phase 2b): long-press a bubble → this sets the reply
   *  context in the composer. Absent = no reply affordance. */
  onReply?: (message: RoomMessage) => void;
  /** Kakao-grade reactions (Phase 2c): per-message emoji aggregates + toggle. */
  reactions?: Record<string, ReactionAgg[]>;
  onReact?: (messageId: string, emoji: string) => void;
  /** Phase 2d — newest read time among others → "Read" on my last bubble. */
  lastReadByOthersAt?: string | null;
  /** Phase 2d — others currently typing. */
  typingUsers?: Array<{ role: string; displayName: string }>;
  /** Phase 3 — deep-link: scroll to + flash this message once it's in the feed. */
  focusMessageId?: string | null;
}) {
  const bubbleText = textScale === 'large' ? 'tr-body-lg' : 'tr-body';
  const systemText = textScale === 'large' ? 'tr-card-text' : 'tr-label';
  const [windowSize, setWindowSize] = useState(WINDOW);
  const [originals, setOriginals] = useState<Set<string>>(new Set());
  const [awayCount, setAwayCount] = useState(0);
  const [showFab, setShowFab] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; name?: string | null } | null>(null);
  const [actionMsg, setActionMsg] = useState<RoomMessage | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);
  const action = ACTION_COPY[viewerLocale] ?? ACTION_COPY.en;

  const jumpToMessage = useCallback((id: string) => {
    const el = feedRef.current?.querySelector(`[data-msg-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('tr-msg-flash');
      window.setTimeout(() => el.classList.remove('tr-msg-flash'), 1600);
    }
  }, []);

  const copyMessage = useCallback(
    async (m: RoomMessage) => {
      const text = displayText(m, viewerLocale, originals.has(m.id), preferredLocale);
      try {
        await navigator.clipboard?.writeText(text);
        setCopiedNote(true);
        window.setTimeout(() => {
          setCopiedNote(false);
          setActionMsg(null);
        }, 800);
      } catch {
        setActionMsg(null);
      }
    },
    [viewerLocale, originals, preferredLocale],
  );
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

  // Phase 2d — the id of my newest delivered bubble (the one that shows "Read").
  const myLastReadableId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].sender_role === viewerRole && !messages[i]._local) return messages[i].id;
    }
    return null;
  }, [messages, viewerRole]);

  // W2.4 — every LEDGER transition drops a fresh capsule; only the newest
  // capsule per extra carries the live state (and the confirm button).
  const latestExtraCapsule = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      const meta = m.metadata as { kind?: string; extra_id?: string } | null;
      if (meta?.kind === 'extra_ledger' && typeof meta.extra_id === 'string') map.set(meta.extra_id, m.id);
    }
    return map;
  }, [messages]);

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

  // Phase 3 — deep-link focus: once the target message is in the feed, scroll
  // to it and flash it (guide console "tap a message → open the chat there").
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusMessageId || focusedRef.current === focusMessageId) return;
    if (!messages.some((m) => m.id === focusMessageId)) return;
    focusedRef.current = focusMessageId;
    const raf = window.requestAnimationFrame(() => jumpToMessage(focusMessageId));
    return () => window.cancelAnimationFrame(raf);
  }, [focusMessageId, messages, jumpToMessage]);

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
            if (message.metadata?.kind === 'extra_ledger') {
              const meta = message.metadata as ExtraLedgerMeta;
              const newest = meta.extra_id ? latestExtraCapsule.get(meta.extra_id) === message.id : false;
              return (
                <div className={animClass}>
                  <ExtraLedgerCard
                    meta={meta}
                    locale={viewerLocale}
                    canConfirm={Boolean(newest && meta.status === 'logged' && viewerRole === 'customer' && onExtraConfirm)}
                    onConfirm={onExtraConfirm}
                  />
                </div>
              );
            }
            // A0 — the one-tap arrival bundle renders as a single composite
            // card (meeting strip · badges · route note · restroom map · spot
            // briefing). The multi-line text stays for TTS / push / cockpit.
            if (message.metadata?.kind === 'arrival_bundle') {
              const text = displayText(message, viewerLocale, originals.has(message.id), preferredLocale);
              return (
                <div className={`mt-2 ${animClass}`}>
                  <ArrivalBundleCard
                    meta={message.metadata as unknown as ArrivalBundleMeta}
                    arrivedLine={text.split('\n')[0] ?? text}
                    locale={viewerLocale}
                  />
                </div>
              );
            }
            // W3/J4 — an approved POI short rides spot_arrival metadata too.
            const arrivalVideo =
              message.metadata?.kind === 'spot_arrival' && isVideoCardMeta(message.metadata.video_card)
                ? message.metadata.video_card
                : null;
            if ((arrivalContent && Object.keys(arrivalContent).length > 0) || arrivalVideo) {
              return (
                <div className={`mt-2 flex flex-col gap-2 ${animClass}`}>
                  {/* video-only arrival: keep the arrived line above the player */}
                  {arrivalVideo && !(arrivalContent && Object.keys(arrivalContent).length > 0) ? (
                    <p className="px-1 text-sm font-semibold text-[var(--tr-ink)]">
                      {displayText(message, viewerLocale, originals.has(message.id), preferredLocale)}
                    </p>
                  ) : null}
                  {arrivalVideo ? <ArrivalVideoCard meta={arrivalVideo} locale={viewerLocale} /> : null}
                  {arrivalContent && Object.keys(arrivalContent).length > 0 ? (
                    <SpotArrivalCard
                      content={arrivalContent}
                      messageText={displayText(message, viewerLocale, originals.has(message.id), preferredLocale)}
                      audioUrl={(message.metadata?.audio_url as string | null | undefined) ?? null}
                      locale={viewerLocale}
                      contentTier={(message.metadata?.content_tier as string | null | undefined) ?? null}
                    />
                  ) : null}
                </div>
              );
            }
            if (system) {
              return (
                <div className={`my-2 flex justify-center ${animClass}`}>
                  <div className={`tr-pill max-w-[88%] px-4 py-1.5 text-center leading-relaxed ${systemText}`}>
                    {displayText(message, viewerLocale, originals.has(message.id), preferredLocale)}
                  </div>
                </div>
              );
            }

            const translated =
              (preferredLocale ? message.translations?.[preferredLocale] : undefined) ??
              message.translations?.[viewerLocale];
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

            const readMark =
              mine &&
              !message._local &&
              message.id === myLastReadableId &&
              Boolean(lastReadByOthersAt) &&
              lastReadByOthersAt! >= message.created_at;

            const metaColumn = (
              <div
                className={`tr-meta flex shrink-0 flex-col justify-end gap-0.5 pb-0.5 text-[var(--tr-ink-3)] ${
                  mine ? 'items-end' : 'items-start'
                }`}
              >
                {(onReply || onReact) && !message._local && (
                  <button
                    type="button"
                    onClick={() => setActionMsg(message)}
                    aria-label="message actions"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--tr-ink-3)] active:bg-[var(--tr-bubble-system)]"
                    data-testid="msg-actions"
                  >
                    <IconMore size={15} aria-hidden />
                  </button>
                )}
                {readMark && (
                  <span className="font-semibold text-[var(--tr-safe)]" data-testid="read-mark">
                    {READ_LABEL[viewerLocale]}
                  </span>
                )}
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

            // Kakao-grade attachments: image → thumbnail bubble → lightbox;
            // file → download chip. The caption (source_text) still translates.
            const attachment = message.metadata?.attachment as AttachmentMeta | undefined;
            const isImage = message.input_kind === 'image' && typeof attachment?.url === 'string';
            const isFile = message.input_kind === 'file' && typeof attachment?.url === 'string';
            const caption = displayText(message, viewerLocale, showingOriginal, preferredLocale);
            // A driver/system location message (…q=lat,lng) renders as an inline
            // map preview instead of a raw URL.
            const loc = !isImage && !isFile ? parseLocationMessage(caption) : null;

            const textBubble = (
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
                {caption}
              </button>
            );

            const bubble = isImage ? (
              <div className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
                <button
                  type="button"
                  onClick={() => setLightbox({ url: attachment!.url!, name: attachment!.name })}
                  className={`block overflow-hidden rounded-[var(--tr-radius-bubble)] ${sending ? 'opacity-60' : ''} ${
                    failed ? 'outline outline-1 outline-[var(--tr-danger)]' : ''
                  }`}
                  data-testid="chat-image"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment!.url}
                    alt={attachment!.name ?? ''}
                    loading="lazy"
                    className="max-h-64 max-w-[62vw] object-cover"
                  />
                </button>
                {caption ? textBubble : null}
              </div>
            ) : isFile ? (
              <a
                href={attachment!.url}
                download={attachment!.name ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex max-w-[70vw] items-center gap-2.5 rounded-[var(--tr-radius-bubble)] px-3.5 py-2.5 ${tailClass} ${
                  mine
                    ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                    : 'bg-[var(--tr-bubble-in)] text-[var(--tr-bubble-in-ink)]'
                } ${sending ? 'opacity-60' : ''}`}
                data-testid="chat-file"
              >
                <IconFile size={22} strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{attachment!.name ?? 'file'}</span>
                  {formatBytes(attachment!.size) && (
                    <span className="tr-meta block opacity-70">{formatBytes(attachment!.size)}</span>
                  )}
                </span>
                <IconInstall size={16} aria-hidden />
              </a>
            ) : loc ? (
              <LocationPreview lat={loc.lat} lng={loc.lng} label={loc.label} url={loc.url} />
            ) : (
              textBubble
            );

            // Kakao-grade reply: a quote block above the bubble, tap → jump.
            const replySnap = message.metadata?.reply_to as ReplySnapshot | undefined;
            const bubbleEl = replySnap ? (
              <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <button type="button" onClick={() => jumpToMessage(replySnap.id)} className="max-w-full text-left" data-testid="reply-jump">
                  <ReplyPreview variant="bubble" snapshot={replySnap} locale={viewerLocale} mine={mine} />
                </button>
                {bubble}
              </div>
            ) : (
              bubble
            );

            if (mine) {
              return (
                <div className={`flex justify-end pl-12 ${groupStart ? 'mt-2' : 'mt-0.5'} ${animClass}`}>
                  <div className="flex max-w-full items-end gap-1.5">
                    {metaColumn}
                    <div className="min-w-0">{bubbleEl}</div>
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
                    <div className="min-w-0">{bubbleEl}</div>
                    {metaColumn}
                  </div>
                  {listenable && tts && (
                    <AudioButton
                      text={displayText(message, viewerLocale, showingOriginal, preferredLocale)}
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

          const msgReactions = reactions?.[message.id] ?? [];
          return (
            <div
              key={item.key}
              data-msg-id={message.id}
              onContextMenu={
                (onReply || onReact) && !system && !message._local
                  ? (e) => {
                      e.preventDefault();
                      setActionMsg(message);
                    }
                  : undefined
              }
            >
              {body}
              {msgReactions.length > 0 && (
                <div
                  className={`mt-0.5 flex flex-wrap gap-1 ${mine ? 'justify-end pr-1' : 'pl-11'}`}
                  data-testid="reaction-row"
                >
                  {msgReactions.map((r) => (
                    <button
                      key={r.emoji}
                      type="button"
                      onClick={() => onReact?.(message.id, r.emoji)}
                      className={`tr-meta flex items-center gap-0.5 rounded-full px-2 py-0.5 tabular-nums transition-transform active:scale-95 ${
                        r.mine
                          ? 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)] ring-1 ring-[var(--tr-accent)]'
                          : 'border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                      }`}
                    >
                      <span>{r.emoji}</span>
                      {r.count > 1 && <span>{r.count}</span>}
                    </button>
                  ))}
                </div>
              )}
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

        {typingUsers.length > 0 && (
          <div className="mt-1 flex justify-start pl-11" data-testid="typing-indicator">
            <div className="flex items-center gap-1.5 rounded-[var(--tr-radius-bubble)] bg-[var(--tr-bubble-in)] px-3 py-2">
              <span className="flex gap-0.5" aria-hidden>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--tr-ink-3)] [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--tr-ink-3)] [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--tr-ink-3)] [animation-delay:300ms]" />
              </span>
              <span className="tr-meta text-[var(--tr-ink-3)]">
                {(ROLE_LABEL[viewerLocale][typingUsers[0].role] ?? typingUsers[0].displayName ?? '').trim()} {TYPING_LABEL[viewerLocale]}
              </span>
            </div>
          </div>
        )}
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

      <Lightbox url={lightbox?.url ?? null} name={lightbox?.name} onClose={() => setLightbox(null)} />

      <style>{`
        .tr-msg-flash { animation: tr-msg-flash 1.6s ease-out; border-radius: 14px; }
        @keyframes tr-msg-flash { 0%, 25% { background: var(--tr-accent-soft); } 100% { background: transparent; } }
      `}</style>

      {actionMsg && (
        <Sheet open onClose={() => setActionMsg(null)} closeLabel={action.close} title={action.title}>
          <div className="flex flex-col">
            {onReact && (
              <div className="mb-1 flex items-center justify-around gap-1 border-b border-[var(--tr-hairline)] px-1 pb-3">
                {REACTION_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReact(actionMsg.id, emoji);
                      setActionMsg(null);
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-2xl active:bg-[var(--tr-surface-2)]"
                    data-testid={`react-${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            {onReply && (
              <button
                type="button"
                onClick={() => {
                  onReply(actionMsg);
                  setActionMsg(null);
                }}
                className="tr-card-text flex items-center gap-3 rounded-xl px-2 py-3 text-left font-medium text-[var(--tr-ink)] active:bg-[var(--tr-surface-2)]"
                data-testid="action-reply"
              >
                <IconReply size={18} aria-hidden />
                {action.reply}
              </button>
            )}
            <button
              type="button"
              onClick={() => void copyMessage(actionMsg)}
              className="tr-card-text flex items-center gap-3 rounded-xl px-2 py-3 text-left font-medium text-[var(--tr-ink)] active:bg-[var(--tr-surface-2)]"
              data-testid="action-copy"
            >
              <IconCopy size={18} aria-hidden />
              {copiedNote ? action.copied : action.copy}
            </button>
            <button
              type="button"
              onClick={() => {
                toggleOriginal(actionMsg.id);
                setActionMsg(null);
              }}
              className="tr-card-text flex items-center gap-3 rounded-xl px-2 py-3 text-left font-medium text-[var(--tr-ink)] active:bg-[var(--tr-surface-2)]"
              data-testid="action-translate"
            >
              {originals.has(actionMsg.id) ? <IconTranslated size={18} aria-hidden /> : <IconOriginal size={18} aria-hidden />}
              {originals.has(actionMsg.id) ? action.translated : action.original}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
