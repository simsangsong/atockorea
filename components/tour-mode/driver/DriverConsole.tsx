'use client';

/**
 * W3 (P-D15) — the pure driver's entry: `/tour-mode/driver?rt=<driver token>`.
 *
 * Boots the driver's PII-minimal day bundle, gates entry on the vehicle PIN,
 * unlocks audio with one tap, then hands off to the shared dark <Cockpit/>
 * (components/tour-mode/cockpit) — the same surface the guide's "운전 모드"
 * enters, so both operators share every driving tool (Phase 2, handoff §5).
 *
 * KO-only UI (P-D10); traveller copy is template-translated server-side.
 */

import { useCallback, useEffect, useState } from 'react';
import { type RoomMessage } from '@/hooks/useTourRoomChannel';
import Cockpit, {
  Screen,
  Note,
  itemTitle,
  OPS_PHONE,
  type CockpitLifecycle,
  type CockpitRoom,
} from '@/components/tour-mode/cockpit/Cockpit';

const TOKEN_KEY = 'tour_mode_driver_token';
const DEVICE_KEY = 'tour_mode_driver_device_key';

interface DriverOverview {
  tour: { id: string; title: string; city?: string | null };
  tour_date: string;
  lifecycle: CockpitLifecycle;
  driver_name: string;
  rooms: CockpitRoom[];
}

function readToken(): string | null {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('rt');
    if (fromUrl) {
      sessionStorage.setItem(TOKEN_KEY, fromUrl);
      url.searchParams.delete('rt');
      window.history.replaceState(window.history.state, '', url.toString());
      return fromUrl;
    }
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function deviceKey(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export default function DriverConsole() {
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<DriverOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinNeeded, setPinNeeded] = useState(false);
  const [pin, setPin] = useState('');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState<{
    bookingId: string;
    session: string;
    channelTopic: string;
    initialMessages: RoomMessage[];
  } | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // ── boot: token → overview ────────────────────────────────────────────
  useEffect(() => {
    const t = readToken();
    setToken(t);
    if (!t) setError('링크가 올바르지 않아요. 관리자나 가이드에게 새 링크를 요청해 주세요.');
  }, []);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/tour-mode/driver/overview?rt=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setError(res.status === 403 ? '링크가 만료되었거나 올바르지 않아요.' : '데이터를 불러오지 못했어요.');
          return;
        }
        setOverview(data as DriverOverview);
      } catch {
        if (alive) setError('네트워크 오류 — 새로고침해 주세요.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const room = overview?.rooms?.[0] ?? null; // private mode: one party per day

  // ── join (with PIN gate) ──────────────────────────────────────────────
  const join = useCallback(
    async (pinValue?: string) => {
      if (!token || !room) return;
      setJoining(true);
      setError(null);
      try {
        const res = await fetch(`/api/tour-rooms/${room.booking_id}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            deviceKey: deviceKey(),
            locale: 'ko',
            ttsCapable: true,
            ...(pinValue ? { pin: pinValue } : {}),
          }),
        });
        const data = await res.json();
        if (res.status === 403 && (data?.error === 'pin_required' || data?.error === 'pin_mismatch')) {
          setPinNeeded(true);
          if (data.error === 'pin_mismatch') setError('차량번호 뒤 4자리가 일치하지 않아요.');
          return;
        }
        if (!res.ok) {
          setError('입장에 실패했어요. 새로고침해 주세요.');
          return;
        }
        setPinNeeded(false);
        setJoined({
          bookingId: room.booking_id,
          session: data.session,
          channelTopic: data.channel?.topic ?? null,
          initialMessages: (data.snapshot?.messages ?? []) as RoomMessage[],
        });
      } catch {
        setError('네트워크 오류 — 다시 시도해 주세요.');
      } finally {
        setJoining(false);
      }
    },
    [token, room],
  );

  useEffect(() => {
    if (overview && room && !joined && !pinNeeded && !joining) void join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, room?.booking_id]);

  if (error && !overview) return <Screen><Note>{error}</Note></Screen>;
  if (!overview || !room) return <Screen><Note>불러오는 중…</Note></Screen>;

  // 완료(ended): a calm wrap-up — no join / audio needed.
  if (overview.lifecycle === 'ended') {
    return <EndScreen overview={overview} room={room} />;
  }

  if (pinNeeded && !joined) {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
          <p className="text-2xl font-bold text-white">차량번호 뒤 4자리</p>
          <input
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
            className="w-48 rounded-2xl border-2 border-neutral-600 bg-neutral-900 px-4 py-4 text-center text-4xl font-bold tracking-[0.5em] text-white"
            data-testid="driver-pin-input"
          />
          {error ? <p className="text-lg text-red-400">{error}</p> : null}
          <button
            type="button"
            disabled={pin.length !== 4 || joining}
            onClick={() => void join(pin)}
            className="w-full max-w-xs rounded-2xl bg-neutral-100 py-5 text-2xl font-bold text-neutral-950 disabled:opacity-40"
          >
            확인
          </button>
        </div>
      </Screen>
    );
  }

  if (!joined) return <Screen><Note>투어룸 연결 중…</Note></Screen>;

  if (!audioUnlocked) {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-3xl font-bold text-white">{overview.tour.title}</p>
          <p className="text-xl text-neutral-300">
            {overview.tour_date} · 손님 {room.number_of_guests ?? '-'}명
          </p>
          {room.pickup?.name ? (
            <p className="text-lg text-neutral-400">
              픽업 {room.pickup.pickup_time ? `${room.pickup.pickup_time} · ` : ''}
              {room.pickup.name}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setAudioUnlocked(true)}
            className="mt-6 w-full max-w-sm rounded-3xl bg-neutral-100 py-8 text-3xl font-bold text-neutral-950"
            data-testid="driver-start"
          >
            🚐 운행 시작
          </button>
          <p className="text-base text-neutral-400">시작을 누르면 손님 메시지를 소리로 읽어드려요.</p>
        </div>
      </Screen>
    );
  }

  return (
    <Cockpit
      tourTitle={overview.tour.title}
      lifecycle={overview.lifecycle}
      room={room}
      bookingId={joined.bookingId}
      session={joined.session}
      channelTopic={joined.channelTopic}
      initialMessages={joined.initialMessages}
      city={overview.tour.city ?? null}
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────

function EndScreen({ overview, room }: { overview: DriverOverview; room: CockpitRoom }) {
  return (
    <Screen>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-8">
        <div className="text-center">
          <p className="text-3xl font-bold text-white">오늘 투어 종료</p>
          <p className="mt-2 text-lg text-neutral-400">
            {overview.tour.title} · {overview.tour_date}
          </p>
          <p className="mt-1 text-base text-neutral-500">수고하셨어요 🙌</p>
        </div>

        {room.schedule.length > 0 ? (
          <div className="rounded-3xl bg-neutral-900 px-5 py-4">
            <p className="text-sm font-bold uppercase tracking-wide text-neutral-500">오늘 방문</p>
            <ul className="mt-2 space-y-1.5">
              {room.schedule.map((item, index) => (
                <li key={`${item.poi_key ?? item.title ?? index}`} className="text-lg text-neutral-200">
                  {item.time ? `${item.time} · ` : ''}{itemTitle(item)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {OPS_PHONE ? (
          <a
            href={`tel:${OPS_PHONE}`}
            className="rounded-2xl bg-neutral-800 py-4 text-center text-xl font-bold text-white"
            data-testid="driver-ops-call"
          >
            📞 운영팀에 전화
          </a>
        ) : null}
      </div>
    </Screen>
  );
}
