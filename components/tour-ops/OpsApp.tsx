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
import { LayoutDashboard, Map as MapIcon, Settings, Siren } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { kstToday } from '@/lib/tour-room/time';
import { useOpsChannels, type OpsChannelDescriptor } from '@/hooks/useOpsChannels';
import { computeAttention } from '@/lib/tour-ops/attention';
import { startSosAlarmVisuals, stopSosAlarmVisuals, vibrateSos } from '@/lib/tour-ops/alerts';
import { getOpsToken, playSosSound, type OpsRoom, type SosInfo, type SosMetadata } from '@/components/tour-ops/opsShared';
import OpsDashboardTab from '@/components/tour-ops/OpsDashboardTab';
import OpsMapTab from '@/components/tour-ops/OpsMapTab';
import OpsSosTab from '@/components/tour-ops/OpsSosTab';
import OpsSettingsTab from '@/components/tour-ops/OpsSettingsTab';
import OpsRoomDrawer from '@/components/tour-ops/OpsRoomDrawer';

const BACKUP_POLL_MS = 20_000;
const DRIFT_REFRESH_MS = 5 * 60_000;
const SOUND_KEY = 'tour_ops_sound';

export type OpsTab = 'dashboard' | 'map' | 'sos' | 'settings';

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
  const [tab, setTab] = useState<OpsTab>('dashboard');
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const loadAll = useCallback(async () => {
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
      setRooms(roomsJson.rooms as OpsRoom[]);
      const channelsJson = await channelsRes.json();
      if (channelsRes.ok) {
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
      toast.error(error instanceof Error ? error.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [date]);

  const { streams, connection, unread, markRead, ingestMessages } = useOpsChannels(channels, {
    onRoomEvent: () => void loadAll(),
  });

  const connectionRef = useRef(connection);
  useEffect(() => {
    connectionRef.current = connection;
  });

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

  // Active SOS per room: aggregate row ∪ live broadcast (live wins — newer).
  const sosRooms = useMemo(() => {
    const map = new Map<string, SosInfo>();
    for (const room of rooms) {
      if (room.sos?.metadata) map.set(room.id, { metadata: room.sos.metadata, created_at: room.sos.created_at });
    }
    for (const [roomId, stream] of Object.entries(streams)) {
      for (let i = stream.messages.length - 1; i >= 0; i -= 1) {
        const message = stream.messages[i];
        if ((message.metadata as { kind?: string } | undefined)?.kind === 'sos') {
          map.set(roomId, { metadata: message.metadata as SosMetadata, created_at: message.created_at });
          break;
        }
      }
    }
    return map;
  }, [rooms, streams]);

  // W4.1 — new SOS → sound + vibration (once per room per session), plus
  // title/favicon blink until ops acknowledges (opens the room or the SOS tab).
  const sosSeenRef = useRef<Set<string>>(new Set());
  const sosHandledRef = useRef<Set<string>>(new Set());
  const [handledVersion, setHandledVersion] = useState(0);
  const soundOnRef = useRef(soundOn);
  useEffect(() => {
    soundOnRef.current = soundOn;
  });
  useEffect(() => {
    for (const roomId of sosRooms.keys()) {
      if (sosSeenRef.current.has(roomId)) continue;
      sosSeenRef.current.add(roomId);
      if (soundOnRef.current) playSosSound();
      vibrateSos();
    }
  }, [sosRooms]);
  useEffect(() => {
    const unhandled = [...sosRooms.keys()].some((roomId) => !sosHandledRef.current.has(roomId));
    if (unhandled) startSosAlarmVisuals();
    else stopSosAlarmVisuals();
  }, [sosRooms, handledVersion]);
  useEffect(() => stopSosAlarmVisuals, []);

  const acknowledgeSos = useCallback(
    (roomIds: Iterable<string>) => {
      let changed = false;
      for (const roomId of roomIds) {
        if (!sosHandledRef.current.has(roomId)) {
          sosHandledRef.current.add(roomId);
          changed = true;
        }
      }
      if (changed) setHandledVersion((version) => version + 1);
    },
    [],
  );

  const openRoom = useCallback(
    (roomId: string) => {
      setOpenRoomId(roomId);
      markRead(roomId);
      if (sosRooms.has(roomId)) acknowledgeSos([roomId]);
    },
    [markRead, sosRooms, acknowledgeSos],
  );

  const selectTab = useCallback(
    (next: OpsTab) => {
      setTab(next);
      if (next === 'sos') acknowledgeSos(sosRooms.keys());
    },
    [acknowledgeSos, sosRooms],
  );

  // W4.2 — the attention queue: non-SOS "customer wants to talk" signals.
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
    [rooms, streams, sosRooms],
  );

  const openRoomObject = openRoomId ? rooms.find((room) => room.id === openRoomId) ?? null : null;
  const sosCount = sosRooms.size;
  const unreadTotal = useMemo(() => Object.values(unread).reduce((sum, n) => sum + n, 0), [unread]);

  const tabs: Array<{ key: OpsTab; label: string; icon: typeof LayoutDashboard; badge?: number }> = [
    { key: 'dashboard', label: '대시보드', icon: LayoutDashboard, badge: unreadTotal },
    { key: 'map', label: '지도', icon: MapIcon },
    { key: 'sos', label: 'SOS', icon: Siren, badge: sosCount },
    { key: 'settings', label: '설정', icon: Settings },
  ];

  return (
    <div
      className="ops-app min-h-dvh bg-slate-950 text-slate-100"
      style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
    >
      <header
        className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex min-h-[52px] items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="text-[15px] font-bold tracking-tight">투어 관제센터</h1>
            <span
              className={`size-2 shrink-0 rounded-full ${
                connection === 'realtime'
                  ? 'bg-emerald-400'
                  : connection === 'connecting'
                    ? 'bg-slate-500'
                    : 'bg-amber-400 animate-pulse'
              }`}
              title={connection === 'realtime' ? '실시간 연결됨' : connection === 'connecting' ? '연결 중' : '백업 폴링'}
            />
          </div>
          <p className="shrink-0 text-[12px] text-slate-400">
            {date} · 룸 {rooms.length}
            {sosCount > 0 && <span className="ml-1.5 font-semibold text-red-400">🆘 {sosCount}</span>}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-3 pt-3">
        {tab === 'dashboard' && (
          <OpsDashboardTab
            rooms={rooms}
            loading={loading}
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
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-white/10 bg-slate-950/95 backdrop-blur"
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
                active ? 'text-white' : 'text-slate-500'
              }`}
            >
              <span className="relative">
                <Icon className={`size-5 ${key === 'sos' && badge ? 'text-red-400' : ''}`} />
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
