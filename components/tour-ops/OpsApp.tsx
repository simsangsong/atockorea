'use client';

/**
 * W3 — the ops-center app shell: one screen for every live tour room.
 *
 * Data plane (§3-B):
 *   · aggregate REST (/rooms) + channel directory (/channels) load per date;
 *   · useOpsChannels streams messages/locations live over one WebSocket;
 *   · the 20s poll is demoted to a reconnect backup (W2.3 — zero polls while
 *     realtime is up), Postgres-Changes inserts likewise only trigger a
 *     reload when the broadcast plane is down;
 *   · a slow 5-minute refresh catches drift the broadcast plane can't see
 *     (rooms created after the directory fetch).
 *
 * UI plane (§3-H): dark app chrome, bottom tab bar (대시보드/지도/SOS/설정),
 * safe-area insets, 44px touch targets. The room drawer (W3.3) rides over
 * every tab.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CalendarRange, Home, LayoutDashboard, Map as MapIcon, Moon, RefreshCw, Settings, Siren, Sun } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { kstToday } from '@/lib/tour-room/time';
import { useOpsChannels, type OpsChannelDescriptor } from '@/hooks/useOpsChannels';
import { migrateLegacyOpsTheme } from '@/components/tour-ops/opsTheme';
import { useResolvedTheme, useTourRoomSettings } from '@/hooks/useTourRoomSettings';
import { computeAttention } from '@/lib/tour-ops/attention';
import { startSosAlarmVisuals, stopSosAlarmVisuals, vibrateSos } from '@/lib/tour-ops/alerts';
import { getOpsToken, playSosSound, type OpsRoom, type SosInfo, type SosMetadata } from '@/components/tour-ops/opsShared';
import OpsHomeTab from '@/components/tour-ops/OpsHomeTab';
import OpsDashboardTab from '@/components/tour-ops/OpsDashboardTab';
import OpsMapTab from '@/components/tour-ops/OpsMapTab';
import OpsSosTab from '@/components/tour-ops/OpsSosTab';
import OpsSettingsTab from '@/components/tour-ops/OpsSettingsTab';
import OpsRoomDrawer from '@/components/tour-ops/OpsRoomDrawer';
import OpsRoomManager from '@/components/tour-ops/OpsRoomManager';
import OpsInboxView from '@/components/tour-ops/OpsInboxView';
import OpsReviewQueueView from '@/components/tour-ops/OpsReviewQueueView';
import OpsBookingsOverview from '@/components/tour-ops/OpsBookingsOverview';
import OpsRoomHistoryView from '@/components/tour-ops/OpsRoomHistoryView';
import OpsScheduleCalendar from '@/components/tour-ops/OpsScheduleCalendar';
import OpsAutopilotView from '@/components/tour-ops/OpsAutopilotView';
import OpsGuestMessagingView from '@/components/tour-ops/OpsGuestMessagingView';

const BACKUP_POLL_MS = 20_000;
const DRIFT_REFRESH_MS = 5 * 60_000;
const SOUND_KEY = 'tour_ops_sound';

export type OpsTab = 'home' | 'dashboard' | 'bookings' | 'map' | 'sos' | 'settings';

interface ChannelRow {
  room_id: string;
  booking_id: string;
  status: string | null;
  topic: string;
}

export default function OpsApp() {
  const [date, setDate] = useState(() => kstToday());
  const [rooms, setRooms] = useState<OpsRoom[]>([]);
  const [channels, setChannels] = useState<OpsChannelDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<OpsTab>('home');
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  // Hub sheets (룸·링크 관리 / 메시지 모아보기) ride over every tab like the
  // room drawer does.
  const [managerOpen, setManagerOpen] = useState(false);
  // U-D9 — one device preference, not two. The ops center used to persist its
  // own `tour_ops_theme`, so the same dispatcher flipping between the guide
  // console and here got two different answers about their own taste. Both now
  // read the shared device store; `skin` rides along for the same reason
  // (U-D1: skin yes, scenery no — this is a dense tool, not a lounge).
  const { theme: opsTheme, toggle: toggleOpsTheme, setTheme } = useResolvedTheme();
  const { settings: deviceSettings } = useTourRoomSettings();
  const [inboxOpen, setInboxOpen] = useState(false);
  // Phase 2 A-6 — 인박스 리뷰 큐 시트 (파싱 review_queued/failed 처리).
  const [reviewOpen, setReviewOpen] = useState(false);
  // W3/W4 — 월 범위 화면들. 탭이 이미 6개라 `flex-1`이 좁아서 새 탭 대신 시트로.
  const [roomHistoryOpen, setRoomHistoryOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // W5 — 오토파일럿 제안 큐. 제안만 한다(실행 없음).
  const [autopilotOpen, setAutopilotOpen] = useState(false);
  // M4 — 손님 안내 보내기(이메일 일괄 + 왓츠앱 순차). 매일 하는 일이라 홈에서 한 번에 연다.
  const [messagingOpen, setMessagingOpen] = useState(false);

  const [loadError, setLoadError] = useState(false);
  // Monotonic request id: a stale response from the previous date (fired by a
  // timer/poll before the date flip) must never overwrite the newer one.
  const loadSeqRef = useRef(0);

  const loadAll = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const token = await getOpsToken();
      const init: RequestInit = {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        cache: 'no-store',
      };
      const [roomsRes, channelsRes] = await Promise.all([
        fetch(`/api/admin/tour-ops/rooms?date=${date}`, init),
        fetch(`/api/admin/tour-ops/channels?date=${date}`, init),
      ]);
      const roomsJson = await roomsRes.json();
      if (!roomsRes.ok) throw new Error(roomsJson.error || '불러오기 실패');
      if (seq !== loadSeqRef.current) return; // superseded by a newer load
      setRooms(roomsJson.rooms as OpsRoom[]);
      setLoadError(false);
      const channelsJson = await channelsRes.json();
      if (channelsRes.ok && seq === loadSeqRef.current) {
        setChannels(
          (channelsJson.channels as ChannelRow[]).map((row) => ({
            roomId: row.room_id,
            bookingId: row.booking_id,
            topic: row.topic,
            status: row.status,
          })),
        );
      }
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      setLoadError(true);
      toast.error(error instanceof Error ? error.message : '불러오기 실패');
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [date]);

  const { streams, connection, unread, liveSos, markRead, ingestMessages } = useOpsChannels(channels, {
    onRoomEvent: () => void loadAll(),
  });

  const connectionRef = useRef(connection);
  useEffect(() => {
    connectionRef.current = connection;
  });

  // U-D9 — carry the retired `tour_ops_theme` over to the shared store once,
  // so a dispatcher who had chosen dark here doesn't get bounced to light on
  // the first load after the merge. Clears the old keys either way.
  useEffect(() => {
    const legacy = migrateLegacyOpsTheme();
    if (legacy) setTheme(legacy);
    // Intentionally once per mount: the migration is idempotent because it
    // removes the keys it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gap-fill: fold each room's aggregate last_message into the live stream so
  // messages that arrived while the socket was down (recovered only by the
  // backup poll) still count toward unread / attention / the card preview —
  // dedupe by id makes this a no-op when the stream already has it.
  useEffect(() => {
    for (const room of rooms) {
      const last = room.last_message;
      if (last?.id && last.created_at) {
        ingestMessages(room.id, [
          {
            id: last.id,
            sender_role: last.sender_role ?? 'system',
            source_text: last.source_text ?? '',
            created_at: last.created_at,
            translations: last.translations ?? undefined,
            metadata: last.metadata ?? undefined,
          },
        ]);
      }
    }
  }, [rooms, ingestMessages]);

  // Initial load + date change.
  useEffect(() => {
    const kick = () => {
      setLoading(true);
      void loadAll();
    };
    kick();
  }, [loadAll]);

  // W2.3 — backup poll: only when visible AND the broadcast plane is down.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && connectionRef.current !== 'realtime') void loadAll();
    }, BACKUP_POLL_MS);
    return () => clearInterval(timer);
  }, [loadAll]);

  // Postgres-Changes stays as the secondary plane (M-6), same demotion rule.
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('tour-ops-pgc')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tour_room_messages' }, () => {
        if (connectionRef.current !== 'realtime') void loadAll();
      })
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [loadAll]);

  // Drift refresh: new rooms/status flips the broadcast plane can't announce.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void loadAll();
    }, DRIFT_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadAll]);

  // Sound preference (persisted).
  useEffect(() => {
    const restore = () => {
      try {
        setSoundOn(window.localStorage.getItem(SOUND_KEY) !== '0');
      } catch {
        /* default on */
      }
    };
    restore();
  }, []);
  const updateSoundOn = useCallback((next: boolean) => {
    setSoundOn(next);
    try {
      window.localStorage.setItem(SOUND_KEY, next ? '1' : '0');
    } catch {
      /* preference just won't persist */
    }
  }, []);

  // Active SOS per room: aggregate row ∪ live broadcast (newer wins). liveSos
  // is tracked incrementally by the hook, so this no longer scans history.
  const sosRooms = useMemo(() => {
    const map = new Map<string, SosInfo>();
    for (const room of rooms) {
      if (room.sos?.metadata) map.set(room.id, { metadata: room.sos.metadata, created_at: room.sos.created_at });
    }
    for (const [roomId, sos] of Object.entries(liveSos)) {
      const existing = map.get(roomId);
      if (!existing || (sos.created_at ?? '') > (existing.created_at ?? '')) {
        map.set(roomId, { metadata: sos.metadata as SosMetadata, created_at: sos.created_at });
      }
    }
    return map;
  }, [rooms, liveSos]);

  // A distinct SOS is keyed by room + its timestamp, so a SECOND SOS in the
  // same room later in the day re-fires sound/vibration/blink (the first one's
  // acknowledgement must not silence a fresh emergency).
  const sosKeys = useMemo(() => {
    const keys: string[] = [];
    for (const [roomId, sos] of sosRooms) keys.push(`${roomId}:${sos.created_at ?? ''}`);
    return keys;
  }, [sosRooms]);

  // W4.1 — new SOS → sound + vibration (once per SOS), plus title/favicon
  // blink until ops acknowledges (opens the room or the SOS tab).
  const sosSeenRef = useRef<Set<string>>(new Set());
  const sosHandledRef = useRef<Set<string>>(new Set());
  const [handledVersion, setHandledVersion] = useState(0);
  const soundOnRef = useRef(soundOn);
  useEffect(() => {
    soundOnRef.current = soundOn;
  });
  useEffect(() => {
    for (const key of sosKeys) {
      if (sosSeenRef.current.has(key)) continue;
      sosSeenRef.current.add(key);
      if (soundOnRef.current) playSosSound();
      vibrateSos();
    }
  }, [sosKeys]);
  useEffect(() => {
    const unhandled = sosKeys.some((key) => !sosHandledRef.current.has(key));
    if (unhandled) startSosAlarmVisuals();
    else stopSosAlarmVisuals();
  }, [sosKeys, handledVersion]);
  useEffect(() => stopSosAlarmVisuals, []);

  const acknowledgeSos = useCallback(
    (keys: Iterable<string>) => {
      let changed = false;
      for (const key of keys) {
        if (!sosHandledRef.current.has(key)) {
          sosHandledRef.current.add(key);
          changed = true;
        }
      }
      if (changed) setHandledVersion((version) => version + 1);
    },
    [],
  );

  // The SOS key(s) for a given room (usually one — the newest).
  const sosKeysForRoom = useCallback(
    (roomId: string) => {
      const sos = sosRooms.get(roomId);
      return sos ? [`${roomId}:${sos.created_at ?? ''}`] : [];
    },
    [sosRooms],
  );

  // 배정 발견성(2026-07-27): 룸 매니저의 [차량] 버튼이 드로어를 곧장
  // 차량 뷰로 연다 — 3뎁스(룸 열기→탭 찾기)를 1탭으로.
  const [openRoomView, setOpenRoomView] = useState<'chat' | 'vehicle'>('chat');
  const openRoom = useCallback(
    (roomId: string, view: 'chat' | 'vehicle' = 'chat') => {
      setOpenRoomView(view);
      setOpenRoomId(roomId);
      markRead(roomId);
      acknowledgeSos(sosKeysForRoom(roomId));
    },
    [markRead, acknowledgeSos, sosKeysForRoom],
  );

  const selectTab = useCallback(
    (next: OpsTab) => {
      setTab(next);
      if (next === 'sos') acknowledgeSos(sosKeys);
    },
    [acknowledgeSos, sosKeys],
  );

  // W4.2 — the attention queue: non-SOS "customer wants to talk" signals.
  // A slow ticking clock re-evaluates the 5-minute "unanswered" rule even when
  // no new message arrives (otherwise a quiet room's signal never appears).
  const [nowTick, setNowTick] = useState(() => 0);
  useEffect(() => {
    const timer = setInterval(() => setNowTick((n) => n + 1), 45_000);
    return () => clearInterval(timer);
  }, []);
  const attention = useMemo(
    () =>
      computeAttention(
        rooms.map((room) => ({
          roomId: room.id,
          hasSos: sosRooms.has(room.id),
          messages: streams[room.id]?.messages ?? [],
          lastMessage: room.last_message,
        })),
        Date.now(),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nowTick intentionally re-evaluates the time-based rule
    [rooms, streams, sosRooms, nowTick],
  );

  const openRoomObject = openRoomId ? rooms.find((room) => room.id === openRoomId) ?? null : null;
  const sosCount = sosRooms.size;
  const unreadTotal = useMemo(() => Object.values(unread).reduce((sum, n) => sum + n, 0), [unread]);

  const tabs: Array<{ key: OpsTab; label: string; icon: typeof LayoutDashboard; badge?: number }> = [
    { key: 'home', label: '홈', icon: Home },
    { key: 'dashboard', label: '대시보드', icon: LayoutDashboard, badge: unreadTotal },
    { key: 'bookings', label: '예약', icon: CalendarRange },
    { key: 'map', label: '지도', icon: MapIcon },
    { key: 'sos', label: 'SOS', icon: Siren, badge: sosCount },
    { key: 'settings', label: '설정', icon: Settings },
  ];

  return (
    <div
      /* W1.2 — tr-* token engine on the ops shell. The root carries `.tr-root`
         (provides the vars) and toggles `.dark` for dark mode; light is the
         default. Every tab + overlay is on tr-* chrome + `dark:` semantics now,
         so the old `.ops-light` override is gone. */
      className={`tr-root min-h-dvh bg-[var(--tr-canvas)] text-[var(--tr-ink)] ${opsTheme === 'dark' ? 'dark' : ''}`}
      /* U-D1 — the skin travels with the person (they cross between the guide
         console and here all day), but SkinScenery does not: this is a dense
         tool and a wallpaper illustration behind a manifest table is noise. */
      data-tr-skin={deviceSettings.skin}
      style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* U-D4 — chrome, not a white bar. `--tr-chrome` fuses the header with
          the canvas the way the smart app's does; the divider and the
          backdrop-blur both existed to separate a *differently coloured* bar
          from the content, so they go with it. `tr-chrome-line-b` keeps a
          hairline only for the skins that ask for one. */}
      <header
        className="tr-chrome-line-b sticky top-0 z-30 bg-[var(--tr-chrome)]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex min-h-[52px] items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            {/* min-w-0 플렉스 자식이라 좁은 화면에서 눌린다. 보호가 없으면
                "관제센터"가 글자 단위로 쪼개진다 (CLAUDE.md P1-5). */}
            <h1 className="text-cjk-safe text-[15px] font-bold tracking-tight">투어 관제센터</h1>
            {/* Connection state with a visible label (a bare dot's tooltip
                never shows on touch — the primary ops device). */}
            <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-[var(--tr-ink-3)]">
              <span
                className={`size-2 rounded-full ${
                  connection === 'realtime'
                    ? 'bg-emerald-400'
                    : connection === 'connecting'
                      ? 'bg-slate-500'
                      : 'bg-amber-400 animate-pulse'
                }`}
              />
              {connection === 'realtime' ? '실시간' : connection === 'connecting' ? '연결 중' : '백업'}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <p className="text-[12px] text-[var(--tr-ink-3)]">
              {date} · 룸 {rooms.length}
              {sosCount > 0 && <span className="ml-1.5 font-semibold text-[var(--tr-danger)]">🆘 {sosCount}</span>}
            </p>
            <button
              type="button"
              onClick={toggleOpsTheme}
              aria-label={opsTheme === 'dark' ? '라이트 모드' : '다크 모드'}
              className="flex size-11 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
              data-testid="ops-theme-toggle"
            >
              {opsTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => void loadAll()}
              aria-label="새로고침"
              className="flex size-11 items-center justify-center rounded-lg text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-3 pt-3">
        {tab === 'home' && (
          <OpsHomeTab
            rooms={rooms}
            sosRooms={sosRooms}
            attention={attention}
            unreadTotal={unreadTotal}
            onNavigate={selectTab}
            onOpenManager={() => setManagerOpen(true)}
            onOpenInbox={() => setInboxOpen(true)}
            onOpenReview={() => setReviewOpen(true)}
            onOpenRoomHistory={() => setRoomHistoryOpen(true)}
            onOpenSchedule={() => setScheduleOpen(true)}
            onOpenAutopilot={() => setAutopilotOpen(true)}
            onOpenMessaging={() => setMessagingOpen(true)}
          />
        )}
        {tab === 'dashboard' && (
          <OpsDashboardTab
            rooms={rooms}
            loading={loading}
            loadError={loadError}
            onRetry={() => void loadAll()}
            streams={streams}
            unread={unread}
            sosRooms={sosRooms}
            attention={attention}
            onOpenRoom={openRoom}
          />
        )}
        {/* §K B1 — 전 채널 예약 통합 통계. 대시보드가 "오늘 돌아가는 것"이라면
            이쪽은 "이번 주/이번 달에 무엇이 들어왔고 무엇이 새는가"다. */}
        {tab === 'bookings' && <OpsBookingsOverview onOpenReview={() => setReviewOpen(true)} />}
        {tab === 'map' && <OpsMapTab rooms={rooms} streams={streams} sosRooms={sosRooms} onSelectRoom={openRoom} />}
        {tab === 'sos' && <OpsSosTab rooms={rooms} sosRooms={sosRooms} onOpenRoom={openRoom} />}
        {tab === 'settings' && (
          <OpsSettingsTab
            date={date}
            onDateChange={setDate}
            soundOn={soundOn}
            onSoundChange={updateSoundOn}
            connection={connection}
          />
        )}
      </main>

      {managerOpen && (
        <OpsRoomManager
          date={date}
          onClose={() => setManagerOpen(false)}
          onOpenRoom={openRoom}
          onRoomsChanged={() => void loadAll()}
        />
      )}
      {inboxOpen && (
        <OpsInboxView
          rooms={rooms}
          streams={streams}
          onClose={() => setInboxOpen(false)}
          onOpenRoom={openRoom}
        />
      )}
      {reviewOpen && <OpsReviewQueueView onClose={() => setReviewOpen(false)} />}
      {roomHistoryOpen && (
        <OpsRoomHistoryView
          initialPeriod={date.slice(0, 7)}
          onClose={() => setRoomHistoryOpen(false)}
          onOpenRoom={(roomId) => {
            // 다른 달의 방을 열면 대시보드의 날짜도 그 날로 맞춰야 룸이 목록에 있다.
            setRoomHistoryOpen(false);
            openRoom(roomId);
          }}
        />
      )}
      {scheduleOpen && <OpsScheduleCalendar initialPeriod={date.slice(0, 7)} onClose={() => setScheduleOpen(false)} />}
      {autopilotOpen && <OpsAutopilotView onClose={() => setAutopilotOpen(false)} />}
      {messagingOpen && <OpsGuestMessagingView initialDate={date} onClose={() => setMessagingOpen(false)} />}

      {openRoomObject && (
        <OpsRoomDrawer
          room={openRoomObject}
          initialView={openRoomView}
          stream={streams[openRoomObject.id]}
          sos={sosRooms.get(openRoomObject.id) ?? null}
          onClose={() => setOpenRoomId(null)}
          onDelivered={(message) => ingestMessages(openRoomObject.id, [message])}
          onSeen={() => markRead(openRoomObject.id)}
        />
      )}

      <nav
        className="tr-chrome-line-t fixed inset-x-0 bottom-0 z-40 flex items-stretch bg-[var(--tr-chrome)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {tabs.map(({ key, label, icon: Icon, badge }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectTab(key)}
              aria-current={active ? 'page' : undefined}
              /* O0 — the walk harness drives the ops center through these, so
                 they must survive the O1 chrome rewrite. Label text alone is
                 not a stable handle: it is Korean copy that O2 will re-typeset. */
              data-testid={`ops-tab-${key}`}
              className={`relative flex h-[64px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                active ? 'text-[var(--tr-ink)]' : 'text-[var(--tr-ink-3)]'
              }`}
            >
              <span className="relative">
                <Icon className={`size-5 ${key === 'sos' && badge ? 'text-[var(--tr-danger)]' : ''}`} />
                {badge ? (
                  <span
                    className={`absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${
                      key === 'sos' ? 'bg-red-500 animate-pulse' : 'bg-blue-500'
                    }`}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </span>
              {/* P1-5 — '대시보드' in a flex-1 tab is the classic per-character break. */}
              <span className="text-cjk-safe max-w-full px-0.5">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
