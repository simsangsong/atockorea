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
import { IconInbox, IconSubmit, IconStop } from '@/components/tour-mode/icons';
import {
  IconArrived,
  IconChevronRight,
  IconConcierge,
  IconClose,
  IconDone,
  IconEta,
  IconLedger,
  IconMeeting,
  IconMic,
  IconMore,
  IconTabChat,
  IconTileSchedule,
  IconVehicle,
  TR_ICON,
} from '../icons';
import GuideLedgerPanel from '@/components/tour-mode/guide/GuideLedgerPanel';
import GuidePlanPanel from '@/components/tour-mode/guide/GuidePlanPanel';
import GuideSeatDashboard from '@/components/tour-mode/guide/GuideSeatDashboard';
import OperatorAssist from '@/components/tour-mode/guide/OperatorAssist';
import MicPrime from '@/components/tour-mode/MicPrime';
import Sheet from '@/components/tour-mode/Sheet';
import StaffShell, { type StaffTabKey } from '@/components/tour-mode/staff/StaffShell';
import StaffSettings from '@/components/tour-mode/staff/StaffSettings';
import GuideAnnouncePanel from '@/components/tour-mode/staff/GuideAnnouncePanel';
import { PreDepartureChecklist } from '@/components/tour-mode/driver/DriverConsole';
import { useTourManifest } from '@/hooks/useTourManifest';
import { useResolvedTourTheme } from '@/hooks/useResolvedTourTheme';
import Cockpit, { type CockpitLifecycle, type CockpitRoom } from '@/components/tour-mode/cockpit/Cockpit';
import { roomHue } from '@/lib/tour-room/hue';
import ChatListRow from '@/components/tour-mode/chatlist/ChatListRow';
import { chatListClock, kstToday } from '@/lib/tour-room/time';
import { OPERATOR_PRESETS } from '@/lib/tour-room/operatorPresets';
import { primeAudio } from '@/lib/tour-room/tts';
import { type RoomMessage } from '@/hooks/useTourRoomChannel';
import {
  isVoiceRecordingSupported,
  startVoiceRecording,
  type ActiveRecording,
} from '@/lib/tour-room/recorder';
import {
  ALL_TARGET,
  clearTarget,
  pruneTarget,
  sendButtonLabel,
  targetChipLabel,
  targetOne,
  targetPayload,
  targetTone,
  toggleTarget,
  type MessageTarget,
  type TargetRoster,
} from '@/lib/tour-room/messageTarget';

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
  /** §11.D D7 — join-vs-private kind resolved server-side; may be absent. */
  tour_kind?: 'join' | 'private';
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
  /** §11.D D7 — join-vs-private kind for hiding private-only cockpit tools. */
  tourKind: 'join' | 'private';
}


/** P4 — the collapsed day-tools segment control. */
const DAY_SEGMENTS = [
  { key: 'broadcast' as const, label: '공지', Icon: IconMeeting },
  { key: 'meeting' as const, label: '집합', Icon: IconArrived },
  { key: 'free' as const, label: '자유시간', Icon: IconEta },
];

interface OverviewRoom {
  booking_id: string;
  room_id: string | null;
  /**
   * D2: private (vehicle-charter) tour ⇒ the plan editor / review flow is
   * available; join / shared tours run a fixed itinerary and hide it. May be
   * absent on older payloads (treated as non-private = hidden).
   */
  is_private?: boolean;
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

/** Stable pastel hue per room (T6.2) — lives in lib/tour-room/hue so the seat
 *  dashboard shares the identical color without a component import cycle.
 *  Re-exported to keep existing imports (tests, prior callers) working. */
export { roomHue };

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
  /**
   * 🔴 `undefined` means "not read yet", `null` means "read, and absent".
   *
   * This used to start at `null`, which collapsed those two into one. The token
   * is read in an effect, so it is still null on first paint — and the render
   * below turned that into 「가이드 링크(이메일의 버튼)로 접속해 주세요」. Every
   * single load of this console opened by telling the guide their link was
   * wrong, for as long as it took the effect to run (~400ms measured on dev,
   * longer on a slow phone), before quietly correcting itself.
   *
   * Accusing someone of a mistake they did not make is worse than showing them
   * nothing, and it is the same fail-open shape the full audit catalogued:
   * treating "absent" and "not determined yet" as the same answer.
   */
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // §K B3 — 발송 대상. 기본은 전체이고, 전송 후에도 유지된다(B3-D4):
  // 개인톡 대화가 이어지는 것이 자연스럽고, 매번 다시 고르게 하면 개인톡이
  // 사실상 못 쓰는 기능이 된다.
  const [target, setTarget] = useState<MessageTarget>(ALL_TARGET);
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
  // C-D7 — the day-wide tools live in a sheet now, opened from the pinned
  // [전체 공지] chat-list row (and by seat-tab "이 손님에게만 공지").
  const [dayToolsOpen, setDayToolsOpen] = useState(false);
  const [daySeg, setDaySeg] = useState<'broadcast' | 'meeting' | 'free'>('broadcast');
  // W2 — the shell tab is controlled here so seat actions can jump tabs.
  const [staffTab, setStaffTab] = useState<StaffTabKey>('chat');
  // 손님 안내 보내기 (wa.me/mailto 원버튼) — 사용자 요청 2026-07-27.
  const [announceOpen, setAnnounceOpen] = useState(false);
  // C-D7 — per-guest ⋮ action sheet (일정/정산/AI/운전/개인 공지) so the chat
  // list rows stay one line tall without losing any of the five actions.
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const preShellDark = useResolvedTourTheme() === 'dark';
  const tokenRef = useRef<string | null>(null);
  // send()가 useCallback이라 target을 의존성에 넣으면 선택할 때마다 재생성된다.
  // ref로 읽으면 항상 최신값을 쓰면서 콜백은 안정적으로 유지된다.
  const targetRef = useRef<MessageTarget>(ALL_TARGET);
  targetRef.current = target;

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

