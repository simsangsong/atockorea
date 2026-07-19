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
import { startVoiceRecording, type ActiveRecording } from '@/lib/tour-room/recorder';
import MicPrime from '@/components/tour-mode/MicPrime';
import {
  googleDirectionsUrl,
  kakaoNaviUrl,
  kakaoWebRouteUrl,
  naverCarUrl,
  naverWebUrl,
  tmapUrl,
  type NavDestination,
} from '@/lib/tour-room/nav-links';

const CANCEL_WINDOW_MS = 3000;
export const OPS_PHONE = process.env.NEXT_PUBLIC_TOUR_OPS_PHONE ?? '';
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? '';

export type CockpitLifecycle = 'lobby' | 'live' | 'ended';

/** Driver expense kinds (tour_room_extras.kind); parking is the common one. */
const EXPENSE_KINDS: Array<{ value: string; label: string }> = [
  { value: 'parking', label: '주차' },
  { value: 'advance', label: '대납' },
  { value: 'extension', label: '연장' },
  { value: 'other', label: '기타' },
];

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
  onExit,
}: {
  tourTitle: string;
  lifecycle: CockpitLifecycle;
  room: CockpitRoom;
  bookingId: string;
  session: string;
  channelTopic: string | null;
  initialMessages: RoomMessage[];
  /** Guide drive-mode: a way back to dispatch. Omitted by the pure driver. */
  onExit?: () => void;
}) {
  useWakeLock(true);
  const { messages, connection } = useTourRoomChannel({
    bookingId,
    channelTopic,
    roomSession: session,
    initialMessages,
  });

  const [recording, setRecording] = useState<ActiveRecording | null>(null);
  const [level, setLevel] = useState(0);
  const [pendingClip, setPendingClip] = useState<{ blob: Blob; mimeType: string } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [textSending, setTextSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'none' | 'delay' | 'schedule' | 'return' | 'expense'>('none');
  const [pushOn, setPushOn] = useState(false);
  const [expItem, setExpItem] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expKind, setExpKind] = useState('parking');
  const [expBusy, setExpBusy] = useState(false);
  const playedRef = useRef<Set<string>>(new Set(initialMessages.map((message) => message.id)));
  const audioQueueRef = useRef<string[]>([]);
  const playingRef = useRef(false);

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
    const audio = new Audio(url);
    audio.onended = audio.onerror = () => {
      playingRef.current = false;
      playNext();
    };
    void audio.play().catch(() => {
      playingRef.current = false;
    });
  }, []);

  useEffect(() => {
    for (const message of messages) {
      if (playedRef.current.has(message.id)) continue;
      playedRef.current.add(message.id);
      if (message.sender_role !== 'customer' || message._local) continue;
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
  const sendText = useCallback(async () => {
    const value = textDraft.trim();
    if (!value || textSending) return;
    setTextSending(true);
    try {
      const res = await fetch(`/api/tour-rooms/${bookingId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
        body: JSON.stringify({ text: value }),
      });
      if (res.ok) {
        setTextDraft('');
        say('전송 완료 ✓');
      } else {
        say('전송 실패 — 다시 시도해 주세요');
      }
    } catch {
      say('네트워크 오류 — 다시 시도해 주세요');
    } finally {
      setTextSending(false);
    }
  }, [bookingId, session, textDraft, textSending, say]);

  // ── hands-free voice send ──────────────────────────────────────────────
  const sendClip = useCallback(
    async (clip: { blob: Blob; mimeType: string }) => {
      setSending(true);
      try {
        const form = new FormData();
        const ext = clip.mimeType.includes('mp4') ? 'm4a' : 'webm';
        form.append('audio', new File([clip.blob], `driver.${ext}`, { type: clip.mimeType }));
        const res = await fetch(`/api/tour-rooms/${bookingId}/messages`, {
          method: 'POST',
          headers: { 'x-tour-room-auth': session },
          body: form,
        });
        if (!res.ok) say('전송 실패 — 다시 말해 주세요');
        else say('전송 완료 ✓');
      } catch {
        say('네트워크 오류 — 다시 말해 주세요');
      } finally {
        setSending(false);
      }
    },
    [bookingId, session, say],
  );

  // 3s cancel window after the clip finishes.
  useEffect(() => {
    if (!pendingClip) return;
    setCountdown(CANCEL_WINDOW_MS / 1000);
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const left = CANCEL_WINDOW_MS - (Date.now() - startedAt);
      setCountdown(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0) {
        window.clearInterval(interval);
        const clip = pendingClip;
        setPendingClip(null);
        void sendClip(clip);
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [pendingClip, sendClip]);

  const toggleRecord = useCallback(async () => {
    if (recording) {
      recording.stop();
      return;
    }
    if (pendingClip || sending) return;
    try {
      const handle = await startVoiceRecording({
        onLevel: setLevel,
        onFinish: (clip) => {
          setRecording(null);
          setLevel(0);
          if (clip && clip.blob.size > 0) setPendingClip({ blob: clip.blob, mimeType: clip.mimeType });
        },
        onError: () => {
          setRecording(null);
          setLevel(0);
          say('녹음 오류 — 다시 시도해 주세요');
        },
      });
      setRecording(handle);
    } catch {
      say('마이크 권한을 허용해 주세요');
    }
  }, [recording, pendingClip, sending, say]);

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

  const announceArrival = useCallback(
    async (item: CockpitScheduleItem) => {
      setSheet('none');
      try {
        const res = await fetch(`/api/tour-rooms/${bookingId}/manual-arrival`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
          body: JSON.stringify({ poiKey: item.poi_key ?? null, title: itemTitle(item) }),
        });
        say(res.ok ? `${itemTitle(item)} 도착 안내 전송 ✓` : '실패 — 다시 시도해 주세요');
      } catch {
        say('네트워크 오류');
      }
    },
    [bookingId, session, say],
  );

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

  // ── expense log (parking etc.) → the same ledger the guide settles ──────
  const logExpense = useCallback(async () => {
    const amountKrw = Number.parseInt(expAmount.replace(/[^0-9]/g, ''), 10);
    if (!expItem.trim() || !Number.isFinite(amountKrw) || amountKrw <= 0) return;
    setExpBusy(true);
    try {
      const res = await fetch(`/api/tour-rooms/${bookingId}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': session },
        body: JSON.stringify({ item: expItem.trim(), amount_krw: amountKrw, kind: expKind }),
      });
      if (res.ok) {
        setExpItem('');
        setExpAmount('');
        setSheet('none');
        say('지출 기록됨 ✓ (정산에 반영)');
      } else {
        say('기록 실패 — 다시 시도해 주세요');
      }
    } catch {
      say('네트워크 오류');
    } finally {
      setExpBusy(false);
    }
  }, [bookingId, session, expItem, expAmount, expKind, say]);

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

  const recent = messages.slice(-6);

  return (
    <Screen>
      {/* header: back (guide) · title · connection · wake · ops call */}
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2.5">
        {onExit ? (
          <button
            type="button"
            onClick={onExit}
            className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-neutral-800 pl-2 pr-3 text-sm font-bold text-white"
            data-testid="cockpit-exit"
          >
            ◀ 대시보드
          </button>
        ) : null}
        <p className="min-w-0 flex-1 truncate text-sm text-neutral-400">
          {tourTitle} · {connection === 'realtime' || connection === 'sse' ? '연결됨' : '연결 중…'}
        </p>
        {pushSupported() ? (
          <button
            type="button"
            onClick={() => void enablePush()}
            disabled={pushOn}
            className={`flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold ${
              pushOn ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-100 text-neutral-950'
            }`}
            data-testid="driver-push-toggle"
          >
            {pushOn ? '🔔 켜짐' : '🔔 알림'}
          </button>
        ) : null}
        {OPS_PHONE ? (
          <a
            href={`tel:${OPS_PHONE}`}
            className="flex h-9 items-center gap-1 rounded-full bg-neutral-800 px-3 text-sm font-bold text-white"
            data-testid="driver-ops-call"
          >
            📞 운영팀
          </a>
        ) : null}
      </div>

      {/* phase-aware destination + nav */}
      <div className="border-b border-neutral-800 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{destLabel}</p>
        <p className="mt-0.5 truncate text-xl font-bold text-white">{destTitle}</p>
        {navDest ? <NavRow dest={navDest} /> : null}
      </div>

      {/* bubbles */}
      <div className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto px-4 py-4" data-testid="driver-feed">
        {recent.map((message) => {
          const mine = message.sender_role === 'driver' || message.sender_role === 'guide';
          const system = message.sender_role === 'system' || message.sender_role === 'admin';
          return (
            <div key={message.id} className={mine ? 'self-end' : 'self-start'}>
              {!mine && !system ? <p className="mb-1 text-sm font-semibold text-neutral-400">손님</p> : null}
              <div
                className={
                  mine
                    ? 'max-w-[85vw] rounded-3xl rounded-br-md bg-neutral-100 px-5 py-4 text-xl font-medium text-neutral-900'
                    : system
                      ? 'max-w-[85vw] rounded-2xl bg-neutral-800 px-4 py-3 text-base text-neutral-300'
                      : 'max-w-[85vw] rounded-3xl rounded-bl-md bg-neutral-700 px-5 py-4 text-2xl font-semibold text-white'
                }
              >
                {koText(message)}
              </div>
            </div>
          );
        })}
      </div>

      {toast ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center">
          <span className="rounded-full bg-black/80 px-5 py-2 text-lg font-bold text-white">{toast}</span>
        </div>
      ) : null}

      {/* pending clip cancel window */}
      {pendingClip ? (
        <div className="flex items-center justify-between gap-3 border-t border-neutral-800 bg-neutral-900 px-5 py-4">
          <p className="text-xl font-bold text-white">전송 중… {countdown}</p>
          <button
            type="button"
            onClick={() => setPendingClip(null)}
            className="rounded-2xl bg-red-500 px-6 py-3 text-xl font-bold text-white"
            data-testid="driver-cancel-send"
          >
            취소
          </button>
        </div>
      ) : null}

      {/* typed send — always available (webview fallback / quiet typing) */}
      <div className="px-4 pt-2">
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
            className="min-w-0 flex-1 resize-none rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-lg text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
            data-testid="driver-text-input"
          />
          <button
            type="submit"
            disabled={!textDraft.trim() || textSending}
            className="shrink-0 rounded-2xl bg-neutral-100 px-5 py-3 text-lg font-bold text-neutral-950 disabled:opacity-40"
            data-testid="driver-text-send"
          >
            {textSending ? '…' : '보내기'}
          </button>
        </form>
      </div>

      {/* mic */}
      <div className="px-4 pb-3 pt-2">
        <MicPrime variant="dark" locale="ko" className="mb-2" />
        <button
          type="button"
          onClick={() => void toggleRecord()}
          disabled={sending || Boolean(pendingClip)}
          className={`w-full rounded-3xl py-8 text-3xl font-bold transition-colors disabled:opacity-50 ${
            recording ? 'bg-red-500 text-white' : 'bg-neutral-100 text-neutral-950'
          }`}
          style={recording ? { boxShadow: `0 0 0 ${Math.round(4 + level * 26)}px rgba(239,68,68,0.25)` } : undefined}
          data-testid="driver-mic"
        >
          {sending ? '전송 중…' : recording ? '■ 말 끝났어요' : '🎤 눌러서 말하기'}
        </button>
      </div>

      {/* one-tap actions */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-2.5">
        <ActionButton label="타세요" emoji="🚐" onClick={announceVehicleArrived} />
        <ActionButton label="지연" emoji="⏱" onClick={() => setSheet('delay')} />
        <ActionButton label="복귀시간" emoji="⏰" onClick={() => setSheet('return')} />
        <ActionButton label="일정·도착" emoji="🗺" onClick={() => setSheet('schedule')} />
        <ActionButton label="주차핀" emoji="🅿️" onClick={dropParkingPin} />
        <ActionButton
          label="차량문제"
          emoji="⚠️"
          onClick={() => {
            if (window.confirm('차량 문제를 손님과 운영팀에 알릴까요?')) {
              void signal({ type: 'vehicle_issue' }, '운영팀에 알렸어요 ✓');
            }
          }}
        />
      </div>

      {/* expense log (secondary, deliberate) */}
      <div className="px-4 pb-6">
        <button
          type="button"
          onClick={() => setSheet('expense')}
          className="w-full rounded-2xl bg-neutral-800 py-3 text-lg font-bold text-neutral-200"
          data-testid="driver-action-expense"
        >
          💰 지출 기록 (주차비 등)
        </button>
      </div>

      {/* sheets */}
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
                className="rounded-2xl bg-neutral-700 py-5 text-2xl font-bold text-white"
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
                  className="rounded-2xl bg-neutral-700 py-5 text-xl font-bold text-white"
                >
                  +{minutes}분 <span className="text-neutral-400">({time})</span>
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
            className="mt-3 w-full rounded-2xl bg-neutral-800 py-4 text-lg font-semibold text-neutral-300"
          >
            타이머 해제
          </button>
        </Sheet>
      ) : null}

      {sheet === 'schedule' ? (
        <Sheet onClose={() => setSheet('none')} title="오늘 일정 · 도착 안내">
          <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
            {room.schedule.length === 0 ? <p className="text-lg text-neutral-400">등록된 일정이 없어요.</p> : null}
            {room.schedule.map((item, index) => {
              const dest = destFrom(item);
              return (
                <div key={`${item.poi_key ?? item.title ?? index}`} className="rounded-2xl bg-neutral-800 px-4 py-3">
                  <p className="text-lg font-semibold text-white">
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
                      onClick={() => void announceArrival(item)}
                      className="flex-1 rounded-xl bg-neutral-100 py-3 text-base font-bold text-neutral-950"
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

      {sheet === 'expense' ? (
        <Sheet onClose={() => setSheet('none')} title="지출 기록 (정산 반영)">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-2">
              {EXPENSE_KINDS.map((kind) => (
                <button
                  key={kind.value}
                  type="button"
                  onClick={() => setExpKind(kind.value)}
                  className={`rounded-xl py-3 text-base font-bold ${
                    expKind === kind.value ? 'bg-neutral-100 text-neutral-950' : 'bg-neutral-700 text-white'
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
              className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-4 text-xl text-white placeholder:text-neutral-500"
            />
            <input
              value={expAmount}
              onChange={(event) => setExpAmount(event.target.value)}
              inputMode="numeric"
              placeholder="금액 (₩)"
              className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-4 text-xl text-white placeholder:text-neutral-500"
            />
            <button
              type="button"
              disabled={expBusy || !expItem.trim() || !expAmount.trim()}
              onClick={() => void logExpense()}
              className="rounded-2xl bg-neutral-100 py-4 text-xl font-bold text-neutral-950 disabled:opacity-40"
              data-testid="driver-expense-log"
            >
              {expBusy ? '기록 중…' : '기록'}
            </button>
          </div>
        </Sheet>
      ) : null}
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
      <a href={tmapUrl(dest)} className="rounded-xl bg-[#0f5bd6] py-2.5 text-center text-sm font-bold text-white">
        티맵
      </a>
      <a
        href={naverCarUrl(dest)}
        onClick={() => {
          window.setTimeout(() => window.open(naverWebUrl(dest), '_blank'), 1200);
        }}
        className="rounded-xl bg-[#03C75A] py-2.5 text-center text-sm font-bold text-white"
      >
        네이버
      </a>
      <a
        href={googleDirectionsUrl(dest, 'driving')}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-neutral-700 py-2.5 text-center text-sm font-bold text-white"
      >
        구글
      </a>
    </div>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto flex h-[100dvh] max-w-lg flex-col bg-neutral-950" data-testid="driver-console">
      {children}
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <p className="text-center text-xl text-neutral-300">{children}</p>
    </div>
  );
}

function ActionButton({ label, emoji, onClick }: { label: string; emoji: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl bg-neutral-800 py-4 text-white"
      data-testid={`driver-action-${label}`}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-base font-bold">{label}</span>
    </button>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div className="rounded-t-3xl bg-neutral-900 px-5 pb-8 pt-5" onClick={(event) => event.stopPropagation()}>
        <p className="mb-4 text-2xl font-bold text-white">{title}</p>
        {children}
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-2xl bg-neutral-700 py-4 text-xl font-bold text-white">
          닫기
        </button>
      </div>
    </div>
  );
}
