'use client';

/**
 * T7.2/T7.3 — the ops center: every active tour room for a date on one
 * screen. SOS rooms pin to the top with a sound cue; a room expands into its
 * recent feed with an admin composer (the messages API's admin path) and a
 * one-tap SOS location link. Live inserts arrive over Postgres-Changes (the
 * M-6 admin SELECT policy + publication) with the 20s poll as the fallback.
 * Mobile-first cards per the admin shell rules.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { kstToday } from '@/lib/tour-room/time';

const POLL_MS = 20_000;

interface OpsRoom {
  id: string;
  booking_id: string;
  status: string;
  booking: { contact_name: string | null; number_of_guests: number | null; preferred_language: string | null } | null;
  tour: { title: string } | null;
  participants: Array<{ role: string; display_name: string; last_seen_at: string | null }>;
  message_count: number;
  last_message: { source_text?: string; sender_role?: string; created_at?: string } | null;
  sos: { metadata?: { latitude?: number; longitude?: number; note?: string; sender_name?: string } } | null;
}

async function getToken(): Promise<string> {
  const sess = await supabase?.auth.getSession();
  const token = sess?.data.session?.access_token;
  if (!token) throw new Error('세션이 만료되었습니다. 다시 로그인하세요.');
  return token;
}

/** Short two-tone alert via WebAudio — no asset needed. */
function playSosSound() {
  try {
    type Ctor = new () => AudioContext;
    const Ctx =
      (window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }).AudioContext ??
      (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    for (const [freq, at] of [[880, 0], [660, 0.18], [880, 0.36]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.17);
    }
  } catch {
    /* sound is a bonus */
  }
}

export default function TourOpsPage() {
  const [date, setDate] = useState(() => kstToday());
  const [rooms, setRooms] = useState<OpsRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [feed, setFeed] = useState<Array<{ id: string; sender_role: string; source_text: string; created_at: string; metadata?: Record<string, unknown> }>>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const sosSeenRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/tour-ops/rooms?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오기 실패');
      const next = json.rooms as OpsRoom[];
      // New SOS → sound (once per room).
      for (const room of next) {
        if (room.sos && !sosSeenRef.current.has(room.id)) {
          sosSeenRef.current.add(room.id);
          playSosSound();
        }
      }
      setRooms(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // T7.1 — live inserts (admin RLS + publication, R-4); poll remains the net.
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('tour-ops-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tour_room_messages' }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [load]);

  const openRoom = useCallback(async (roomBookingId: string, roomId: string) => {
    setOpenRoomId(roomId);
    setFeed([]);
    try {
      const token = await getToken();
      const res = await fetch(`/api/tour-rooms/${roomBookingId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok) setFeed((json.messages as typeof feed).slice(-40));
    } catch {
      /* feed stays empty; card still shows aggregates */
    }
  }, []);

  const sendAdmin = useCallback(
    async (bookingId: string) => {
      const text = draft.trim();
      if (!text) return;
      setSending(true);
      try {
        const token = await getToken();
        const res = await fetch(`/api/tour-rooms/${bookingId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          credentials: 'include',
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error((await res.json()).error || '발신 실패');
        setDraft('');
        const room = rooms.find((r) => r.id === openRoomId);
        if (room) void openRoom(room.booking_id, room.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '발신 실패');
      } finally {
        setSending(false);
      }
    },
    [draft, rooms, openRoomId, openRoom],
  );

  const sosCount = useMemo(() => rooms.filter((room) => room.sos).length, [rooms]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">투어 관제센터</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            활성 룸 {rooms.length} · {sosCount > 0 ? `🆘 SOS ${sosCount}건` : 'SOS 없음'}
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      {loading && <p className="mt-8 text-center text-sm text-slate-400">불러오는 중…</p>}
      {!loading && rooms.length === 0 && (
        <p className="mt-8 text-center text-sm text-slate-400">이 날짜에 활성 룸이 없습니다.</p>
      )}

      <div className="mt-4 space-y-2.5">
        {rooms.map((room) => {
          const isOpen = openRoomId === room.id;
          const sosMeta = room.sos?.metadata;
          return (
            <div
              key={room.id}
              className={`rounded-xl border bg-white ${room.sos ? 'border-red-300 ring-2 ring-red-200' : 'border-slate-200'}`}
              data-testid="ops-room-card"
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() => (isOpen ? setOpenRoomId(null) : void openRoom(room.booking_id, room.id))}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    {room.sos && <span className="animate-pulse">🆘</span>}
                    {room.booking?.contact_name ?? '게스트'}
                    <span className="font-normal text-slate-400">
                      · {room.booking?.number_of_guests ?? 1}명 · {room.booking?.preferred_language ?? 'en'}
                    </span>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {room.tour?.title ?? ''} · {room.last_message?.source_text ?? '메시지 없음'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{room.message_count}건</span>
              </button>

              {room.sos && sosMeta && (
                <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  {sosMeta.sender_name && <b>{sosMeta.sender_name}: </b>}
                  {sosMeta.note ?? 'SOS'}
                  {typeof sosMeta.latitude === 'number' && (
                    <a
                      className="ml-2 font-semibold underline"
                      href={`https://maps.google.com/?q=${sosMeta.latitude},${sosMeta.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      📍 위치 열기
                    </a>
                  )}
                </div>
              )}

              {isOpen && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <div className="max-h-64 space-y-1.5 overflow-y-auto">
                    {feed.length === 0 && <p className="text-xs text-slate-400">피드를 불러오는 중…</p>}
                    {feed.map((message) => (
                      <p key={message.id} className="text-xs leading-relaxed text-slate-700">
                        <span className={`font-semibold ${message.sender_role === 'customer' ? 'text-slate-900' : 'text-amber-700'}`}>
                          {message.sender_role === 'customer' ? '손님' : message.sender_role === 'guide' ? '가이드' : message.sender_role === 'admin' ? '관제' : '시스템'}
                        </span>{' '}
                        {message.source_text}
                      </p>
                    ))}
                  </div>
                  <form
                    className="mt-2 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void sendAdmin(room.booking_id);
                    }}
                  >
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={2000}
                      placeholder="관제 메시지 (자동 번역되어 전달)"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      발신
                    </button>
                  </form>
                  <a
                    href={`/admin/orders/${room.booking_id}`}
                    className="mt-2 inline-block text-xs font-medium text-slate-500 underline"
                  >
                    주문 상세 →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
