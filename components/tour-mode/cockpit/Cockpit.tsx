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
import { useTourRoomChannel, type RoomMessage } from '@/hooks/useTourRoomChannel';
import { startVoiceRecording } from '@/lib/tour-room/recorder';
import { isDeviceSttSupported, startDeviceStt } from '@/lib/tour-room/deviceStt';
import { primeAudio } from '@/lib/tour-room/tts';
import MicPrime from '@/components/tour-mode/MicPrime';
import OperatorAssist from '@/components/tour-mode/guide/OperatorAssist';
import LocationPreview from '@/components/tour-mode/LocationPreview';
import Lightbox from '@/components/tour-mode/Lightbox';
import { parseLocationMessage } from '@/lib/tour-room/locationMessage';
import {
  readMessageAttachment,
  isTranslationPending,
  formatAttachmentBytes,
} from '@/lib/tour-room/messageView';
import { EXTRA_KIND_LABELS, formatKrw } from '@/lib/tour-room/ledger';
import {
  baseHoursForCity,
  computeOvertime,
  overtimeAmount,
  OVERTIME_RATE_KRW_PER_HOUR,
} from '@/lib/tour-room/overtime';
import {
  AlarmClock,
  Bell,
  BusFront,
  ChevronLeft,
  FileText,
  Map as MapIcon,
  Phone,
  Sparkles,
  SquareParking,
  Sunrise,
  Timer,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
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
export const OPS_PHONE = process.env.NEXT_PUBLIC_TOUR_OPS_PHONE ?? '';
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

function koText(message: RoomMessage): string {
  return message.translations?.ko?.trim() || message.source_text;
}

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
  channelTopic,
  initialMessages,
  city = null,
  onExit,
}: {
  tourTitle: string;
  lifecycle: CockpitLifecycle;
  room: CockpitRoom;
  bookingId: string;
  session: string;
  channelTopic: string | null;
  initialMessages: RoomMessage[];
  /** Tour city — sets the overtime base hours (Jeju 9h / Busan 8h, T1-1). */
  city?: string | null;
  /** Guide drive-mode: a way back to dispatch. Omitted by the pure driver. */
  onExit?: () => void;
}) {
  useWakeLock(true);
  const {
    messages,
    connection,
    // Optimistic echo + localStorage unsent-queue + retry (parity with the
    // guest side): the operator sees their own bubble instantly and a failed
    // send is held for retry instead of silently lost on flaky field data.
    sendText: sendChannelText,
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
    'none' | 'delay' | 'schedule' | 'return' | 'expense' | 'overtime' | 'assist' | 'arrival'
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
  const [arrNote, setArrNote] = useState('');
  const [arrCoords, setArrCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [arrBusy, setArrBusy] = useState(false);
  // A4 — the POI's headline event (sticky label) + today's on/off confirmation.
  const [arrEventLabel, setArrEventLabel] = useState('');
  const [arrEventStatus, setArrEventStatus] = useState<'on' | 'off' | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name?: string | null } | null>(null);
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
      } catch {
        say('네트워크 오류');
      }
    },
    [bookingId, session, say],
  );

  const dropParkingPin = useCallback(() => {
    if (!navigator.geolocation) {
      say('이 기기에서 위치를 사용할 수 없어요');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        void signal(
          { type: 'parking_pin', lat: position.coords.latitude, lng: position.coords.longitude },
          '주차 위치 공유 완료 ✓',
        ),
      () => say('위치 권한을 허용해 주세요'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
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

  // A1 — morning briefing: the day's opening speech, one confirmed tap. The
  // server picks join vs private from the tour's price model.
  const sendMorningBriefing = useCallback(async () => {
    if (!window.confirm('아침 브리핑을 손님 전원에게 보낼까요?')) return;
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
  }, [bookingId, session, say]);

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
      setArrNoMeeting(false);
      setArrFollow('free');
      setArrTicket(false);
      setArrNote('');
      setArrCoords(null);
      setArrEventLabel('');
      setArrEventStatus(null);
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
              };
              event_status?: 'on' | 'off' | null;
            } | null) => {
              const profile = data?.profile;
              if (!profile) return;
              setArrFollow(profile.follow_mode === 'follow' ? 'follow' : 'free');
              setArrTicket(profile.ticket_required === true);
              setArrNote(typeof profile.route_note === 'string' ? profile.route_note : '');
              setArrEventLabel(typeof profile.event_label === 'string' ? profile.event_label : '');
              setArrEventStatus(data?.event_status ?? null);
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
          profile: {
            follow_mode: arrFollow,
            ticket_required: arrTicket,
            route_note: arrNote.trim() || null,
            event_label: arrEventLabel.trim() || null,
          },
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
  const enablePush = useCallback(async () => {
    if (!pushSupported()) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
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
      if (res.ok) setPushOn(true);
    } catch {
      /* stays off; the button remains for a retry */
    }
  }, [bookingId, session]);

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
  const otComputed = useMemo(() => computeOvertime(baseHours, otStart, otEnd), [baseHours, otStart, otEnd]);
  const otAmount = overtimeAmount(otHours);

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
          amount_krw: overtimeAmount(otHours),
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
  }, [bookingId, session, otHours, baseHours, say, loadExtras]);

  // ── phase-aware destination (준비=픽업, 진행=다음 스톱) ───────────────────
  const nextStop = useMemo(() => {
    const now = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    return (
      room.schedule.find((item) => typeof item.time === 'string' && item.time > now) ??
      room.schedule[0] ??
      null
    );
  }, [room.schedule]);

  const pickupDest: NavDestination | null =
    room.pickup && typeof room.pickup.lat === 'number' && typeof room.pickup.lng === 'number'
      ? { lat: room.pickup.lat, lng: room.pickup.lng, name: room.pickup.name ?? '픽업 장소' }
      : null;

  const isPrep = lifecycle === 'lobby';
  const destLabel = isPrep && room.pickup ? '픽업' : '다음';
  const destTitle = isPrep && room.pickup
    ? `${room.pickup.pickup_time ? `${room.pickup.pickup_time} ` : ''}${room.pickup.name ?? '픽업 장소'}`
    : nextStop
      ? `${nextStop.time ? `${nextStop.time} ` : ''}${itemTitle(nextStop)}`
      : '오늘 일정 없음';
  const navDest = isPrep && pickupDest ? pickupDest : destFrom(nextStop);

  const recent = messages.slice(-8);

  return (
    <Screen>
      {/* header: back (guide) · title · connection · wake · ops call */}
      <div className="flex items-center gap-2 border-b border-[var(--tr-hairline)] px-4 py-2.5">
        {onExit ? (
          <button
            type="button"
            onClick={onExit}
            className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-[var(--tr-surface-2)] pl-2 pr-3 text-sm font-bold text-[var(--tr-ink)]"
            data-testid="cockpit-exit"
          >
            <ChevronLeft size={16} strokeWidth={2.25} aria-hidden />
            대시보드
          </button>
        ) : null}
        <p className="min-w-0 flex-1 truncate text-sm text-[var(--tr-ink-2)]">
          {tourTitle} · {connection === 'realtime' || connection === 'sse' ? '연결됨' : '연결 중…'}
        </p>
        {pushSupported() ? (
          <button
            type="button"
            onClick={() => void enablePush()}
            disabled={pushOn}
            className={`flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold ${
              pushOn ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]' : 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
            }`}
            data-testid="driver-push-toggle"
          >
            <Bell size={15} strokeWidth={2.25} aria-hidden />
            {pushOn ? '켜짐' : '알림'}
          </button>
        ) : null}
        {OPS_PHONE ? (
          <a
            href={`tel:${OPS_PHONE}`}
            className="flex h-9 items-center gap-1 rounded-full bg-[var(--tr-surface-2)] px-3 text-sm font-bold text-[var(--tr-ink)]"
            data-testid="driver-ops-call"
          >
            <Phone size={15} strokeWidth={2.25} aria-hidden />
            운영팀
          </a>
        ) : null}
      </div>

      {/* phase-aware destination + nav */}
      <div className="border-b border-[var(--tr-hairline)] px-4 py-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--tr-ink-3)]">{destLabel}</p>
        <p className="mt-0.5 truncate text-lg font-bold text-[var(--tr-ink)]">{destTitle}</p>
        {navDest ? <NavRow dest={navDest} /> : null}
      </div>

      {/* bubbles */}
      <div className="flex flex-1 flex-col justify-end gap-2.5 overflow-y-auto px-4 py-3" data-testid="driver-feed">
        {recent.map((message) => {
          const mine = message.sender_role === 'driver' || message.sender_role === 'guide';
          const system = message.sender_role === 'system' || message.sender_role === 'admin';
          // Optimistic echo state (T0-4): dim while sending, outline on failure.
          const localCls =
            message._local === 'failed'
              ? 'opacity-60 outline outline-1 outline-[var(--tr-danger)]'
              : message._local === 'sending'
                ? 'opacity-60'
                : '';
          // A guest photo/file is a first-class message — render it, don't drop
          // it into an empty grey bubble. A caption (if any) rides below.
          const att = readMessageAttachment(message);
          const text = koText(message);
          // A location message (…q=lat,lng) becomes an inline map preview.
          const loc = !att ? parseLocationMessage(text) : null;
          return (
            <div key={message.id} className={mine ? 'self-end' : 'self-start'}>
              {!mine && !system ? <p className="mb-1 text-sm font-semibold text-[var(--tr-ink-2)]">손님</p> : null}
              {att ? (
                <div className={`flex max-w-[85vw] flex-col gap-1.5 ${mine ? 'items-end' : 'items-start'}`}>
                  {att.kind === 'image' ? (
                    <button
                      type="button"
                      onClick={() => setLightbox({ url: att.url, name: att.name })}
                      className="block overflow-hidden rounded-3xl"
                      data-testid="cockpit-image"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={att.url} alt={att.name} loading="lazy" className="max-h-72 max-w-[80vw] object-cover" />
                    </button>
                  ) : (
                    <a
                      href={att.url}
                      download={att.name || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-3xl bg-[var(--tr-surface-2)] px-5 py-4 text-[var(--tr-ink)]"
                      data-testid="cockpit-file"
                    >
                      <FileText size={26} strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-semibold">{att.name || '파일'}</span>
                        {formatAttachmentBytes(att.size) ? (
                          <span className="block text-sm text-[var(--tr-ink-2)]">{formatAttachmentBytes(att.size)}</span>
                        ) : null}
                      </span>
                    </a>
                  )}
                  {text ? (
                    <div className="rounded-3xl rounded-bl-md bg-[var(--tr-surface-2)] px-5 py-3 text-xl font-medium text-[var(--tr-ink)]">
                      {text}
                    </div>
                  ) : null}
                </div>
              ) : loc ? (
                <div className="max-w-[85vw]">
                  <LocationPreview lat={loc.lat} lng={loc.lng} label={loc.label} url={loc.url} />
                </div>
              ) : (
                <div
                  className={`${
                    mine
                      ? 'max-w-[85vw] rounded-3xl rounded-br-md bg-[var(--tr-bubble-me)] px-5 py-4 text-xl font-medium text-[var(--tr-bubble-me-ink)]'
                      : system
                        ? 'max-w-[85vw] rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3 text-base text-[var(--tr-ink-2)]'
                        : 'max-w-[85vw] rounded-3xl rounded-bl-md bg-[var(--tr-surface-2)] px-5 py-4 text-2xl font-semibold text-[var(--tr-ink)]'
                  } ${localCls}`}
                >
                  {text}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {toast ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center">
          <span className="rounded-full bg-black/80 px-5 py-2 text-lg font-bold text-[var(--tr-ink)]">{toast}</span>
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
          className="mx-4 mb-1.5 flex items-center justify-center gap-2 rounded-2xl bg-[var(--tr-surface-2)] py-2.5 text-base font-bold text-[var(--tr-danger)] transition-transform active:scale-[0.99]"
          data-testid="cockpit-retry-failed"
        >
          <TriangleAlert size={16} strokeWidth={2.25} aria-hidden />
          전송 실패 {failedCount}건 · 다시 보내기
        </button>
      ) : null}

      {/* input dock — idle: type + mic; else elegant recording/undo/sending states */}
      {phase === 'idle' ? (
        <>
          {/* typed send — always available (webview fallback / quiet typing) */}
          <div className="px-4 pt-1.5">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendText();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={textDraft}
                onChange={(event) => setTextDraft(event.target.value)}
                rows={1}
                maxLength={2000}
                placeholder="타이핑해서 보내기"
                enterKeyHint="send"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendText();
                  }
                }}
                className="min-w-0 flex-1 resize-none rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-2.5 text-base text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-ink-3)] focus:outline-none"
                data-testid="driver-text-input"
              />
              <button
                type="submit"
                disabled={!textDraft.trim() || textSending}
                className="shrink-0 rounded-2xl bg-[var(--tr-bubble-me)] px-5 py-2.5 text-base font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
                data-testid="driver-text-send"
              >
                {textSending ? '…' : '보내기'}
              </button>
            </form>
          </div>
          <div className="px-4 pb-2 pt-1.5">
            <MicPrime variant="dark" locale="ko" className="mb-1.5" />
            <button
              type="button"
              onClick={startRecording}
              className="w-full rounded-3xl bg-[var(--tr-bubble-me)] py-4 text-2xl font-bold text-[var(--tr-bubble-me-ink)] transition-transform active:scale-[0.99]"
              data-testid="driver-mic"
            >
              🎤 눌러서 말하기
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
            <p className="min-w-0 flex-1 truncate text-lg text-[var(--tr-ink)]">
              {recMode === 'device' ? interim || '듣는 중…' : '녹음 중…'}
            </p>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="w-full rounded-3xl bg-red-500 py-4 text-2xl font-bold text-[var(--tr-ink)] transition-transform active:scale-[0.99]"
            data-testid="driver-mic"
          >
            ■ 말 끝났어요
          </button>
        </div>
      ) : phase === 'transcribing' ? (
        <div className="px-4 pb-2 pt-1.5">
          <div
            className="cockpit-shimmer w-full rounded-3xl bg-[var(--tr-surface-2)] py-4 text-center text-xl font-bold text-[var(--tr-ink-2)]"
            data-testid="cockpit-transcribing"
          >
            인식 중…
          </div>
        </div>
      ) : phase === 'pending' ? (
        <div className="px-4 pb-2 pt-1.5">
          <p className="mb-2 line-clamp-3 text-center text-xl font-medium text-[var(--tr-ink)]">“{pending?.text}”</p>
          {pending?.confirm ? (
            // Low-confidence transcript: explicit send, no auto-timer (T0-3).
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={cancelPending}
                className="rounded-3xl bg-[var(--tr-surface-2)] py-4 text-xl font-bold text-[var(--tr-ink)] transition-transform active:scale-[0.99]"
                data-testid="cockpit-cancel-send"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => pending && void sendVoice(pending)}
                className="rounded-3xl bg-[var(--tr-bubble-me)] py-4 text-xl font-bold text-[var(--tr-bubble-me-ink)] transition-transform active:scale-[0.99]"
                data-testid="cockpit-confirm-send"
              >
                보내기
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={cancelPending}
              className="relative w-full overflow-hidden rounded-3xl bg-[var(--tr-surface-2)] py-4 transition-transform active:scale-[0.99]"
              data-testid="cockpit-undo-send"
            >
              <span aria-hidden className="cockpit-fill absolute bottom-0 left-0 h-1.5 rounded-full bg-white/80" />
              <span className="relative text-xl font-bold text-[var(--tr-ink)]">탭하여 취소</span>
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 pb-2 pt-1.5">
          <div
            className="cockpit-shimmer w-full rounded-3xl bg-[var(--tr-surface-2)] py-4 text-center text-xl font-bold text-[var(--tr-ink-2)]"
            data-testid="cockpit-sending"
          >
            전송 중…
          </div>
        </div>
      )}

      {/* one-tap actions */}
      <div className="grid grid-cols-3 gap-1.5 px-4 pb-1.5">
        <ActionButton label="타세요" Icon={BusFront} onClick={announceVehicleArrived} />
        <ActionButton label="지연" Icon={Timer} onClick={() => setSheet('delay')} />
        <ActionButton label="복귀시간" Icon={AlarmClock} onClick={() => setSheet('return')} />
        <ActionButton label="일정·도착" Icon={MapIcon} onClick={() => setSheet('schedule')} />
        <ActionButton label="주차핀" Icon={SquareParking} onClick={dropParkingPin} />
        <ActionButton
          label="차량문제"
          Icon={TriangleAlert}
          onClick={() => {
            if (window.confirm('차량 문제를 손님과 운영팀에 알릴까요?')) {
              void signal({ type: 'vehicle_issue' }, '운영팀에 알렸어요 ✓');
            }
          }}
        />
        <ActionButton label="AI 도우미" Icon={Sparkles} onClick={() => setSheet('assist')} />
        <ActionButton label="아침브리핑" Icon={Sunrise} onClick={() => void sendMorningBriefing()} />
      </div>

      {/* expense/settle + overtime (secondary, deliberate) */}
      <div className="grid grid-cols-2 gap-1.5 px-4 pb-3">
        <button
          type="button"
          onClick={() => {
            setSheet('expense');
            void loadExtras();
          }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--tr-surface-2)] py-2.5 text-base font-bold text-[var(--tr-ink)] transition-transform active:scale-[0.99]"
          data-testid="driver-action-expense"
        >
          <Wallet size={17} strokeWidth={2} aria-hidden />
          지출·정산
        </button>
        <button
          type="button"
          onClick={openOvertime}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--tr-surface-2)] py-2.5 text-base font-bold text-[var(--tr-ink)] transition-transform active:scale-[0.99]"
          data-testid="driver-action-overtime"
        >
          <Timer size={17} strokeWidth={2} aria-hidden />
          초과근무
        </button>
      </div>

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
                className="rounded-2xl bg-[var(--tr-surface-2)] py-5 text-2xl font-bold text-[var(--tr-ink)]"
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
                  className="rounded-2xl bg-[var(--tr-surface-2)] py-5 text-xl font-bold text-[var(--tr-ink)]"
                >
                  +{minutes}분 <span className="text-[var(--tr-ink-2)]">({time})</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              setSheet('none');
              void signal({ type: 'return_time', cancel: true }, '복귀 타이머 해제 ✓');
            }}
            className="mt-3 w-full rounded-2xl bg-[var(--tr-surface-2)] py-4 text-lg font-semibold text-[var(--tr-ink-2)]"
          >
            타이머 해제
          </button>
        </Sheet>
      ) : null}

      {sheet === 'schedule' ? (
        <Sheet onClose={() => setSheet('none')} title="오늘 일정 · 도착 안내">
          <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
            {room.schedule.length === 0 ? <p className="text-lg text-[var(--tr-ink-2)]">등록된 일정이 없어요.</p> : null}
            {room.schedule.map((item, index) => {
              const dest = destFrom(item);
              return (
                <div key={`${item.poi_key ?? item.title ?? index}`} className="rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
                  <p className="text-lg font-semibold text-[var(--tr-ink)]">
                    {item.time ? `${item.time} · ` : ''}{itemTitle(item)}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {dest ? (
                      <a
                        href={kakaoNaviUrl(dest)}
                        onClick={() => {
                          window.setTimeout(() => window.open(kakaoWebRouteUrl(dest), '_blank'), 1200);
                        }}
                        className="flex-1 rounded-xl bg-[#FEE500] py-3 text-center text-base font-bold text-black"
                      >
                        내비
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openArrivalSheet(item)}
                      className="flex-1 rounded-xl bg-[var(--tr-bubble-me)] py-3 text-base font-bold text-[var(--tr-bubble-me-ink)]"
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

      {sheet === 'arrival' && arrItem ? (
        <Sheet onClose={() => setSheet('none')} title={`${itemTitle(arrItem)} 도착 안내`}>
          <div className="flex max-h-[62vh] flex-col gap-3 overflow-y-auto">
            {/* per-day variable ① — parking pin (auto-captured on open) */}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
              <p className="min-w-0 text-base font-semibold text-[var(--tr-ink)]">
                <SquareParking size={16} strokeWidth={2} aria-hidden className="mr-1.5 inline-block align-[-2px]" />
                주차핀 {arrCoords ? '✓ 현재 위치' : '캡처 안 됨'}
              </p>
              <button
                type="button"
                onClick={captureArrCoords}
                className="shrink-0 rounded-xl bg-[var(--tr-surface)] px-3 py-2 text-sm font-bold text-[var(--tr-ink)]"
              >
                다시 캡처
              </button>
            </div>

            {/* per-day variable ② — meeting time (no default, must choose) */}
            <div className="rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
              <p className="mb-2 text-base font-semibold text-[var(--tr-ink)]">집합 시간</p>
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
                      className={`rounded-xl py-3 text-center text-base font-bold ${
                        selected
                          ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                          : 'bg-[var(--tr-surface)] text-[var(--tr-ink)]'
                      }`}
                    >
                      +{minutes}분
                      <span className="block text-xs font-medium text-current opacity-70">{time}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="time"
                  value={arrNoMeeting ? '' : arrTime}
                  onChange={(event) => {
                    setArrNoMeeting(false);
                    setArrTime(event.target.value);
                  }}
                  className="flex-1 rounded-xl bg-[var(--tr-surface)] px-3 py-2.5 text-base font-semibold text-[var(--tr-ink)]"
                  data-testid="arrival-time-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    setArrNoMeeting(!arrNoMeeting);
                    setArrTime('');
                  }}
                  className={`rounded-xl px-3 py-2.5 text-sm font-bold ${
                    arrNoMeeting
                      ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                      : 'bg-[var(--tr-surface)] text-[var(--tr-ink-2)]'
                  }`}
                >
                  집합 없이
                </button>
              </div>
            </div>

            {/* sticky per-POI toggles (prefilled from the profile) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setArrFollow(arrFollow === 'follow' ? 'free' : 'follow')}
                className={`rounded-2xl px-3 py-3 text-base font-bold ${
                  arrFollow === 'follow'
                    ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                    : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink)]'
                }`}
                data-testid="arrival-follow-toggle"
              >
                {arrFollow === 'follow' ? '🚶 스태프 인솔' : '🧭 자유 관람'}
              </button>
              <button
                type="button"
                onClick={() => setArrTicket(!arrTicket)}
                className={`rounded-2xl px-3 py-3 text-base font-bold ${
                  arrTicket
                    ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                    : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink)]'
                }`}
              >
                🎟️ 입장권 {arrTicket ? '필요' : '불필요'}
              </button>
            </div>

            {/* A4 — headline event: sticky label + today's O/X confirmation */}
            <div className="rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
              <input
                value={arrEventLabel}
                onChange={(event) => {
                  setArrEventLabel(event.target.value);
                  if (!event.target.value.trim()) setArrEventStatus(null);
                }}
                placeholder="이벤트명 (예: 해녀 공연 14:00) — 선택"
                className="w-full rounded-xl bg-[var(--tr-surface)] px-3 py-2.5 text-base text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-2)]"
                data-testid="arrival-event-label"
              />
              {arrEventLabel.trim() ? (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'on' as const, label: '오늘 진행 ✓' },
                      { value: 'off' as const, label: '오늘 안 함' },
                      { value: null, label: '미확인' },
                    ]
                  ).map((option) => (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() => setArrEventStatus(option.value)}
                      className={`rounded-xl py-2.5 text-sm font-bold ${
                        arrEventStatus === option.value
                          ? 'bg-[var(--tr-bubble-me)] text-[var(--tr-bubble-me-ink)]'
                          : 'bg-[var(--tr-surface)] text-[var(--tr-ink-2)]'
                      }`}
                    >
                      {option.label}
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
              className="w-full resize-none rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3 text-base text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-2)]"
            />

            <button
              type="button"
              onClick={() => void sendArrivalBundle()}
              disabled={arrBusy || (!arrNoMeeting && !/^\d{2}:\d{2}$/.test(arrTime))}
              className="w-full rounded-2xl bg-[var(--tr-bubble-me)] py-4 text-lg font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
              data-testid="arrival-send"
            >
              {arrBusy ? '전송 중…' : '전원 발송'}
            </button>
          </div>
        </Sheet>
      ) : null}

      {sheet === 'expense' ? (
        <Sheet onClose={() => setSheet('none')} title="지출·정산">
          {/* T1-2 — the driver's own advanced expenses awaiting cash. Tap
              수취완료 when the guest pays (guide-less private tour). */}
          {myUnsettledExtras.length > 0 ? (
            <div className="mb-4 flex flex-col gap-2" data-testid="cockpit-settle-list">
              <p className="text-sm font-bold text-[var(--tr-ink-2)]">
                받을 돈 · 합계 {formatKrw(myUnsettledExtras.reduce((sum, e) => sum + e.amount_krw, 0))}
              </p>
              {myUnsettledExtras.map((e) => (
                <div key={e.id} className="flex items-center gap-2 rounded-2xl bg-[var(--tr-surface-2)] px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-[var(--tr-ink)]">
                      {EXTRA_KIND_LABELS[e.kind as keyof typeof EXTRA_KIND_LABELS] ?? e.kind} · {e.item}
                    </span>
                    <span className="block text-sm text-[var(--tr-ink-2)]">
                      {formatKrw(e.amount_krw)} · {e.status === 'confirmed' ? '손님 확인됨' : '미확인'}
                      {e.receipt_photo_url ? (
                        <a
                          href={e.receipt_photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 font-semibold text-[var(--tr-accent-deep)] underline"
                        >
                          🧾 영수증
                        </a>
                      ) : null}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void settleExtra(e.id)}
                    className="shrink-0 rounded-xl bg-[var(--tr-bubble-me)] px-4 py-2.5 text-sm font-bold text-[var(--tr-bubble-me-ink)]"
                    data-testid="cockpit-settle-extra"
                  >
                    수취완료
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-[var(--tr-ink-2)]">지출 기록</p>
            <div className="grid grid-cols-4 gap-2">
              {EXPENSE_KINDS.map((kind) => (
                <button
                  key={kind.value}
                  type="button"
                  onClick={() => setExpKind(kind.value)}
                  className={`rounded-xl py-3 text-base font-bold ${
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
              className="rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-4 text-xl text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)]"
            />
            <input
              value={expAmount}
              onChange={(event) => setExpAmount(event.target.value)}
              inputMode="numeric"
              placeholder="금액 (₩)"
              className="rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-4 text-xl text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)]"
            />
            {/* T1-3 — optional receipt photo (입장권 할인가 투명성). */}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--tr-hairline)] bg-[var(--tr-surface)] py-3 text-base font-semibold text-[var(--tr-ink-2)]">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setExpReceipt(event.target.files?.[0] ?? null)}
                className="hidden"
                data-testid="expense-receipt-input"
              />
              🧾 {expReceipt ? '영수증 첨부됨 ✓' : '영수증 사진 (선택)'}
            </label>
            <button
              type="button"
              disabled={expBusy || !expItem.trim() || !expAmount.trim()}
              onClick={() => void logExpense()}
              className="rounded-2xl bg-[var(--tr-bubble-me)] py-4 text-xl font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
              data-testid="driver-expense-log"
            >
              {expBusy ? '기록 중…' : '기록'}
            </button>
          </div>
        </Sheet>
      ) : null}

      {sheet === 'overtime' ? (
        <Sheet onClose={() => setSheet('none')} title="초과근무 정산">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--tr-ink-2)]">
              기준 {baseHours}시간 · {formatKrw(OVERTIME_RATE_KRW_PER_HOUR)}/시간
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold text-[var(--tr-ink-2)]">시작</span>
                <input
                  value={otStart}
                  onChange={(event) => setOtStart(event.target.value)}
                  inputMode="numeric"
                  placeholder="09:00"
                  className="rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-3.5 text-xl tabular-nums text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)]"
                  data-testid="overtime-start"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold text-[var(--tr-ink-2)]">종료</span>
                <div className="flex items-center gap-1.5">
                  <input
                    value={otEnd}
                    onChange={(event) => setOtEnd(event.target.value)}
                    inputMode="numeric"
                    placeholder="18:00"
                    className="min-w-0 flex-1 rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-3.5 text-xl tabular-nums text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)]"
                    data-testid="overtime-end"
                  />
                  <button
                    type="button"
                    onClick={() => setOtEnd(kstPlusMinutes(0))}
                    className="shrink-0 rounded-2xl bg-[var(--tr-surface-2)] px-3 py-3.5 text-sm font-bold text-[var(--tr-ink)]"
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
              className="rounded-2xl bg-[var(--tr-surface-2)] py-2.5 text-base font-bold text-[var(--tr-ink)]"
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
                className="h-10 w-10 rounded-full bg-[var(--tr-surface)] text-2xl font-bold text-[var(--tr-ink)]"
                aria-label="30분 빼기"
              >
                −
              </button>
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--tr-ink)]" data-testid="overtime-hours">
                  초과 {otHours}시간
                </p>
                <p className="text-lg font-semibold text-[var(--tr-accent-deep)]" data-testid="overtime-amount">
                  {formatKrw(otAmount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOtHours((h) => Math.round((h + 0.5) * 2) / 2)}
                className="h-10 w-10 rounded-full bg-[var(--tr-surface)] text-2xl font-bold text-[var(--tr-ink)]"
                aria-label="30분 더하기"
              >
                +
              </button>
            </div>

            <button
              type="button"
              disabled={expBusy || otHours <= 0}
              onClick={() => void logOvertime()}
              className="rounded-2xl bg-[var(--tr-bubble-me)] py-4 text-xl font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
              data-testid="overtime-log"
            >
              {expBusy ? '기록 중…' : `${formatKrw(otAmount)} 기록`}
            </button>
          </div>
        </Sheet>
      ) : null}

      {/* Guest photo → full-screen viewer (an address, menu, or lost item). */}
      <Lightbox url={lightbox?.url ?? null} name={lightbox?.name} onClose={() => setLightbox(null)} />
    </Screen>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function NavRow({ dest }: { dest: NavDestination }) {
  return (
    <div className="mt-2 grid grid-cols-4 gap-1.5">
      <a
        href={kakaoNaviUrl(dest)}
        onClick={() => {
          window.setTimeout(() => window.open(kakaoWebRouteUrl(dest), '_blank'), 1200);
        }}
        className="rounded-xl bg-[#FEE500] py-2.5 text-center text-sm font-bold text-black"
      >
        카카오
      </a>
      <a href={tmapUrl(dest)} className="rounded-xl bg-[#0f5bd6] py-2.5 text-center text-sm font-bold text-[var(--tr-ink)]">
        티맵
      </a>
      <a
        href={naverCarUrl(dest)}
        onClick={() => {
          window.setTimeout(() => window.open(naverWebUrl(dest), '_blank'), 1200);
        }}
        className="rounded-xl bg-[#03C75A] py-2.5 text-center text-sm font-bold text-[var(--tr-ink)]"
      >
        네이버
      </a>
      <a
        href={googleDirectionsUrl(dest, 'driving')}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-[var(--tr-surface-2)] py-2.5 text-center text-sm font-bold text-[var(--tr-ink)]"
      >
        구글
      </a>
    </div>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  // W1.1 — the cockpit shares the room's dark token layer: outer `.dark` +
  // inner `.tr-root` so `.dark .tr-root` resolves (descendant combinator), the
  // same way RoomShell applies its dark theme. No more parallel neutral ramp.
  return (
    <div className="dark">
      <div
        className="tr-root relative mx-auto flex h-[100dvh] max-w-lg flex-col bg-[var(--tr-canvas)]"
        data-testid="driver-console"
      >
        {children}
      </div>
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <p className="text-center text-xl text-[var(--tr-ink-2)]">{children}</p>
    </div>
  );
}

function ActionButton({ label, Icon, onClick }: { label: string; Icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl bg-[var(--tr-surface-2)] py-2.5 text-[var(--tr-ink)] transition-transform active:scale-[0.97]"
      data-testid={`driver-action-${label}`}
    >
      <Icon size={22} strokeWidth={2} aria-hidden />
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div className="rounded-t-3xl bg-[var(--tr-surface)] px-5 pb-8 pt-5" onClick={(event) => event.stopPropagation()}>
        <p className="mb-4 text-2xl font-bold text-[var(--tr-ink)]">{title}</p>
        {children}
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-2xl bg-[var(--tr-surface-2)] py-4 text-xl font-bold text-[var(--tr-ink)]">
          닫기
        </button>
      </div>
    </div>
  );
}
