'use client';

/**
 * T1.4/T1.5 room-entry client (full RoomShell tabs arrive with T1.6).
 *
 * Join credential ladder on mount:
 *   1. `?rt=` invite token (track 1) — consumed once, then scrubbed from the
 *      address bar via history.replaceState (§O-1 ③: no token in history,
 *      screen shares, or share sheets; the link itself stays re-clickable);
 *   2. stored room session (frictionless re-entry, §O-1 ④);
 *   3. guest credentials stashed by the entry page (sessionStorage, one-shot);
 *   4. plain cookie session (logged-in owner / merchant / admin).
 *
 * Once joined, messages flow through useTourRoomChannel (Realtime Broadcast →
 * SSE fallback → visibility resync, T1.5).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import CaptionBanner from '@/components/tour-mode/CaptionBanner';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import Composer from '@/components/tour-mode/Composer';
import EndedCard from '@/components/tour-mode/EndedCard';
import TravelTimelineEntry from '@/components/tour-mode/TravelTimeline';
import GuideCaptionBar from '@/components/tour-mode/GuideCaptionBar';
import NoticeBanner from '@/components/tour-mode/NoticeBanner';
import DepartureCountdown from '@/components/tour-mode/DepartureCountdown';
import OfflineInfoCard from '@/components/tour-mode/OfflineInfoCard';
import PushOptInBanner from '@/components/tour-mode/PushOptInBanner';
import QuickSignalBar from '@/components/tour-mode/QuickSignalBar';
import SecondaryCardBanner from '@/components/tour-mode/SecondaryCardBanner';
import HomeTab from '@/components/tour-mode/HomeTab';
import PlanNudgeModal from '@/components/tour-mode/PlanNudgeModal';
import AppManual from '@/components/tour-mode/AppManual';
import type { ManualKind } from '@/lib/tour-room/appManual';
import { tourKindFromPriceType } from '@/lib/tour-room/tourKind';
import LobbyCard, { firstPickup } from '@/components/tour-mode/LobbyCard';
import PickupBoard from '@/components/tour-mode/PickupBoard';
import RoomMapTab from '@/components/tour-mode/map/RoomMapTab';
import RoomShell from '@/components/tour-mode/RoomShell';
import RoomDrawer from '@/components/tour-mode/RoomDrawer';
import GuideSeatStrip from '@/components/tour-mode/guide/GuideSeatStrip';
import GuideSeatDashboard from '@/components/tour-mode/guide/GuideSeatDashboard';
import Sheet from '@/components/tour-mode/Sheet';
import SosButton from '@/components/tour-mode/SosButton';
import ConciergePanel from '@/components/tour-mode/ConciergePanel';
import ConciergeEntryRow from '@/components/tour-mode/ConciergeEntryRow';
import ConciergeInlineAnswer, { type InlineConciergeAnswer } from '@/components/tour-mode/ConciergeInlineAnswer';
import {
  inlineConciergeAnswer,
  latestArrivalContext,
  matchConciergeIntent,
  type ScheduleItemLike,
  type Tier0Context,
} from '@/lib/tour-room/concierge';
import type { DiningCardMeta } from '@/lib/ops/dining/card';
import { activeNotice } from '@/lib/tour-room/notices';
import { roomLifecycle } from '@/lib/tour-room/time';
import InstallBanner from '@/components/tour-mode/InstallBanner';
import { detectEntryLocale, ENTRY_COPY } from '@/components/tour-mode/entryCopy';
import { GUEST_CREDS_STORAGE_PREFIX } from '@/components/tour-mode/TourModeEntry';
import { decodeTokenBody, storePersonalToken } from '@/lib/ops/seating/personalTokens';
import { IconEmergency, IconHighlight, IconLost, IconPresence, IconRetry, TR_ICON, TR_STROKE } from '@/components/tour-mode/icons';
import { CONCIERGE_COPY } from '@/lib/tour-room/concierge';
import { EMERGENCY_TITLE } from '@/lib/tour-room/emergency';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

/**
 * The viewer's language for a room defaults to the language the guest booked
 * in (booking.preferred_language, resolved server-side at /join), NOT the
 * device locale — an English booking must not render in Korean just because
 * the phone is Korean. detectEntryLocale() is only a provisional value for the
 * pre-join skeleton; a guest can still override it in Settings, which we
 * persist here so their choice survives a reload / re-entry.
 */
// 🔴 §D A4.1 — 여기 있던 사본은 정본과 순서가 달랐다(ja/es/zh 자리가 뒤바뀜).
// 같은 목록의 두 번째 사본은 언젠가 어긋나고, 순서가 다르면 그게 이미 어긋난 것이다.
const ROOM_LOCALE_VALUES = ROOM_LOCALES;
const localeOverrideKey = (bookingId: string) => `tour_mode_locale:${bookingId}`;

function readLocaleOverride(bookingId: string): RoomLocale | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(localeOverrideKey(bookingId));
    return (ROOM_LOCALE_VALUES as readonly string[]).includes(v ?? '') ? (v as RoomLocale) : null;
  } catch {
    return null;
  }
}

/** Explicit chat-translation language ('' = auto-detect from typing). Any LLM
 *  language — separate from the 5-locale UI so a French speaker reads operator
 *  bubbles in French while the chrome stays one of the five. */
const chatLocaleOverrideKey = (bookingId: string) => `tour_mode_chat_locale:${bookingId}`;

function readChatLocaleOverride(bookingId: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(chatLocaleOverrideKey(bookingId)) ?? '';
  } catch {
    return '';
  }
}