  // W3 (U4-D3) — the seat ledger feeds the roster so target chips and send
  // buttons can finally say "3번 Massimo" (guestLabel's seat path was dead
  // code while this payload carried names only). Party bookings may hold
  // several seats; the lowest number is the label.
  const manifestAnchor = overview?.rooms[0]?.booking_id ?? null;
  // `undefined` (not read yet) and `null` (absent) are the same answer to this
  // hook — both mean "no token to fetch with". The distinction only matters for
  // what the guide is shown while we find out.
  const { data: manifest } = useTourManifest(manifestAnchor, token ?? null);
  const seatByBooking = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of manifest?.assignments ?? []) {
      const prev = map.get(a.booking_id);
      if (prev === undefined || a.seat_number < prev) map.set(a.booking_id, a.seat_number);
    }
    return map;
  }, [manifest]);

  // B3 — 명단(칩 문구·버튼 라벨의 근거). 좌석이 배정돼 있으면 함께 싣는다.
  const roster: TargetRoster = useMemo(
    () => ({
      total: overview?.rooms.length ?? 0,
      guests: (overview?.rooms ?? []).map((r) => ({
        bookingId: r.booking_id,
        name: r.contact_name,
        seat: seatByBooking.get(r.booking_id) ?? null,
      })),
    }),
    [overview, seatByBooking],
  );

  // B3-D4 — 룸/날짜를 벗어나면 대상이 초기화된다. 명단에 없는 예약이 남아 있으면
  // 칩이 유령 이름을 보여준다.
  useEffect(() => {
    setTarget((prev) => pruneTarget(prev, roster));
  }, [roster]);

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
          body: JSON.stringify({
            tourId: overview.tour.id,
            tourDate: overview.tour_date,
            token: t,
            // B3-D1 — 같은 라우트를 탄다. 전체일 때는 아무것도 안 붙으므로
            // 기존 호출과 완전히 동일한 요청이 나간다.
            ...targetPayload(targetRef.current),
            ...body,
          }),
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

  const enterDrive = useCallback(async (bookingId: string) => {
    const t = tokenRef.current;
    if (!t || driveBusy) return;
    primeAudio(); // this tap is the gesture that unlocks incoming-message TTS
    setDriveBusy(bookingId);
    setDriveError(null);
    try {
      /**
       * 1. cockpit day bundle (schedule + coords + pickup).
       *
       * 🔴 This used to be "cached once" for the console's whole session, and
       * the thing it caches is the DAY PLAN. A guide who reorders a stop, skips
       * one, or has the plan confirmed between two drive-mode entries got the
       * stale order back — while the guest was being told "오늘의 일정이
       * 변경되었어요" by the capsule the same edit fires. The driver's
       * destination header and the nav deep-link would then point at a stop the
       * party is no longer going to, which is a navigation error, not a
       * staleness nit.
       *
       * It is one GET behind an explicit tap. Correctness wins.
       */
      const res = await fetch(`/api/tour-mode/driver/overview?rt=${encodeURIComponent(t)}`, { cache: 'no-store' });
      const data = (await res.json()) as CockpitOverview;
      if (!res.ok) throw new Error('overview');
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
        // §11.D D7 — same driver overview route now resolves the kind; default
        // to private when absent so current behavior is unchanged.
        tourKind: data.tour_kind ?? 'private',
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
  // 좌석·명단 탭 어텐션 — 배차가 있는 날에만 의미가 있다(배차 0이면 전원이
  // "미지정"이라 뱃지가 소음이 된다). 교차표면 감사 #6.
  const unseatedCount = useMemo(() => {
    if (!manifest || manifest.vehicles.length === 0 || !overview) return 0;
    return overview.rooms.filter((room) => !seatByBooking.has(room.booking_id)).length;
  }, [manifest, overview, seatByBooking]);
  const roomLabel = useMemo(() => {
    const map = new Map<string, { name: string; hue: number; bookingId: string }>();
    for (const room of overview?.rooms ?? []) {
      if (room.room_id)
        map.set(room.room_id, { name: room.contact_name ?? '게스트', hue: roomHue(room.booking_id), bookingId: room.booking_id });
    }
    return map;
  }, [overview]);

  // 프리셸(토큰 없음/로딩/에러)도 저장된 테마를 존중한다 — 래퍼 없이는 다크
  // 사용자가 셸 뜨기 전 라이트 플래시를 본다 (교차표면 감사 #6).
  const preShell = (message: string) => (
    <div className={preShellDark ? 'dark' : ''}>
      <div className="tr-root tr-plan-root flex min-h-dvh items-center justify-center bg-[var(--tr-canvas)] px-6 text-center">
        <p className="tr-card-text text-[var(--tr-ink-2)]">{message}</p>
      </div>
    </div>
  );
  /**
   * UX-001 — loading gets a shape; the two dead ends keep their sentence.
   *
   * `preShell` used to draw all three states the same way: one centred line of
   * text. For "no token" and "access denied" that is right — nothing is coming,
   * so a skeleton would be a lie that never resolves. But the guide console
   * paints in well under a second and only becomes usable near 2.5s, and for
   * that whole window the screen was a sentence in the middle of nothing. The
   * guide is standing in front of the customer while it happens.
   *
   * So the wait now shows the shell it is about to become — header, a few room
   * cards, tab bar — at the same measurements the real chrome uses, and the
   * message rides along instead of standing alone.
   */
  const preShellSkeleton = (message: string) => (
    <div className={preShellDark ? 'dark' : ''}>
      <div className="tr-root tr-plan-root flex min-h-dvh flex-col bg-[var(--tr-canvas)]" data-testid="guide-console-skeleton">
        <div
          className="tr-safe-top tr-chrome-line-b z-30 flex shrink-0 items-center gap-2 bg-[var(--tr-chrome)] px-3"
          style={{ minHeight: 'var(--tr-header-h)' }}
        >
          <div className="h-4 w-40 animate-pulse rounded bg-[var(--tr-surface-2)]" />
        </div>
        <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden px-4 py-4" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="tr-card space-y-2 p-3.5">
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-[var(--tr-surface-2)]" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--tr-surface-2)]" />
            </div>
          ))}
        </div>
        <p className="tr-meta px-4 pb-3 text-center text-[var(--tr-ink-3)]" role="status">
          {message}
        </p>
        <div className="tr-safe-bottom tr-chrome-line-t z-30 h-[57px] shrink-0 bg-[var(--tr-chrome)]" />
      </div>
    </div>
  );

  if (token === undefined) return preShellSkeleton('불러오는 중…'); // still reading it
  if (!token) return preShell('가이드 링크(이메일의 버튼)로 접속해 주세요.');
  if (!overview) {
    return error
      ? preShell('접근할 수 없어요 — 링크를 다시 확인해 주세요.')
      : preShellSkeleton('불러오는 중…');
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
          /* The 명단·좌석 tile renders only when this is present, and the guide
             mount left it out — so a guide who tapped 운전 모드 lost the roster
             that the driver arriving by link could see. The manifest endpoint
             authorises guide, driver and admin alike, and this component holds
             the same token it already uses for the overview fetch. */
          roomToken={tokenRef.current}
          channelTopic={drive.channelTopic}
          initialMessages={drive.initialMessages}
          city={drive.city}
          tourKind={drive.tourKind}
          onExit={() => setDrive(null)}
        />
      </div>
    );
  }

  const notReturned = overview.rooms.filter((room) => !room.onboard_ack);
  const rooms = [...overview.rooms].sort((a, b) => attentionScore(b) - attentionScore(a));
  // C-D7 — the 전체 공지 row's preview: latest fan-out (broadcast route stamps
  // metadata.fanout on every copy; the feed is created_at DESC, so find() is
  // the most recent one).
  const lastBroadcast = overview.feed.find(
    (message) =>
      (message.metadata as { fanout?: boolean } | undefined)?.fanout === true &&
      message.sender_role !== 'customer',
  );
  const replyCount = overview.rooms.filter((room) => room.last_message?.sender_role === 'customer').length;
  const reviewCount = overview.rooms.filter(
    (room) => room.day_plan?.status === 'guest_draft' || room.day_plan?.status === 'guest_submitted',
  ).length;
  const roomHref = (bookingId: string) =>
    `/tour-mode/room/${bookingId}?rt=${encodeURIComponent(tokenRef.current ?? '')}`;

  // ── W2 (U4-D1/D2): the day is now FOUR TABS in the staff shell, not one
  // tall scroll. Each tab's JSX is built here so all state stays local.
  const chatTab = (
    <div data-testid="guide-console">
      {/* attention strip — reply/review counts (date · counts live in the
          shell's subtitle line now) */}
      {(replyCount > 0 || reviewCount > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {replyCount > 0 && (
            <span className="tr-meta text-cjk-safe inline-flex items-center gap-1 rounded-full bg-[var(--tr-danger-soft)] px-2.5 py-1 font-bold tabular-nums text-[var(--tr-danger)]">
              <IconTabChat size={TR_ICON.meta} aria-hidden />
              답장 {replyCount}
            </span>
          )}
          {reviewCount > 0 && (
            <span className="tr-meta text-cjk-safe inline-flex items-center gap-1 rounded-full bg-[var(--tr-accent-soft)] px-2.5 py-1 font-bold tabular-nums text-[var(--tr-accent)]">
              <IconTileSchedule size={TR_ICON.meta} aria-hidden />
              검토 {reviewCount}
            </span>
          )}
        </div>
      )}

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

      {/* 운행 시작 — the day's primary action, on the first screen.
       *
       * It used to be a 44px pill in near-black (`--tr-ink`) on the THIRD tab,
       * which is both too small and too dark for the control a guide presses at
       * the start of every tour (사용자 리포트 2026-07-28, with a screenshot).
       * Size and press physics carry the prominence; the surface stays a wash.
       *
       * One booking is the private-charter norm, so one tap starts driving.
       * With several, the button cannot know which vehicle — it hands over to
       * the 운행 tab where the per-room entries live, rather than guessing.
       * Hidden once the day has ended: a start button for a finished tour is
       * an invitation to a dead screen. */}
      {overview.lifecycle !== 'ended' && rooms.length > 0 && (
        <button
          type="button"
          onClick={() => {
            if (rooms.length === 1) void enterDrive(rooms[0].booking_id);
            else setStaffTab('ops');
          }}
          disabled={Boolean(driveBusy)}
          className="tr-cta-hero mt-3"
          data-testid="drive-hero"
        >
          <span className="tr-cta-hero-glyph" aria-hidden>
            <IconVehicle size={TR_ICON.action} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="tr-body text-cjk-safe block font-bold">
              {driveBusy
                ? '운전 모드 여는 중…'
                : overview.lifecycle === 'live'
                  ? '운행 중 · 콕핏 열기'
                  : '운행 시작'}
            </span>
            <span className="tr-meta mt-0.5 block truncate opacity-80">
              {rooms.length === 1
                ? '내비·손님 위치·통역이 한 화면에'
                : `차량 ${rooms.length}대 — 운행 탭에서 고르기`}
            </span>
          </span>
          <IconChevronRight size={TR_ICON.chip} className="shrink-0 opacity-60" aria-hidden />
        </button>
      )}

      {/* C-D7 — pinned channel rows (카톡 채팅탭의 상단 고정 문법): 안내 발송
          도구들이 대화 리스트와 같은 행 문법으로 산다. */}
      <div className="tr-card mt-3 divide-y divide-[var(--tr-hairline)] overflow-hidden border border-[var(--tr-hairline)]">
        {/* 손님 안내 보내기 — 전날/당일 wa.me·메일 프리필 (관제 M4의 가이드 입구) */}
        <button
          type="button"
          onClick={() => setAnnounceOpen(true)}
          className="flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2 text-left active:bg-[var(--tr-surface-2)]"
          data-testid="open-announce"
        >
          <span className="tr-chip tr-chip--base flex h-11 w-11 shrink-0 items-center justify-center !rounded-[14px]">
            <IconSubmit size={TR_ICON.action} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="tr-card-text text-cjk-safe block font-bold text-[var(--tr-ink)]">
              손님 안내 보내기
            </span>
            <span className="tr-meta mt-0.5 block truncate text-[var(--tr-ink-3)]">
              왓츠앱·메일 문구가 채워진 채 열려요
            </span>
          </span>
          <IconChevronRight size={TR_ICON.chip} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
        </button>
        {/* 전체 공지 — the broadcast "thread". Preview = the latest fan-out
            message (metadata.fanout), so this row reads like a group chat. */}
        <button
          type="button"
          onClick={() => {
            setDaySeg('broadcast');
            setDayToolsOpen(true);
          }}
          className="text-cjk-safe flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2 text-left active:bg-[var(--tr-surface-2)]"
          data-testid="daytools-open"
        >
          <span className="tr-chip tr-chip--accent flex h-11 w-11 shrink-0 items-center justify-center !rounded-[14px]">
            <IconMeeting size={TR_ICON.action} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="tr-card-text text-cjk-safe font-bold text-[var(--tr-ink)]">전체 공지</span>
              <span className="tr-meta tr-num shrink-0 text-[var(--tr-ink-3)]">{overview.rooms.length}팀</span>
            </span>
            <span className="tr-meta mt-0.5 block truncate text-[var(--tr-ink-3)]" data-testid="daytools-preview">
              {lastBroadcast ? koPreview(lastBroadcast) : '집합·자유시간·전체 안내 보내기'}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1 self-start pt-1.5">
            <span className="tr-meta tr-num text-[var(--tr-ink-3)]">
              {lastBroadcast ? chatListClock(lastBroadcast.created_at) : ''}
            </span>
            <IconChevronRight size={TR_ICON.chip} className="text-[var(--tr-ink-3)]" aria-hidden />
          </span>
        </button>
      </div>

      {/* C-D7 — 대화 (rooms as a KakaoTalk-style chat list). Row tap = that
          guest's 1:1 room; the trailing ⋮ keeps 일정/정산/AI/운전/개인 공지
          one tap away (편의성 무손실). */}
      <section className="mt-4">
        <h2 className="tr-label px-1 font-bold uppercase tracking-wide text-[var(--tr-ink-3)]">
          대화 · {overview.rooms.length}
        </h2>
        {overview.rooms.length === 0 && (
          <div className="tr-card mt-2 flex flex-col items-center gap-2 px-4 py-8 text-center">
            <IconInbox size={TR_ICON.tile} className="text-[var(--tr-ink-3)]" aria-hidden />
            <p className="tr-card-text text-[var(--tr-ink-2)]">오늘은 배정된 예약이 없어요.</p>
          </div>
        )}
        {overview.rooms.length > 0 && (
          <div className="tr-card mt-2 divide-y divide-[var(--tr-hairline)] overflow-hidden border border-[var(--tr-hairline)]">
            {rooms.map((room) => {
              const badge = planBadge(room.day_plan?.status);
              const awaitingReply = room.last_message?.sender_role === 'customer';
              /**
               * Did the driver ever open the link the guide minted?
               *
               * Feature audit F7. Joining already writes a driver row here and
               * /guide/overview already sends it — this component declared
               * `participants` in its props type and then never read it, so the
               * answer arrived on every poll and was dropped. Ops learned the
               * link had not landed on the morning it mattered.
               *
               * Shown only while it is still actionable. Once the driver is in,
               * the absence of a warning is the signal; a permanent tick on
               * every row is noise the eye stops seeing.
               */
              const driverJoined = room.participants.some((p) => p.role === 'driver');
              return (
                <ChatListRow
                  key={room.booking_id}
                  testId="room-card"
                  linkTestId="room-chat"
                  href={roomHref(room.booking_id)}
                  hue={roomHue(room.booking_id)}
                  avatar={(room.contact_name ?? 'G').trim()[0]?.toUpperCase()}
                  title={room.contact_name ?? '게스트'}
                  meta={`${room.number_of_guests ?? 1}명`}
                  badges={
                    <>
                      {!driverJoined && (
                        <span
                          data-testid="driver-not-joined"
                          className="tr-meta text-cjk-safe shrink-0 rounded-full bg-[var(--tr-accent-soft)] px-1.5 py-0.5 font-bold text-[var(--tr-ink-2)]"
                          title="기사가 아직 링크를 열지 않았어요"
                        >
                          기사 미확인
                        </span>
                      )}
                      {room.onboard_ack && (
                        <span className="inline-flex shrink-0 items-center text-[var(--tr-safe)]" title="탑승 확인">
                          <IconDone size={TR_ICON.meta} aria-hidden />
                        </span>
                      )}
                      {badge && (
                        <span
                          className={`tr-meta text-cjk-safe shrink-0 rounded-full px-1.5 py-0.5 font-bold ${
                            badge.tone === 'review'
                              ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                              : 'bg-[var(--tr-accent-soft)] text-[var(--tr-ink-2)]'
                          }`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </>
                  }
                  preview={koPreview(room.last_message)}
                  previewEmphasised={awaitingReply}
                  time={chatListClock(room.last_message?.created_at)}
                  indicator={
                    awaitingReply ? (
                      <span
                        className="h-2 w-2 rounded-full bg-[var(--tr-danger)]"
                        data-testid="room-unread-dot"
                        title="답장 필요"
                      />
                    ) : null
                  }
                  action={
                    <button
                      type="button"
                      onClick={() => setActionBookingId(room.booking_id)}
                      aria-label={`${room.contact_name ?? '게스트'} 더보기`}
                      aria-haspopup="dialog"
                      className="mr-1 flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink-3)] active:bg-[var(--tr-surface-2)]"
                      data-testid="room-more"
                    >
                      <IconMore size={TR_ICON.action} aria-hidden />
                    </button>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* C-D7 — 전체 안내 sheet: opened by the pinned [전체 공지] row above and
          by the seat tab's "이 손님에게만 공지" (target pre-filled). The tools
          inside are unchanged — they just live behind a sheet instead of an
          inline collapsible, so the chat list keeps the room list on screen. */}
      {dayToolsOpen && (
        <Sheet open onClose={() => setDayToolsOpen(false)} closeLabel="닫기" title="전체 안내">
          <div data-testid="daytools-sheet">
            <div className="flex gap-1 rounded-full bg-[var(--tr-surface-2)] p-1">
              {DAY_SEGMENTS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDaySeg(key)}
                  className={`tr-label text-cjk-safe flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 font-bold ${
                    daySeg === key ? 'bg-[var(--tr-surface)] text-[var(--tr-ink)] shadow-sm' : 'text-[var(--tr-ink-3)]'
                  }`}
                  data-testid={`dayseg-${key}`}
                >
                  <Icon size={TR_ICON.meta} aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            {daySeg === 'broadcast' && (
        <div className="tr-card mt-2.5 px-3.5 py-3.5">
          <p className="tr-label flex items-center gap-1.5 font-semibold text-[var(--tr-ink-2)]">
            <IconMeeting size={TR_ICON.meta} aria-hidden />
            메시지 (자동 번역)
          </p>

          {/* §K B3-D3 — 대상은 **항상** 여기 보인다. 라이브 투어에서 오발송은
              실질 피해라(취소 안내가 12명에게 / 집합 공지가 1명에게), 대상이
              화면 어딘가에 조용히 있으면 반드시 사고가 난다. 전체와 개인은
              색·아이콘이 다르다. */}
          <div className="mt-2 flex items-center gap-2" data-testid="guide-target-row">
            <span
              data-testid="guide-target-chip"
              data-tone={targetTone(target)}
              className={
                'tr-label text-cjk-safe inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold ' +
                (targetTone(target) === 'all'
                  ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                  : 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent)]')
              }
            >
              {targetTone(target) === 'all' ? (
                <IconMeeting size={TR_ICON.meta} aria-hidden />
              ) : (
                <IconSubmit size={TR_ICON.meta} aria-hidden />
              )}
              {targetChipLabel(target, roster)}
            </span>
            {targetTone(target) !== 'all' && (
              <button
                type="button"
                onClick={() => setTarget(clearTarget())}
                aria-label="대상 해제 (전체로)"
                data-testid="guide-target-clear"
                className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-full text-[var(--tr-ink-3)] active:scale-95"
              >
                <IconClose size={TR_ICON.meta} aria-hidden />
              </button>
            )}
          </div>

          {/* 이름 탭 = 그 사람에게만. B3-D2 — 세 번째 선택 화면을 만들지 않고
              가이드가 이미 사람을 지목하는 곳에 진입점을 둔다. */}
          {roster.guests.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5" data-testid="guide-target-picker">
              {roster.guests.map((g) => {
                const picked = target.kind === 'selected' && target.bookingIds.includes(g.bookingId);
                return (
                  <button
                    key={g.bookingId}
                    type="button"
                    onClick={() => setTarget((prev) => toggleTarget(prev, g.bookingId))}
                    aria-pressed={picked}
                    className={
                      'tr-label text-cjk-safe min-h-[32px] rounded-full border px-2.5 font-medium active:scale-95 ' +
                      (picked
                        ? 'border-[var(--tr-accent)] bg-[var(--tr-accent-soft)] text-[var(--tr-accent)]'
                        : 'border-[var(--tr-hairline)] text-[var(--tr-ink-2)]')
                    }
                  >
                    {g.name?.trim() || '이름 미상'}
                  </button>
                );
              })}
            </div>
          )}
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
                className="text-cjk-safe tr-label flex min-h-[44px] items-center gap-1 rounded-full px-3 font-medium text-[var(--tr-ink-2)]"
              >
                <IconClose size={TR_ICON.meta} aria-hidden />
                취소
              </button>
              <button
                type="button"
                onClick={() => recordingRef.current?.stop()}
                className="text-cjk-safe tr-label flex min-h-[44px] items-center gap-1 rounded-full bg-[var(--tr-danger)] px-4 font-semibold text-white"
                data-testid="guide-recording-done"
              >
                <IconStop size={TR_ICON.meta} aria-hidden />
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
                  <IconMic size={TR_ICON.action} aria-hidden />
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
                className="tr-label text-cjk-safe flex min-h-[46px] shrink-0 items-center gap-1.5 rounded-full bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
                data-testid="fanout-send"
              >
                <IconSubmit size={TR_ICON.chip} aria-hidden />
                {sendButtonLabel(target, roster)}
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
            <IconArrived size={TR_ICON.meta} aria-hidden />
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
              aria-label={meetPin ? '집합 위치 핀 찍힘' : '현재 위치로 집합 핀 찍기'}
              className={`inline-flex shrink-0 items-center gap-0.5 rounded-[var(--tr-radius-input)] border px-3 py-2.5 ${
                meetPin
                  ? 'border-[var(--tr-accent)] bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]'
                  : 'border-[var(--tr-hairline)] bg-[var(--tr-surface)] text-[var(--tr-ink)]'
              }`}
              data-testid="meeting-pin"
            >
              <IconArrived size={TR_ICON.chip} aria-hidden />
              {meetPin ? <IconDone size={TR_ICON.meta} aria-hidden /> : null}
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
              className="text-cjk-safe tr-label shrink-0 rounded-[var(--tr-radius-input)] bg-[var(--tr-accent)] px-3.5 py-2.5 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
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
            <IconEta size={TR_ICON.meta} aria-hidden />
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
                className="text-cjk-safe tr-label flex-1 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] py-2.5 font-bold text-[var(--tr-ink)] disabled:opacity-40"
              >
                {minutes}분
              </button>
            ))}
            <button
              type="button"
              disabled={busy === 'free'}
              onClick={() => void send({ notice: { kind: 'free_time_timer', cancelled: true, point: freePoint } }, 'free')}
              className="text-cjk-safe tr-label flex-1 rounded-xl border border-[var(--tr-danger-soft)] bg-[var(--tr-surface)] py-2.5 font-bold text-[var(--tr-danger)] disabled:opacity-40"
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
        </Sheet>
      )}

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
    </div>
  );

  // 좌석·명단 tab — 단일 소스 ops_seat_assignments, tour 스코프 (§5.4b).
  // U4-D3: 좌석 터치 → [대화 열기]=그 예약의 룸(=1:1), [이 손님에게만 공지]=
  // 타겟 발송 프리필 + 대화 탭 점프.
  const seatsTab =
    tokenRef.current && overview.rooms[0]?.booking_id ? (
      <GuideSeatDashboard
        token={tokenRef.current}
        bookingId={overview.rooms[0].booking_id}
        onOpenChat={(bid) => {
          window.location.assign(roomHref(bid));
        }}
        onTargetNotice={(bid) => {
          // C-D7 — the composer is a sheet now: prefill the target, jump to
          // the 대화 tab (the sheet mounts there) and open it. No scroll dance.
          setTarget(targetOne(bid));
          setDaySeg('broadcast');
          setStaffTab('chat');
          setDayToolsOpen(true);
        }}
      />
    ) : (
      <p className="tr-card-text pt-10 text-center text-[var(--tr-ink-3)]">오늘은 배정된 예약이 없어요.</p>
    );

  // 운행 tab — per-room drive entry + the pre-departure habit list.
  const opsTab = (
    <div className="flex flex-col gap-3" data-testid="guide-ops-tab">
      {overview.rooms.length === 0 && (
        <p className="tr-card-text pt-10 text-center text-[var(--tr-ink-3)]">오늘은 배정된 예약이 없어요.</p>
      )}
      {rooms.map((room) => (
        <div
          key={room.booking_id}
          className="tr-card flex items-center gap-3 border border-[var(--tr-hairline)] px-3.5 py-3"
        >
          <span
            className="tr-body flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-bold text-white"
            style={{ backgroundColor: `hsl(${roomHue(room.booking_id)} 55% 52%)` }}
            aria-hidden
          >
            {(room.contact_name ?? 'G').trim()[0]?.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="tr-card-text font-bold text-[var(--tr-ink)]">{room.contact_name ?? '게스트'}</p>
            <p className="tr-meta text-[var(--tr-ink-3)]">
              {room.number_of_guests ?? 1}명{room.pickup?.name ? ` · ${room.pickup.name}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void enterDrive(room.booking_id)}
            disabled={driveBusy === room.booking_id}
            /* Was near-black (`--tr-ink`) — the same "찐한 색" the hero button
               above replaced. Kept as the compact per-room variant of the same
               material so the two entries read as one control, not two. */
            className="tr-cta-hero tr-label text-cjk-safe !min-h-[44px] !w-auto shrink-0 justify-center !gap-1.5 !rounded-xl !px-4 font-bold"
            data-testid="ops-drive"
          >
            <IconVehicle size={TR_ICON.chip} aria-hidden />
            운전 모드
          </button>
        </div>
      ))}
      <div className="flex justify-center">
        <PreDepartureChecklist tourDate={overview.tour_date} />
      </div>
    </div>
  );

  // P4 — plan / ledger open in a sheet. Rendered through the shell's overlay
  // slot so they stay INSIDE the themed root (a sheet outside .tr-root goes
  // transparent — 2026-07-26 field incident).
  // C-D7 — the chat-list row's ⋮ sheet: every action the old room card
  // carried, now one tap behind the row (일정/정산/AI/운전/개인 공지).
  const actionRoom = actionBookingId
    ? overview.rooms.find((room) => room.booking_id === actionBookingId) ?? null
    : null;
  const actionRow = (
    label: string,
    Icon: typeof IconTabChat,
    onPress: () => void,
    opts: { testid: string; disabled?: boolean; primary?: boolean } ,
  ) => (
    <button
      type="button"
      disabled={opts.disabled}
      onClick={onPress}
      data-testid={opts.testid}
      className={`text-cjk-safe flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3.5 text-left active:scale-[0.995] disabled:opacity-40 ${
        opts.primary
          ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
          : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink)]'
      }`}
    >
      <Icon size={TR_ICON.action} className="shrink-0" aria-hidden />
      <span className="tr-card-text min-w-0 flex-1 font-semibold">{label}</span>
      <IconChevronRight
        size={TR_ICON.chip}
        className={`shrink-0 ${opts.primary ? 'opacity-70' : 'text-[var(--tr-ink-3)]'}`}
        aria-hidden
      />
    </button>
  );

  const overlay = (
    <>
      {actionRoom && (
        <Sheet
          open
          onClose={() => setActionBookingId(null)}
          closeLabel="닫기"
          title={
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="tr-name flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold text-white"
                style={{ backgroundColor: `hsl(${roomHue(actionRoom.booking_id)} 55% 52%)` }}
                aria-hidden
              >
                {(actionRoom.contact_name ?? 'G').trim()[0]?.toUpperCase()}
              </span>
              <span className="truncate">{actionRoom.contact_name ?? '게스트'}</span>
              <span className="tr-meta tr-num shrink-0 font-normal text-[var(--tr-ink-3)]">
                {actionRoom.number_of_guests ?? 1}명 · {actionRoom.preferred_language ?? 'en'}
              </span>
            </span>
          }
        >
          <div className="space-y-2" data-testid="guest-action-sheet">
            {actionRoom.pickup?.name && (
              <p className="tr-meta flex items-center gap-1.5 px-1 text-[var(--tr-ink-2)]">
                <IconArrived size={TR_ICON.meta} className="shrink-0" aria-hidden />
                <span className="truncate">
                  {actionRoom.pickup.pickup_time ? `${actionRoom.pickup.pickup_time} · ` : ''}
                  {actionRoom.pickup.name}
                </span>
              </p>
            )}
            <a
              href={roomHref(actionRoom.booking_id)}
              data-testid="sheet-room-chat"
              className="text-cjk-safe flex min-h-[52px] w-full items-center gap-3 rounded-xl bg-[var(--tr-accent)] px-3.5 text-left text-[var(--tr-bubble-me-ink)] active:scale-[0.995]"
            >
              <IconTabChat size={TR_ICON.action} className="shrink-0" aria-hidden />
              <span className="tr-card-text min-w-0 flex-1 font-semibold">채팅 열기</span>
              <IconChevronRight size={TR_ICON.chip} className="shrink-0 opacity-70" aria-hidden />
            </a>
            {actionRoom.is_private &&
              actionRow('일정 검토·확정', IconTileSchedule, () => {
                setActionBookingId(null);
                setOpenPlanBookingId(actionRoom.booking_id);
              }, { testid: 'plan-toggle' })}
            {actionRow('정산', IconLedger, () => {
              setActionBookingId(null);
              setOpenLedgerBookingId(actionRoom.booking_id);
            }, { testid: 'ledger-toggle' })}
            {actionRow('AI 도우미', IconConcierge, () => {
              setActionBookingId(null);
              setOpenAssistBookingId(actionRoom.booking_id);
            }, { testid: 'assist-toggle' })}
            {actionRow('이 손님에게만 공지', IconMeeting, () => {
              setActionBookingId(null);
              setTarget(targetOne(actionRoom.booking_id));
              setDaySeg('broadcast');
              setDayToolsOpen(true);
            }, { testid: 'target-notice-toggle' })}
            {actionRow(
              driveBusy === actionRoom.booking_id ? '운전 모드 여는 중…' : '운전 모드',
              IconVehicle,
              () => {
                setActionBookingId(null);
                void enterDrive(actionRoom.booking_id);
              },
              { testid: 'room-drive', disabled: driveBusy === actionRoom.booking_id },
            )}
          </div>
        </Sheet>
      )}
      {announceOpen && tokenRef.current && (
        <Sheet open onClose={() => setAnnounceOpen(false)} closeLabel="닫기" title="손님 안내 보내기">
          <GuideAnnouncePanel
            token={tokenRef.current}
            tourId={overview.tour.id}
            tourDate={overview.tour_date}
          />
        </Sheet>
      )}
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
    </>
  );

  return (
    <StaffShell
      title={overview.tour.title}
      lifecycle={overview.lifecycle}
      subtitle={`${overview.tour_date} · 예약 ${overview.rooms.length} · 탑승 ${onboardCount}/${overview.rooms.length}`}
      onRefresh={() => {
        setRefreshing(true);
        void load().finally(() => setRefreshing(false));
      }}
      refreshing={refreshing}
      chatBadge={replyCount}
      seatsBadge={unseatedCount}
      tab={staffTab}
      onTabChange={setStaffTab}
      chat={chatTab}
      seats={seatsTab}
      ops={opsTab}
      settings={<StaffSettings />}
      overlay={overlay}
    />
  );
}
