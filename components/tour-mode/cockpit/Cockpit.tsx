'use client';

/**
 * Phase 2 (unified guide/driver console) — the shared dark "cockpit".
 *
 * Extracted from the driver console's BridgeScreen so ONE surface serves both
 * operators (P-D15 + handoff §5): the pure Korean-only driver (`/tour-mode/
 * driver`, vehicle-PIN gated) AND the guide who is driving today (a room card's
 * "운전 모드" in the guide console). Small groups are usually guide-driven, so
 * the guide needs every driver tool — nothing is omitted here.
 *
 * Design rules (unchanged from W3):
 *   - While driving the operator LISTENS and TAPS ONCE — voice is one-tap,
 *     incoming guest messages auto-play as Korean TTS, everything else is a
 *     one-tap signal. Typing is always available as the webview fallback.
 *   - Dark, big taps, high contrast; brand colour only on the nav-app buttons.
 *   - Wake Lock keeps the screen awake so navigation never sleeps.
 *
 * The room session's role (driver | guide | admin) is server-authoritative, so
 * driver-signal / manual-arrival / messages / extras / push-subscribe all
 * accept whoever joined. `onExit`, when provided (the guide), renders a way
 * back to the dispatch home; the pure driver omits it (the cockpit is the app).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OPS_PHONE } from '@/lib/tour-room/emergency';
import { motion } from 'framer-motion';
import { useTourRoomChannel, type RoomMessage } from '@/hooks/useTourRoomChannel';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import { SkeletonRows } from '@/components/tour-mode/LoadingHint';
import NavBrandButton from '@/components/tour-mode/NavBrandButton';
import { useTourRoomSettings, useShellSurface } from '@/hooks/useTourRoomSettings';
import { useGeoWatcher } from '@/hooks/useGeoWatcher';
import { useSpotGeofence } from '@/hooks/useSpotGeofence';
import type { WatchableSpot } from '@/lib/tour-room/spotWatcher';
import { DRIVER_QUICK_REPLIES } from '@/lib/tour-room/quickReplies';
import { startVoiceRecording } from '@/lib/tour-room/recorder';
import { isDeviceSttSupported, startDeviceStt } from '@/lib/tour-room/deviceStt';
import { primeAudio } from '@/lib/tour-room/tts';
import MicPrime from '@/components/tour-mode/MicPrime';
import ActionGrid, { type ActionGridItem } from '@/components/tour-mode/ActionGrid';
import GuideSeatDashboard from '@/components/tour-mode/guide/GuideSeatDashboard';
import TimeWheel from '@/components/tour-mode/cockpit/TimeWheel';
import { useConfirmSheet } from '@/components/tour-mode/ConfirmSheet';
import { kstToday, scheduleClock } from '@/lib/tour-room/time';
import {
  RALLY_GRACE_MS,
  activeNotice,
  formatTargetTime,
  rallyResolution,
  rallyStage,
} from '@/lib/tour-room/notices';
import NumeralClock from '@/components/tour-mode/NumeralClock';
import { useRallyLadder } from '@/hooks/useRallyLadder';
import SayQueueCard from '@/components/tour-mode/cockpit/SayQueueCard';
import { firedSubjectsFromMessages, sayQueue } from '@/lib/tour-room/sayQueue';
import { latestArrival } from '@/lib/tour-room/nowCard';
import { quickRepliesForRole } from '@/lib/tour-room/quickReplies';
import OperatorAssist from '@/components/tour-mode/guide/OperatorAssist';
import Lightbox from '@/components/tour-mode/Lightbox';
import {
  readMessageAttachment,
  isTranslationPending,
} from '@/lib/tour-room/messageView';
import { EXTRA_KIND_LABELS, formatKrw } from '@/lib/tour-room/ledger';
import {
  baseHoursForCity,
  computeOvertime,
  overtimeAmount,
  rateForCity,
} from '@/lib/tour-room/overtime';
import {
  AlarmClock,
  Bell,
  BusFront,
  ChevronLeft,
  FileText,
  Map as MapIcon,
  Camera,
  Sparkles,
  Luggage,
  SquareParking,
  Sunrise,
  Timer,
  TriangleAlert,
  Users,
  Utensils,
  Wallet,
  Navigation,
  type LucideIcon,
} from 'lucide-react';
import {
  IconDone,
  IconExplore,
  IconMic,
  IconPaperclip,
  IconSubmit,
  IconPhone,
  IconPlus,
  IconReceipt,
  IconThemeDark,
  IconThemeLight,
  IconTicket,
  IconWalking,
  TR_ICON,
  TR_STROKE,
} from '../icons';
import {
  googleDirectionsUrl,
  kakaoNaviUrl,
  kakaoWebRouteUrl,
  naverCarUrl,
  naverWebUrl,
  tmapUrl,
  type NavDestination,
} from '@/lib/tour-room/nav-links';

/** Undo-send window after a clip/utterance finishes — a calm hold, not a
 *  3·2·1 countdown. The progress line fills over exactly this long. */
const UNDO_WINDOW_MS = 2400;
export { OPS_PHONE };
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? '';

/** What a finished voice capture will send. Both device STT and the audio
 *  fallback (server-transcribed before this point) resolve to reviewable text;
 *  `confirm` forces an explicit send when the transcript was flagged low-
 *  confidence, so a mistranscription never auto-fans-out unseen. */
type PendingVoice = { kind: 'text'; text: string; confirm?: boolean };

/** A header-only silent WAV — playing it inside a user gesture unlocks the
 *  HTMLMediaElement audio channel on iOS Safari (WebAudio priming alone does
 *  not), so the first incoming guest message autoplays hands-free. */
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAiBUAABArAAACABAAZGF0YQAAAAA=';

export type CockpitLifecycle = 'lobby' | 'live' | 'ended';

/** Driver expense-picker kinds — labels derive from the ledger single source
 *  (T1-5) so a new kind is never silently mislabelled. Parking is the common
 *  one; ticket covers the discount-buy pass-through. */
const EXPENSE_KINDS = (['parking', 'advance', 'ticket', 'other'] as const).map((value) => ({
  value,
  label: EXTRA_KIND_LABELS[value],
}));

/** The driver's own unsettled expenses (T1-2 self-settle list). */
interface CockpitExtra {
  id: string;
  item: string;
  amount_krw: number;
  payer: string;
  kind: string;
  status: string;
  receipt_photo_url?: string | null;
}

export interface CockpitScheduleItem {
  time?: string;
  title?: string;
  name?: string;
  poi_key?: string;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

export interface CockpitRoom {
  booking_id: string;
  number_of_guests: number | null;
  pickup: { name: string | null; lat: number | null; lng: number | null; pickup_time: string | null } | null;
  schedule_source: string;
  schedule: CockpitScheduleItem[];
}

export function itemTitle(item: CockpitScheduleItem): string {
  return String(item.title ?? item.name ?? '').trim() || '(이름 없음)';
}

/** Now + N minutes as an HH:MM KST wall-clock string. */
function kstPlusMinutes(minutes: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(Date.now() + minutes * 60 * 1000));
}

/** HH:MM rounded UP to the next 5-minute mark (wheel resting positions). */
function roundUpTo5(hhmm: string): string {
  const match = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!match) return hhmm;
  const total = Number(match[1]) * 60 + Number(match[2]);
  const rounded = (Math.ceil(total / 5) * 5) % (24 * 60);
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

/**
 * §11.C C1 — per-booking memory of the vehicle-location opt-in. Default OFF
 * (first use is always a deliberate tap); once ON it auto-resumes on the next
 * mount so the driver never re-taps it every morning of the same tour.
 */
export function vehicleShareKey(bookingId: string): string {
  return `tr.vehicleShare.${bookingId}`;
}

/** Chat font zoom (pinch) bounds + storage key. */
/** Attachment picker filter + ceilings — same contract as the guest composer. */
const ATTACH_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.hwp,.zip';
const ATTACH_MAX_IMAGE = 8 * 1024 * 1024;
const ATTACH_MAX_FILE = 20 * 1024 * 1024;

const CHAT_ZOOM_KEY = 'tr-cockpit-chat-zoom';
const CHAT_ZOOM_MIN = 0.85;
const CHAT_ZOOM_MAX = 1.8;

function destFrom(item: CockpitScheduleItem | null): NavDestination | null {
  if (item && typeof item.lat === 'number' && typeof item.lng === 'number') {
    return { lat: item.lat, lng: item.lng, name: itemTitle(item) };
  }
  return null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(VAPID_PUBLIC)
  );
}

/** Keep the screen awake while the cockpit is up (re-acquires on tab return). */
type WakeLockSentinelLike = { release: () => Promise<void> };
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return undefined;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = () => {
      nav.wakeLock
        ?.request('screen')
        .then((s) => {
          if (cancelled) {
            void s.release().catch(() => undefined);
            return;
          }
          sentinel = s;
        })
        .catch(() => undefined);
    };
    acquire();
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release?.().catch(() => undefined);
    };
  }, [active]);
}

// ───────────────────────────────────────────────────────────────────────────