/** U2.6 — bulk resend pill under the feed (per-message state is on the bubble). */
const RETRY_COPY: Record<RoomLocale, (n: number) => string> = {
  en: (n) => `${n} failed — tap to resend`,
  ko: (n) => `${n}개 전송 실패 — 다시 보내기`,
  ja: (n) => `${n}件送信失敗 — 再送する`,
  es: (n) => `${n} sin enviar — reintentar`,
  zh: (n) => `${n}条发送失败 — 点击重发`,
  fr: (n) => `${n} non envoyé(s) — touchez pour renvoyer`,
  de: (n) => `${n} nicht gesendet — zum erneuten Senden tippen`,
  ru: (n) => `Не отправлено: ${n} — нажмите, чтобы отправить снова`,
  it: (n) => `${n} non inviati — tocca per reinviare`,
};
import SettingsTab from '@/components/tour-mode/SettingsTab';
import { useTourRoomSession, getOrCreateDeviceKey, type TourRoomJoinResult } from '@/hooks/useTourRoomSession';
import { deriveChatLocale } from '@/lib/tour-room/chatLocale';
import { useTourRoomChannel, type RoomMessage } from '@/hooks/useTourRoomChannel';
import { buildReplySnapshot } from '@/lib/tour-room/reply';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { extensionForMime } from '@/lib/tour-room/recorder';
import { detectTtsTier, primeAudio, speakWithDevice } from '@/lib/tour-room/tts';
import { pickupBoardState } from '@/lib/tour-room/pickup';
import type { RoomLocale, PickupSequenceStop } from '@/lib/tour-room/snapshot';
import type { RoomLocation } from '@/hooks/useTourRoomChannel';
import type { VoiceTranscribeResult } from '@/components/tour-mode/Composer';

