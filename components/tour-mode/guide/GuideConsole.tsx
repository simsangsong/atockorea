'use client';

/**
 * T6.2–T6.5 — the guide console (`/tour-mode/guide?rt=<tour-date token>`).
 *
 * A guide runs one tour DAY across many guest rooms, so this is a dispatcher:
 *   - a hero header with the day's status,
 *   - "손님" — one rich card per booking with the guest's identity, needs, the
 *     plan/onboard state, and explicit entrances: [채팅] opens that guest's
 *     room (the same customer-grade RoomShell, so the guide talks to the guest
 *     in the exact UI the guest sees), [일정] the plan-review panel, [정산] the
 *     cash ledger,
 *   - "전체 안내" — broadcast, meeting notice (countdown), free-time timer,
 *   - a merged recent feed.
 *
 * Design: shares the guest planner's `tr-plan-root` system (grey surfaces, ink
 * CTAs, bordered cards, one type scale) so the guide and customer surfaces read
 * as one product. Korean-first UI; traveller-facing content stays
 * template-translated server-side. Data refreshes on a 15s poll.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  Inbox,
  MapPin,
  Megaphone,
  MessageCircle,
  Mic,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Timer,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import GuideLedgerPanel from '@/components/tour-mode/guide/GuideLedgerPanel';
import GuidePlanPanel from '@/components/tour-mode/guide/GuidePlanPanel';
import GuideSeatDashboard from '@/components/tour-mode/guide/GuideSeatDashboard';
import OperatorAssist from '@/components/tour-mode/guide/OperatorAssist';
import MicPrime from '@/components/tour-mode/MicPrime';
import Sheet from '@/components/tour-mode/Sheet';
import Cockpit, { type CockpitLifecycle, type CockpitRoom } from '@/components/tour-mode/cockpit/Cockpit';
import { kstToday } from '@/lib/tour-room/time';
import { OPERATOR_PRESETS } from '@/lib/tour-room/operatorPresets';
import { primeAudio } from '@/lib/tour-room/tts';
import { type RoomMessage } from '@/hooks/useTourRoomChannel';
import {
  isVoiceRecordingSupported,
  startVoiceRecording,
  type ActiveRecording,
} from '@/lib/tour-room/recorder';

const GUIDE_TOKEN_KEY = 'tour_mode_guide_token';
const GUIDE_DEVICE_KEY = 'tour_mode_guide_device_key';
const POLL_MS = 15_000;

/** Stable per-device key so the guide's drive-mode join reuses one participant. */
function guideDeviceKey(): string {
  try {
    const existing = localStorage.getItem(GUIDE_DEVICE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(GUIDE_DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

/** The cockpit's PII-minimal day bundle (shared driver/guide overview route). */
interface CockpitOverview {
  tour: { id: string; title: string; city?: string | null };
  tour_date: string;
  lifecycle: CockpitLifecycle;
  rooms: CockpitRoom[];
}

/** Everything the dark cockpit needs for one room the guide is driving. */
interface DriveState {
  bookingId: string;
  session: string;
  channelTopic: string | null;
  initialMessages: RoomMessage[];
  room: CockpitRoom;
  tourTitle: string;
  lifecycle: CockpitLifecycle;
  city: string | null;
}


/** P4 — the collapsed day-tools segment control. */
const DAY_SEGMENTS = [
  { key: 'broadcast' as const, label: '공지', Icon: Megaphone },
  { key: 'meeting' as const, label: '집합', Icon: MapPin },
  { key: 'free' as const, label: '자유시간', Icon: Timer },
];

interface OverviewRoom {
  booking_id: string;
  room_id: string | null;
  day_plan: { id: string; status: string; version: number; stops_count: number; updated_at: string } | null;
  contact_name: string | null;
  number_of_guests: number | null;
  preferred_language: string | null;
  pickup: { name?: string; pickup_time?: string } | null;
  participants: Array<{ role: string; display_name: string; last_seen_at: string | null }>;
  onboard_ack: boolean;
  last_message: { source_text?: string; sender_role?: string; created_at?: string; translations?: Record<string, string> } | null;
}

interface Overview {
  tour: { id: string; title: string; city?: string | null };
  tour_date: string;
  lifecycle: 'lobby' | 'live' | 'ended';
  rooms: OverviewRoom[];
  feed: Array<{ id: string; room_id: string; sender_role: string; source_text: string; created_at: string; metadata?: Record<string, unknown>; translations?: Record<string, string> }>;
}

/** Korean-first preview for the guide (falls back to the original text). */
export function koPreview(m: { source_text?: string; translations?: Record<string, string> } | null | undefined): string {
  if (!m) return '아직 메시지 없음';
  return m.translations?.ko?.trim() || m.source_text || '아직 메시지 없음';
}

/** Stable pastel hue per room for the color tags (T6.2). */
export function roomHue(bookingId: string): number {
  let hash = 0;
  for (let i = 0; i < bookingId.length; i += 1) hash = (hash * 31 + bookingId.charCodeAt(i)) % 360;
  return hash;
}

function readToken(): string | null {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('rt');
    if (fromUrl) {
      sessionStorage.setItem(GUIDE_TOKEN_KEY, fromUrl);
      url.searchParams.delete('rt'); // §O-1 ③ — scrub, link stays reusable
      window.history.replaceState(window.history.state, '', url.toString());
      return fromUrl;
    }
    return sessionStorage.getItem(GUIDE_TOKEN_KEY);
  } catch {
    return null;
  }
}

function planBadge(status: string | undefined): { label: string; tone: 'review' | 'confirmed' } | null {
  if (status === 'guest_submitted') return { label: '제출 검토', tone: 'review' };
  if (status === 'guest_draft') return { label: '초안 검토', tone: 'review' };
  if (status === 'guide_confirmed' || status === 'live' || status === 'done') return { label: '일정 확정', tone: 'confirmed' };
  return null;
}

/** Float rooms that need the guide (a guest message to answer, a plan to review) to the top. */
function attentionScore(room: OverviewRoom): number {
  let score = 0;
  if (room.last_message?.sender_role === 'customer') score += 2;
  if (room.day_plan?.status === 'guest_submitted' || room.day_plan?.status === 'guest_draft') score += 1;
  return score;
}

export default function GuideConsole() {
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [meetTime, setMeetTime] = useState('');
  const [meetPoint, setMeetPoint] = useState('');
  const [meetPin, setMeetPin] = useState<{ lat: number; lng: number } | null>(null);
  const [freePoint, setFreePoint] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openPlanBookingId, setOpenPlanBookingId] = useState<string | null>(null);
  const [openLedgerBookingId, setOpenLedgerBookingId] = useState<string | null>(null);
  // B — per-room operator AI assist (staff-facing Smart Guide).
  const [openAssistBookingId, setOpenAssistBookingId] = useState<string | null>(null);
  // P4 redesign: day-wide tools collapse behind one section with a segment.
  const [dayToolsOpen, setDayToolsOpen] = useState(false);
  const [daySeg, setDaySeg] = useState<'broadcast' | 'meeting' | 'free'>('broadcast');
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    const t = readToken();
    tokenRef.current = t;
    setToken(t);
  }, []);

  const load = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    try {
      const res = await fetch(`/api/tour-mode/guide/overview?rt=${encodeURIComponent(t)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'load_failed');
      setOverview(json as Overview);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load_failed');
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [token, load]);

  const send = useCallback(
    async (body: Record<string, unknown>, label: string) => {
      const t = tokenRef.current;
      if (!t || !overview) return false;
      setBusy(label);
      try {
        const res = await fetch('/api/tour-rooms/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tourId: overview.tour.id, tourDate: overview.tour_date, token: t, ...body }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'send_failed');
        void load();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'send_failed');
        return false;
      } finally {
        setBusy(null);
      }
    },
    [overview, load],
  );

  const startFreeTime = async (minutes: number) => {
    const target = new Date(Date.now() + minutes * 60 * 1000 + 9 * 60 * 60 * 1000); // shift to KST wall clock
    const hhmm = `${String(target.getUTCHours()).padStart(2, '0')}:${String(target.getUTCMinutes()).padStart(2, '0')}`;
    await send({ notice: { kind: 'free_time_timer', time: hhmm, point: freePoint } }, 'free');
  };

  // ── broadcast voice input (record → STT → review → send) ────────────────
  // The guide speaks Korean; STT transcribes it into the draft, the guide
  // reviews, then the normal fan-out translates it per guest. STT is scoped to
  // a booking, so we borrow any room of the day (the tour-date token authorizes
  // every one). No rooms = nothing to say to, so the mic hides.
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [micNote, setMicNote] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recordingRef = useRef<ActiveRecording | null>(null);
  useEffect(() => {
    setVoiceSupported(isVoiceRecordingSupported());
  }, []);
  useEffect(() => () => recordingRef.current?.cancel(), []);

  const sttBookingId = overview?.rooms[0]?.booking_id ?? null;

  const transcribeBroadcast = useCallback(
    async (clip: { blob: Blob; mimeType: string } | null) => {
      recordingRef.current = null;
      const t = tokenRef.current;
      if (!clip || !sttBookingId || !t) {
        setVoiceState('idle');
        return;
      }
      setVoiceState('transcribing');
      try {
        const form = new FormData();
        const ext = clip.mimeType.includes('mp4') ? 'm4a' : 'webm';
        form.append('audio', new File([clip.blob], `guide.${ext}`, { type: clip.mimeType }));
        const res = await fetch(`/api/tour-rooms/${sttBookingId}/stt?rt=${encodeURIComponent(t)}`, {
          method: 'POST',
          body: form,
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.text) {
          setDraft((prev) => (prev.trim() ? `${prev.trim()} ${data.text}` : data.text));
        } else {
          setMicNote('잘 못 알아들었어요 — 다시 말씀해 주세요.');
        }
      } catch {
        setMicNote('음성 인식 오류 — 다시 시도해 주세요.');
      } finally {
        setVoiceState('idle');
      }
    },
    [sttBookingId],
  );

  const startBroadcastRecording = useCallback(async () => {
    setMicNote(null);
    try {
      const recording = await startVoiceRecording({
        onFinish: (clip) => void transcribeBroadcast(clip),
        onError: () => setVoiceState('idle'),
      });
      recordingRef.current = recording;
      setVoiceState('recording');
    } catch {
      setMicNote('마이크를 허용해 주세요.');
    }
  }, [transcribeBroadcast]);

  // ── drive mode — the guide enters the shared dark cockpit for one room ──
  // Small groups are usually guide-driven, so a guide gets every driver tool
  // (nav, voice bridge, one-tap signals, wake lock, expense, push). Same token
  // authorizes the cockpit day bundle + a per-room guide session join.
  const [drive, setDrive] = useState<DriveState | null>(null);
  const [driveBusy, setDriveBusy] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const cockpitDataRef = useRef<CockpitOverview | null>(null);

  const enterDrive = useCallback(async (bookingId: string) => {
    const t = tokenRef.current;
    if (!t || driveBusy) return;
    primeAudio(); // this tap is the gesture that unlocks incoming-message TTS
    setDriveBusy(bookingId);
    setDriveError(null);
    try {
      // 1. cockpit day bundle (schedule + coords + pickup) — cached once
      let data = cockpitDataRef.current;
      if (!data) {
        const res = await fetch(`/api/tour-mode/driver/overview?rt=${encodeURIComponent(t)}`, { cache: 'no-store' });
        const json = (await res.json()) as CockpitOverview;
        if (!res.ok) throw new Error('overview');
        data = json;
        cockpitDataRef.current = json;
      }
      const room = data.rooms.find((r) => r.booking_id === bookingId);
      if (!room) throw new Error('room');

      // 2. join the room as guide → short-lived room session for the cockpit
      const joinRes = await fetch(`/api/tour-rooms/${bookingId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t, deviceKey: guideDeviceKey(), locale: 'ko', ttsCapable: true }),
      });
      const joinData = await joinRes.json();
      if (!joinRes.ok) throw new Error('join');

      setDrive({
        bookingId,
        session: joinData.session,
        channelTopic: joinData.channel?.topic ?? null,
        initialMessages: (joinData.snapshot?.messages ?? []) as RoomMessage[],
        room,
        tourTitle: data.tour?.title ?? '투어',
        lifecycle: data.lifecycle,
        city: data.tour?.city ?? null,
      });
    } catch {
      setDriveError('운전 모드 진입 실패 — 다시 시도해 주세요.');
    } finally {
      setDriveBusy(null);
    }
  }, [driveBusy]);

  const onboardCount = useMemo(
    () => (overview ? overview.rooms.filter((room) => room.onboard_ack).length : 0),
    [overview],
  );
  const roomLabel = useMemo(() => {
    const map = new Map<string, { name: string; hue: number; bookingId: string }>();
    for (const room of overview?.rooms ?? []) {
      if (room.room_id)
        map.set(room.room_id, { name: room.contact_name ?? '게스트', hue: roomHue(room.booking_id), bookingId: room.booking_id });
    }
    return map;
  }, [overview]);

  if (!token) {
    return (
      <div className="tr-root tr-plan-root flex min-h-dvh items-center justify-center bg-[var(--tr-canvas)] px-6 text-center">
        <p className="tr-card-text text-[var(--tr-ink-2)]">가이드 링크(이메일의 버튼)로 접속해 주세요.</p>
      </div>
    );
  }
  if (!overview) {
    return (
      <div className="tr-root tr-plan-root flex min-h-dvh items-center justify-center bg-[var(--tr-canvas)] px-6 text-center">
        <p className="tr-card-text text-[var(--tr-ink-2)]">
          {error ? '접근할 수 없어요 — 링크를 다시 확인해 주세요.' : '불러오는 중…'}
        </p>
      </div>
    );
  }

  // Drive mode: a full-screen dark cockpit for one room; ◀ returns to dispatch.
  if (drive) {
    return (
      <div className="fixed inset-0 z-[60] bg-neutral-950">
        <Cockpit
          tourTitle={drive.tourTitle}
          lifecycle={drive.lifecycle}
          room={drive.room}
          bookingId={drive.bookingId}
          session={drive.session}
          channelTopic={drive.channelTopic}
          initialMessages={drive.initialMessages}
          city={drive.city}
          onExit={() => setDrive(null)}
        />
      </div>
    );
  }

  const notReturned = overview.rooms.filter((room) => !room.onboard_ack);
  const rooms = [...overview.rooms].sort((a, b) => attentionScore(b) - attentionScore(a));
  const replyCount = overview.rooms.filter((room) => room.last_message?.sender_role === 'customer').length;
  const reviewCount = overview.rooms.filter(
    (room) => room.day_plan?.status === 'guest_draft' || room.day_plan?.status === 'guest_submitted',
  ).length;
  const roomHref = (bookingId: string) =>
    `/tour-mode/room/${bookingId}?rt=${encodeURIComponent(tokenRef.current ?? '')}`;

  return (
    <div
      className="tr-root tr-plan-root mx-auto min-h-dvh w-full max-w-xl bg-[var(--tr-canvas)] px-4 pb-10 pt-4"
      data-testid="guide-console"
    >
      {/* hero */}
      <header className="tr-plan-hero">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="tr-meta font-bold uppercase tracking-wide text-[var(--tr-plan-hero-muted)]">가이드 콘솔</p>
            <h1 className="mt-1 truncate text-[20px] font-bold leading-tight text-[var(--tr-plan-hero-ink)]">
              {overview.tour.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                void load().finally(() => setRefreshing(false));
              }}
              aria-label="새로고침"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[var(--tr-plan-hero-ink)] active:scale-95"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden />
            </button>
            <span
              className={`tr-meta rounded-full px-2.5 py-1 font-bold ${
                overview.lifecycle === 'live'
                  ? 'bg-white/20 text-[var(--tr-plan-hero-ink)]'
                  : 'bg-white/10 text-[var(--tr-plan-hero-muted)]'
              }`}
            >
              {overview.lifecycle === 'live' ? 'LIVE' : overview.lifecycle === 'lobby' ? '대기' : '종료'}
            </span>
          </div>
        </div>
        {/* W3.2 — base stats as one hairline-divided strip (denser, one unit);
            reply/review stay separate attention badges. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="tr-meta inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-semibold text-[var(--tr-plan-hero-ink)]">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <CalendarClock size={13} aria-hidden />
              {overview.tour_date}
            </span>
            <span className="h-3 w-px bg-white/20" aria-hidden />
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Users size={13} aria-hidden />
              예약 {overview.rooms.length}
            </span>
            <span className="h-3 w-px bg-white/20" aria-hidden />
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Check size={13} aria-hidden />
              탑승 {onboardCount}/{overview.rooms.length}
            </span>
          </div>
          {replyCount > 0 && (
            <span className="tr-meta inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 font-bold tabular-nums text-[var(--tr-plan-hero-ink)]">
              <MessageCircle size={13} aria-hidden />
              답장 {replyCount}
            </span>
          )}
          {reviewCount > 0 && (
            <span className="tr-meta inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 font-bold tabular-nums text-[var(--tr-plan-hero-ink)]">
              <CalendarClock size={13} aria-hidden />
              검토 {reviewCount}
            </span>
          )}
        </div>
      </header>

      {error && (
        <p className="tr-label mt-3 rounded-xl border border-[var(--tr-danger-soft)] bg-[var(--tr-surface)] px-3 py-2 font-medium text-[var(--tr-danger)]">
          {error}
        </p>
      )}
      {driveError && (
        <p
          className="tr-label mt-3 rounded-xl border border-[var(--tr-danger-soft)] bg-[var(--tr-surface)] px-3 py-2 font-medium text-[var(--tr-danger)]"
          data-testid="drive-error"
        >
          {driveError}
        </p>
      )}

      {/* 명단·좌석·체크인 대시보드 (§5.4b) + 시작 게이트 (§5.4 C-16) —
          단일 소스 ops_seat_assignments, tour 스코프. 배정 booking 하나로 키잉. */}
      {tokenRef.current && overview.rooms[0]?.booking_id && (
        <GuideSeatDashboard
          token={tokenRef.current}
          bookingId={overview.rooms[0].booking_id}
          tourTitle={overview.tour.title}
        />
      )}

      {/* 손님 (rooms) — the guide's core surface */}
      <section className="mt-5">
        <h2 className="tr-label px-1 font-bold uppercase tracking-wide text-[var(--tr-ink-3)]">
          손님 · {overview.rooms.length}
        </h2>
        {overview.rooms.length === 0 && (
          <div className="tr-card mt-2 flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Inbox size={26} className="text-[var(--tr-ink-3)]" aria-hidden />
            <p className="tr-card-text text-[var(--tr-ink-2)]">오늘은 배정된 예약이 없어요.</p>
          </div>
        )}
        <div className="mt-2 space-y-2.5">
          {rooms.map((room) => {
            const badge = planBadge(room.day_plan?.status);
            const awaitingReply = room.last_message?.sender_role === 'customer';
            return (
              <article key={room.booking_id} className="tr-card tr-plan-course-card px-3.5 py-3" data-testid="room-card">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[15px] font-bold text-white"
                    style={{ backgroundColor: `hsl(${roomHue(room.booking_id)} 55% 52%)` }}
                    aria-hidden
                  >
                    {(room.contact_name ?? 'G').trim()[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="tr-card-text font-bold text-[var(--tr-ink)]">{room.contact_name ?? '게스트'}</p>
                      <span className="tr-meta text-[var(--tr-ink-3)]">
                        {room.number_of_guests ?? 1}명 · {room.preferred_language ?? 'en'}
                      </span>
                      {room.onboard_ack && (
                        <span className="inline-flex items-center gap-0.5 text-[var(--tr-safe)]" title="탑승 확인">
                          <Check size={13} aria-hidden />
                        </span>
                      )}
                      {badge && (
                        <span
                          className={`tr-meta rounded-full px-2 py-0.5 font-bold ${
                            badge.tone === 'review'
                              ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                              : 'bg-[var(--tr-accent-soft)] text-[var(--tr-ink-2)]'
                          }`}
                        >
                          {badge.label}
                        </span>
                      )}
                      {awaitingReply && (
                        <span className="tr-meta rounded-full bg-[var(--tr-danger-soft)] px-2 py-0.5 font-bold text-[var(--tr-danger)]">
                          답장 필요
                        </span>
                      )}
                    </div>
                    {room.pickup?.name && (
                      <p className="tr-meta mt-0.5 flex items-center gap-1 text-[var(--tr-ink-2)]">
                        <MapPin size={12} className="shrink-0" aria-hidden />
                        <span className="truncate">
                          {room.pickup.pickup_time ? `${room.pickup.pickup_time} · ` : ''}
                          {room.pickup.name}
                        </span>
                      </p>
                    )}
                    <p className="tr-meta mt-0.5 line-clamp-1 text-[var(--tr-ink-3)]">
                      {koPreview(room.last_message)}
                    </p>
                  </div>
                </div>

                {/* W3.1 — one 44px action row: 채팅 is the labelled primary;
                    일정/정산/AI/운전 are icon-only (aria-labelled) to reclaim the
                    second row. */}
                <div className="mt-3 flex items-center gap-1.5">
                  <a
                    href={roomHref(room.booking_id)}
                    className="tr-label flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-accent)] px-3 font-bold text-[var(--tr-bubble-me-ink)] active:scale-[0.99]"
                    data-testid="room-chat"
                  >
                    <MessageCircle size={15} aria-hidden />
                    채팅
                  </a>
                  <button
                    type="button"
                    onClick={() => setOpenPlanBookingId(room.booking_id)}
                    aria-label="일정 검토·확정"
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl active:scale-95 ${
                      badge?.tone === 'review'
                        ? 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)] ring-1 ring-[var(--tr-hairline)]'
                        : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                    }`}
                    data-testid="plan-toggle"
                  >
                    <CalendarClock size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenLedgerBookingId(room.booking_id)}
                    aria-label="정산"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)] active:scale-95"
                    data-testid="ledger-toggle"
                  >
                    <Wallet size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenAssistBookingId(room.booking_id)}
                    aria-label="AI 도우미"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)] active:scale-95"
                    data-testid="assist-toggle"
                  >
                    <Sparkles size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => void enterDrive(room.booking_id)}
                    disabled={driveBusy === room.booking_id}
                    aria-label={driveBusy === room.booking_id ? '운전 모드 여는 중' : '운전 모드'}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tr-ink)] text-[var(--tr-canvas)] active:scale-95 disabled:opacity-50"
                    data-testid="room-drive"
                  >
                    <Car size={18} aria-hidden />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 전체 안내 (day-wide tools) — collapsible, segmented (P4) */}
      <section className="mt-6">
        <button
          type="button"
          onClick={() => setDayToolsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-1 py-1"
          data-testid="daytools-toggle"
        >
          <span className="tr-label font-bold uppercase tracking-wide text-[var(--tr-ink-3)]">전체 안내</span>
          {dayToolsOpen ? (
            <ChevronUp size={16} className="text-[var(--tr-ink-3)]" aria-hidden />
          ) : (
            <ChevronDown size={16} className="text-[var(--tr-ink-3)]" aria-hidden />
          )}
        </button>

        {dayToolsOpen && (
          <div className="mt-2">
            <div className="flex gap-1 rounded-full bg-[var(--tr-surface-2)] p-1">
              {DAY_SEGMENTS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDaySeg(key)}
                  className={`tr-label flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 font-bold ${
                    daySeg === key ? 'bg-[var(--tr-surface)] text-[var(--tr-ink)] shadow-sm' : 'text-[var(--tr-ink-3)]'
                  }`}
                  data-testid={`dayseg-${key}`}
                >
                  <Icon size={13} aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            {daySeg === 'broadcast' && (
        <div className="tr-card mt-2.5 px-3.5 py-3.5">
          <p className="tr-label flex items-center gap-1.5 font-semibold text-[var(--tr-ink-2)]">
            <Megaphone size={14} aria-hidden />
            전체 공지 (모든 손님, 자동 번역)
          </p>
          {voiceState === 'recording' ? (
            <div
              className="mt-2 flex items-center gap-2 rounded-[var(--tr-radius-input)] bg-[var(--tr-danger-soft)] px-3 py-2.5"
              data-testid="guide-recording-bar"
            >
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--tr-danger)]" />
              <span className="tr-card-text flex-1 font-semibold text-[var(--tr-ink)]">녹음 중… 끝나면 완료</span>
              <button
                type="button"
                onClick={() => {
                  recordingRef.current?.cancel();
                  recordingRef.current = null;
                  setVoiceState('idle');
                }}
                className="tr-label flex min-h-[40px] items-center gap-1 rounded-full px-3 font-medium text-[var(--tr-ink-2)]"
              >
                <X size={14} aria-hidden />
                취소
              </button>
              <button
                type="button"
                onClick={() => recordingRef.current?.stop()}
                className="tr-label flex min-h-[40px] items-center gap-1 rounded-full bg-[var(--tr-danger)] px-4 font-semibold text-white"
                data-testid="guide-recording-done"
              >
                <Square size={13} aria-hidden />
                완료
              </button>
            </div>
          ) : voiceState === 'transcribing' ? (
            <div
              className="mt-2 flex items-center gap-2.5 rounded-[var(--tr-radius-input)] bg-[var(--tr-surface-2)] px-3 py-3"
              data-testid="guide-transcribing-bar"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--tr-accent)] border-t-transparent" />
              <span className="tr-card-text text-[var(--tr-ink-2)]">받아쓰는 중…</span>
            </div>
          ) : (
            <form
              className="mt-2 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = draft.trim();
                if (!text) return;
                setDraft('');
                void send({ text }, 'text');
              }}
            >
              {voiceSupported && sttBookingId && (
                <button
                  type="button"
                  onClick={() => void startBroadcastRecording()}
                  aria-label="음성으로 공지"
                  className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)] active:scale-95"
                  data-testid="guide-broadcast-mic"
                >
                  <Mic size={18} aria-hidden />
                </button>
              )}
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                placeholder="예: 10분 뒤 출발합니다"
                className="tr-card-text min-w-0 flex-1 rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy === 'text'}
                className="tr-label flex min-h-[46px] shrink-0 items-center gap-1.5 rounded-full bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
                data-testid="fanout-send"
              >
                <Send size={15} aria-hidden />
                보내기
              </button>
            </form>
          )}
          {micNote && (
            <p
              className="tr-label mt-2 rounded-xl bg-[var(--tr-danger-soft)] px-3 py-2 font-medium text-[var(--tr-danger)]"
              data-testid="guide-mic-note"
            >
              {micNote}
            </p>
          )}
          {voiceSupported && sttBookingId && <MicPrime variant="light" locale="ko" className="mt-2" />}
          {/* T3-4 — one-tap situational presets: zero-LLM (instant, resilient),
              sent to the whole vehicle. Editable free text stays above. */}
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid="operator-presets">
            {OPERATOR_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                disabled={busy === `op-${preset.key}`}
                onClick={() => void send({ operatorPresetKey: preset.key }, `op-${preset.key}`)}
                className="tr-meta rounded-full border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2.5 py-1 font-medium text-[var(--tr-ink-2)] active:scale-95 disabled:opacity-40"
                data-testid={`operator-preset-${preset.key}`}
              >
                {preset.emoji} {preset.text.ko}
              </button>
            ))}
          </div>
        </div>
            )}

            {daySeg === 'meeting' && (
        <div className="tr-card mt-2.5 px-3.5 py-3.5">
          <p className="tr-label flex items-center gap-1.5 font-semibold text-[var(--tr-ink-2)]">
            <MapPin size={14} aria-hidden />
            집합 공지 (손님 화면에 카운트다운)
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="time"
              value={meetTime}
              onChange={(e) => setMeetTime(e.target.value)}
              className="tr-card-text w-28 shrink-0 rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 py-2.5 text-[var(--tr-ink)]"
            />
            <input
              value={meetPoint}
              onChange={(e) => setMeetPoint(e.target.value)}
              maxLength={120}
              placeholder="집합 장소 (예: 주차장 2번 게이트)"
              className="tr-card-text min-w-0 flex-1 rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
            />
            {/* T2-1 — drop a GPS pin so a foreign guest can navigate even when
                the place name means nothing to them. Text is optional once pinned. */}
            <button
              type="button"
              onClick={() => {
                if (!navigator.geolocation) {
                  setError('이 기기에서 위치를 사용할 수 없어요.');
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (pos) => setMeetPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                  () => setError('위치 권한을 허용해 주세요.'),
                  { enableHighAccuracy: true, timeout: 8000 },
                );
              }}
              aria-pressed={Boolean(meetPin)}
              className={`tr-label shrink-0 rounded-[var(--tr-radius-input)] border px-3 py-2.5 font-bold ${
                meetPin
                  ? 'border-[var(--tr-accent)] bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]'
                  : 'border-[var(--tr-hairline)] bg-[var(--tr-surface)] text-[var(--tr-ink)]'
              }`}
              data-testid="meeting-pin"
            >
              {meetPin ? '📍✓' : '📍'}
            </button>
            <button
              type="button"
              disabled={(!meetPoint.trim() && !meetPin) || busy === 'meet'}
              onClick={() =>
                void send(
                  {
                    notice: {
                      kind: 'meeting_notice',
                      time: meetTime,
                      point: meetPoint.trim() || '집합 장소',
                      ...(meetPin ?? {}),
                    },
                  },
                  'meet',
                ).then((ok) => {
                  if (ok) setMeetPin(null);
                })
              }
              className="tr-label shrink-0 rounded-[var(--tr-radius-input)] bg-[var(--tr-accent)] px-3.5 py-2.5 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
              data-testid="meeting-send"
            >
              공지
            </button>
          </div>
        </div>
            )}

            {daySeg === 'free' && (
        <div className="tr-card mt-2.5 px-3.5 py-3.5">
          <p className="tr-label flex items-center gap-1.5 font-semibold text-[var(--tr-ink-2)]">
            <Timer size={14} aria-hidden />
            자유시간 (10분·5분 전 자동 알림)
          </p>
          <input
            value={freePoint}
            onChange={(e) => setFreePoint(e.target.value)}
            maxLength={120}
            placeholder="복귀 장소"
            className="tr-card-text mt-2 w-full rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
          />
          <div className="mt-2 flex gap-1.5">
            {[30, 45, 60].map((minutes) => (
              <button
                key={minutes}
                type="button"
                disabled={busy === 'free'}
                onClick={() => void startFreeTime(minutes)}
                className="tr-label flex-1 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] py-2.5 font-bold text-[var(--tr-ink)] disabled:opacity-40"
              >
                {minutes}분
              </button>
            ))}
            <button
              type="button"
              disabled={busy === 'free'}
              onClick={() => void send({ notice: { kind: 'free_time_timer', cancelled: true, point: freePoint } }, 'free')}
              className="tr-label flex-1 rounded-xl border border-[var(--tr-danger-soft)] bg-[var(--tr-surface)] py-2.5 font-bold text-[var(--tr-danger)] disabled:opacity-40"
              data-testid="free-time-cancel"
            >
              종료
            </button>
          </div>
          {notReturned.length > 0 && overview.lifecycle === 'live' && (
            <p className="tr-meta mt-2 text-[var(--tr-ink-3)]">
              미탑승: {notReturned.map((room) => room.contact_name ?? '게스트').join(', ')}
            </p>
          )}
        </div>
            )}
          </div>
        )}
      </section>

      {/* recent feed */}
      {overview.feed.length > 0 && (
        <section className="mt-6">
          <h2 className="tr-label px-1 font-bold uppercase tracking-wide text-[var(--tr-ink-3)]">최근 메시지</h2>
          <div className="mt-2 space-y-1.5">
            {overview.feed.map((message) => {
              const tag = roomLabel.get(message.room_id);
              // Phase 3 — tap a message → open that guest's chat scrolled to it,
              // ready to quote (customer messages prime a reply).
              const deepLink = tag
                ? `${roomHref(tag.bookingId)}&message=${encodeURIComponent(message.id)}${
                    message.sender_role === 'customer' ? '&reply=1' : ''
                  }`
                : null;
              const Row = deepLink ? 'a' : 'div';
              return (
                <Row
                  key={message.id}
                  {...(deepLink ? { href: deepLink } : {})}
                  className="tr-card flex items-start gap-2 px-3 py-2 active:scale-[0.99]"
                  data-testid="feed-message"
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag ? `hsl(${tag.hue} 55% 52%)` : 'var(--tr-ink-3)' }}
                    title={tag?.name}
                  />
                  <p className="tr-meta min-w-0 flex-1 leading-relaxed text-[var(--tr-ink-2)]">
                    <span className="font-bold text-[var(--tr-ink)]">{tag?.name ?? '룸'}</span>
                    {message.sender_role === 'guide' || message.sender_role === 'admin' ? ' (나/운영)' : ''} ·{' '}
                    {koPreview(message)}
                  </p>
                </Row>
              );
            })}
          </div>
        </section>
      )}

      <p className="tr-meta mt-6 text-center text-[var(--tr-ink-3)]">
        {kstToday() === overview.tour_date ? '오늘 투어' : overview.tour_date} · 15초마다 자동 새로고침
      </p>

      {/* P4 — plan / ledger open in a sheet instead of expanding inline. */}
      {openPlanBookingId && tokenRef.current && (
        <Sheet open onClose={() => setOpenPlanBookingId(null)} closeLabel="닫기" title="일정 검토·확정">
          <GuidePlanPanel
            bookingId={openPlanBookingId}
            token={tokenRef.current}
            onChanged={() => void load()}
          />
        </Sheet>
      )}
      {openLedgerBookingId && tokenRef.current && (
        <Sheet open onClose={() => setOpenLedgerBookingId(null)} closeLabel="닫기" title="정산">
          <GuideLedgerPanel bookingId={openLedgerBookingId} token={tokenRef.current} />
        </Sheet>
      )}
      {openAssistBookingId && tokenRef.current && (
        <Sheet open onClose={() => setOpenAssistBookingId(null)} closeLabel="닫기" title="AI 도우미">
          <OperatorAssist bookingId={openAssistBookingId} token={tokenRef.current} />
        </Sheet>
      )}
    </div>
  );
}