export default function Cockpit({
  tourTitle,
  lifecycle,
  room,
  bookingId,
  session,
  roomToken,
  channelTopic,
  initialMessages,
  city = null,
  tourKind,
  onExit,
}: {
  tourTitle: string;
  lifecycle: CockpitLifecycle;
  room: CockpitRoom;
  bookingId: string;
  session: string;
  /**
   * The RAW room token (`?rt=`), distinct from `session`. The manifest API
   * authenticates with `x-tour-room-token`, not the `x-tour-room-auth` session
   * every other cockpit call uses. Optional: the guide/admin mounts of this
   * component have no token, and the 명단·좌석 tile hides without one.
   */
  roomToken?: string | null;
  channelTopic: string | null;
  initialMessages: RoomMessage[];
  /** Tour city — sets the overtime base hours (Jeju 9h / Busan 8h, T1-1). */
  city?: string | null;
  /**
   * §11.D D7 — join-vs-private discriminator. DEFAULTS to private when
   * unresolved/undefined so every current mount behaves identically; only a
   * resolved 'join' HIDES the private-only cash/overtime/settlement tools.
   */
  tourKind?: 'join' | 'private';
  /** Guide drive-mode: a way back to dispatch. Omitted by the pure driver. */
  onExit?: () => void;
}) {
  // §11.D D7 — undefined ⇒ private ⇒ isJoin false ⇒ current behavior unchanged.
  const isJoin = tourKind === 'join';
  useWakeLock(true);
  // A5 — device theme store: the cockpit defaults dark ('system' → dark in
  // Screen); the header chip flips an explicit light/dark override.
  const { settings: deviceSettings, update: updateSettings } = useTourRoomSettings();
  const cockpitDark = deviceSettings.theme !== 'light';
  // C2 — the header shows this as a dot; the sentence lives in the sr-only span.
  const {
    messages,
    connection,
    // Optimistic echo + localStorage unsent-queue + retry (parity with the
    // guest side): the operator sees their own bubble instantly and a failed
    // send is held for retry instead of silently lost on flaky field data.
    sendText: sendChannelText,
    sendPreset: sendChannelPreset,
    retryFailed,
    failedCount,
  } = useTourRoomChannel({
    bookingId,
    channelTopic,
    roomSession: session,
    initialMessages,
    senderRole: 'driver',
  });

  // Voice is a small phase machine: idle → recording → pending (undo window) →
  // sending → idle. Device STT (Web Speech) is preferred; audio upload is the
  // fallback. `recMode` picks which the current capture is.
  const [phase, setPhase] = useState<'idle' | 'recording' | 'transcribing' | 'pending' | 'sending'>('idle');
  const [recMode, setRecMode] = useState<'device' | 'audio'>('audio');
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState('');
  const [pending, setPending] = useState<PendingVoice | null>(null);
  const voiceRef = useRef<{ stop(): void; cancel(): void } | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [textSending, setTextSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<
    | 'none' | 'delay' | 'schedule' | 'return' | 'expense' | 'overtime' | 'assist' | 'arrival'
    | 'summary' | 'manifest' | 'welcome'
  >('none');
  const [pushOn, setPushOn] = useState(false);
  const [expItem, setExpItem] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expKind, setExpKind] = useState('parking');
  const [expBusy, setExpBusy] = useState(false);
  const [expReceipt, setExpReceipt] = useState<File | null>(null);
  const [extras, setExtras] = useState<CockpitExtra[]>([]);
  // T1-1 overtime settlement inputs (start/end wall-clock + billable hours).
  const [otStart, setOtStart] = useState('');
  const [otEnd, setOtEnd] = useState('');
  const [otHours, setOtHours] = useState(0);
  // A0 — arrival one-tap bundle sheet. Per-day variables are ONLY the meeting
  // time + the parking pin (auto-GPS on open); follow/ticket/route-note are
  // sticky per-POI defaults prefetched from the profile (user decision
  // 2026-07-21). No default meeting time — a deliberate 1-tap choice every
  // stop, so yesterday's time can never fan out by accident.
  const [arrItem, setArrItem] = useState<CockpitScheduleItem | null>(null);
  const [arrTime, setArrTime] = useState('');
  const [arrNoMeeting, setArrNoMeeting] = useState(false);
  const [arrFollow, setArrFollow] = useState<'follow' | 'free'>('free');
  const [arrTicket, setArrTicket] = useState(false);
  // J1 — sticky adult admission (KRW string for the input; '' = unset).
  const [arrTicketKrw, setArrTicketKrw] = useState('');
  const [arrNote, setArrNote] = useState('');
  const [arrCoords, setArrCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [arrBusy, setArrBusy] = useState(false);
  // A4 — the POI's headline event (sticky label) + today's on/off confirmation.
  const [arrEventLabel, setArrEventLabel] = useState('');
  const [arrEventStatus, setArrEventStatus] = useState<'on' | 'off' | null>(null);
  // B4 — the operator's Korean spot prep (hours/closed/tips) from the GET.
  const [arrBriefing, setArrBriefing] = useState<string[] | null>(null);
  // Pressure-fix (2026-07-22): only send the profile patch AFTER the sticky
  // prefill landed — a send racing the GET would silently wipe the stored
  // follow/ticket/note back to defaults. Not-ready sends omit `profile`
  // entirely; the server then serves the stored profile untouched.
  const [arrProfileReady, setArrProfileReady] = useState(false);
  // B5 — the end-of-day summary (visited stops · run span · money roll-up).
  const [daySummary, setDaySummary] = useState<{
    visited: Array<{ title: string; at: string }>;
    span: { minutes: number } | null;
    money: { logged_total: number; settled_total: number; unsettled_total: number; overtime_total: number; count: number };
    /** C5 — current-stop dwell vs the plan's recommended stay (advisory). */
    current?: { title: string; dwell_minutes: number; recommended_minutes: number | null } | null;
    /** SG-7a — 오늘의 나 (순위 없음·손님 연결 없음, SG-D12). */
    me?: {
      ontime: { chains: number; departed: number };
      response: { signals: number; median_seconds: number | null };
      narration: number;
      photos: number;
    } | null;
  } | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name?: string | null } | null>(null);
  // Return-time dial (free wall-clock pick alongside the +N분 chips).
  const [retTime, setRetTime] = useState('');
  const [retRest, setRetRest] = useState('12:00');
  // Arrival meeting-time dial resting position (captured when the sheet opens).
  const [arrRest, setArrRest] = useState('12:00');
  // Chat focus mode: tap anywhere in the feed → the feed takes the button
  // rows' space so a long exchange is readable at a glance; one button
  // restores the grids. Pinch on the feed adjusts the chat font zoom.
  const [chatZoom, setChatZoom] = useState(1);
  const chatZoomRef = useRef(1);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const playedRef = useRef<Set<string>>(new Set(initialMessages.map((message) => message.id)));
  const audioQueueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  // One reusable, gesture-unlocked <audio> element for incoming TTS (T0-5).
  const warmAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaPrimedRef = useRef(false);

  // Unlock the media channel inside a user gesture: play a silent clip on the
  // element we later reuse for TTS. On iOS Safari only the element that played
  // during a gesture may be played programmatically afterwards — a fresh
  // `new Audio(url)` per message stays blocked, so the pure driver never heard
  // the first guest message. Also primes WebAudio for the device-STT ladder.
  const primeMedia = useCallback(() => {
    primeAudio();
    if (mediaPrimedRef.current || typeof window === 'undefined') return;
    mediaPrimedRef.current = true;
    try {
      const el = warmAudioRef.current ?? new Audio();
      warmAudioRef.current = el;
      el.src = SILENT_WAV;
      const played = el.play();
      if (played && typeof played.then === 'function') {
        played.then(
          () => {
            el.pause();
            el.currentTime = 0;
          },
          () => undefined,
        );
      }
    } catch {
      /* priming is best-effort; playback failures surface as the text bubble */
    }
  }, []);

  const say = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  // ── §11.C C1 vehicle location sharing ─────────────────────────────────
  // The cockpit only ever took ONE-SHOT positions (parking pin, vehicle
  // arrived); nothing published continuously, so the guest's map had no van on
  // it. This opt-in feeds the existing T3.1 relay through the existing
  // watcher — no new endpoint, no background tracking (foreground only, the
  // hook pauses on a hidden tab), and permission denial stays terminal.
  const [shareLocation, setShareLocation] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(vehicleShareKey(bookingId)) === '1') setShareLocation(true);
    } catch {
      /* private-mode storage — the toggle just starts OFF */
    }
  }, [bookingId]);
  /**
   * ── X15 Phase 1: arrival detection on the STAFF device ─────────────────
   *
   * 🔴 Nothing here is new machinery. The geofence engine
   * (`lib/tour-room/geo` + `spotWatcher`: enter radius, exit hysteresis, 60s
   * dwell, bus-speed guard, nearest-spot, 120s cooldown) has existed and been
   * unit-tested since T4.4, and this cockpit has been streaming position
   * continuously since §11.C C1. They were simply never connected: the only
   * consumer of the geofence was the GUEST map tab, behind a location share
   * that is opt-in, default OFF, and foreground-only — so in practice arrivals
   * were detected for almost nobody.
   *
   * The staff device is the right source anyway: the driver arriving IS the
   * group arriving, and the driver already has a reason to share position (the
   * guests' map shows the van). This rides that same opt-in stream — no new
   * permission, no background tracking, and the toggle that stops the van also
   * stops this.
   *
   * What it does NOT do: send anything to guests by itself. The arrival bundle
   * carries a meeting time, and §A0 is explicit that there is no default
   * meeting time — inventing one would be worse than the tap it saves. So the
   * geofence OFFERS the sheet, prefilled, and the driver still decides.
   */
  const [geoSpots, setGeoSpots] = useState<WatchableSpot[]>([]);
  const [arrivalPrompt, setArrivalPrompt] = useState<{ spotId: string; title: string } | null>(null);
  const spotTitlesRef = useRef<Map<string, { title: string; poiKey: string | null }>>(new Map());

  // Guide spots come from the room snapshot — the same rows the guest geofence
  // uses, so a spot cannot be armed for one side and not the other. Fetched
  // only once sharing is on: no location, no need for the radii.
  useEffect(() => {
    if (!shareLocation || geoSpots.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/tour-mode/room/${encodeURIComponent(bookingId)}/snapshot`, {
          headers: { 'x-tour-room-auth': session },
        });
        if (!res.ok) return;
        const snap = (await res.json()) as { tour_guide_spots?: Array<Record<string, unknown>> };
        if (cancelled) return;
        const rows = snap.tour_guide_spots ?? [];
        const titles = new Map<string, { title: string; poiKey: string | null }>();
        const watchable: WatchableSpot[] = [];
        for (const row of rows) {
          const id = typeof row.id === 'string' ? row.id : null;
          const lat = typeof row.latitude === 'number' ? row.latitude : null;
          const lng = typeof row.longitude === 'number' ? row.longitude : null;
          const radius = typeof row.trigger_radius_m === 'number' ? row.trigger_radius_m : null;
          if (!id || lat === null || lng === null || radius === null) continue;
          watchable.push({
            id,
            latitude: lat,
            longitude: lng,
            trigger_radius_m: radius,
            exit_radius_m: typeof row.exit_radius_m === 'number' ? row.exit_radius_m : null,
          });
          titles.set(id, {
            title: String(row.title ?? '').trim() || '이 스팟',
            poiKey: typeof row.poi_key === 'string' ? row.poi_key : null,
          });
        }
        spotTitlesRef.current = titles;
        setGeoSpots(watchable);
      } catch {
        /* no radii → no auto-detection; the manual sheet is untouched */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareLocation, geoSpots.length, bookingId, session]);

  const { onSample: onGeofenceSample } = useSpotGeofence({
    bookingId,
    roomSession: session,
    spots: geoSpots,
    locale: 'ko',
    enabled: shareLocation && geoSpots.length > 0,
    onArrival: ({ spotId }) => {
      const meta = spotTitlesRef.current.get(spotId);
      setArrivalPrompt({ spotId, title: meta?.title ?? '이 스팟' });
    },
  });

  const { status: geoStatus, lastPublishedAtMs, accuracyBlocked, stopSharing } = useGeoWatcher({
    bookingId,
    roomSession: session,
    enabled: shareLocation,
    onSample: onGeofenceSample,
  });
  const [actionsOpen, setActionsOpen] = useState(false);
  const toggleShareLocation = useCallback(() => {
    setShareLocation((on) => {
      const next = !on;
      try {
        if (next) window.localStorage.setItem(vehicleShareKey(bookingId), '1');
        else window.localStorage.removeItem(vehicleShareKey(bookingId));
      } catch {
        /* best-effort memory only */
      }
      if (!next) void stopSharing();
      return next;
    });
  }, [bookingId, stopSharing]);
  // Permission denial is terminal in the hook — say it once, don't re-request.
  useEffect(() => {
    if (geoStatus === 'denied') say('위치 권한을 허용해 주세요 (설정 > 위치)');
    else if (geoStatus === 'unsupported') say('이 기기에서 위치를 사용할 수 없어요');
  }, [geoStatus, say]);

  // ── chat focus mode + pinch font zoom ──────────────────────────────────
  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(CHAT_ZOOM_KEY));
      if (Number.isFinite(stored) && stored >= CHAT_ZOOM_MIN && stored <= CHAT_ZOOM_MAX) {
        setChatZoom(stored);
        chatZoomRef.current = stored;
      }
    } catch {
      /* zoom just stays at 1 */
    }
  }, []);

  // Two-finger pinch on the feed = chat font size. Native listeners because
  // touchmove must be non-passive to preventDefault (blocks page zoom).
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return undefined;
    const dist = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const onStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        pinchRef.current = { startDist: dist(event.touches), startZoom: chatZoomRef.current };
      }
    };
    const onMove = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (event.touches.length !== 2 || !pinch) return;
      event.preventDefault();
      const next = Math.min(
        CHAT_ZOOM_MAX,
        Math.max(CHAT_ZOOM_MIN, pinch.startZoom * (dist(event.touches) / pinch.startDist)),
      );
      chatZoomRef.current = next;
      setChatZoom(next);
    };
    const onEnd = (event: TouchEvent) => {
      if (event.touches.length < 2 && pinchRef.current) {
        pinchRef.current = null;
        try {
          window.localStorage.setItem(CHAT_ZOOM_KEY, String(chatZoomRef.current));
        } catch {
          /* not persisted — session-only zoom */
        }
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // M1 — in-app confirmation sheet (window.confirm is banned: iOS WebView
  // silently returns true for it, which could fire departures unconfirmed).
  const { confirm: confirmSheet, sheet: confirmSheetEl } = useConfirmSheet({ confirm: '확인', cancel: '취소' });

  // ── incoming guest messages → Korean TTS autoplay ─────────────────────
  const playNext = useCallback(() => {
    if (playingRef.current) return;
    const url = audioQueueRef.current.shift();
    if (!url) return;
    playingRef.current = true;
    // Reuse the gesture-unlocked element (T0-5); a fresh one is fine off iOS.
    const audio = warmAudioRef.current ?? new Audio();
    warmAudioRef.current = audio;
    audio.src = url;
    audio.onended = audio.onerror = () => {
      playingRef.current = false;
      playNext();
    };
    const played = audio.play();
    if (played && typeof played.catch === 'function') {
      played.catch(() => {
        playingRef.current = false;
      });
    }
  }, []);

  // Prime the media channel on the first interaction inside the cockpit — the
  // "운행 시작" tap lives in the parent, so the first tap here (mic, action, or
  // anywhere) is the gesture that unlocks iOS autoplay.
  useEffect(() => {
    if (mediaPrimedRef.current) return undefined;
    const onGesture = () => primeMedia();
    document.addEventListener('pointerdown', onGesture, { once: true });
    return () => document.removeEventListener('pointerdown', onGesture);
  }, [primeMedia]);

  useEffect(() => {
    for (const message of messages) {
      if (playedRef.current.has(message.id)) continue;
      if (message.sender_role !== 'customer' || message._local) continue;
      // Wait for translation repair (R-6) before speaking — a pending message
      // would otherwise be read aloud in the guest's language with a Korean
      // voice. Leave it unmarked so the repaired rebroadcast (same id) plays.
      if (isTranslationPending(message)) continue;
      playedRef.current.add(message.id);
      // A caption-less photo/file has nothing to speak (the image is on screen).
      if (readMessageAttachment(message) && !message.source_text.trim()) continue;
      void (async () => {
        try {
          const res = await fetch(
            `/api/tour-rooms/${bookingId}/tts?messageId=${encodeURIComponent(message.id)}&locale=ko`,
            { headers: { 'x-tour-room-auth': session } },
          );
          const data = await res.json();
          if (res.ok && data?.url) {
            audioQueueRef.current.push(data.url);
            playNext();
          }
        } catch {
          // silent — the text bubble is still on screen
        }
      })();
    }
  }, [messages, bookingId, session, playNext]);

  // ── typed send — the always-available fallback (webview / quiet typing) ─
  // Goes through the channel's optimistic path: the bubble appears instantly,
  // and a failed send is queued (localStorage) for the retry banner instead of
  // vanishing on flaky data (T0-4).
  const sendText = useCallback(async () => {
    const value = textDraft.trim();
    if (!value || textSending) return;
    setTextSending(true);
    setTextDraft(''); // the optimistic bubble now carries the text
    const ok = await sendChannelText(value);
    setTextSending(false);
    if (!ok) say('전송 대기 — 아래 재전송을 눌러 주세요');
  }, [textDraft, textSending, sendChannelText, say]);

  // ── hands-free voice send ──────────────────────────────────────────────
  // The reviewed transcript (device STT text, or the audio fallback already
  // transcribed via /stt) goes through the channel's optimistic path, so voice
  // gets the same instant echo + failure queue as typed sends (T0-4).
  const sendVoice = useCallback(
    async (payload: PendingVoice) => {
      setPhase('sending');
      const ok = await sendChannelText(payload.text);
      setPending(null);
      setInterim('');
      setPhase('idle');
      if (!ok) say('전송 대기 — 아래 재전송을 눌러 주세요');
    },
    [sendChannelText, say],
  );

  // Undo-send window: a calm hold before the message goes (no numeric
  // countdown). A low-confidence transcript (`confirm`) skips the auto-timer —
  // it waits for an explicit send so a mistranscription never fans out unseen.
  useEffect(() => {
    if (phase !== 'pending' || !pending || pending.confirm) return;
    const payload = pending;
    const timer = window.setTimeout(() => void sendVoice(payload), UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [phase, pending, sendVoice]);

  const cancelPending = useCallback(() => {
    setPending(null);
    setInterim('');
    setPhase('idle');
  }, []);

  // Audio fallback (webview / no device STT): transcribe the clip via /stt and
  // surface the text for review BEFORE it sends (T0-3). The server flags a
  // low-confidence transcript (needsConfirmation) → explicit-send in the
  // pending step; a clean one flows through the calm auto-send undo window.
  const transcribeClip = useCallback(
    async (blob: Blob, mimeType: string) => {
      try {
        const form = new FormData();
        const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
        form.append('audio', new File([blob], `driver.${ext}`, { type: mimeType }));
        const res = await fetch(`/api/tour-rooms/${bookingId}/stt`, {
          method: 'POST',
          headers: { 'x-tour-room-auth': session },
          body: form,
        });
        const data = await res.json().catch(() => null);
        const text = typeof data?.text === 'string' ? data.text.trim() : '';
        if (res.ok && text) {
          setPending({ kind: 'text', text, confirm: Boolean(data?.needsConfirmation) });
          setPhase('pending');
        } else {
          setPhase('idle');
          say('잘 못 알아들었어요 — 다시 말해 주세요');
        }
      } catch {
        setPhase('idle');
        say('네트워크 오류 — 다시 말해 주세요');
      }
    },
    [bookingId, session, say],
  );

  // Start capturing: prefer device STT (free, instant text), else record audio
  // for server transcription. Same tap stops it. The tap also primes iOS audio.
  const startRecording = useCallback(() => {
    primeMedia();
    setInterim('');
    if (isDeviceSttSupported()) {
      setRecMode('device');
      setPhase('recording');
      voiceRef.current = startDeviceStt({
        lang: 'ko-KR',
        onPartial: (text) => setInterim(text),
        onFinal: (text) => {
          voiceRef.current = null;
          if (text) {
            setPending({ kind: 'text', text });
            setPhase('pending');
          } else {
            setPhase('idle');
            say('다시 말해 주세요');
          }
        },
      });
    } else {
      setRecMode('audio');
      setLevel(0);
      setPhase('recording');
      startVoiceRecording({
        onLevel: setLevel,
        onFinish: (clip) => {
          voiceRef.current = null;
          setLevel(0);
          if (clip && clip.blob.size > 0) {
            setPhase('transcribing');
            void transcribeClip(clip.blob, clip.mimeType);
          } else {
            setPhase('idle');
          }
        },
        onError: () => {
          voiceRef.current = null;
          setLevel(0);
          setPhase('idle');
          say('녹음 오류 — 다시 시도해 주세요');
        },
      })
        .then((handle) => {
          voiceRef.current = handle;
        })
        .catch(() => {
          setPhase('idle');
          say('마이크 권한을 허용해 주세요');
        });
    }
  }, [say, primeMedia, transcribeClip]);

  const stopRecording = useCallback(() => {
    voiceRef.current?.stop();
  }, []);

  // ── one-tap signals ────────────────────────────────────────────────────
  const signal = useCallback(
    async (payload: Record<string, unknown>, doneText: string) => {
      try {
        const res = await fetch(`/api/tour-rooms/${bookingId}/driver-signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
          body: JSON.stringify(payload),
        });
        say(res.ok ? doneText : '실패 — 다시 시도해 주세요');
        // SG-2c — callers that chain on the created message (the extension's
        // next_notice_id) read the body; everyone else keeps ignoring it.
        return res.ok ? await res.json().catch(() => null) : null;
      } catch {
        say('네트워크 오류');
        return null;
      }
    },
    [bookingId, session, say],
  );

  // ── SG-2b-β — the rally ladder on the STAFF device ─────────────────────
  // The cockpit is the one screen guaranteed awake during a tour (wake
  // lock), so it is the PRIMARY firer; guests are the backup. Rooms are
  // per-tour-date surfaces, so the live day IS the tour date here.
  const rallyTourDate = kstToday();
  useRallyLadder({
    bookingId,
    roomSession: session,
    messages,
    tourDate: rallyTourDate,
    enabled: true,
  });
  const [rallyNowMs, setRallyNowMs] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setRallyNowMs(Date.now());
    const timer = setInterval(tick, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  const rallyNotice = activeNotice([...messages], rallyTourDate, rallyNowMs);
  const rallyRes = rallyResolution(messages, rallyTourDate, rallyNowMs);
  const rallyPastMs =
    rallyNotice && !rallyNotice.cancelled && rallyNotice.targetMs !== null
      ? rallyNowMs - rallyNotice.targetMs
      : null;
  // Local memory of a taken resolution so the prompt collapses immediately;
  // the server's UNIQUE resolution subject is the real arbiter.
  const [rallyPromptDone, setRallyPromptDone] = useState<string | null>(null);
  const pendingExtendNoticeIdRef = useRef<string | null>(null);
  const postRallyCrossing = useCallback(
    async (
      type: 'rally_all_aboard' | 'rally_departed' | 'rally_extended',
      noticeId: string,
      extra: Record<string, unknown> = {},
    ) => {
      try {
        const res = await fetch(`/api/tour-rooms/${bookingId}/signals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
          body: JSON.stringify({ type, noticeId, ...extra }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [bookingId, session],
  );
  // T+12 — "전원 탑승했나요?" Appears in the contact stage, two minutes
  // before the default T+15 firing, and only while the window is still open.
  const rallyPromptVisible =
    rallyNotice !== null &&
    !rallyNotice.cancelled &&
    rallyNotice.targetMs !== null &&
    rallyPastMs !== null &&
    rallyPastMs >= 12 * 60 * 1000 &&
    rallyRes !== null &&
    rallyRes.noticeId === rallyNotice.messageId &&
    rallyRes.phase !== 'closed' &&
    rallyPromptDone !== rallyNotice.messageId;

  /**
   * 주차핀 — the one-shot fix used to be `{enableHighAccuracy: true,
   * timeout: 8000}` with no maximumAge, i.e. a cold high-accuracy lock in 8s.
   * A parking garage is exactly where that times out, and the failure path sent
   * NOTHING while blaming permissions for every error code. Live DB: zero
   * parking pins have ever been created.
   *
   * Now: accept a recent cached fix, then retry coarse (a rough pin next to the
   * van beats no pin), and say what actually went wrong.
   */
  const dropParkingPin = useCallback(() => {
    if (!navigator.geolocation) {
      say('이 기기에서 위치를 사용할 수 없어요');
      return;
    }
    const send = (position: GeolocationPosition) =>
      void signal(
        { type: 'parking_pin', lat: position.coords.latitude, lng: position.coords.longitude },
        '주차 위치 공유 완료 ✓',
      );
    const explain = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) say('위치 권한을 허용해 주세요 (설정 > 위치)');
      else if (error.code === error.TIMEOUT) say('위치를 못 잡았어요 — 실외로 나가서 다시 눌러주세요');
      else say('지금 위치를 확인할 수 없어요 — 잠시 후 다시 시도해 주세요');
    };
    // C-2 survivor (UX-003): this rides a 2.5s self-dismissing toast — transient
    // feedback, not a standing wait, so it carries no skeleton on purpose.
    say('주차 위치 확인 중…');
    navigator.geolocation.getCurrentPosition(send, () => {
      // Second attempt: coarse network fix, longer window, cached fix allowed.
      navigator.geolocation.getCurrentPosition(send, explain, {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 120000,
      });
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
  }, [signal, say]);

  // 차량 도착 (vehicle_arrived) — pickup or after free time. Adds a GPS pin when
  // available; still sends the "차량 도착" card without it.
  const announceVehicleArrived = useCallback(() => {
    const fire = (coords?: { lat: number; lng: number }) =>
      void signal({ type: 'vehicle_arrived', ...(coords ?? {}) }, '차량 도착 안내 완료 ✓');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => fire({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => fire(),
        { enableHighAccuracy: true, timeout: 6000 },
      );
    } else {
      fire();
    }
  }, [signal]);

  // B1 — vehicle photo: one tap → camera → the photo lands in the guest chat
  // with a translated caption ("오늘 이 차량으로 모시겠습니다"). Rides the
  // Kakao-grade /messages attachment path — no new schema. Sent the evening
  // before (or at pickup) so the party recognizes the vehicle.
  const vehiclePhotoRef = useRef<HTMLInputElement | null>(null);
  // SG-4d -- the meeting-point photo: same camera input as the vehicle
  // photo, but it lands in the PUBLIC bucket via /meeting-photo and waits in
  // the ops review queue. One tap at a stop fixes that POI forever.
  const meetingPhotoRef = useRef<HTMLInputElement | null>(null);
  // SG-5b -- the T-0 name sign: the driver's phone IS the sign. Zero-language
  // contact (제로베이스 §G-1): the guest reads their OWN name across the kerb.
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const openWelcome = useCallback(async () => {
    setSheet('welcome');
    if (welcomeName !== null) return;
    try {
      const res = await fetch(`/api/tour-mode/room/${bookingId}/snapshot`, {
        headers: { 'x-tour-room-auth': session },
      });
      const body = res.ok ? await res.json() : null;
      const name = body?.booking?.contact_name;
      setWelcomeName(typeof name === 'string' && name.trim() ? name.trim() : '');
    } catch {
      setWelcomeName('');
    }
  }, [bookingId, session, welcomeName]);
  const [meetingPhotoBusy, setMeetingPhotoBusy] = useState(false);
  const sendMeetingPhoto = useCallback(
    async (file: File) => {
      const poiKey = typeof arrItem?.poi_key === 'string' ? arrItem.poi_key : null;
      if (!poiKey) {
        say('poi 정보가 없는 스팟이에요');
        return;
      }
      setMeetingPhotoBusy(true);
      try {
        const form = new FormData();
        form.append('photo', file);
        form.append('poiKey', poiKey);
        const res = await fetch(`/api/tour-rooms/${bookingId}/meeting-photo`, {
          method: 'POST',
          headers: { 'x-tour-room-auth': session },
          body: form,
        });
        say(res.ok ? '집합장소 사진 접수 ✓ (검수 후 손님에게 보여요)' : '전송 실패 — 다시 시도해 주세요');
      } catch {
        say('네트워크 오류');
      } finally {
        setMeetingPhotoBusy(false);
      }
    },
    [arrItem, bookingId, session, say],
  );
  const sendVehiclePhoto = useCallback(
    async (file: File) => {
      try {
        const form = new FormData();
        form.append('attachment', file);
        form.append('text', '오늘 이 차량으로 모시겠습니다 🚐');
        const res = await fetch(`/api/tour-rooms/${bookingId}/messages`, {
          method: 'POST',
          headers: { 'x-tour-room-auth': session },
          body: form,
        });
        say(res.ok ? '차량 사진 전송 ✓' : '실패 — 다시 시도해 주세요');
      } catch {
        say('네트워크 오류');
      }
    },
    [bookingId, session, say],
  );

  /**
   * General photo/file attachment.
   *
   * The cockpit could already send exactly one kind of picture — the vehicle
   * photo, with its own fixed caption — and nothing else. A guide holding up a
   * ticket, a driver photographing a changed meeting point, anyone sending a
   * PDF voucher had no way to do it from the console the guests are watching.
   * Same `/messages` multipart path the guest composer uses; no new schema.
   *
   * Deliberately NOT the guest's preview-and-caption sheet: this surface is
   * used one-handed, often at a kerb. Pick a file and it goes, with whatever is
   * already typed riding along as the caption — the same grammar as every other
   * cockpit control.
   */
  const attachRef = useRef<HTMLInputElement | null>(null);
  const sendAttachment = useCallback(
    async (file: File) => {
      const isImage = file.type.startsWith('image/');
      if (file.size > (isImage ? ATTACH_MAX_IMAGE : ATTACH_MAX_FILE)) {
        say(isImage ? '사진이 너무 커요 (8MB 이하)' : '파일이 너무 커요 (20MB 이하)');
        return;
      }
      const caption = textDraft.trim();
      try {
        const form = new FormData();
        form.append('attachment', file);
        if (caption) form.append('text', caption);
        const res = await fetch(`/api/tour-rooms/${bookingId}/messages`, {
          method: 'POST',
          headers: { 'x-tour-room-auth': session },
          body: form,
        });
        if (res.ok) {
          setTextDraft('');
          say(isImage ? '사진 전송 ✓' : '파일 전송 ✓');
        } else {
          // Say what the server said. A generic "failed" hides "too big" and
          // "unsupported type", which are the two the sender can act on.
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          say(body?.error ? `실패 — ${body.error}` : '실패 — 다시 시도해 주세요');
        }
      } catch {
        say('네트워크 오류');
      }
    },
    [bookingId, session, say, textDraft],
  );

  // B5 — end-of-day summary sheet: read-only aggregation of the day.
  const openDaySummary = useCallback(async () => {
    setDaySummary(null);
    setSheet('summary');
    try {
      const res = await fetch(`/api/tour-rooms/${bookingId}/day-summary`, {
        headers: { 'x-tour-room-auth': session },
      });
      if (res.ok) setDaySummary(await res.json());
    } catch {
      /* the sheet shows the loading line */
    }
  }, [bookingId, session]);

  // A1 — morning briefing: the day's opening speech, one confirmed tap. The
  // server picks join vs private from the tour's price model.
  const sendMorningBriefing = useCallback(async () => {
    if (!(await confirmSheet({ title: '아침 브리핑', message: '아침 브리핑을 손님 전원에게 보낼까요?', confirmLabel: '보내기' }))) return;
    try {
      const res = await fetch(`/api/tour-rooms/${bookingId}/morning-briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = (await res.json()) as { delivered?: number };
        const teams = data.delivered && data.delivered > 1 ? ` (${data.delivered}팀)` : '';
        say(`아침 브리핑 전송 ✓${teams}`);
      } else {
        say('실패 — 다시 시도해 주세요');
      }
    } catch {
      say('네트워크 오류');
    }
  }, [bookingId, session, say, confirmSheet]);

  // ── A0 arrival bundle: open sheet → (auto pin + sticky prefill) → send ──
  const captureArrCoords = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setArrCoords({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => say('위치 권한을 허용해 주세요'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [say]);

  const openArrivalSheet = useCallback(
    (item: CockpitScheduleItem) => {
      setArrItem(item);
      setArrTime('');
      // Dial resting position only — arrTime stays empty until a deliberate
      // chip tap or wheel scroll (§A0: no default meeting time).
      setArrRest(roundUpTo5(kstPlusMinutes(60)));
      setArrNoMeeting(false);
      setArrFollow('free');
      setArrTicket(false);
      setArrTicketKrw('');
      setArrNote('');
      setArrCoords(null);
      setArrEventLabel('');
      setArrEventStatus(null);
      setArrBriefing(null);
      // Title-only stops have no poi_key → no server profile → toggles are
      // send-only for this stop and it's safe to include them immediately.
      setArrProfileReady(!item.poi_key);
      setSheet('arrival');
      // The sheet opens right after parking — capture "here" as the pin.
      captureArrCoords();
      // Sticky per-POI defaults (self-built profile; free-visit when none).
      if (item.poi_key) {
        void fetch(`/api/tour-rooms/${bookingId}/arrival-bundle?poiKey=${encodeURIComponent(item.poi_key)}`, {
          headers: { 'x-tour-room-auth': session },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then(
            (data: {
              profile?: {
                follow_mode?: string;
                ticket_required?: boolean;
                route_note?: string | null;
                event_label?: string | null;
                ticket_krw?: number | null;
              };
              event_status?: 'on' | 'off' | null;
              briefing?: string[] | null;
            } | null) => {
              const profile = data?.profile;
              if (!profile) return;
              setArrFollow(profile.follow_mode === 'follow' ? 'follow' : 'free');
              setArrTicket(profile.ticket_required === true);
              setArrTicketKrw(typeof profile.ticket_krw === 'number' ? String(profile.ticket_krw) : '');
              setArrNote(typeof profile.route_note === 'string' ? profile.route_note : '');
              setArrEventLabel(typeof profile.event_label === 'string' ? profile.event_label : '');
              setArrEventStatus(data?.event_status ?? null);
              setArrBriefing(Array.isArray(data?.briefing) ? data.briefing : null);
              setArrProfileReady(true);
            },
          )
          .catch(() => undefined);
      }
    },
    [bookingId, session, captureArrCoords],
  );

  const sendArrivalBundle = useCallback(async () => {
    if (!arrItem || arrBusy) return;
    if (!arrNoMeeting && !/^\d{2}:\d{2}$/.test(arrTime)) return;
    setArrBusy(true);
    try {
      const res = await fetch(`/api/tour-rooms/${bookingId}/arrival-bundle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
        body: JSON.stringify({
          poiKey: arrItem.poi_key ?? null,
          title: itemTitle(arrItem),
          meetingTime: arrNoMeeting ? null : arrTime,
          ...(arrCoords ?? {}),
          eventStatus: arrEventStatus,
          ...(arrProfileReady
            ? {
                profile: {
                  follow_mode: arrFollow,
                  ticket_required: arrTicket,
                  ticket_krw: /^\d+$/.test(arrTicketKrw.trim()) ? Number(arrTicketKrw.trim()) : null,
                  route_note: arrNote.trim() || null,
                  event_label: arrEventLabel.trim() || null,
                },
              }
            : {}),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { delivered?: number };
        setSheet('none');
        const teams = data.delivered && data.delivered > 1 ? ` (${data.delivered}팀)` : '';
        say(`${itemTitle(arrItem)} 도착 안내 전송 ✓${teams}`);
      } else {
        say('실패 — 다시 시도해 주세요');
      }
    } catch {
      say('네트워크 오류');
    } finally {
      setArrBusy(false);
    }
  }, [arrItem, arrBusy, arrNoMeeting, arrTime, arrCoords, arrFollow, arrTicket, arrNote, bookingId, session, say]);

  // ── background push (hear guests while out in a nav app) ────────────────
  // `manual` = the driver tapped the bell. A tapped failure must SAY so —
  // silence here read as "the button does nothing" (owner report 2026-08-04).
  // The mount-time re-subscribe stays quiet: an uninvited toast on entry is
  // noise about something the driver didn't just do.
  const enablePush = useCallback(async (manual = false) => {
    if (!pushSupported()) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        if (manual) say('브라우저에서 알림이 차단돼 있어요 — 설정에서 허용해 주세요');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC).buffer as ArrayBuffer,
      });
      const res = await fetch(`/api/tour-rooms/${bookingId}/push-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (res.ok) {
        setPushOn(true);
        return;
      }
      if (manual) say('알림을 켜지 못했어요 — 잠시 후 다시 눌러주세요');
    } catch {
      /* stays off; the button remains for a retry */
      if (manual) say('알림을 켜지 못했어요 — 잠시 후 다시 눌러주세요');
    }
  }, [bookingId, session, say]);

  // Silent re-subscribe when permission was already granted on this device.
  useEffect(() => {
    if (pushSupported() && Notification.permission === 'granted') void enablePush();
  }, [enablePush]);

  // ── expense ledger (log + T1-2 driver self-settle) ─────────────────────
  const loadExtras = useCallback(async () => {
    try {
      const res = await fetch(`/api/tour-rooms/${bookingId}/extras`, {
        headers: { 'x-tour-room-auth': session },
      });
      if (res.ok) {
        const data = (await res.json()) as { extras?: CockpitExtra[] };
        setExtras(data.extras ?? []);
      }
    } catch {
      /* the log form still works without the settle list */
    }
  }, [bookingId, session]);

  const logExpense = useCallback(async () => {
    const amountKrw = Number.parseInt(expAmount.replace(/[^0-9]/g, ''), 10);
    if (!expItem.trim() || !Number.isFinite(amountKrw) || amountKrw <= 0) return;
    setExpBusy(true);
    try {
      // T1-3 — a receipt photo (ticket transparency) upgrades the send to
      // multipart; the common no-receipt case stays plain JSON.
      let res: Response;
      if (expReceipt) {
        const form = new FormData();
        form.append('item', expItem.trim());
        form.append('amount_krw', String(amountKrw));
        form.append('kind', expKind);
        form.append('receipt', expReceipt);
        res = await fetch(`/api/tour-rooms/${bookingId}/extras`, {
          method: 'POST',
          headers: { 'x-tour-room-auth': session },
          body: form,
        });
      } else {
        res = await fetch(`/api/tour-rooms/${bookingId}/extras`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
          body: JSON.stringify({ item: expItem.trim(), amount_krw: amountKrw, kind: expKind }),
        });
      }
      if (res.ok) {
        setExpItem('');
        setExpAmount('');
        setExpReceipt(null);
        // Keep the sheet open and refresh so the logged item appears in the
        // self-settle list (the guest may hand over the cash right now).
        say('지출 기록됨 ✓ (정산에 반영)');
        void loadExtras();
      } else {
        say('기록 실패 — 다시 시도해 주세요');
      }
    } catch {
      say('네트워크 오류');
    } finally {
      setExpBusy(false);
    }
  }, [bookingId, session, expItem, expAmount, expKind, expReceipt, say, loadExtras]);

  // T1-2 — the driver marks their own advanced expense settled when the guest
  // hands over the cash (guide-less private tour; the guide panel still works
  // for guided ones). The server only allows it for payer='driver' rows.
  const settleExtra = useCallback(
    async (extraId: string) => {
      try {
        const res = await fetch(`/api/tour-rooms/${bookingId}/extras`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
          body: JSON.stringify({ extraId, action: 'settle' }),
        });
        if (res.ok) {
          say('수취 완료 ✓');
          void loadExtras();
        } else {
          say('실패 — 다시 시도해 주세요');
        }
      } catch {
        say('네트워크 오류');
      }
    },
    [bookingId, session, say, loadExtras],
  );

  const myUnsettledExtras = useMemo(
    () => extras.filter((e) => e.payer === 'driver' && (e.status === 'logged' || e.status === 'confirmed')),
    [extras],
  );

  // ── T1-1 overtime settlement ───────────────────────────────────────────
  const baseHours = useMemo(() => baseHoursForCity(city), [city]);
  const otRate = useMemo(() => rateForCity(city), [city]);
  const otComputed = useMemo(() => computeOvertime(baseHours, otStart, otEnd, { city }), [baseHours, otStart, otEnd, city]);
  const otAmount = overtimeAmount(otHours, otRate);

  // Open the overtime sheet: seed start from the pickup time, end with "now",
  // and pre-fill the billable hours from the computed value.
  const openOvertime = useCallback(() => {
    const start = room.pickup?.pickup_time ?? '';
    const now = kstPlusMinutes(0);
    setOtStart(start);
    setOtEnd(now);
    setOtHours(computeOvertime(baseHours, start, now).overtimeHours);
    setSheet('overtime');
  }, [room.pickup, baseHours]);

  const logOvertime = useCallback(async () => {
    if (otHours <= 0) return;
    setExpBusy(true);
    try {
      const res = await fetch(`/api/tour-rooms/${bookingId}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
        body: JSON.stringify({
          item: `초과근무 ${otHours}시간 (기준 ${baseHours}시간)`,
          amount_krw: overtimeAmount(otHours, otRate),
          kind: 'overtime',
        }),
      });
      if (res.ok) {
        say('초과근무 기록됨 ✓ (정산에 반영)');
        setSheet('expense');
        void loadExtras();
      } else {
        say('기록 실패 — 다시 시도해 주세요');
      }
    } catch {
      say('네트워크 오류');
    } finally {
      setExpBusy(false);
    }
  }, [bookingId, session, otHours, baseHours, otRate, say, loadExtras]);

  // ── phase-aware destination (준비=픽업, 진행=다음 스톱) ───────────────────
  const nextStop = useMemo(() => {
    const now = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    // scheduleClock: ops sometimes write "≈ 08:00" — normalize before the
    // string compare, else every stop sorts as "upcoming" forever.
    return (
      room.schedule.find((item) => {
        const start = scheduleClock(item.time);
        return /^\d{2}:\d{2}$/.test(start) && start > now;
      }) ??
      room.schedule[0] ??
      null
    );
  }, [room.schedule]);

  const pickupDest: NavDestination | null =
    room.pickup && typeof room.pickup.lat === 'number' && typeof room.pickup.lng === 'number'
      ? { lat: room.pickup.lat, lng: room.pickup.lng, name: room.pickup.name ?? '픽업 장소' }
      : null;

  const isPrep = lifecycle === 'lobby';
  /**
   * C5 — the one thing the shared feed does not know about: a guest pickup /
   * drop-off request gets one-tap numeric ETA chips right under the capsule
   * (A3). It rides ChatFeed's `renderMessageExtra` slot so consolidating the
   * renderer does not quietly delete a driver control.
   */
  const renderEtaReply = useCallback(
    (message: RoomMessage) => {
      const wants =
        message.metadata?.signal_type === 'pickup_request' ||
        message.metadata?.signal_type === 'dropoff_change';
      if (!wants) return null;
      return (
        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-11" data-testid="cockpit-eta-reply">
          {[3, 5, 10, 15, 20].map((min) => (
            <button
              key={min}
              type="button"
              onClick={() => void signal({ type: 'eta_reply', minutes: min }, `${min}분 후 도착 안내 ✓`)}
              className="text-cjk-safe tr-label rounded-xl bg-[var(--tr-bubble-me)] px-3 py-2 font-bold text-[var(--tr-bubble-me-ink)]"
              data-testid={`cockpit-eta-${min}`}
            >
              {min}분
            </button>
          ))}
        </div>
      );
    },
    [signal],
  );

  const connected = connection === 'realtime' || connection === 'sse';
  const destLabel = isPrep && room.pickup ? '픽업' : '다음';
  const destTitle = isPrep && room.pickup
    ? `${room.pickup.pickup_time ? `${room.pickup.pickup_time} ` : ''}${room.pickup.name ?? '픽업 장소'}`
    : nextStop
      ? `${nextStop.time ? `${nextStop.time} ` : ''}${itemTitle(nextStop)}`
      : '오늘 일정 없음';
  const navDest = isPrep && pickupDest ? pickupDest : destFrom(nextStop);

  // §5.7 R-2 ④ — operator one-tap dining picks for the upcoming stop. The
  // server does the judging (cache HIT/MISS, dietary intake, ranking); this is
  // just "send it". Declared after `nextStop` on purpose — a useCallback whose
  // dep array names a later const would hit the TDZ at render.
  const sendDiningPicks = useCallback(async () => {
    if (!nextStop) {
      say('보낼 스팟이 없어요');
      return;
    }
    const title = itemTitle(nextStop);
    if (!(await confirmSheet({ title: '식당 추천', message: `${title} 근처 식당을 손님에게 보낼까요?`, confirmLabel: '보내기' }))) return;
    try {
      const res = await fetch(`/api/tour-rooms/${bookingId}/dining`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
        body: JSON.stringify({
          poiKey: nextStop.poi_key ?? null,
          spotTitle: title,
          lat: typeof nextStop.lat === 'number' ? nextStop.lat : undefined,
          lng: typeof nextStop.lng === 'number' ? nextStop.lng : undefined,
          post: true,
        }),
      });
      if (!res.ok) {
        say('실패 — 다시 시도해 주세요');
        return;
      }
      const data = (await res.json()) as { posted?: boolean; delivered?: number; skipped?: string | null };
      if (!data.posted) {
        say(data.skipped === 'duplicate' ? '오늘 이 근처 추천은 이미 보냈어요' : '추천할 식당을 못 찾았어요');
        return;
      }
      const teams = data.delivered && data.delivered > 1 ? ` (${data.delivered}팀)` : '';
      say(`${title} 식당 추천 전송 ✓${teams}`);
    } catch {
      say('네트워크 오류');
    }
  }, [bookingId, session, say, confirmSheet, nextStop]);

  // Focus mode widens the window — the point is reading a long exchange.
  /**
   * 🔴 C5 — this used to be `messages.slice(chatExpanded ? -80 : -8)`, and the
   * `-8` was the real answer to "채팅 내용이 몇 줄밖에 안 보인다": the ninth
   * message was not off-screen, it was never mounted. ChatFeed windows at 60
   * with a "show earlier" control, so the cap is now the component's job and
   * the driver can scroll back instead of being silently truncated.
   */
  const recent = messages;

  // C1 — one glanceable word for the sharing state (denial is terminal).
  // 🔴 'watching' only means the device is emitting samples. Anything coarser
  // than MAX_ACCURACY_M is dropped before the POST, so the button used to read
  // "공유 중" with a green dot while the room received nothing at all — the
  // worst kind of failure, one that looks like success. Say "공유 중" only once
  // the server has actually accepted a position.
  const sharingLive = shareLocation && geoStatus === 'watching' && lastPublishedAtMs !== null;
  const shareLabel = !shareLocation
    ? '위치공유'
    : geoStatus === 'denied'
      ? '권한 필요'
      : geoStatus === 'unsupported'
        ? '사용 불가'
        : geoStatus === 'error'
          ? '오류'
          : sharingLive
            ? '공유 중'
            : geoStatus === 'watching'
              ? (accuracyBlocked ? '신호 약함' : '위치 잡는 중…')
              : '켜는 중…';

  /**
   * The tray's contents. Order is by how often a driver reaches for it, not by
   * how the code grew: boarding and delay first, settlement last. Colour is
   * assigned by meaning — movement blue, time amber, alerts rose, money green —
   * so the grid is scannable without reading.
   */
  // ── SG-6 — the say queue: pure ranking, zero new send paths ────────────
  const [sayDismissed, setSayDismissed] = useState<ReadonlySet<string>>(new Set());
  const [sayOptimistic, setSayOptimistic] = useState<ReadonlySet<string>>(new Set());
  const sayItems = useMemo(() => {
    const dayStartMs = rallyNowMs - ((rallyNowMs + 9 * 3600_000) % 86_400_000);
    const derived = firedSubjectsFromMessages(messages, dayStartMs);
    const fired = new Set<string>([...derived.fired, ...sayOptimistic, ...sayDismissed]);
    const arrival = latestArrival([...messages], rallyNowMs);
    return sayQueue({
      nowMs: rallyNowMs,
      tourDate: rallyTourDate,
      schedule: room.schedule,
      notice: rallyNotice,
      geofenceArrival: arrivalPrompt
        ? {
            spotId: arrivalPrompt.spotId,
            title: arrivalPrompt.title,
            poiKey: spotTitlesRef.current.get(arrivalPrompt.spotId)?.poiKey ?? null,
          }
        : null,
      lastArrivalAtMs: arrival?.arrivedAtMs ?? null,
      lastArrivalPoiKey: arrival?.poiKey ?? null,
      lastTimerAtMs: derived.lastTimerAtMs,
      firedSubjects: fired,
    });
  }, [messages, rallyNowMs, rallyTourDate, room.schedule, rallyNotice, arrivalPrompt, sayOptimistic, sayDismissed]);
  const sayBookkeep = useCallback(
    (type: 'say_dismissed' | 'say_expired', subject: string) => {
      void fetch(`/api/tour-rooms/${bookingId}/driver-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
        body: JSON.stringify({ type, subject }),
      }).catch(() => undefined);
    },
    [bookingId, session],
  );
  const fireSayItem = useCallback(
    (item: import('@/lib/tour-room/sayQueue').SayItem) => {
      setSayOptimistic((prev) => new Set([...prev, item.subject]));
      if (item.kind === 'arrival_bundle') {
        const scheduleItem =
          (item.poiKey ? room.schedule.find((it) => it.poi_key === item.poiKey) : undefined) ??
          room.schedule.find((it) => itemTitle(it) === item.spotTitle) ?? {
            title: item.spotTitle ?? '이 스팟',
            poi_key: item.poiKey ?? undefined,
          };
        setArrivalPrompt(null);
        openArrivalSheet(scheduleItem);
      } else if (item.kind === 'return_time') {
        setRetTime('');
        setRetRest(roundUpTo5(kstPlusMinutes(30)));
        setSheet('return');
      } else if (item.kind === 'briefing') {
        void sendMorningBriefing();
      } else if (item.kind === 'preset' && item.presetKey) {
        const preset = quickRepliesForRole('driver').find((p) => p.key === item.presetKey);
        if (preset) void sendChannelPreset(preset, 'ko');
      }
    },
    [room.schedule, openArrivalSheet, sendMorningBriefing, sendChannelPreset],
  );
  const dismissSayItem = useCallback(
    (item: import('@/lib/tour-room/sayQueue').SayItem) => {
      setSayDismissed((prev) => new Set([...prev, item.subject]));
      if (item.subject === (arrivalPrompt ? `arrival:${spotTitlesRef.current.get(arrivalPrompt.spotId)?.poiKey ?? arrivalPrompt.spotId}` : '')) {
        setArrivalPrompt(null);
      }
      sayBookkeep(item.urgency === 'required' && item.deadlineMs != null && rallyNowMs > item.deadlineMs ? 'say_expired' : 'say_dismissed', item.subject);
    },
    [arrivalPrompt, rallyNowMs, sayBookkeep],
  );


  const driverActions = useMemo<ActionGridItem[]>(() => {
    const base: ActionGridItem[] = [
      // C3 — attachment moved here from its own permanent composer column.
      // The tray is where "everything else you can send" already lives; the
      // paperclip was the only one paying rent on the input row.
      {
        key: 'attach',
        label: '사진·파일',
        Icon: IconPaperclip,
        tone: 'slate',
        onClick: () => attachRef.current?.click(),
      },
      { key: 'board', label: '타세요', Icon: BusFront, tone: 'blue', onClick: announceVehicleArrived },
      // The roster/seat map was reachable from the guide's chat but nowhere in
      // the cockpit — the driver is the person actually counting heads at the
      // door. Same self-contained component, and the manifest endpoint already
      // authorises the driver role.
      ...(roomToken
        ? [
            {
              key: 'manifest',
              label: '명단·좌석',
              Icon: Users,
              tone: 'slate' as const,
              onClick: () => setSheet('manifest'),
            },
          ]
        : []),
      { key: 'delay', label: '지연', Icon: Timer, tone: 'amber', onClick: () => setSheet('delay') },
      {
        key: 'return',
        label: '복귀시간',
        Icon: AlarmClock,
        tone: 'amber',
        onClick: () => {
          const rest = roundUpTo5(kstPlusMinutes(30));
          setRetRest(rest);
          setRetTime('');
          setSheet('return');
        },
      },
      { key: 'schedule', label: '일정·도착', Icon: MapIcon, tone: 'violet', onClick: () => setSheet('schedule') },
      { key: 'parking', label: '주차핀', Icon: SquareParking, tone: 'blue', onClick: dropParkingPin },
      {
        key: 'share',
        label: '위치공유',
        Icon: Navigation,
        tone: 'cyan',
        active: sharingLive,
        pressed: shareLocation,
        keepOpen: true,
        hint: shareLocation ? shareLabel : null,
        onClick: toggleShareLocation,
      },
      {
        key: 'issue',
        label: '차량문제',
        Icon: TriangleAlert,
        tone: 'rose',
        onClick: () => {
          void confirmSheet({
            title: '차량 문제',
            message: '차량 문제를 손님과 운영팀에 알릴까요?',
            confirmLabel: '알리기',
            danger: true,
          }).then((ok) => {
            if (ok) void signal({ type: 'vehicle_issue' }, '운영팀에 알렸어요 ✓');
          });
        },
      },
      {
        key: 'departing',
        label: '출발 ✓',
        Icon: BusFront,
        tone: 'green',
        onClick: () => {
          const guests = room.number_of_guests != null ? `${room.number_of_guests}명` : '전원';
          void confirmSheet({
            title: '출발 전 인원 확인',
            message: (
              <>
                <span className="mb-1 block text-4xl font-bold tabular-nums">{guests}</span>
                손님 {guests} 탑승을 확인했나요? 확인을 누르면 출발 안내가 나갑니다.
              </>
            ),
            confirmLabel: '출발 안내 보내기',
          }).then((ok) => {
            if (ok) void signal({ type: 'departing' }, '인원 확인·출발 안내 완료 ✓');
          });
        },
      },
      {
        /**
         * Feature audit F4. The guest could report a LOST item; the driver —
         * the one holding it — could not report a FOUND one. Sits here rather
         * than on a screen of its own because the moment it is needed is the
         * driver walking the empty van with one hand full.
         */
        key: 'found_item',
        label: '분실물 발견',
        Icon: Luggage,
        tone: 'amber',
        onClick: () => {
          void confirmSheet({
            title: '분실물 발견',
            message: '차에 두고 내린 물건이 있다고 손님과 운영팀에 알릴까요? 물건이 무엇인지는 적지 않아요 — 주인을 운영팀이 확인합니다.',
            confirmLabel: '알리기',
          }).then((ok) => {
            if (ok) void signal({ type: 'found_item' }, '분실물 안내 완료 ✓');
          });
        },
      },
      { key: 'dining', label: '식당 추천', Icon: Utensils, tone: 'orange', onClick: () => void sendDiningPicks() },
      { key: 'assist', label: 'AI 도우미', Icon: Sparkles, tone: 'violet', onClick: () => setSheet('assist') },
      { key: 'briefing', label: '아침브리핑', Icon: Sunrise, tone: 'amber', onClick: () => void sendMorningBriefing() },
      { key: 'photo', label: '차량사진', Icon: Camera, tone: 'slate', onClick: () => vehiclePhotoRef.current?.click() },
    ];
    // §11.D D7 — the private-charter money tools never appear on a join tour.
    if (isJoin) return base;
    return [
      ...base,
      {
        key: 'expense',
        label: '지출·정산',
        Icon: Wallet,
        tone: 'green',
        onClick: () => {
          setSheet('expense');
          void loadExtras();
        },
      },
      { key: 'overtime', label: '초과근무', Icon: Timer, tone: 'orange', onClick: openOvertime },
      { key: 'summary', label: '오늘 요약', Icon: FileText, tone: 'slate', onClick: () => void openDaySummary() },
    ];
  }, [
    announceVehicleArrived,
    confirmSheet,
    roomToken,
    dropParkingPin,
    isJoin,
    loadExtras,
    openDaySummary,
    openOvertime,
    room.number_of_guests,
    sendDiningPicks,
    sendMorningBriefing,
    shareLabel,
    shareLocation,
    sharingLive,
    signal,
    toggleShareLocation,
  ]);


  return (
    <Screen>
      {/* C2 — header on the app's chrome grammar (§D-5 U-D13).
       *
       * It used to be five text pills in one row on the cockpit's own border
       * chrome, so the TOUR NAME — the driver's only cue for which team they
       * are carrying — collapsed to "Jej…" (사용자 스크린샷 2026-07-28). Same
       * diet the guest room and staff shell already went through: chrome
       * shares the canvas, the left control is an icon, and the right cluster
       * is three 40px icon columns on a 44px touch row.
       *
       * Connection is a dot, not a sentence. "연결됨" cost ~60px of title width
       * to say what a green dot says at a glance; the sentence stays for screen
       * readers, where it is the only form that works. */}
      <header
        className="tr-chrome-line-b z-30 flex shrink-0 items-center gap-0.5 bg-[var(--tr-chrome)] px-2"
        style={{ minHeight: 'var(--tr-header-h)' }}
      >
        {onExit ? (
          <button
            type="button"
            onClick={onExit}
            aria-label="대시보드로 돌아가기"
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink)] active:bg-[var(--tr-bubble-system)]"
            data-testid="cockpit-exit"
          >
            <ChevronLeft size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
          </button>
        ) : null}
        <div className="text-cjk-safe flex min-w-0 flex-1 items-center gap-1.5 px-1">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              connected ? 'bg-[var(--tr-safe)]' : 'animate-pulse bg-[var(--tr-ink-3)]'
            }`}
            aria-hidden
          />
          <h1 className="tr-title min-w-0 truncate text-[var(--tr-ink)]" data-testid="cockpit-title">
            {tourTitle}
          </h1>
          <span className="sr-only" data-testid="cockpit-connection">
            {connected ? '연결됨' : '연결 중'}
          </span>
        </div>
        {pushSupported() ? (
          <button
            type="button"
            onClick={() => void enablePush(true)}
            disabled={pushOn}
            aria-label={pushOn ? '알림 켜짐' : '알림 켜기'}
            /* The signature accent is reclaimed: it was making a secondary
               toggle the brightest object on a driving screen. On = a quiet
               "safe" tint; off = neutral, i.e. an invitation, not an alarm. */
            className={`flex h-11 w-10 shrink-0 items-center justify-center rounded-full ${
              pushOn ? 'text-[var(--tr-safe)]' : 'text-[var(--tr-ink-2)] active:bg-[var(--tr-bubble-system)]'
            }`}
            data-testid="driver-push-toggle"
          >
            <Bell size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
          </button>
        ) : null}
        {/* A5 — explicit light/dark flip; default (system) renders dark. */}
        <button
          type="button"
          onClick={() => updateSettings({ theme: cockpitDark ? 'light' : 'dark' })}
          aria-label={cockpitDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink-2)] active:bg-[var(--tr-bubble-system)]"
          data-testid="cockpit-theme-toggle"
        >
          {cockpitDark ? (
            <IconThemeLight size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
          ) : (
            <IconThemeDark size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
          )}
        </button>
        {OPS_PHONE ? (
          <a
            href={`tel:${OPS_PHONE}`}
            aria-label="운영팀에 전화"
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink)] active:bg-[var(--tr-bubble-system)]"
            data-testid="driver-ops-call"
          >
            <IconPhone size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
          </a>
        ) : null}
      </header>

      {/* phase-aware destination + nav */}
      <div className="tr-chrome-line-b px-4 py-2">
        <p className="tr-label font-bold uppercase tracking-wide text-[var(--tr-ink-3)]">{destLabel}</p>
        <p className="tr-body-lg mt-0.5 truncate font-bold text-[var(--tr-ink)]">{destTitle}</p>
        {navDest ? <NavRow dest={navDest} /> : null}
      </div>

      {/* SG-2b-β — the rally overage strip. Mockup ②'s +MM:SS lives HERE,
          from T+0: staff have no crying-wolf problem (the guest hero waits
          for T+5 — the tested 'due stays quiet' decision stands). */}
      {rallyNotice !== null &&
        !rallyNotice.cancelled &&
        rallyNotice.targetMs !== null &&
        rallyPastMs !== null &&
        rallyPastMs >= 0 && (
          <div
            data-testid="cockpit-rally-strip"
            className="tr-chrome-line-b flex items-center justify-between gap-3 bg-[var(--tr-danger-soft)] px-4 py-2"
          >
            <div className="text-cjk-safe min-w-0">
              <p className="tr-label text-cjk-safe font-bold text-[var(--tr-ink-2)]">
                {`집합 ${formatTargetTime(rallyNotice.targetMs, 'ko')}`}
                {rallyNotice.point ? ` · ${rallyNotice.point}` : ''}
              </p>
              <p className="tr-meta text-cjk-safe text-[var(--tr-ink-3)]">
                {`${formatTargetTime(rallyNotice.targetMs + RALLY_GRACE_MS, 'ko')} 대기 종료`}
              </p>
            </div>
            <NumeralClock
              mode="up"
              format="clock"
              targetMs={rallyNotice.targetMs}
              initialNowMs={rallyNowMs}
              testId="cockpit-rally-overage"
            />
          </div>
        )}

      {/* T+12 — "전원 탑승했나요?" Three answers, all one tap; no answer means
          the T+15 default fires (N-1, 사장님 승인). */}
      {rallyPromptVisible && rallyNotice && (
        <div
          data-testid="cockpit-rally-prompt"
          className="tr-chrome-line-b bg-[var(--tr-warn-soft)] px-4 py-3"
        >
          <p className="tr-card-text text-cjk-body font-bold text-[var(--tr-ink)]">
            {`${formatTargetTime(rallyNotice.targetMs! + RALLY_GRACE_MS, 'ko')} 대기 종료가 다가옵니다 — 전원 탑승했나요?`}
          </p>
          <div className="text-cjk-safe mt-2 flex gap-2">
            <button
              type="button"
              data-testid="rally-all-aboard"
              onClick={() => {
                setRallyPromptDone(rallyNotice.messageId);
                void postRallyCrossing('rally_all_aboard', rallyNotice.messageId).then((ok) =>
                  say(ok ? '전원 탑승 확인 ✓ — 낙오 안내 없이 진행합니다' : '실패 — 다시 시도해 주세요'),
                );
              }}
              className="tr-btn-physical text-cjk-safe flex-1 rounded-full bg-[var(--tr-safe-soft)] px-3 py-2.5 tr-label font-bold text-[var(--tr-ink)]"
            >
              전원 탑승
            </button>
            <button
              type="button"
              data-testid="rally-extend"
              onClick={() => {
                pendingExtendNoticeIdRef.current = rallyNotice.messageId;
                setRetTime(roundUpTo5(kstPlusMinutes(15)));
                setSheet('return');
              }}
              className="tr-btn-physical text-cjk-safe flex-1 rounded-full bg-[var(--tr-surface)] px-3 py-2.5 tr-label font-bold text-[var(--tr-ink)]"
            >
              +15분 연장
            </button>
            <button
              type="button"
              data-testid="rally-manual-departed"
              onClick={() => {
                void confirmSheet({
                  title: '낙오 처리',
                  message: '미탑승 일행에게 재합류 안내(낙오 캡슐)가 즉시 발송됩니다.',
                  confirmLabel: '지금 발송',
                  danger: true,
                }).then((ok) => {
                  if (!ok) return;
                  setRallyPromptDone(rallyNotice.messageId);
                  void postRallyCrossing('rally_departed', rallyNotice.messageId, { manual: true }).then(
                    (sent) => say(sent ? '재합류 안내 발송 ✓' : '실패 — 다시 시도해 주세요'),
                  );
                });
              }}
              className="tr-btn-physical text-cjk-safe rounded-full bg-[var(--tr-danger-soft)] px-3 py-2.5 tr-label font-bold text-[var(--tr-ink)]"
            >
              낙오 처리
            </button>
          </div>
        </div>
      )}

      {/* bubbles — tap anywhere to enter chat focus mode; pinch = font zoom */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      {/* 🔴 C3 added a "대화 전체" chip here and C5 removed it again — recorded
          rather than quietly reverted, because the reasoning is the useful part.
          C3's chip existed to advertise focus mode, whose whole value was
          escaping the feed's `slice(-8)` cap. C5 deleted the cap, and the walk
          then measured focus mode as STRICTLY WORSE than the normal view: it
          keeps the quick chips, composer and mic and merely adds a collapse
          button, so bottom stack 179px → 241px and visible messages 9 → 8.
          A labelled control pointing at a worse screen is worse than no
          control, so the chip is gone. Focus mode itself is left alone (tap the
          feed) — deleting live behaviour is a separate decision, filed as a
          follow-up in §D-5. */}
      <div
        ref={feedRef}
        /* C5 — the scroll now belongs to ChatFeed (it owns the window, the
           "show earlier" control and the near-bottom follow). This wrapper only
           donates height, the pinch-zoom and the tap-to-focus gesture; leaving
           `overflow-y-auto` here would nest two scrollers and the inner one
           would never reach its own bottom. */
        className="flex min-h-0 flex-1 flex-col px-2"
        style={{ zoom: chatZoom, touchAction: 'pan-y' }}
        data-testid="driver-feed"
      >
        {/* C5 (§D-5 U-D7/U-D15) — the shared feed, not a second renderer.

            The cockpit carried ~95 lines of its own bubble code that had
            drifted behind the room's: no reactions, no quoted replies, no
            read state, and a hard `messages.slice(-8)` window — which is the
            actual reason the owner saw "몇 줄밖에 안 보인다". A cap, not a
            pixel shortage: no amount of trimming chrome could have shown a
            ninth message.

            ChatFeed already handles attachments, location cards and the
            optimistic echo, and it windows at 60 with a "show earlier"
            control. The driver's own ETA chips survive through
            `renderMessageExtra`; the INPUT is untouched (U-D7 — voice-first
            while the vehicle is moving). */}
        <ChatFeed
          messages={recent}
          viewerLocale="ko"
          viewerRole="driver"
          textScale={deviceSettings.textScale}
          variant="cockpit"
          renderMessageExtra={renderEtaReply}
        />
      </div>
      </div>

      {/* B1 — hidden camera input for the vehicle photo */}
      <input
        ref={vehiclePhotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="cockpit-vehicle-photo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void sendVehiclePhoto(file);
        }}
      />
      {/* General attachment picker. No `capture` here on purpose — the vehicle
          photo wants the camera, but a ticket or a voucher usually already
          exists in the gallery or the files app. */}
      <input
        ref={attachRef}
        type="file"
        accept={ATTACH_ACCEPT}
        className="hidden"
        data-testid="cockpit-attach-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void sendAttachment(file);
        }}
      />

      {/* X15 — arrival detected. An OFFER, never a send: one tap opens the same
          prefilled sheet the driver would have opened by hand, and dismissing
          it costs nothing. The geofence's own 120s cooldown stops this
          reappearing while parked at the same stop. */}
      {/* SG-6 — X15's prompt, generalized: the queue card owns this slot.
          The geofence hit rides in as the queue's top required item. */}
      <SayQueueCard items={sayItems} onFire={fireSayItem} onDismiss={dismissSayItem} />

      {toast ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center">
          <span className="tr-anim-panel-in tr-body-lg rounded-full bg-black/80 px-5 py-2 font-bold text-[var(--tr-ink)]">{toast}</span>
        </div>
      ) : null}

      {/* premium voice-input animations (listening bars, undo fill, send shimmer) */}
      <style>{`
        @keyframes cockpit-bar { 0% { height: 22%; } 100% { height: 100%; } }
        .cockpit-bar { animation: cockpit-bar 620ms ease-in-out infinite alternate; }
        @keyframes cockpit-fill { from { width: 0%; } to { width: 100%; } }
        .cockpit-fill { animation: cockpit-fill ${UNDO_WINDOW_MS}ms linear forwards; }
        @keyframes cockpit-shimmer { 0%, 100% { opacity: .45; } 50% { opacity: 1; } }
        .cockpit-shimmer { animation: cockpit-shimmer 1150ms ease-in-out infinite; }
      `}</style>

      {/* failed-send retry (T0-4): queued on the device, one tap re-sends all. */}
      {failedCount > 0 ? (
        <button
          type="button"
          onClick={() => void retryFailed()}
          className="text-cjk-safe tr-body mx-4 mb-1.5 flex items-center justify-center gap-2 rounded-2xl bg-[var(--tr-surface-2)] py-2.5 font-bold text-[var(--tr-danger)] transition-transform active:scale-[0.99]"
          data-testid="cockpit-retry-failed"
        >
          <TriangleAlert size={TR_ICON.chip} strokeWidth={TR_STROKE.default} aria-hidden />
          전송 실패 {failedCount}건 · 다시 보내기
        </button>
      ) : null}

      {/* input dock — idle: type + mic; else elegant recording/undo/sending states */}
      {phase === 'idle' ? (
        <>
          {/* A6 — driver quick messages: one tap sends the 5-locale capsule
              (zero LLM), sized for use at the wheel. */}
          <div
            className="tr-chiprow flex gap-1.5 px-4 pt-1.5"
            style={{ scrollbarWidth: 'none' }}
            data-testid="driver-quick-replies"
          >
            {DRIVER_QUICK_REPLIES.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  void (async () => {
                    const ok = await sendChannelPreset(preset, 'ko');
                    say(ok ? '전송 완료 ✓' : '전송 대기 — 아래 재전송을 눌러 주세요');
                  })();
                }}
                /* N5 — this row had the same defect N1 closed on the guest
                   chips, and nobody had measured it: boundary 1.16 (light) /
                   1.45 (dark) against WCAG 1.4.11's 3.0, because `--tr-hairline`
                   is 10% ink. `.tr-chip-tap--quiet` swaps that for the chip's
                   own text colour, which is legible on every skin by
                   construction and needs no new token. Conversational row, so
                   the quiet weight — the urgent full-strength edge belongs to
                   the guest signal row. */
                className="tr-body tr-chip-tap tr-chip-tap--quiet flex h-11 shrink-0 items-center gap-1 rounded-full bg-[var(--tr-surface)] px-3.5 font-semibold text-[var(--tr-ink)] transition-transform active:scale-95"
                data-testid={`driver-quick-${preset.key}`}
              >
                <span aria-hidden>{preset.emoji}</span>
                {preset.text.ko}
              </button>
            ))}
          </div>
          {/* typed send — always available (webview fallback / quiet typing) */}
          <div className="px-4 pt-1.5">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendText();
              }}
              className="flex items-end gap-2"
            >
              {/* Kakao-grade "+" — the 12 action buttons used to sit permanently
                  open above this row. Folded by default; rotates into an × when
                  the tray is out. */}
              <button
                type="button"
                onClick={() => setActionsOpen((v) => !v)}
                aria-expanded={actionsOpen}
                aria-label={actionsOpen ? '기능 닫기' : '기능 열기'}
                className="tr-btn-flat shrink-0 rounded-2xl p-2.5 text-[var(--tr-ink-2)]"
                data-testid="cockpit-actions-toggle"
              >
                <IconPlus
                  size={TR_ICON.nav}
                  strokeWidth={TR_STROKE.default}
                  aria-hidden
                  className={`transition-transform duration-200 ${actionsOpen ? 'rotate-45' : ''}`}
                />
              </button>
              {/* C3 — the paperclip moved INTO the "+" tray (§D-5 U-D14).
                  Attachment already lives there; a second permanent 44px
                  column for it was the difference between an input that fits
                  its own placeholder and one that clips it. */}
              <textarea
                value={textDraft}
                onChange={(event) => setTextDraft(event.target.value)}
                rows={1}
                maxLength={2000}
                placeholder="메시지"
                enterKeyHint="send"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendText();
                  }
                }}
                className="tr-body min-w-0 flex-1 resize-none rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3.5 py-2.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-ink-3)] focus:outline-none"
                data-testid="driver-text-input"
              />
              {/* Send appears only once there is something to send — the text
                  button held ~80px permanently for a control that is unusable
                  most of the time. Messenger grammar, and the width goes to
                  the field. */}
              {textDraft.trim() ? (
                <button
                  type="submit"
                  disabled={textSending}
                  aria-label="보내기"
                  className="tr-btn-raised flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
                  data-testid="driver-text-send"
                >
                  {textSending ? (
                    <span className="tr-label font-bold">…</span>
                  ) : (
                    <IconSubmit size={TR_ICON.chip} strokeWidth={TR_STROKE.default} aria-hidden />
                  )}
                </button>
              ) : null}
            </form>
          </div>
          <div className="px-4 pb-2 pt-1.5">
            <MicPrime variant="dark" locale="ko" className="mb-1.5" />
            <button
              type="button"
              onClick={startRecording}
              className="text-cjk-safe tr-btn-raised flex w-full items-center justify-center gap-2.5 rounded-3xl bg-[var(--tr-bubble-me)] py-4 text-2xl font-bold text-[var(--tr-bubble-me-ink)]"
              data-testid="driver-mic"
            >
              <IconMic size={TR_ICON.tile} aria-hidden />
              눌러서 말하기
            </button>
          </div>
        </>
      ) : phase === 'recording' ? (
        <div className="px-4 pb-2 pt-1.5">
          <div
            className="mb-2 flex min-h-[56px] items-center gap-3 rounded-2xl bg-[var(--tr-surface)] px-4 py-3"
            data-testid="cockpit-listening"
          >
            <span className="flex h-6 items-end gap-0.5" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={recMode === 'device' ? 'cockpit-bar w-1 rounded-full bg-red-400' : 'w-1 rounded-full bg-red-400'}
                  style={
                    recMode === 'device'
                      ? { animationDelay: `${i * 110}ms` }
                      : { height: `${Math.max(22, Math.min(100, 22 + level * 130))}%`, transition: 'height 90ms linear' }
                  }
                />
              ))}
            </span>
            <p className="tr-body-lg min-w-0 flex-1 truncate text-[var(--tr-ink)]">
              {recMode === 'device' ? interim || '듣는 중…' : '녹음 중…'}
            </p>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="text-cjk-safe w-full rounded-3xl bg-red-500 py-4 text-2xl font-bold text-[var(--tr-ink)] transition-transform active:scale-[0.99]"
            data-testid="driver-mic"
          >
            ■ 말 끝났어요
          </button>
        </div>
      ) : phase === 'transcribing' ? (
        <div className="px-4 pb-2 pt-1.5">
          <div
            className="cockpit-shimmer tr-body-lg w-full rounded-3xl bg-[var(--tr-surface-2)] py-3 text-center font-bold text-[var(--tr-ink-2)]"
            data-testid="cockpit-transcribing"
          >
            인식 중…
          </div>
        </div>
      ) : phase === 'pending' ? (
        <div className="px-4 pb-2 pt-1.5">
          <p className="mb-2 line-clamp-3 text-center tr-display font-medium text-[var(--tr-ink)]">“{pending?.text}”</p>
          {pending?.confirm ? (
            // Low-confidence transcript: explicit send, no auto-timer (T0-3).
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={cancelPending}
                className="text-cjk-safe tr-body-lg rounded-3xl bg-[var(--tr-surface-2)] py-3 font-bold text-[var(--tr-ink)] transition-transform active:scale-[0.99]"
                data-testid="cockpit-cancel-send"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => pending && void sendVoice(pending)}
                className="text-cjk-safe tr-btn-raised tr-body-lg rounded-3xl bg-[var(--tr-bubble-me)] py-3 font-bold text-[var(--tr-bubble-me-ink)]"
                data-testid="cockpit-confirm-send"
              >
                보내기
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={cancelPending}
              className="text-cjk-safe relative w-full overflow-hidden rounded-3xl bg-[var(--tr-surface-2)] py-3 transition-transform active:scale-[0.99]"
              data-testid="cockpit-undo-send"
            >
              <span aria-hidden className="cockpit-fill absolute bottom-0 left-0 h-1.5 rounded-full bg-white/80" />
              <span className="tr-body-lg relative font-bold text-[var(--tr-ink)]">탭하여 취소</span>
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 pb-2 pt-1.5">
          <div
            className="cockpit-shimmer tr-body-lg w-full rounded-3xl bg-[var(--tr-surface-2)] py-3 text-center font-bold text-[var(--tr-ink-2)]"
            data-testid="cockpit-sending"
          >
            전송 중…
          </div>
        </div>
      )}

      {/* C7 — chat focus mode is gone (§D-5).

          It existed to escape the feed's 8-message cap; C5 deleted the cap, and
          the walk then measured the mode as strictly WORSE than the normal view
          (bottom stack 179→241px, visible 9→8) because it kept the composer and
          the mic and merely added a collapse button.

          Repairing it would mean actually folding the bottom stack — i.e.
          hiding the MIC on a surface whose primary input is voice while the
          vehicle is moving. That is a worse screen than the one it replaces, so
          the mode is removed rather than fixed. Scrolling reaches the whole
          conversation now, which is what the mode was for.

          Removing it also frees the feed's tap: the wrapper used to swallow
          every tap to enter the mode, which would now fight ChatFeed's own
          long-press → reply/react sheet. */}
      <>
      {/* Kakao-grade action tray — folded by default (the "+" in the composer).
          These twelve used to be three permanently-open grids of identical grey
          buttons, eating the chat's vertical space in a moving vehicle. */}
      <ActionGrid
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        items={driverActions}
      />
        </>

      {/* sheets */}
      {sheet === 'assist' ? (
        <Sheet onClose={() => setSheet('none')} title="AI 도우미">
          {/* .dark so OperatorAssist's tr-* tokens match the cockpit's dark sheet. */}
          <div className="dark">
            <OperatorAssist bookingId={bookingId} roomSession={session} />
          </div>
        </Sheet>
      ) : null}

      {sheet === 'delay' ? (
        <Sheet onClose={() => setSheet('none')} title="몇 분 늦나요?">
          <div className="grid grid-cols-3 gap-3">
            {[5, 10, 15, 20, 30].map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => {
                  setSheet('none');
                  void signal({ type: 'delay', minutes }, `${minutes}분 지연 안내 완료 ✓`);
                }}
                className="text-cjk-safe rounded-2xl bg-[var(--tr-surface-2)] py-5 tr-display font-bold text-[var(--tr-ink)]"
              >
                +{minutes}분
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}

      {sheet === 'return' ? (
        <Sheet onClose={() => setSheet('none')} title="몇 시까지 차로 돌아올까요?">
          <div className="grid grid-cols-2 gap-3">
            {[30, 45, 60, 90].map((minutes) => {
              const time = kstPlusMinutes(minutes);
              return (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => {
                    setSheet('none');
                    void signal({ type: 'return_time', time }, `${time} 복귀 안내 완료 ✓`);
                  }}
                  className="text-cjk-safe rounded-2xl bg-[var(--tr-surface-2)] py-5 tr-display font-bold text-[var(--tr-ink)]"
                >
                  +{minutes}분 <span className="text-[var(--tr-ink-2)]">({time})</span>
                </button>
              );
            })}
          </div>
          {/* Free pick — the field always has variables the fixed chips miss. */}
          <p className="tr-label mb-2 mt-4 font-bold text-[var(--tr-ink-2)]">시계로 직접 설정</p>
          <TimeWheel value={retTime} onChange={setRetTime} restAt={retRest} testId="return-time-wheel" />
          <button
            type="button"
            disabled={!/^\d{2}:\d{2}$/.test(retTime)}
            onClick={() => {
              setSheet('none');
              void signal({ type: 'return_time', time: retTime }, `${retTime} 복귀 안내 완료 ✓`).then(
                (created) => {
                  // SG-2c — an extension links the chain: the old notice's
                  // resolution records WHICH notice replaced it, so the
                  // on-time metric can fold extensions instead of double
                  // counting (§H-1) and the stale T+15 crossing dissolves.
                  const pendingId = pendingExtendNoticeIdRef.current;
                  const nextId = (created as { message?: { id?: string } } | null)?.message?.id;
                  pendingExtendNoticeIdRef.current = null;
                  if (pendingId && nextId) {
                    setRallyPromptDone(pendingId);
                    void postRallyCrossing('rally_extended', pendingId, { next_notice_id: nextId });
                  }
                },
              );
            }}
            className="tr-btn-raised tr-body-lg mt-3 w-full rounded-2xl bg-[var(--tr-bubble-me)] py-4 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
            data-testid="return-time-send"
          >
            {/^\d{2}:\d{2}$/.test(retTime) ? `${retTime} 복귀 안내 보내기` : '시계를 돌려 시간을 고르세요'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSheet('none');
              void signal({ type: 'return_time', cancel: true }, '복귀 타이머 해제 ✓');
            }}
            className="text-cjk-safe tr-body-lg mt-3 w-full rounded-2xl bg-[var(--tr-surface-2)] py-4 font-semibold text-[var(--tr-ink-2)]"
          >
            타이머 해제
          </button>
        </Sheet>
      ) : null}

      {sheet === 'schedule' ? (
        <Sheet onClose={() => setSheet('none')} title="오늘 일정 · 도착 안내">
          <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
            {room.schedule.length === 0 ? <p className="tr-body-lg text-[var(--tr-ink-2)]">등록된 일정이 없어요.</p> : null}
            {room.schedule.map((item, index) => {
              const dest = destFrom(item);
              return (
                <div key={`${item.poi_key ?? item.title ?? index}`} className="rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
                  <p className="tr-body-lg font-semibold text-[var(--tr-ink)]">
                    {item.time ? `${item.time} · ` : ''}{itemTitle(item)}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {dest ? (
                      <a
                        href={kakaoNaviUrl(dest)}
                        onClick={() => {
                          window.setTimeout(() => window.open(kakaoWebRouteUrl(dest), '_blank'), 1200);
                        }}
                        className="text-cjk-safe tr-body flex-1 rounded-xl bg-[#FEE500] py-3 text-center font-bold text-black"
                      >
                        내비
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openArrivalSheet(item)}
                      className="text-cjk-safe tr-body flex-1 rounded-xl bg-[var(--tr-bubble-me)] py-3 font-bold text-[var(--tr-bubble-me-ink)]"
                      data-testid="cockpit-open-arrival"
                    >
                      도착 안내
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Sheet>
      ) : null}

      {sheet === 'manifest' && roomToken ? (
        <Sheet onClose={() => setSheet('none')} title="명단·좌석">
          {/* GuideSeatDashboard is self-contained (token + bookingId) and the
              manifest endpoint already authorises driver | guide | admin, so
              this needs no server change. */}
          <div className="max-h-[68vh] overflow-y-auto">
            <GuideSeatDashboard token={roomToken} bookingId={bookingId} />
          </div>
        </Sheet>
      ) : null}

      {sheet === 'summary' ? (
        <Sheet onClose={() => setSheet('none')} title="오늘 요약">
          {!daySummary ? (
            <SkeletonRows rows={4} className="py-2" />
          ) : (
            <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto" data-testid="day-summary">
              {/* SG-7a — 오늘의 나: four honest numbers. No ranking, ever
                  (사장님 D5/F-10). 정시는 상한 추정치다 — §H-1 각주. */}
              {daySummary.me ? (
                <div className="text-cjk-safe grid grid-cols-2 gap-2" data-testid="day-summary-me">
                  <div className="text-cjk-safe rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
                    <p className="tr-meta font-bold text-[var(--tr-ink-3)]">정시 출발</p>
                    <p className="tr-body-lg tr-num mt-0.5 font-bold text-[var(--tr-ink)]">
                      {daySummary.me.ontime.chains - daySummary.me.ontime.departed} / {daySummary.me.ontime.chains}
                    </p>
                  </div>
                  <div className="text-cjk-safe rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
                    <p className="tr-meta font-bold text-[var(--tr-ink-3)]">신호 응답</p>
                    <p className="tr-body-lg tr-num mt-0.5 font-bold text-[var(--tr-ink)]">
                      {daySummary.me.response.median_seconds != null
                        ? `중앙값 ${daySummary.me.response.median_seconds}초`
                        : `신호 ${daySummary.me.response.signals}건`}
                    </p>
                  </div>
                  <div className="text-cjk-safe rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
                    <p className="tr-meta font-bold text-[var(--tr-ink-3)]">들려준 해설</p>
                    <p className="tr-body-lg tr-num mt-0.5 font-bold text-[var(--tr-ink)]">{daySummary.me.narration}</p>
                  </div>
                  <div className="text-cjk-safe rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
                    <p className="tr-meta font-bold text-[var(--tr-ink-3)]">찍어준 사진</p>
                    <p className="tr-body-lg tr-num mt-0.5 font-bold text-[var(--tr-ink)]">{daySummary.me.photos}</p>
                  </div>
                </div>
              ) : null}
              {/* C5 — live dwell vs recommended, advisory only */}
              {daySummary.current ? (
                <div className="rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3" data-testid="day-summary-current">
                  <p className="tr-label font-bold text-[var(--tr-ink-2)]">현재 스팟</p>
                  <p className="tr-body mt-1 font-bold text-[var(--tr-ink)]">
                    {daySummary.current.title} · {daySummary.current.dwell_minutes}분째
                    {daySummary.current.recommended_minutes != null ? (
                      <span className="ml-1 font-medium text-[var(--tr-ink-2)]">
                        (추천 {daySummary.current.recommended_minutes}분
                        {daySummary.current.recommended_minutes - daySummary.current.dwell_minutes > 0
                          ? ` — ${daySummary.current.recommended_minutes - daySummary.current.dwell_minutes}분 여유`
                          : ' — 추천 시간 초과'}
                        )
                      </span>
                    ) : null}
                  </p>
                </div>
              ) : null}
              <div className="rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
                <p className="tr-label font-bold text-[var(--tr-ink-2)]">방문 스팟 {daySummary.visited.length}곳</p>
                {daySummary.visited.map((visit) => (
                  <p key={`${visit.title}-${visit.at}`} className="tr-body mt-1 text-[var(--tr-ink)]">
                    {new Date(visit.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })}{' '}
                    · {visit.title}
                  </p>
                ))}
                {daySummary.span ? (
                  <p className="tr-card-text mt-2 text-[var(--tr-ink-2)]">
                    첫 도착 → 마지막 도착: 약 {Math.floor(daySummary.span.minutes / 60)}시간{' '}
                    {daySummary.span.minutes % 60}분
                  </p>
                ) : null}
              </div>
              {/* §11.D D7 — the cash-settlement money roll-up is a private-only
                  tool; hidden on a JOIN tour (the visited-spots / run-span
                  summary above stays — it is neutral operational info). */}
              {!isJoin ? (
              <div className="rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
                <p className="tr-label font-bold text-[var(--tr-ink-2)]">정산 ({daySummary.money.count}건)</p>
                <p className="tr-body tr-num mt-1 text-[var(--tr-ink)]">기록 합계 {formatKrw(daySummary.money.logged_total)}</p>
                <p className="tr-body tr-num text-[var(--tr-ink)]">수취 완료 {formatKrw(daySummary.money.settled_total)}</p>
                <p className="tr-body tr-num font-bold text-[var(--tr-ink)]">
                  미수취 {formatKrw(daySummary.money.unsettled_total)}
                </p>
                {daySummary.money.overtime_total > 0 ? (
                  <p className="tr-card-text mt-1 text-[var(--tr-ink-2)]">
                    초과근무분 {formatKrw(daySummary.money.overtime_total)} 포함
                  </p>
                ) : null}
              </div>
              ) : null}
            </div>
          )}
        </Sheet>
      ) : null}

      {sheet === 'welcome' ? (
        <Sheet onClose={() => setSheet('none')} title="이름 사인 — 손님 쪽으로 들어주세요">
          <div className="flex flex-col items-center px-2 pb-4 pt-6 text-center">
            <p className="tr-meta font-bold uppercase tracking-[0.2em] text-[var(--tr-ink-3)]">WELCOME</p>
            <p
              data-testid="welcome-name"
              className="text-cjk-safe mt-3 text-5xl font-bold leading-tight text-[var(--tr-ink)]"
            >
              {welcomeName === null ? '…' : welcomeName || '손님'}
            </p>
            {room.number_of_guests != null && (
              <p className="tr-body-lg tr-num mt-3 text-[var(--tr-ink-2)]">{`${room.number_of_guests}명`}</p>
            )}
            <p className="tr-label text-cjk-body mt-6 text-[var(--tr-ink-3)]">
              양쪽이 서로를 확인하면 상봉 끝 — 인사 음성은 [타세요] 안내로 이어가세요.
            </p>
          </div>
        </Sheet>
      ) : null}
      {sheet === 'arrival' && arrItem ? (
        <Sheet onClose={() => setSheet('none')} title={`${itemTitle(arrItem)} 도착 안내`}>
          <div className="tr-stagger flex max-h-[62vh] flex-col gap-3 overflow-y-auto">
            {typeof arrItem.poi_key === 'string' && arrItem.poi_key ? (
              <>
                <input
                  ref={meetingPhotoRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void sendMeetingPhoto(file);
                  }}
                />
                <button
                  type="button"
                  data-testid="meeting-photo-capture"
                  disabled={meetingPhotoBusy}
                  onClick={() => meetingPhotoRef.current?.click()}
                  className="tr-btn-physical text-cjk-safe flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-[var(--tr-surface-2)] px-4 tr-label font-bold text-[var(--tr-ink)] disabled:opacity-50"
                >
                  {meetingPhotoBusy ? '전송 중…' : '📸 집합장소 사진 찍기 (한 번이면 영구 해결)'}
                </button>
              </>
            ) : null}
            {/* B4 — operator prep: hours/closed/tips at a glance before sending */}
            {arrBriefing && arrBriefing.length > 0 ? (
              <div className="rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3" data-testid="arrival-briefing">
                <p className="tr-label mb-1.5 font-bold text-[var(--tr-ink-2)]">스팟 브리핑</p>
                {arrBriefing.map((line, index) => (
                  <p key={index} className="tr-card-text leading-relaxed text-[var(--tr-ink)]">
                    {line}
                  </p>
                ))}
              </div>
            ) : null}

            {/* per-day variable ① — parking pin (auto-captured on open) */}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
              <p className="tr-body min-w-0 font-semibold text-[var(--tr-ink)]">
                <SquareParking size={TR_ICON.chip} strokeWidth={TR_STROKE.default} aria-hidden className="mr-1.5 inline-block align-[-2px]" />
                주차핀 {arrCoords ? '✓ 현재 위치' : '캡처 안 됨'}
              </p>
              <button
                type="button"
                onClick={captureArrCoords}
                className="text-cjk-safe tr-label shrink-0 rounded-xl bg-[var(--tr-surface)] px-3 py-2 font-bold text-[var(--tr-ink)]"
              >
                다시 캡처
              </button>
            </div>

            {/* per-day variable ② — meeting time (no default, must choose) */}
            <div className="rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
              <p className="tr-body mb-2 font-semibold text-[var(--tr-ink)]">집합 시간</p>
              <div className="grid grid-cols-4 gap-2">
                {[30, 40, 60, 90].map((minutes) => {
                  const time = kstPlusMinutes(minutes);
                  const selected = !arrNoMeeting && arrTime === time;
                  return (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => {
                        setArrNoMeeting(false);
                        setArrTime(time);
                      }}
                      className={`text-cjk-safe tr-body rounded-xl py-3 text-center font-bold ${
                        selected
                          ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                          : 'bg-[var(--tr-surface)] text-[var(--tr-ink)]'
                      }`}
                    >
                      +{minutes}분
                      <span className="tr-meta tr-num block font-medium text-current opacity-70">{time}</span>
                    </button>
                  );
                })}
              </div>
              {/* free pick — the clock dial replaces the fiddly native
                  time input; any minute is one thumb-flick away */}
              <div className="mt-2">
                <TimeWheel
                  value={arrNoMeeting ? '' : arrTime}
                  onChange={(hhmm) => {
                    setArrNoMeeting(false);
                    setArrTime(hhmm);
                  }}
                  restAt={arrRest}
                  testId="arrival-time-input"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setArrNoMeeting(!arrNoMeeting);
                  setArrTime('');
                }}
                className={`text-cjk-safe tr-label mt-2 w-full rounded-xl px-3 py-2.5 font-bold ${
                  arrNoMeeting
                    ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                    : 'bg-[var(--tr-surface)] text-[var(--tr-ink-2)]'
                }`}
              >
                집합 없이
              </button>
            </div>

            {/* sticky per-POI toggles (prefilled from the profile) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setArrFollow(arrFollow === 'follow' ? 'free' : 'follow')}
                className={`tr-body flex items-center justify-center gap-1.5 rounded-2xl px-3 py-3 font-bold ${
                  arrFollow === 'follow'
                    ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                    : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink)]'
                }`}
                data-testid="arrival-follow-toggle"
              >
                {arrFollow === 'follow' ? (
                  <>
                    <IconWalking size={TR_ICON.action} aria-hidden />
                    스태프 인솔
                  </>
                ) : (
                  <>
                    <IconExplore size={TR_ICON.action} aria-hidden />
                    자유 관람
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setArrTicket(!arrTicket)}
                className={`text-cjk-safe tr-body flex items-center justify-center gap-1.5 rounded-2xl px-3 py-3 font-bold ${
                  arrTicket
                    ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                    : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink)]'
                }`}
              >
                <IconTicket size={TR_ICON.action} aria-hidden />
                입장권 {arrTicket ? '필요' : '불필요'}
              </button>
            </div>

            {/* J1 — adult admission (sticky): prices the guest's ticket line */}
            {arrTicket ? (
              <input
                inputMode="numeric"
                value={arrTicketKrw}
                onChange={(event) => setArrTicketKrw(event.target.value.replace(/\D/g, ''))}
                placeholder="성인 입장권 가격 (원, 선택 — 예: 5000)"
                className="tr-body w-full rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-2)]"
                data-testid="arrival-ticket-krw"
              />
            ) : null}

            {/* A4 — headline event: sticky label + today's O/X confirmation */}
            <div className="rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
              <input
                value={arrEventLabel}
                onChange={(event) => {
                  setArrEventLabel(event.target.value);
                  if (!event.target.value.trim()) setArrEventStatus(null);
                }}
                placeholder="이벤트명 (예: 해녀 공연 14:00) — 선택"
                className="tr-body w-full rounded-xl bg-[var(--tr-surface)] px-3 py-2.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-2)]"
                data-testid="arrival-event-label"
              />
              {arrEventLabel.trim() ? (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'on' as const, label: '오늘 진행', withDone: true },
                      { value: 'off' as const, label: '오늘 안 함', withDone: false },
                      { value: null, label: '미확인', withDone: false },
                    ]
                  ).map((option) => (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() => setArrEventStatus(option.value)}
                      className={`tr-label text-cjk-safe flex items-center justify-center gap-1 rounded-xl py-2.5 font-bold ${
                        arrEventStatus === option.value
                          ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                          : 'bg-[var(--tr-surface)] text-[var(--tr-ink-2)]'
                      }`}
                    >
                      {option.label}
                      {option.withDone ? <IconDone size={TR_ICON.meta} aria-hidden /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <textarea
              value={arrNote}
              onChange={(event) => setArrNote(event.target.value)}
              placeholder="관람 순서·노선 메모 (선택 — 다음부터 자동 채워짐)"
              rows={2}
              className="tr-body w-full resize-none rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-2)]"
            />

            <button
              type="button"
              onClick={() => void sendArrivalBundle()}
              disabled={arrBusy || (!arrNoMeeting && !/^\d{2}:\d{2}$/.test(arrTime))}
              className="text-cjk-safe tr-btn-raised tr-body-lg w-full rounded-2xl bg-[var(--tr-bubble-me)] py-4 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
              data-testid="arrival-send"
            >
              {arrBusy ? '전송 중…' : '전원 발송'}
            </button>
          </div>
        </Sheet>
      ) : null}

      {/* §11.D D7 — private-only; the !isJoin guard keeps a stale `sheet`
          state from surfacing the settlement sheet on a join tour. */}
      {sheet === 'expense' && !isJoin ? (
        <Sheet onClose={() => setSheet('none')} title="지출·정산">
          {/* T1-2 — the driver's own advanced expenses awaiting cash. Tap
              수취완료 when the guest pays (guide-less private tour). */}
          {myUnsettledExtras.length > 0 ? (
            <div className="mb-4 flex flex-col gap-2" data-testid="cockpit-settle-list">
              <p className="tr-label font-bold text-[var(--tr-ink-2)]">
                받을 돈 · 합계 {formatKrw(myUnsettledExtras.reduce((sum, e) => sum + e.amount_krw, 0))}
              </p>
              {myUnsettledExtras.map((e) => (
                <div key={e.id} className="flex items-center gap-2 rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="tr-body block truncate font-semibold text-[var(--tr-ink)]">
                      {EXTRA_KIND_LABELS[e.kind as keyof typeof EXTRA_KIND_LABELS] ?? e.kind} · {e.item}
                    </span>
                    <span className="tr-card-text block text-[var(--tr-ink-2)]">
                      {formatKrw(e.amount_krw)} · {e.status === 'confirmed' ? '손님 확인됨' : '미확인'}
                      {e.receipt_photo_url ? (
                        <a
                          href={e.receipt_photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cjk-safe ml-2 inline-flex items-center gap-1 align-[-2px] font-semibold text-[var(--tr-accent-deep)] underline"
                        >
                          <IconReceipt size={TR_ICON.meta} aria-hidden />
                          영수증
                        </a>
                      ) : null}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void settleExtra(e.id)}
                    className="tr-label text-cjk-safe shrink-0 rounded-xl bg-[var(--tr-bubble-me)] px-4 py-2.5 font-bold text-[var(--tr-bubble-me-ink)]"
                    data-testid="cockpit-settle-extra"
                  >
                    수취완료
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            <p className="tr-label font-bold text-[var(--tr-ink-2)]">지출 기록</p>
            <div className="grid grid-cols-4 gap-2">
              {EXPENSE_KINDS.map((kind) => (
                <button
                  key={kind.value}
                  type="button"
                  onClick={() => setExpKind(kind.value)}
                  className={`tr-body text-cjk-safe rounded-xl py-3 font-bold ${
                    expKind === kind.value ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]' : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink)]'
                  }`}
                >
                  {kind.label}
                </button>
              ))}
            </div>
            <input
              value={expItem}
              onChange={(event) => setExpItem(event.target.value)}
              maxLength={120}
              placeholder="항목 (예: 성산 주차장)"
              className="rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-4 tr-display text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)]"
            />
            <input
              value={expAmount}
              onChange={(event) => setExpAmount(event.target.value)}
              inputMode="numeric"
              placeholder="금액 (₩)"
              className="rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-4 tr-display text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)]"
            />
            {/* T1-3 — optional receipt photo (입장권 할인가 투명성). */}
            <label className="tr-body flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--tr-hairline)] bg-[var(--tr-surface)] py-3 font-semibold text-[var(--tr-ink-2)]">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setExpReceipt(event.target.files?.[0] ?? null)}
                className="hidden"
                data-testid="expense-receipt-input"
              />
              <IconReceipt size={TR_ICON.action} aria-hidden />
              {expReceipt ? (
                <>
                  영수증 첨부됨
                  <IconDone size={TR_ICON.chip} aria-hidden />
                </>
              ) : (
                '영수증 사진 (선택)'
              )}
            </label>
            <button
              type="button"
              disabled={expBusy || !expItem.trim() || !expAmount.trim()}
              onClick={() => void logExpense()}
              className="text-cjk-safe tr-btn-raised rounded-2xl bg-[var(--tr-bubble-me)] py-4 tr-display font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
              data-testid="driver-expense-log"
            >
              {expBusy ? '기록 중…' : '기록'}
            </button>
          </div>
        </Sheet>
      ) : null}

      {/* §11.D D7 — private-only; !isJoin guards a stale `sheet` state. */}
      {sheet === 'overtime' && !isJoin ? (
        <Sheet onClose={() => setSheet('none')} title="초과근무 정산">
          <div className="flex flex-col gap-3">
            <p className="tr-card-text text-[var(--tr-ink-2)]">
              기준 {baseHours}시간 · {formatKrw(otRate)}/시간
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="tr-label font-bold text-[var(--tr-ink-2)]">시작</span>
                <input
                  value={otStart}
                  onChange={(event) => setOtStart(event.target.value)}
                  inputMode="numeric"
                  placeholder="09:00"
                  className="rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-3.5 tr-display tabular-nums text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)]"
                  data-testid="overtime-start"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="tr-label font-bold text-[var(--tr-ink-2)]">종료</span>
                <div className="flex items-center gap-1.5">
                  <input
                    value={otEnd}
                    onChange={(event) => setOtEnd(event.target.value)}
                    inputMode="numeric"
                    placeholder="18:00"
                    className="min-w-0 flex-1 rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-3.5 tr-display tabular-nums text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)]"
                    data-testid="overtime-end"
                  />
                  <button
                    type="button"
                    onClick={() => setOtEnd(kstPlusMinutes(0))}
                    className="text-cjk-safe tr-label shrink-0 rounded-2xl bg-[var(--tr-surface-2)] px-3 py-3.5 font-bold text-[var(--tr-ink)]"
                  >
                    지금
                  </button>
                </div>
              </label>
            </div>

            {/* Auto-computed from the times; the driver has final say via ±30분. */}
            <button
              type="button"
              onClick={() => setOtHours(otComputed.overtimeHours)}
              className="text-cjk-safe tr-body rounded-2xl bg-[var(--tr-surface-2)] py-2.5 font-bold text-[var(--tr-ink)]"
              data-testid="overtime-recompute"
            >
              시간으로 계산
              {otComputed.workedMinutes != null
                ? ` · 근무 ${Math.floor(otComputed.workedMinutes / 60)}시간 ${otComputed.workedMinutes % 60}분`
                : ''}
            </button>

            <div className="flex items-center justify-between rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
              <button
                type="button"
                onClick={() => setOtHours((h) => Math.max(0, Math.round((h - 0.5) * 2) / 2))}
                className="h-10 w-10 rounded-full bg-[var(--tr-surface)] tr-display font-bold text-[var(--tr-ink)]"
                aria-label="30분 빼기"
              >
                −
              </button>
              <div className="text-center">
                <p className="tr-display font-bold text-[var(--tr-ink)]" data-testid="overtime-hours">
                  초과 {otHours}시간
                </p>
                <p className="tr-body-lg tr-num font-semibold text-[var(--tr-accent-deep)]" data-testid="overtime-amount">
                  {formatKrw(otAmount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOtHours((h) => Math.round((h + 0.5) * 2) / 2)}
                className="h-10 w-10 rounded-full bg-[var(--tr-surface)] tr-display font-bold text-[var(--tr-ink)]"
                aria-label="30분 더하기"
              >
                +
              </button>
            </div>

            <button
              type="button"
              disabled={expBusy || otHours <= 0}
              onClick={() => void logOvertime()}
              className="text-cjk-safe tr-btn-raised rounded-2xl bg-[var(--tr-bubble-me)] py-4 tr-display font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
              data-testid="overtime-log"
            >
              {expBusy ? '기록 중…' : `${formatKrw(otAmount)} 기록`}
            </button>
          </div>
        </Sheet>
      ) : null}

      {/* Guest photo → full-screen viewer (an address, menu, or lost item). */}
      <Lightbox url={lightbox?.url ?? null} name={lightbox?.name} onClose={() => setLightbox(null)} />

      {/* M1 — in-app confirmation sheet (replaces window.confirm). */}
      {confirmSheetEl}
    </Screen>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function NavRow({ dest }: { dest: NavDestination }) {
  /**
   * 🔴 These used to paint TMAP blue and Naver green and then write the label
   * in `--tr-ink` — which is near-BLACK in light mode. Dark text on a dark-blue
   * button is unreadable, and the cockpit can be flipped to light from its own
   * header. Brand ink now travels with brand colour (lib/tour-room/navBrand).
   *
   * The app-scheme buttons keep their web fallback: a scheme fails SILENTLY on
   * a device without the app, so the timeout opens the web route behind it.
   */
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <NavBrandButton
        chipKey="kakao-navi"
        label="카카오"
        href={kakaoNaviUrl(dest)}
        onClick={() => {
          window.setTimeout(() => window.open(kakaoWebRouteUrl(dest), '_blank'), 1200);
        }}
        testId="nav-kakao"
      />
      <NavBrandButton chipKey="tmap" label="티맵" href={tmapUrl(dest)} testId="nav-tmap" />
      <NavBrandButton
        chipKey="naver"
        label="네이버"
        href={naverCarUrl(dest)}
        onClick={() => {
          window.setTimeout(() => window.open(naverWebUrl(dest), '_blank'), 1200);
        }}
        testId="nav-naver"
      />
      <NavBrandButton
        chipKey="google"
        label="구글"
        href={googleDirectionsUrl(dest, 'driving')}
        testId="nav-google"
      />
    </div>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  // W1.1 — the cockpit shares the room's dark token layer: outer `.dark` +
  // inner `.tr-root` so `.dark .tr-root` resolves (descendant combinator), the
  // same way RoomShell applies its dark theme.
  // A5 — the hardcoded `.dark` became settings-conditional, but the DRIVER
  // DEFAULT stays dark (night-driving glare): 'system' and 'dark' both resolve
  // dark here; only an explicit 'light' lifts it (header chip / settings).
  // C1 — the surface contract (text scale + skin) was MISSING here while both
  // other shells planted it, so the size setting and all ten skins did nothing
  // in the cockpit. `dark-first` keeps the night-driving default (A5).
  const { dark, surfaceProps } = useShellSurface({ mode: 'dark-first' });
  return (
    <div className={dark ? 'dark' : ''}>
      <div
        /* R9 — /tour-mode ships `black-translucent`, so in standalone the
           web view starts UNDER the status bar and ends under the home
           indicator. The shells pad their own chrome; this root had nothing
           to inherit, which put the cockpit's top bar under the clock and its
           drive controls under the home indicator. */
        className="tr-safe-top tr-safe-bottom tr-root relative mx-auto flex h-[100dvh] max-w-lg flex-col bg-[var(--tr-canvas)]"
        data-testid="driver-console"
        // Staff copy here is Korean-only, same as StaffShell — this is what
        // opts the cockpit into the ko line-height rule instead of the
        // ja/zh scaffolding one.
        data-locale="ko"
        lang="ko"
        {...surfaceProps}
      >
        {children}
      </div>
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <p className="text-center tr-display text-[var(--tr-ink-2)]">{children}</p>
    </div>
  );
}

function ActionButton({ label, Icon, onClick }: { label: string; Icon: LucideIcon; onClick: () => void }) {
  // A2 — compact pass (owner: every icon oversized EXCEPT the mic):
  // 64→52px min height, 22→18px icon, tighter gap. Still ≥44px touch target.
  return (
    <button
      type="button"
      onClick={onClick}
      className="tr-btn-flat flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[var(--tr-ink)]"
      data-testid={`driver-action-${label}`}
    >
      <Icon size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
      <span className="tr-label font-bold">{label}</span>
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  // M3 — same spring physics as the room Sheet (M-D3/M-D7): backdrop fade +
  // slide-up on mount. Enter-only (call sites conditional-mount the sheet).
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end" onClick={onClose}>
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
      />
      <motion.div
        className="relative rounded-t-3xl bg-[var(--tr-surface)] px-5 pb-8 pt-5"
        style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
        onClick={(event) => event.stopPropagation()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-[var(--tr-bubble-system)]" aria-hidden />
        <p className="mb-4 tr-display font-bold text-[var(--tr-ink)]">{title}</p>
        {children}
        <button type="button" onClick={onClose} className="text-cjk-safe tr-btn-flat mt-4 w-full rounded-2xl py-4 tr-display font-bold text-[var(--tr-ink)]">
          닫기
        </button>
      </motion.div>
    </div>
  );
}