function consumeGuestCreds(bookingId: string): { contactEmail?: string; contactName?: string } | null {
  try {
    const key = `${GUEST_CREDS_STORAGE_PREFIX}${bookingId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as { contactEmail?: string; contactName?: string };
  } catch {
    return null;
  }
}

/**
 * B0.3c — bridge the two token stores.
 *
 * A personal link opens the room with ?rt=<booking-scope token>, but until now
 * only the claim flow (JoinFlow) and the companion flow wrote that token to
 * `ops_personal_tokens`. So a guest who arrived by personal link — the whole
 * point of B0.3 — still hit `no_token` at the morning QR and got sent through
 * the claim screen the personal link exists to remove.
 *
 * Only booking-scope tokens are cached. A guide or driver token is tour-date
 * scoped, and caching one here would make the QR landing greet the guide as a
 * guest.
 *
 * Runs after the join resolves, so an invalid or expired token never gets
 * stored — the server has already accepted it by then.
 */
function cachePersonalTokenForMorningQr(token: string | null): void {
  if (!token) return;
  try {
    const body = decodeTokenBody(token);
    if (body?.scope !== 'booking') return;
    storePersonalToken(token);
  } catch {
    /* the room still works; only the morning QR shortcut is lost */
  }
}

function scrubTokenFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('rt')) {
      url.searchParams.delete('rt');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {
    /* noop */
  }
}

/**
 * Phase 3 — read (and scrub) a `?message=<id>&reply=1` deep link, e.g. the
 * guide console's "tap a message → open the chat there, ready to quote it".
 */
function readDeepLink(): { focusMessageId: string | null; reply: boolean } {
  try {
    const url = new URL(window.location.href);
    const focusMessageId = url.searchParams.get('message');
    const reply = url.searchParams.get('reply') === '1';
    if (focusMessageId || url.searchParams.has('reply')) {
      url.searchParams.delete('message');
      url.searchParams.delete('reply');
      window.history.replaceState(window.history.state, '', url.toString());
    }
    return { focusMessageId, reply };
  } catch {
    return { focusMessageId: null, reply: false };
  }
}

/** P1-3 — roster/seating sheet, reachable from the guide's chat header. */
const MANIFEST_CLOSE_LABEL: Record<RoomLocale, string> = {
  en: 'Close',
  ko: '닫기',
  ja: '閉じる',
  es: 'Cerrar',
  zh: '关闭',
  fr: 'Fermer',
  de: 'Schließen',
  ru: 'Закрыть',
  it: 'Chiudi',
};

const MANIFEST_SHEET_TITLE: Record<RoomLocale, string> = {
  en: 'Roster & seats',
  ko: '명단·좌석',
  ja: '名簿・座席',
  es: 'Lista y asientos',
  zh: '名单·座位',
  fr: 'Liste et sièges',
  de: 'Gästeliste & Sitzplätze',
  ru: 'Список и места',
  it: 'Elenco e posti',
};

export default function TourRoomClient({ bookingId }: { bookingId: string }) {
  const copy = useMemo(() => ENTRY_COPY[detectEntryLocale()], []);
  const { state, join } = useTourRoomSession(bookingId);
  const attempted = useRef(false);
  // Provisional locale for the pre-join skeleton: a saved override wins,
  // otherwise the device locale — but once /join resolves we adopt the
  // booking's language (below) unless the guest has explicitly overridden.
  const [locale, setLocale] = useState<RoomLocale>(() => readLocaleOverride(bookingId) ?? detectEntryLocale());
  // Explicit chat-translation language ('' = auto-detect from the guest's own
  // typing). Independent of `locale` (the 5-locale UI chrome) so a guest can
  // read operator bubbles in, say, French while the app stays in English.
  const [chatLocaleOverride, setChatLocaleOverride] = useState<string>(() => readChatLocaleOverride(bookingId));
  // B1 (§11.B) — the room token is scrubbed from the URL after join; keep it so
  // the GUIDE-only seat strip can call the staff manifest endpoint.
  const [authToken, setAuthToken] = useState<string | null>(null);

  // T1.12: language switch re-joins so the participant row (and with it the
  // room's translation targeting, D-8) follows the new locale — and we persist
  // it as an explicit override so it survives reloads and re-entry.
  const changeLocale = (next: RoomLocale) => {
    if (next === locale) return;
    setLocale(next);
    try {
      window.localStorage.setItem(localeOverrideKey(bookingId), next);
    } catch {
      /* the in-memory switch still applies for this session */
    }
    void join({ locale: next });
  };

  // Chat-plane language: re-joins so the participant's chat_locale (and the
  // room's translation targeting) follows — operator bubbles then arrive in
  // this language. '' clears the client override so display falls back to the
  // language derived from the guest's own typing.
  const changeChatLocale = (next: string) => {
    if (next === chatLocaleOverride) return;
    setChatLocaleOverride(next);
    try {
      if (next) window.localStorage.setItem(chatLocaleOverrideKey(bookingId), next);
      else window.localStorage.removeItem(chatLocaleOverrideKey(bookingId));
    } catch {
      /* the in-memory switch still applies for this session */
    }
    if (next) void join({ chatLocale: next });
  };

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const url = new URL(window.location.href);
    const token = url.searchParams.get('rt');
    // A4.5 — this is a once-only mount initializer (guarded by attempted.current)
    // that reads a client-only URL param, so it cannot run during SSR render and
    // creates no cascading render. The lint rule guards against setState that
    // re-triggers renders; that is not what this is. Disabling with the reason
    // stated is more honest than the repo's "route through a nested fn" trick,
    // which only hides the same setState from the linter.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) setAuthToken(token); // B1 — retained for the guide seat strip
    const guest = consumeGuestCreds(bookingId);
    const override = readLocaleOverride(bookingId);

    void join({
      token: token || undefined,
      contactEmail: guest?.contactEmail,
      contactName: guest?.contactName,
      // No explicit override → let the server default to booking.preferred_language
      // instead of forcing the device locale onto an English/Japanese/etc guest.
      locale: override ?? undefined,
    }).then((result) => {
      if (!result) return;
      cachePersonalTokenForMorningQr(token);
      scrubTokenFromUrl();
      if (override) return;

      /* 🔴 Staff are not guests. Entering through the room URL, a guide or
         driver inherited `booking.preferred_language`, so a Korean guide
         working an English booking got an English shell wrapped around
         staff panels that are hardcoded Korean — half the screen in each
         language. The dedicated consoles have always joined with 'ko'
         (GuideConsole/DriverConsole); only this entry point did not.
         Re-joining also fixes the quieter half: until now the staff
         participant row carried the guest's locale, so the room's
         translation targets never included Korean and the guest's message
         was never rendered in the language the guide actually reads. */
      const role = result.participant?.role;
      if (role && role !== 'customer') {
        setLocale('ko');
        void join({ locale: 'ko' });
        return;
      }

      const resolved = result.participant?.locale;
      if (resolved && (ROOM_LOCALE_VALUES as readonly string[]).includes(resolved)) {
        setLocale(resolved as RoomLocale);
      }
    });
  }, [bookingId, join, locale]);

  if (state.status === 'idle' || state.status === 'joining') {
    // U1.7 — a room-shaped skeleton (header + bubble ghosts) instead of a
    // bare loading line, so the join round-trip feels like the room arriving.
    return (
      <div className="tr-root mx-auto flex h-dvh w-full flex-col bg-[var(--tr-canvas)]" aria-busy="true">
        <div
          className="tr-hairline-b flex shrink-0 items-center gap-3 bg-[var(--tr-surface)] px-4"
          style={{ minHeight: '52px' }}
        >
          <div className="tr-skeleton h-4 w-36 rounded-full" />
          {/* Client may legitimately detect a non-en device locale here. */}
          <span className="sr-only" suppressHydrationWarning>
            {copy.loading}
          </span>
        </div>
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 pt-6">
          <div className="flex items-end gap-2">
            <div className="tr-skeleton h-9 w-9 rounded-full" />
            <div className="tr-skeleton h-12 w-52 rounded-[18px]" />
          </div>
          <div className="tr-skeleton h-9 w-40 self-end rounded-[18px]" />
          <div className="flex items-end gap-2">
            <div className="tr-skeleton h-9 w-9 rounded-full" />
            <div className="tr-skeleton h-16 w-60 rounded-[18px]" />
          </div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    // Drop the stored last-room so an installed PWA doesn't bounce straight
    // back here, and send the entry list a ?nojump=1 to break the loop.
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage.getItem('tour_mode_last_room') === bookingId) {
          window.localStorage.removeItem('tour_mode_last_room');
        }
      } catch {
        /* noop */
      }
    }
    return (
      <div className="tr-root mx-auto flex h-dvh w-full flex-col items-center justify-center bg-[var(--tr-canvas)] px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--tr-surface)] text-[var(--tr-ink-3)]">
          <IconLost size={TR_ICON.tile} strokeWidth={TR_STROKE.default} aria-hidden />
        </span>
        <p className="tr-card-text mt-5 max-w-xs leading-relaxed text-[var(--tr-ink-2)]">
          {state.httpStatus === 404 ? copy.errorNotFound : copy.errorGeneric}
        </p>
        <Link
          href="/tour-mode?nojump=1"
          className="tr-label mt-6 flex min-h-[44px] items-center rounded-full bg-[var(--tr-accent)] px-6 font-semibold text-white"
        >
          {copy.title}
        </Link>
      </div>
    );
  }

  return (
    <TourRoomLive
      bookingId={bookingId}
      data={state.data}
      locale={locale}
      onLocaleChange={changeLocale}
      chatLocaleOverride={chatLocaleOverride}
      onChatLocaleChange={changeChatLocale}
      authToken={authToken}
    />
  );
}

function TourRoomLive({
  bookingId,
  data,
  locale,
  onLocaleChange,
  chatLocaleOverride,
  onChatLocaleChange,
  authToken,
}: {
  bookingId: string;
  data: TourRoomJoinResult;
  locale: RoomLocale;
  onLocaleChange: (locale: RoomLocale) => void;
  chatLocaleOverride: string;
  onChatLocaleChange: (code: string) => void;
  /** B1 — room token retained by the parent for the guide seat strip. */
  authToken: string | null;
}) {
  const { settings } = useTourRoomSettings();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme;
  const snapshot = data.snapshot as {
    bus_detail?: { payload?: unknown } | null;
    booking?: {
      tours?: { title?: string; city?: string } | null;
      tour_date?: string | null;
      tour_time?: string | null;
      booking_reference?: string | null;
      pickup_points?: unknown;
    } | null;
    messages?: RoomMessage[];
    locations?: RoomLocation[];
    tour_guide_spots?: Array<{
      id: string;
      title?: string | null;
      poi_key?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      trigger_radius_m?: number | null;
      exit_radius_m?: number | null;
    }>;
    tour_facilities?: Array<{ name?: string | null; lat?: number | null; lng?: number | null }>;
    pickup_sequence?: PickupSequenceStop[];
    schedule?: Array<Record<string, unknown>>;
    /** §11.D D4 — the active day plan carries the guest-set departure time. */
    day_plan?: { departure_time?: string | null } | null;
  };
  const {
    messages,
    connection,
    sendText,
    sendPreset,
    retryFailed,
    failedCount,
    latestCaption,
    locations,
    presence,
    reactions,
    react,
    othersLastReadAt,
    markRead,
    typingUsers,
    sendTyping,
  } = useTourRoomChannel({
    bookingId,
    channelTopic: data.channel.topic,
    roomSession: data.session,
    // Pin the participant's chat_locale to the explicit override so their own
    // sends don't let write-detection clobber it (guide/driver bubbles then
    // keep arriving in the chosen chat language, not the app UI language).
    chatLocale: chatLocaleOverride,
    initialMessages: snapshot.messages ?? [],
    initialLocations: snapshot.locations ?? [],
    myParticipantId: data.participant.id,
    initialParticipants: ((snapshot as { participants?: unknown[] }).participants ?? []) as Array<{
      id?: string;
      last_read_at?: string | null;
    }>,
    presence: {
      participantId: data.participant.id,
      role: data.participant.role,
      displayName: data.participant.display_name,
    },
  });

  const viewerRole = data.participant.role;
  // A5 — manual shape from the tour's price model (charter = private).
  // D1: routed through the canonical helper (vehicle ⇒ private, else join) —
  // behaviour-identical to the prior inline `price_type === 'vehicle'` test.
  const manualKind: ManualKind = tourKindFromPriceType(
    (snapshot.booking?.tours as { price_type?: string } | null | undefined)?.price_type,
  );
  const readOnly = data.lifecycle === 'ended';
  const schedule = Array.isArray(snapshot.schedule) ? snapshot.schedule : [];

  // Language-agnostic bridge: the language this party actually reads in. An
  // explicit chat-language pick wins; otherwise it's derived from the newest
  // plain customer message (server-detected), seeded by the participant row.
  // Drives bubble display preference for customers.
  const chatLocale = useMemo(
    () =>
      chatLocaleOverride ||
      deriveChatLocale(messages, (data.participant as { chat_locale?: unknown } | undefined)?.chat_locale),
    [messages, data.participant, chatLocaleOverride],
  );
  const myPickup = firstPickup(snapshot.booking?.pickup_points);
  const guideLocation = Object.values(locations).find((l) => l.role === 'guide') ?? null;
  // T3.7 — pickup-morning board (customers only; hides itself off-morning).
  const pickup =
    viewerRole === 'customer' && data.lifecycle === 'live'
      ? pickupBoardState({
          tourDate: snapshot.booking?.tour_date,
          myBookingId: bookingId,
          pickupSequence: snapshot.pickup_sequence ?? [],
          guidePosition: guideLocation
            ? { latitude: guideLocation.latitude, longitude: guideLocation.longitude }
            : null,
        })
      : null;

  // Latest-messages ref for async event handlers (vision context, etc.).
  // Updated in an effect, not during render (readers run well after commit).
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Kakao-grade reply (Phase 2b): the message being replied to; threaded into
  // the next send and cleared afterwards.
  const [replyTo, setReplyTo] = useState<RoomMessage | null>(null);
  const replyOpts = () =>
    replyTo ? { replyToId: replyTo.id, replySnapshot: buildReplySnapshot(replyTo) } : undefined;

  // C — inline Smart Guide answer. A Tier-0 info question typed into the MAIN
  // chat (restroom / photo / next stop / time left) is answered instantly, on
  // this screen only — never persisted or broadcast, so the shared feed stays a
  // human channel and the guide's own reply is never talked over.
  const [inlineAnswer, setInlineAnswer] = useState<InlineConciergeAnswer | null>(null);
  const inlineAnswerSeq = useRef(0);
  // nowMs is passed in from the send event handler (Date.now() is impure and
  // must be read at the event, not in render scope).
  const maybeAnswerInline = (text: string, nowMs: number) => {
    if (viewerRole !== 'customer' || readOnly) return;
    const arrival = latestArrivalContext(messages);
    const tourDate = snapshot.booking?.tour_date ?? null;
    const notice = activeNotice(messages, tourDate, nowMs);
    const ctx: Tier0Context = {
      spotTitle: arrival.spotTitle,
      content: arrival.content,
      facilityPins: arrival.facilityPins,
      schedule: schedule as ScheduleItemLike[],
      freeTime:
        notice && !notice.cancelled && notice.remainingMs !== null
          ? { remainingMs: notice.remainingMs, point: notice.point }
          : null,
      nowMs,
      lifecycle: roomLifecycle(tourDate, nowMs),
    };
    // §5.7 R-2 ③ — a food ask is the one Tier-0 intent whose data lives in the
    // DB (the Kakao/Google cache), not in the feed. Ask the endpoint; stay
    // silent unless it really returns picks, so a data-less room still leaves
    // the answer to the guide.
    if (matchConciergeIntent(text) === 'restaurant' && arrival.spotTitle) {
      inlineAnswerSeq.current += 1;
      const seq = inlineAnswerSeq.current;
      void fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/concierge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': data.session },
        body: JSON.stringify({ question: text, locale }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((json: { kind?: string; text?: string; card?: DiningCardMeta } | null) => {
          if (json?.kind !== 'tier0_dining' || json.card?.kind !== 'dining_card') return;
          setInlineAnswer({ id: seq, question: text, text: json.text ?? '', diningCard: json.card });
        })
        .catch(() => undefined);
      return;
    }
    // Tier-0 only, guardrailed — null when the message isn't an answerable info
    // question, so we stay silent on chit-chat and never talk over the guide.
    const answer = inlineConciergeAnswer(text, ctx, locale);
    if (!answer) return;
    inlineAnswerSeq.current += 1;
    setInlineAnswer({ id: inlineAnswerSeq.current, question: text, text: answer.text, mapCard: answer.mapCard });
  };

  // Read receipts (Phase 2d): advance my cursor when a new incoming message
  // arrives and the room is on-screen (the room IS the chat). markRead throttles.
  useEffect(() => {
    if (readOnly) return;
    const last = messages[messages.length - 1];
    if (!last || last._local || last.sender_role === viewerRole) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    markRead();
  }, [messages, viewerRole, readOnly, markRead]);

  // Phase 3 — deep link (?message=&reply=1). TourRoomLive is client-only (renders
  // after join), so a lazy read is hydration-safe.
  const [deepLink] = useState(readDeepLink);
  const replyPrefilledRef = useRef(false);
  useEffect(() => {
    // Nested so it isn't a bare effect-body setState; runs once when the target
    // message is present.
    const prefill = () => {
      if (replyPrefilledRef.current || readOnly || !deepLink.reply || !deepLink.focusMessageId) return;
      const target = messages.find((m) => m.id === deepLink.focusMessageId);
      if (target) {
        replyPrefilledRef.current = true;
        setReplyTo(target);
      }
    };
    prefill();
  }, [deepLink, messages, readOnly]);

  // W5.1 — remember this room so the installed PWA's start_url (/tour-mode)
  // can jump straight back in; the stored room session makes rejoin seamless.
  useEffect(() => {
    try {
      window.localStorage.setItem('tour_mode_last_room', bookingId);
    } catch {
      /* entry list still works */
    }
  }, [bookingId]);

  // W4.3 — SOS→ops linkage: once an SOS is delivered, admin replies get the
  // highlight (ChatFeed) and the SOS card shows "connected". sessionStorage
  // keeps it across a mid-tour reload.
  const sosSentKey = `tour_mode_sos_sent:${bookingId}`;
  const [sosSentAt, setSosSentAt] = useState<string | null>(null);
  // P1-3 — roster / seating opened as a sheet OVER the chat, so the guide never
  // loses the conversation (it previously lived only on /tour-mode/guide, a
  // different route entirely).
  const [manifestOpen, setManifestOpen] = useState(false);
  // P0-5 rich schedule — the product page's itinerary (photo, description,
  // highlights, facilities) for the guest's language. Same authenticated route
  // the /plan editor already uses; [] when the tour has no product page, and
  // the shell then keeps its plain timeline.
  const [richStops, setRichStops] = useState<unknown[]>([]);
  useEffect(() => {
    const restore = () => {
      try {
        setSosSentAt(window.sessionStorage.getItem(sosSentKey));
      } catch {
        /* highlight just starts from the next SOS */
      }
    };
    restore();
  }, [sosSentKey]);
  const handleSosSent = useCallback(
    (at: string) => {
      setSosSentAt(at);
      try {
        window.sessionStorage.setItem(sosSentKey, at);
      } catch {
        /* non-persistent highlight is still correct for this session */
      }
    },
    [sosSentKey],
  );

  // T2.4: any first gesture in the room unlocks audio for later playback.
  useEffect(() => {
    const unlock = () => primeAudio();
    document.addEventListener('pointerdown', unlock, { once: true });
    return () => document.removeEventListener('pointerdown', unlock);
  }, []);

  // T2.2 — transcribe-only upload; the transcript comes back into the
  // Composer for confirmation (or auto-sends per the settings contract).
  const transcribeVoice = useCallback(
    async (blob: Blob, mimeType: string): Promise<VoiceTranscribeResult | null> => {
      try {
        const form = new FormData();
        form.append('audio', new File([blob], `voice.${extensionForMime(mimeType)}`, { type: mimeType }));
        const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/stt`, {
          method: 'POST',
          headers: { 'x-tour-room-auth': data.session },
          body: form,
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { text?: string; needsConfirmation?: boolean };
        return { text: json.text ?? '', needsConfirmation: json.needsConfirmation !== false };
      } catch {
        return null;
      }
    },
    [bookingId, data.session],
  );

  // T6.4 — one-tap onboard headcount ack (zero-LLM server template).
  const onboardAcked = messages.some((m) => m.metadata?.kind === 'onboard_ack' && m.sender_role === 'customer');
  const sendOnboardAck = useCallback(async () => {
    try {
      await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': data.session },
        body: JSON.stringify({ ackKind: 'onboard' }),
      });
    } catch {
      /* the button stays; user can retap */
    }
  }, [bookingId, data.session]);

  // T4.7 — photo questions; the latest geofence arrival is the location
  // context injected into the vision prompt.
  const visionAsk = useCallback(
    async (file: File, options: { question: string; share: boolean }) => {
      try {
        const lastArrival = [...messagesRef.current]
          .reverse()
          .find((m) => m.metadata?.kind === 'spot_arrival');
        const form = new FormData();
        form.append('image', file);
        form.append('locale', locale);
        form.append('question', options.question);
        form.append('share', String(options.share));
        if (lastArrival?.metadata?.spot_title) {
          form.append('context', String(lastArrival.metadata.spot_title));
        }
        const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/vision-ask`, {
          method: 'POST',
          headers: { 'x-tour-room-auth': data.session },
          body: form,
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { answer?: string; shared?: boolean };
        return json.answer ? { answer: json.answer, shared: Boolean(json.shared) } : null;
      } catch {
        return null;
      }
    },
    [bookingId, data.session, locale],
  );

  // P0-5 — pull the product page's rich itinerary for this guest's language.
  // The route is the one the /plan editor already uses, so there is no new
  // backend and no new auth path; a tour with no product page returns [] and
  // the shell falls back to its plain time/title timeline.
  useEffect(() => {
    if (!data.session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/tour-rooms/${encodeURIComponent(bookingId)}/tour-itinerary?locale=${encodeURIComponent(locale)}`,
          { headers: { 'x-tour-room-auth': data.session } },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { stops?: unknown[] };
        if (!cancelled && Array.isArray(json.stops)) setRichStops(json.stops);
      } catch {
        // Offline / route unavailable — the plain timeline still renders.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, data.session, locale]);

  // Kakao-grade attachment (Phase 2): send a photo/file as a message with an
  // optional (auto-translated) caption. It arrives back via the room channel.
  const sendAttachment = useCallback(
    async (file: File, caption: string, replyToId?: string): Promise<boolean> => {
      try {
        const form = new FormData();
        form.append('attachment', file);
        if (caption) form.append('caption', caption);
        if (replyToId) form.append('replyToId', replyToId);
        const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/messages`, {
          method: 'POST',
          headers: { 'x-tour-room-auth': data.session },
          body: form,
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [bookingId, data.session],
  );

  // T2.9 — report the device's TTS capability once per entry (background,
  // via the join upsert; no UI state churn).
  useEffect(() => {
    let cancelled = false;
    void detectTtsTier(locale).then((tier) => {
      if (cancelled) return;
      const deviceKey = getOrCreateDeviceKey();
      if (!deviceKey) return;
      void fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': data.session },
        body: JSON.stringify({ deviceKey, locale, ttsCapable: tier === 'device' }),
      }).catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId, data.session, locale]);

  // T2.5 — optional auto-read of incoming guide notices (device TTS only,
  // never the paid path; silent when the tab is hidden).
  const spokenIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (spokenIdsRef.current === null) {
      // First render: everything already in the feed predates this visit.
      spokenIdsRef.current = new Set(messages.map((m) => m.id));
      return;
    }
    const seen = spokenIdsRef.current;
    for (const message of messages) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      if (
        settings.autoRead &&
        message.sender_role === 'guide' &&
        viewerRole !== 'guide' &&
        !message._local &&
        document.visibilityState === 'visible'
      ) {
        const text = message.translations?.[locale] || message.source_text;
        void speakWithDevice(text, locale);
      }
    }
  }, [messages, settings.autoRead, viewerRole, locale]);

  return (
    <>
      {/* Pre-tour planner nudge — most guests miss the email's secondary plan
          link, so the day plan never gets set. Lead guest, lobby only. */}
      {viewerRole === 'customer' && !readOnly && data.lifecycle === 'lobby' && (
        <PlanNudgeModal bookingId={bookingId} roomSession={data.session} locale={locale} theme={theme} />
      )}
      {/* A5 — one-time usage manual on first entry (shape follows the tour's
          price model: shared → join manual, charter → private manual). */}
      {viewerRole === 'customer' && !readOnly && (
        <AppManual variant="auto" kind={manualKind} locale={locale} theme={theme} />
      )}
      <RoomShell
      title={snapshot.booking?.tours?.title ?? 'Your tour'}
      headerTitleSlot={
        viewerRole === 'guide' && authToken ? (
          /* P1-3 — the strip's own chips are buttons, so the roster opener is a
             SIBLING control rather than a wrapper (no nested interactives). */
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <GuideSeatStrip
                bookingId={bookingId}
                token={authToken}
                fallbackTitle={snapshot.booking?.tours?.title ?? undefined}
              />
            </div>
            {/* Icon, not a text pill. The header already carries back, home,
                theme and SOS; a spelled-out "명단·좌석" left the seat strip
                beside it about forty pixels, so the one chip in it rendered as
                a clipped "－" — a broken-looking glyph where a guest's name
                should be. The label lives on aria-label and in the sheet's own
                title, where it is not competing for width. */}
            <button
              type="button"
              onClick={() => setManifestOpen(true)}
              aria-haspopup="dialog"
              aria-label={MANIFEST_SHEET_TITLE[locale]}
              title={MANIFEST_SHEET_TITLE[locale]}
              data-testid="open-manifest-sheet"
              className="tr-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tr-bubble-system)] text-[var(--tr-ink-2)]"
            >
              <IconPresence size={TR_ICON.action} aria-hidden />
            </button>
          </div>
        ) : undefined
      }
      lifecycle={data.lifecycle}
      connection={connection}
      locale={locale}
      schedule={schedule}
      theme={theme}
      chatActivityKey={messages.length}
      initialTab={deepLink.focusMessageId ? 'chat' : undefined}
      homeHref={viewerRole === 'guide' ? '/tour-mode/guide' : viewerRole === 'driver' ? '/tour-mode/driver' : undefined}
      richStops={richStops}
      backHref={
        viewerRole === 'guide'
          ? '/tour-mode/guide'
          : viewerRole === 'driver'
            ? '/tour-mode/driver'
            : undefined /* customers have no "up" — back only steps tabs, never
                           dumps to the booking gate or exits the app */
      }
      renderDrawer={(api) => (
        <RoomDrawer
          title={snapshot.booking?.tours?.title ?? 'Your tour'}
          locale={locale}
          bookingId={bookingId}
          roomSession={data.session}
          participants={
            ((snapshot as { participants?: Array<{ role?: string; display_name?: string }> }).participants ?? [])
              .filter((p) => p.display_name)
              .map((p) => ({ role: p.role ?? 'customer', display_name: p.display_name! }))
          }
          onClose={api.close}
          onSelectTab={api.selectTab}
          /* readOnly 게이트 필수 — 컨시어지 시트 자체가 종료룸에선 null이라
             (아래 concierge prop) 게이트 없이 넘기면 서랍의 이 타일만 눌러도
             아무 일도 안 일어나는 데드 버튼이 된다 (교차표면 감사 #1). */
          onOpenConcierge={viewerRole === 'customer' && !readOnly ? api.openConcierge : undefined}
          onOpenEmergency={api.openEmergency}
        />
      )}
      banner={
        <>
          {viewerRole === 'customer' && (
            <OfflineInfoCard
              bookingId={bookingId}
              roomSession={data.session}
              locale={locale}
              tourDate={snapshot.booking?.tour_date}
              messages={messages}
              schedule={(schedule ?? []) as Array<Record<string, unknown>>}
            />
          )}
          {viewerRole === 'customer' && !readOnly && (
            <PushOptInBanner bookingId={bookingId} roomSession={data.session} locale={locale} />
          )}
          <NoticeBanner
            messages={messages}
            tourDate={snapshot.booking?.tour_date}
            locale={locale}
            bookingId={bookingId}
            roomSession={data.session}
            canSignal={viewerRole === 'customer' && !readOnly}
          />
          {/* §11.D D4 — PRIVATE-tour departure countdown (client-derived). Shows
              only for a private tour with a guest-set departure time; hidden for
              join tours and when unset. */}
          {manualKind === 'private' && snapshot.day_plan?.departure_time && (
            <DepartureCountdown
              departureTime={snapshot.day_plan.departure_time}
              tourDate={snapshot.booking?.tour_date}
              city={snapshot.booking?.tours?.city}
              locale={locale}
              bookingId={bookingId}
              roomSession={data.session}
              canExtend={viewerRole === 'customer' && !readOnly}
            />
          )}
          {viewerRole === 'customer' && (
            <SecondaryCardBanner messages={messages} tourDate={snapshot.booking?.tour_date} locale={locale} />
          )}
          {viewerRole !== 'guide' && <CaptionBanner caption={latestCaption} locale={locale} />}
        </>
      }
      sos={
        viewerRole === 'customer' && !readOnly ? (
          <SosButton
            bookingId={bookingId}
            roomSession={data.session}
            locale={locale}
            onSent={handleSosSent}
            alreadySentAt={sosSentAt}
          />
        ) : null
      }
      concierge={
        viewerRole === 'customer' && !readOnly ? (
          <ConciergePanel
            bookingId={bookingId}
            roomSession={data.session}
            locale={locale}
            schedule={schedule}
            messages={messages}
            tourDate={snapshot.booking?.tour_date ?? null}
          />
        ) : null
      }
      home={
        viewerRole === 'customer'
          ? (api) => (
              <HomeTab
                api={api}
                locale={locale}
                lifecycle={data.lifecycle}
                bookingId={bookingId}
                roomSession={data.session}
                messages={messages}
                schedule={schedule}
                tourDate={snapshot.booking?.tour_date ?? null}
                tourTime={snapshot.booking?.tour_time ?? null}
                pickupPoints={snapshot.booking?.pickup_points}
                busPayload={(snapshot.bus_detail as { payload?: unknown } | null | undefined)?.payload}
                tourSlug={(snapshot.booking?.tours as { slug?: string } | null | undefined)?.slug ?? null}
                canSignal={!readOnly && data.lifecycle === 'live'}
                showConcierge={!readOnly}
                isPrivate={manualKind === 'private'}
                locations={locations}
              />
            )
          : undefined
      }
      map={
        <RoomMapTab
          bookingId={bookingId}
          roomSession={data.session}
          locale={locale}
          myParticipantId={data.participant.id}
          locations={locations}
          presence={presence}
          spots={(snapshot.tour_guide_spots ?? []).map((spot) => ({
            id: spot.id,
            title: spot.title ?? null,
            latitude: spot.latitude ?? null,
            longitude: spot.longitude ?? null,
          }))}
          facilities={snapshot.tour_facilities ?? []}
          pickup={myPickup}
          geofenceSpots={(snapshot.tour_guide_spots ?? [])
            .filter(
              (spot) =>
                typeof spot.latitude === 'number' &&
                typeof spot.longitude === 'number' &&
                typeof spot.trigger_radius_m === 'number',
            )
            .map((spot) => ({
              id: spot.id,
              latitude: spot.latitude!,
              longitude: spot.longitude!,
              trigger_radius_m: spot.trigger_radius_m!,
              exit_radius_m: spot.exit_radius_m ?? null,
            }))}
          // §11.C C2 — 1 km approach previews use poi_key (the content key),
          // so a spot without one simply never previews.
          approachTargets={(snapshot.tour_guide_spots ?? [])
            .filter(
              (spot) =>
                typeof spot.poi_key === 'string' &&
                spot.poi_key.length > 0 &&
                typeof spot.latitude === 'number' &&
                typeof spot.longitude === 'number',
            )
            .map((spot) => ({
              poi_key: spot.poi_key!,
              latitude: spot.latitude!,
              longitude: spot.longitude!,
            }))}
        />
      }
      settings={
        <SettingsTab
          locale={locale}
          onLocaleChange={onLocaleChange}
          manualKind={manualKind}
          {...(viewerRole === 'customer'
            ? {
                chatLocale: chatLocaleOverride,
                onChatLocaleChange,
                // §5.2 C-6 — the card itself checks is_lead server-side.
                companionInvite: { bookingId, roomSession: data.session },
              }
            : {})}
        />
      }
      chat={(chatApi) => (
        <div className="tr-anim-panel-in flex min-h-0 flex-1 flex-col px-3 pt-2">
          {viewerRole === 'guide' && !readOnly && (
            <GuideCaptionBar bookingId={bookingId} roomSession={data.session} locale={locale} />
          )}
          {pickup && (
            <PickupBoard
              state={pickup}
              locale={locale}
              onSendPreset={(preset) => void sendPreset(preset, locale)}
              onboardAcked={onboardAcked}
              onOnboardAck={() => void sendOnboardAck()}
            />
          )}
          {data.lifecycle === 'lobby' && (
            <LobbyCard
              viewerRole={viewerRole}
              locale={locale}
              tourDate={snapshot.booking?.tour_date ?? null}
              tourTime={snapshot.booking?.tour_time ?? null}
              pickupPoints={snapshot.booking?.pickup_points}
              busPayload={(snapshot.bus_detail as { payload?: unknown } | null | undefined)?.payload}
            />
          )}
          {readOnly && (
            <EndedCard
              locale={locale}
              bookingReference={snapshot.booking?.booking_reference}
              bookingId={bookingId}
              roomSession={viewerRole === 'customer' ? data.session : null}
              tourDate={snapshot.booking?.tour_date ?? null}
            />
          )}
          {viewerRole === 'customer' && (
            <TravelTimelineEntry
              locale={locale}
              messages={messages}
              bookingId={bookingId}
              roomSession={data.session}
              tourSlug={(snapshot.booking?.tours as { slug?: string } | null | undefined)?.slug ?? null}
              variant={readOnly ? 'ended' : 'live'}
            />
          )}
          <ChatFeed
            messages={messages}
            viewerLocale={locale}
            viewerRole={viewerRole}
            textScale={settings.textScale}
            tts={{ bookingId, roomSession: data.session }}
            opsHighlightAfter={viewerRole === 'customer' ? sosSentAt : null}
            preferredLocale={viewerRole === 'customer' ? chatLocale : null}
            onReply={!readOnly ? (m) => setReplyTo(m) : undefined}
            reactions={reactions}
            onReact={!readOnly ? (id, emoji) => void react(id, emoji) : undefined}
            lastReadByOthersAt={othersLastReadAt}
            typingUsers={typingUsers}
            focusMessageId={deepLink.focusMessageId}
            onExtraConfirm={
              viewerRole === 'customer' && !readOnly
                ? async (extraId) => {
                    try {
                      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/extras`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': data.session },
                        body: JSON.stringify({ extraId, action: 'confirm' }),
                      });
                      return res.ok;
                    } catch {
                      return false;
                    }
                  }
                : undefined
            }
          />
          {/* W5.1 — pin-to-home-screen nudge, D-1 through tour day, once per booking. */}
          {viewerRole === 'customer' && !readOnly && (
            <InstallBanner tourDate={snapshot.booking?.tour_date ?? null} bookingId={bookingId} />
          )}
          {failedCount > 0 && (
            <button
              type="button"
              onClick={() => void retryFailed()}
              className="tr-label mb-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-[var(--tr-danger-soft)] font-medium text-[var(--tr-danger)]"
              data-testid="retry-failed"
            >
              <IconRetry size={TR_ICON.meta} aria-hidden />
              {RETRY_COPY[locale](failedCount)}
            </button>
          )}
          {viewerRole === 'customer' && !readOnly && data.lifecycle === 'live' && (
            <QuickSignalBar bookingId={bookingId} roomSession={data.session} locale={locale} />
          )}
          {viewerRole === 'customer' && !readOnly && inlineAnswer && (
            <ConciergeInlineAnswer
              answer={inlineAnswer}
              locale={locale}
              onOpen={() => {
                setInlineAnswer(null);
                chatApi.openConcierge();
              }}
              onDismiss={() => setInlineAnswer(null)}
              auth={{ bookingId, roomSession: data.session }}
            />
          )}
          {viewerRole === 'customer' && !readOnly && (
            <ConciergeEntryRow locale={locale} onOpen={chatApi.openConcierge} />
          )}
          {!readOnly && (
            <Composer
              locale={locale}
              viewerRole={viewerRole === 'guide' || viewerRole === 'driver' ? viewerRole : 'customer'}
              onSendText={(text) => {
                void sendText(text, replyOpts());
                setReplyTo(null);
                maybeAnswerInline(text, Date.now());
              }}
              onSendPreset={(preset) => {
                void sendPreset(preset, locale, replyOpts());
                setReplyTo(null);
              }}
              transcribeVoice={transcribeVoice}
              vision={{ ask: visionAsk }}
              onSendAttachment={(file, caption) => {
                const promise = sendAttachment(file, caption, replyTo?.id);
                setReplyTo(null);
                return promise;
              }}
              replyTo={replyTo ? buildReplySnapshot(replyTo) : null}
              onCancelReply={() => setReplyTo(null)}
              onTyping={sendTyping}
              /* C — 손님 트레이. 콕핏의 "+" 트레이와 같은 자리에 손님도 스마트가이드와
                 긴급을 갖는다. 둘 다 **셸이 소유한 시트를 여는 것**이지 새 흐름이
                 아니다 — 긴급 동작이 두 벌이 되면 그중 하나는 반드시 썩는다.
                 스마트가이드 진입 줄(ConciergeEntryRow)은 그대로 둔다: 스크롤로
                 밀려나도 트레이에는 항상 있고, 트레이를 모르는 손님에게는 줄이 남는다. */
              extraActions={
                viewerRole === 'customer'
                  ? [
                      {
                        key: 'smart-guide',
                        label: CONCIERGE_COPY[locale].title,
                        Icon: IconHighlight,
                        tone: 'amber' as const,
                        onClick: chatApi.openConcierge,
                      },
                      {
                        key: 'emergency',
                        label: EMERGENCY_TITLE[locale],
                        Icon: IconEmergency,
                        tone: 'rose' as const,
                        onClick: chatApi.openEmergency,
                      },
                    ]
                  : undefined
              }
            />
          )}
        </div>
      )}
      />

      {/* P1-3 — roster + seat map over the chat. GuideSeatDashboard is already
          self-contained (token + bookingId), so the guide keeps the
          conversation underneath instead of navigating to /tour-mode/guide. */}
      {viewerRole === 'guide' && authToken && (
        /* 🔴 The sheet is a SIBLING of RoomShell, so it renders outside the
           `.tr-root` that defines every `--tr-*` token. Without this wrapper
           `bg-[var(--tr-surface)]` resolves to nothing and the panel comes up
           TRANSPARENT — the roster appeared painted straight onto the chat,
           with the composer and tab bar showing through it. `contents` keeps
           the wrapper out of the layout; the `dark` class is what makes the
           `.dark .tr-root` cascade resolve. Same fix, same reason, as
           AppManual's auto variant. */
        <div className={`tr-root contents${theme === 'dark' ? ' dark' : ''}`}>
          <Sheet
            open={manifestOpen}
            onClose={() => setManifestOpen(false)}
            title={MANIFEST_SHEET_TITLE[locale]}
            closeLabel={MANIFEST_CLOSE_LABEL[locale]}
          >
            <GuideSeatDashboard
              token={authToken}
              bookingId={bookingId}
              tourTitle={snapshot.booking?.tours?.title ?? undefined}
            />
          </Sheet>
        </div>
      )}
    </>
  );
}
