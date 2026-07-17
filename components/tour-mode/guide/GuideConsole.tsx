'use client';

/**
 * T6.2–T6.5 — the guide console.
 *
 * One screen for a tour day: every booking's room as a color-tagged card
 * (guests, onboard ack, last message), a merged recent feed, and three send
 * tools — free-text fan-out, meeting notice (time+place), free-time timer
 * (quick 30/45/60 or custom, cancel/extend). Data refreshes on a 15s poll;
 * sends go through the fan-out API (T6.1) with the tour-date token.
 *
 * Korean-first UI: AtoC guides operate in Korean; traveller-facing content
 * stays template-translated server-side.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GuidePlanPanel from '@/components/tour-mode/guide/GuidePlanPanel';
import { kstToday } from '@/lib/tour-room/time';

const GUIDE_TOKEN_KEY = 'tour_mode_guide_token';
const POLL_MS = 15_000;

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

export default function GuideConsole() {
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [meetTime, setMeetTime] = useState('');
  const [meetPoint, setMeetPoint] = useState('');
  const [freePoint, setFreePoint] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [openPlanBookingId, setOpenPlanBookingId] = useState<string | null>(null);
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
      <div className="tr-root flex min-h-dvh items-center justify-center bg-[var(--tr-canvas)] px-6 text-center">
        <p className="text-[14px] text-gray-500">가이드 링크(이메일의 버튼)로 접속해 주세요.</p>
      </div>
    );
  }
  if (!overview) {
    return (
      <div className="tr-root flex min-h-dvh items-center justify-center bg-[var(--tr-canvas)]">
        <p className="text-[14px] text-gray-500">{error ? '접근할 수 없어요 — 링크를 다시 확인해 주세요.' : '불러오는 중…'}</p>
      </div>
    );
  }

  const notReturned = overview.rooms.filter((room) => !room.onboard_ack);

  return (
    <div className="tr-root mx-auto min-h-dvh w-full max-w-md bg-[var(--tr-canvas)] px-4 pb-8 pt-5" data-testid="guide-console">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">가이드 콘솔</p>
          <h1 className="truncate text-[17px] font-bold text-gray-900">{overview.tour.title}</h1>
          <p className="text-[12px] text-gray-500">
            {overview.tour_date} · 예약 {overview.rooms.length}건 · 탑승 {onboardCount}/{overview.rooms.length}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            overview.lifecycle === 'live'
              ? 'bg-emerald-100 text-emerald-700'
              : overview.lifecycle === 'lobby'
                ? 'bg-sky-100 text-sky-700'
                : 'bg-gray-200 text-gray-600'
          }`}
        >
          {overview.lifecycle === 'live' ? 'LIVE' : overview.lifecycle === 'lobby' ? '대기' : '종료'}
        </span>
      </header>

      {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}

      {/* 전체 공지 */}
      <section className="tr-card mt-4 p-3.5">
        <p className="text-[12px] font-semibold text-gray-500">전체 공지 (모든 손님, 자동 번역)</p>
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
            className="tr-body min-w-0 flex-1 rounded-xl bg-[var(--tr-surface-2)] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--tr-accent)]"
          />
          <button
            type="submit"
            disabled={!draft.trim() || busy === 'text'}
            className="tr-card-text min-h-[44px] rounded-full bg-[var(--tr-accent)] px-4 font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
            data-testid="fanout-send"
          >
            보내기
          </button>
        </form>
      </section>

      {/* 집합 공지 */}
      <section className="tr-card mt-3 p-3.5">
        <p className="text-[12px] font-semibold text-gray-500">집합 공지 (손님 화면에 카운트다운)</p>
        <div className="mt-2 flex gap-2">
          <input
            type="time"
            value={meetTime}
            onChange={(e) => setMeetTime(e.target.value)}
            className="w-28 rounded-xl border border-gray-200 px-2 py-2.5 text-[14px]"
          />
          <input
            value={meetPoint}
            onChange={(e) => setMeetPoint(e.target.value)}
            maxLength={120}
            placeholder="집합 장소 (예: 주차장 2번 게이트)"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-[14px]"
          />
          <button
            type="button"
            disabled={!meetPoint.trim() || busy === 'meet'}
            onClick={() => void send({ notice: { kind: 'meeting_notice', time: meetTime, point: meetPoint.trim() } }, 'meet')}
            className="shrink-0 rounded-xl bg-gray-900 px-3.5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
            data-testid="meeting-send"
          >
            공지
          </button>
        </div>
      </section>

      {/* 자유시간 타이머 */}
      <section className="tr-card mt-3 p-3.5">
        <p className="text-[12px] font-semibold text-gray-500">자유시간 (10분·5분 전 자동 알림)</p>
        <input
          value={freePoint}
          onChange={(e) => setFreePoint(e.target.value)}
          maxLength={120}
          placeholder="복귀 장소"
          className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px]"
        />
        <div className="mt-2 flex gap-1.5">
          {[30, 45, 60].map((minutes) => (
            <button
              key={minutes}
              type="button"
              disabled={busy === 'free'}
              onClick={() => void startFreeTime(minutes)}
              className="flex-1 rounded-xl bg-amber-50 py-2.5 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200 disabled:opacity-40"
            >
              {minutes}분
            </button>
          ))}
          <button
            type="button"
            disabled={busy === 'free'}
            onClick={() => void send({ notice: { kind: 'free_time_timer', cancelled: true, point: freePoint } }, 'free')}
            className="flex-1 rounded-xl bg-red-50 py-2.5 text-[13px] font-semibold text-red-700 ring-1 ring-red-200 disabled:opacity-40"
            data-testid="free-time-cancel"
          >
            종료
          </button>
        </div>
        {notReturned.length > 0 && overview.lifecycle === 'live' && (
          <p className="mt-2 text-[12px] text-gray-500">
            미탑승: {notReturned.map((room) => room.contact_name ?? '게스트').join(', ')}
          </p>
        )}
      </section>

      {/* 룸 카드 */}
      <section className="mt-4 space-y-2">
        {overview.rooms.map((room) => (
          <div key={room.booking_id} className="tr-card px-3.5 py-3" data-testid="room-card">
            <div className="flex items-center gap-3">
              <a
                href={`/tour-mode/room/${room.booking_id}?rt=${encodeURIComponent(tokenRef.current ?? '')}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span
                  className="h-9 w-9 shrink-0 rounded-full text-center text-[15px] font-bold leading-9 text-white"
                  style={{ backgroundColor: `hsl(${roomHue(room.booking_id)} 65% 55%)` }}
                >
                  {(room.contact_name ?? 'G').trim()[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[14px] font-semibold text-gray-900">
                    {room.contact_name ?? '게스트'}
                    <span className="text-[11px] font-normal text-gray-400">
                      {room.number_of_guests ?? 1}명 · {room.preferred_language ?? 'en'}
                    </span>
                    {room.onboard_ack && <span title="탑승 확인" className="text-emerald-600">✓</span>}
                    {room.day_plan?.status === 'guest_draft' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        초안 검토
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-gray-500">
                    {room.last_message?.source_text ?? (room.pickup?.name ? `픽업: ${room.pickup.name}` : '아직 메시지 없음')}
                  </span>
                </span>
              </a>
              <button
                type="button"
                onClick={() =>
                  setOpenPlanBookingId((prev) => (prev === room.booking_id ? null : room.booking_id))
                }
                className={`shrink-0 rounded-xl px-2.5 py-2 text-[12px] font-semibold ${
                  room.day_plan?.status === 'guest_draft'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
                data-testid="plan-toggle"
              >
                일정{openPlanBookingId === room.booking_id ? ' ▴' : ' ▾'}
              </button>
            </div>
            {openPlanBookingId === room.booking_id && tokenRef.current && (
              <GuidePlanPanel
                bookingId={room.booking_id}
                token={tokenRef.current}
                onChanged={() => void load()}
              />
            )}
          </div>
        ))}
      </section>

      {/* 통합 피드 */}
      {overview.feed.length > 0 && (
        <section className="mt-4">
          <p className="text-[12px] font-semibold text-gray-500">최근 메시지</p>
          <div className="mt-2 space-y-1.5">
            {overview.feed.map((message) => {
              const tag = roomLabel.get(message.room_id);
              return (
                <div key={message.id} className="tr-card flex items-start gap-2 px-3 py-2">
                  <span
                    className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag ? `hsl(${tag.hue} 65% 55%)` : '#d1d5db' }}
                    title={tag?.name}
                  />
                  <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-gray-700">
                    <span className="font-semibold">{tag?.name ?? '룸'}</span>
                    {message.sender_role === 'guide' || message.sender_role === 'admin' ? ' (나/운영)' : ''} ·{' '}
                    {message.source_text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-6 text-center text-[11px] text-gray-400">
        {kstToday() === overview.tour_date ? '오늘 투어' : overview.tour_date} · 15초마다 자동 새로고침
      </p>
    </div>
  );
}
