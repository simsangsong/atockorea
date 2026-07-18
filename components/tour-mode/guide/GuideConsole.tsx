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
  Check,
  ChevronDown,
  ChevronUp,
  Inbox,
  MapPin,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Send,
  Timer,
  Users,
  Wallet,
} from 'lucide-react';
import GuideLedgerPanel from '@/components/tour-mode/guide/GuideLedgerPanel';
import GuidePlanPanel from '@/components/tour-mode/guide/GuidePlanPanel';
import { kstToday } from '@/lib/tour-room/time';

const GUIDE_TOKEN_KEY = 'tour_mode_guide_token';
const POLL_MS = 15_000;

/** One-tap Korean dispatch lines (auto-translated per guest server-side). */
const BROADCAST_PRESETS = ['곧 출발합니다', '5분 뒤 출발합니다', '잠시 후 집합입니다', '여기서 잠시 쉬어갑니다'];

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
  last_message: { source_text?: string; sender_role?: string; created_at?: string } | null;
}

interface Overview {
  tour: { id: string; title: string; city?: string | null };
  tour_date: string;
  lifecycle: 'lobby' | 'live' | 'ended';
  rooms: OverviewRoom[];
  feed: Array<{ id: string; room_id: string; sender_role: string; source_text: string; created_at: string; metadata?: Record<string, unknown> }>;
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
  const [freePoint, setFreePoint] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openPlanBookingId, setOpenPlanBookingId] = useState<string | null>(null);
  const [openLedgerBookingId, setOpenLedgerBookingId] = useState<string | null>(null);
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

  const onboardCount = useMemo(
    () => (overview ? overview.rooms.filter((room) => room.onboard_ack).length : 0),
    [overview],
  );
  const roomLabel = useMemo(() => {
    const map = new Map<string, { name: string; hue: number }>();
    for (const room of overview?.rooms ?? []) {
      if (room.room_id) map.set(room.room_id, { name: room.contact_name ?? '게스트', hue: roomHue(room.booking_id) });
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
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="tr-meta inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 font-semibold text-[var(--tr-plan-hero-ink)]">
            <CalendarClock size={13} aria-hidden />
            {overview.tour_date}
          </span>
          <span className="tr-meta inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 font-semibold text-[var(--tr-plan-hero-ink)]">
            <Users size={13} aria-hidden />
            예약 {overview.rooms.length}
          </span>
          <span className="tr-meta inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 font-semibold text-[var(--tr-plan-hero-ink)]">
            <Check size={13} aria-hidden />
            탑승 {onboardCount}/{overview.rooms.length}
          </span>
          {replyCount > 0 && (
            <span className="tr-meta inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 font-bold text-[var(--tr-plan-hero-ink)]">
              <MessageCircle size={13} aria-hidden />
              답장 {replyCount}
            </span>
          )}
          {reviewCount > 0 && (
            <span className="tr-meta inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 font-bold text-[var(--tr-plan-hero-ink)]">
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
            const planOpen = openPlanBookingId === room.booking_id;
            const ledgerOpen = openLedgerBookingId === room.booking_id;
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
                      {room.last_message?.source_text ?? '아직 메시지 없음'}
                    </p>
                  </div>
                </div>

                {/* entrances */}
                <div className="mt-3 flex items-center gap-1.5">
                  <a
                    href={roomHref(room.booking_id)}
                    className="tr-label flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--tr-accent)] px-3 font-bold text-[var(--tr-bubble-me-ink)] active:scale-[0.99]"
                    data-testid="room-chat"
                  >
                    <MessageCircle size={15} aria-hidden />
                    채팅
                  </a>
                  <button
                    type="button"
                    onClick={() => setOpenPlanBookingId((prev) => (prev === room.booking_id ? null : room.booking_id))}
                    className={`tr-label flex min-h-[42px] items-center justify-center gap-1 rounded-xl px-3 font-bold ${
                      badge?.tone === 'review'
                        ? 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)] ring-1 ring-[var(--tr-hairline)]'
                        : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                    }`}
                    data-testid="plan-toggle"
                  >
                    <CalendarClock size={15} aria-hidden />
                    일정
                    {planOpen ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenLedgerBookingId((prev) => (prev === room.booking_id ? null : room.booking_id))}
                    className="tr-label flex min-h-[42px] items-center justify-center gap-1 rounded-xl bg-[var(--tr-surface-2)] px-3 font-bold text-[var(--tr-ink-2)]"
                    data-testid="ledger-toggle"
                  >
                    <Wallet size={15} aria-hidden />
                    정산
                    {ledgerOpen ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
                  </button>
                </div>

                {planOpen && tokenRef.current && (
                  <GuidePlanPanel bookingId={room.booking_id} token={tokenRef.current} onChanged={() => void load()} />
                )}
                {ledgerOpen && tokenRef.current && (
                  <GuideLedgerPanel bookingId={room.booking_id} token={tokenRef.current} />
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* 전체 안내 (day-wide tools) */}
      <section className="mt-6">
        <h2 className="tr-label px-1 font-bold uppercase tracking-wide text-[var(--tr-ink-3)]">전체 안내</h2>

        {/* broadcast */}
        <div className="tr-card mt-2 px-3.5 py-3.5">
          <p className="tr-label flex items-center gap-1.5 font-semibold text-[var(--tr-ink-2)]">
            <Megaphone size={14} aria-hidden />
            전체 공지 (모든 손님, 자동 번역)
          </p>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const text = draft.trim();
              if (!text) return;
              setDraft('');
              void send({ text }, 'text');
            }}
          >
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
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BROADCAST_PRESETS.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => setDraft(phrase)}
                className="tr-meta rounded-full border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2.5 py-1 font-medium text-[var(--tr-ink-2)] active:scale-95"
              >
                {phrase}
              </button>
            ))}
          </div>
        </div>

        {/* meeting notice */}
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
            <button
              type="button"
              disabled={!meetPoint.trim() || busy === 'meet'}
              onClick={() => void send({ notice: { kind: 'meeting_notice', time: meetTime, point: meetPoint.trim() } }, 'meet')}
              className="tr-label shrink-0 rounded-[var(--tr-radius-input)] bg-[var(--tr-accent)] px-3.5 py-2.5 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
              data-testid="meeting-send"
            >
              공지
            </button>
          </div>
        </div>

        {/* free-time timer */}
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
      </section>

      {/* recent feed */}
      {overview.feed.length > 0 && (
        <section className="mt-6">
          <h2 className="tr-label px-1 font-bold uppercase tracking-wide text-[var(--tr-ink-3)]">최근 메시지</h2>
          <div className="mt-2 space-y-1.5">
            {overview.feed.map((message) => {
              const tag = roomLabel.get(message.room_id);
              return (
                <div key={message.id} className="tr-card flex items-start gap-2 px-3 py-2">
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag ? `hsl(${tag.hue} 55% 52%)` : 'var(--tr-ink-3)' }}
                    title={tag?.name}
                  />
                  <p className="tr-meta min-w-0 flex-1 leading-relaxed text-[var(--tr-ink-2)]">
                    <span className="font-bold text-[var(--tr-ink)]">{tag?.name ?? '룸'}</span>
                    {message.sender_role === 'guide' || message.sender_role === 'admin' ? ' (나/운영)' : ''} ·{' '}
                    {message.source_text}
                  </p>
                </div>
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
}
