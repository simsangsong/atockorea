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
import { Home, LayoutDashboard, Map as MapIcon, Moon, RefreshCw, Settings, Siren, Sun } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { kstToday } from '@/lib/tour-room/time';
import { useOpsChannels, type OpsChannelDescriptor } from '@/hooks/useOpsChannels';
import { useOpsTheme } from '@/components/tour-ops/opsTheme';
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

const BACKUP_POLL_MS = 20_000;
const DRIFT_REFRESH_MS = 5 * 60_000;
const SOUND_KEY = 'tour_ops_sound';

export type OpsTab = 'home' | 'dashboard' | 'map' | 'sos' | 'settings';

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
  // Ops-wide light/dark (사용자 요청 2026-07-18) — .ops-light remaps every tab.
  const [opsTheme, toggleOpsTheme] = useOpsTheme();
  const [inboxOpen, setInboxOpen] = useState(false);

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

  const openRoom = useCallback(
    (roomId: string) => {
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
    { key: 'map', label: '지도', icon: MapIcon },
    { key: 'sos', label: 'SOS', icon: Siren, badge: sosCount },
    { key: 'settings', label: '설정', icon: Settings },
  ];

  return (
    <div
      /* W1.2 — tr-* token engine on the ops shell. Single root carries both
         `.tr-root` and the theme class: `.dark` (→ .tr-root.dark dark vars) or
         `.ops-light` (kept so not-yet-migrated tabs' raw-slate utilities still
         flip to light via the globals.css override during the migration). */
      className={`ops-app tr-root min-h-dvh bg-[var(--tr-canvas)] text-[var(--tr-ink)] ${opsTheme === 'dark' ? 'dark' : 'ops-light'}`}
      style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
    >
      <header
        className="sticky top-0 z-30 border-b border-[var(--tr-hairline)] bg-[var(--tr-surface)] backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex min-h-[52px] items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <h1 className="text-[15px] font-bold tracking-tight">투어 관제센터</h1>
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

      {openRoomObject && (
        <OpsRoomDrawer
          room={openRoomObject}
          stream={streams[openRoomObject.id]}
          sos={sosRooms.get(openRoomObject.id) ?? null}
          onClose={() => setOpenRoomId(null)}
          onDelivered={(message) => ingestMessages(openRoomObject.id, [message])}
          onSeen={() => markRead(openRoomObject.id)}
        />
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-[var(--tr-hairline)] bg-[var(--tr-surface)] backdrop-blur"
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
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
