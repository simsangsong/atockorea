'use client';

/**
 * T1.6/T1.12 → U1 — room shell, reassembled in messenger grammar (plan §E):
 *
 *   ┌ slim 52px header — title · LIVE badge · degraded-connection hint ·
 *   │                     emergency icon → bottom sheet (SOS + contacts)
 *   ├ full-bleed tab panels on the chat canvas; notice/caption banners
 *   │ float in an overlay zone (zero layout shift)
 *   └ bottom tab bar (safe-area, unread dot, hidden while typing)
 *
 * Theme (T1.12): class-based Tailwind dark mode scoped to the room — the
 * resolved theme wraps the shell in a `.dark` ancestor, so `dark:` variants
 * and the `.dark .tr-root` token layer apply without touching <html>.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import EmergencyCard from '@/components/tour-mode/EmergencyCard';
import Sheet from '@/components/tour-mode/Sheet';
import { useKeyboardOpen } from '@/components/tour-mode/useKeyboardOpen';
import {
  IconEmergency,
  IconTabChat,
  IconTabMap,
  IconTabSchedule,
  IconTabSettings,
  IconPickup,
} from '@/components/tour-mode/icons';
import { EMERGENCY_TITLE } from '@/lib/tour-room/emergency';
import type { RoomConnection } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const TAB_LABEL: Record<RoomLocale, { chat: string; map: string; schedule: string; settings: string }> = {
  en: { chat: 'Chat', map: 'Map', schedule: 'Today', settings: 'Settings' },
  ko: { chat: '채팅', map: '지도', schedule: '오늘 일정', settings: '설정' },
  ja: { chat: 'チャット', map: '地図', schedule: '本日', settings: '設定' },
  es: { chat: 'Chat', map: 'Mapa', schedule: 'Hoy', settings: 'Ajustes' },
  zh: { chat: '聊天', map: '地图', schedule: '今日', settings: '设置' },
};

const MAP_SOON: Record<RoomLocale, string> = {
  en: 'Live map is coming soon.',
  ko: '실시간 지도는 곧 제공됩니다.',
  ja: 'ライブマップは近日公開です。',
  es: 'El mapa en vivo llegará pronto.',
  zh: '实时地图即将上线。',
};

const CONNECTION_HINT: Record<RoomLocale, { reconnecting: string; offline: string }> = {
  en: { reconnecting: 'Reconnecting…', offline: 'Offline — retrying' },
  ko: { reconnecting: '다시 연결하는 중…', offline: '오프라인 — 재시도 중' },
  ja: { reconnecting: '再接続中…', offline: 'オフライン — 再試行中' },
  es: { reconnecting: 'Reconectando…', offline: 'Sin conexión — reintentando' },
  zh: { reconnecting: '重新连接中…', offline: '离线 — 重试中' },
};

const CLOSE_LABEL: Record<RoomLocale, string> = {
  en: 'Close',
  ko: '닫기',
  ja: '閉じる',
  es: 'Cerrar',
  zh: '关闭',
};

const LIFECYCLE_BADGE: Record<string, { label: string; className: string }> = {
  lobby: { label: 'D-day soon', className: 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]' },
  live: { label: 'LIVE', className: 'bg-[var(--tr-safe-soft)] text-[var(--tr-safe)]' },
  ended: { label: 'Ended', className: 'bg-[var(--tr-bubble-system)] text-[var(--tr-ink-2)]' },
};

export type RoomTab = 'chat' | 'map' | 'schedule' | 'settings';

interface ScheduleItem {
  time?: string;
  departure_time?: string;
  title?: string;
  name?: string;
  [key: string]: unknown;
}

const TABS: Array<{ key: RoomTab; Icon: typeof IconTabChat }> = [
  { key: 'chat', Icon: IconTabChat },
  { key: 'map', Icon: IconTabMap },
  { key: 'schedule', Icon: IconTabSchedule },
  { key: 'settings', Icon: IconTabSettings },
];

export default function RoomShell({
  title,
  subtitle,
  lifecycle,
  connection,
  locale,
  schedule,
  chat,
  settings,
  banner,
  map,
  sos,
  theme = 'light',
  chatActivityKey,
}: {
  title: string;
  subtitle?: string;
  lifecycle: 'lobby' | 'live' | 'ended';
  connection: RoomConnection;
  locale: RoomLocale;
  schedule: ScheduleItem[];
  /** Chat tab content (feed + composer), supplied by the page. */
  chat: ReactNode;
  /** Settings tab content (T1.12), supplied by the page. */
  settings: ReactNode;
  /** T2.8 — live caption / notice banners, floating over every tab. */
  banner?: ReactNode;
  /** T3.3 — map tab content; the "coming soon" placeholder shows when absent. */
  map?: ReactNode;
  /** T7.3 — the SOS control inside the emergency sheet. */
  sos?: ReactNode;
  /** Resolved theme — 'system' is resolved by the caller before this prop. */
  theme?: 'light' | 'dark';
  /** U1.2 — bumps on chat activity; while on another tab it lights the unread dot. */
  chatActivityKey?: number;
}) {
  const [tab, setTab] = useState<RoomTab>('chat');
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(false);
  const keyboardOpen = useKeyboardOpen();
  const badge = LIFECYCLE_BADGE[lifecycle] ?? LIFECYCLE_BADGE.live;
  const labels = TAB_LABEL[locale];

  // Unread dot: chat activity while another tab is up.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const activityRef = useRef(chatActivityKey);
  useEffect(() => {
    if (chatActivityKey === activityRef.current) return;
    activityRef.current = chatActivityKey;
    if (tabRef.current !== 'chat') setChatUnread(true);
  }, [chatActivityKey]);

  const selectTab = (next: RoomTab) => {
    setTab(next);
    if (next === 'chat') setChatUnread(false);
  };

  const degraded = connection === 'offline' || connection === 'connecting';
  const connectionHint =
    connection === 'offline'
      ? CONNECTION_HINT[locale].offline
      : connection === 'connecting'
        ? CONNECTION_HINT[locale].reconnecting
        : null;

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div
        className="tr-root mx-auto flex h-dvh w-full flex-col bg-[var(--tr-canvas)]"
        data-locale={locale}
        lang={locale}
      >
        {/* ---- Slim header ------------------------------------------- */}
        <header
          className="tr-safe-top tr-hairline-b z-30 flex shrink-0 items-center gap-2 bg-[var(--tr-surface)] px-4"
          style={{ minHeight: 'var(--tr-header-h)' }}
        >
          <div className="min-w-0 flex-1 py-1.5">
            <div className="flex items-center gap-2">
              <h1 className="tr-title truncate text-[var(--tr-ink)]">{title}</h1>
              <span
                className={`tr-meta shrink-0 rounded-full px-2 py-0.5 font-semibold ${badge.className}`}
                data-testid="lifecycle-badge"
              >
                {badge.label}
              </span>
            </div>
            {degraded && connectionHint ? (
              <p className="tr-meta mt-0.5 flex items-center gap-1.5 truncate font-medium text-[var(--tr-accent-deep)]">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    connection === 'offline' ? 'bg-[var(--tr-danger)]' : 'animate-pulse bg-[var(--tr-accent)]'
                  }`}
                />
                {connectionHint}
              </p>
            ) : (
              subtitle && <p className="tr-meta mt-0.5 truncate text-[var(--tr-ink-3)]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEmergencyOpen(true)}
            aria-label={EMERGENCY_TITLE[locale]}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--tr-danger)] active:bg-[var(--tr-danger-soft)]"
            data-testid="emergency-open"
          >
            <IconEmergency size={22} strokeWidth={2} />
          </button>
        </header>

        {/* ---- Tab panels + floating banner zone --------------------- */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {banner && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto w-full max-w-2xl px-3 pt-2 [&>*]:pointer-events-auto">
              {banner}
            </div>
          )}

          <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
            {tab === 'chat' && chat}
            {tab === 'map' && (
              <div className="flex min-h-0 flex-1 flex-col px-3 py-2">
                {map ?? (
                  <div className="tr-card-text flex flex-1 items-center justify-center gap-2 text-[var(--tr-ink-3)]">
                    <IconTabMap size={16} aria-hidden />
                    {MAP_SOON[locale]}
                  </div>
                )}
              </div>
            )}
            {tab === 'schedule' && (
              <ol className="space-y-2 overflow-y-auto px-3 py-3">
                {schedule.length === 0 && (
                  <p className="tr-card-text pt-10 text-center text-[var(--tr-ink-3)]">—</p>
                )}
                {schedule.map((item, index) => (
                  <li key={index} className="tr-card px-4 py-3">
                    <div className="tr-card-text font-medium text-[var(--tr-ink)]">
                      {String(item.title ?? item.name ?? '')}
                    </div>
                    {(item.time || item.departure_time) && (
                      <div className="tr-meta mt-0.5 flex items-center gap-1.5 text-[var(--tr-ink-2)]">
                        {item.time && <span>{String(item.time)}</span>}
                        {item.departure_time && (
                          <span className="flex items-center gap-1">
                            <IconPickup size={12} aria-hidden />
                            {String(item.departure_time)}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {tab === 'settings' && <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{settings}</div>}
          </div>
        </div>

        {/* ---- Bottom tab bar ---------------------------------------- */}
        {!keyboardOpen && (
          <nav
            className="tr-safe-bottom tr-hairline-t z-30 shrink-0 bg-[var(--tr-surface)]"
            role="tablist"
            data-testid="room-tabbar"
          >
            <div className="mx-auto flex w-full max-w-2xl items-stretch" style={{ minHeight: 'var(--tr-tabbar-h)' }}>
              {TABS.map(({ key, Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectTab(key)}
                    className={`relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 pb-1 pt-1.5 transition-colors ${
                      active ? 'text-[var(--tr-accent-deep)]' : 'text-[var(--tr-ink-3)]'
                    }`}
                  >
                    <span
                      className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                        active ? 'bg-[var(--tr-accent-soft)]' : ''
                      }`}
                    >
                      <Icon size={21} strokeWidth={active ? 2.25 : 2} aria-hidden />
                      {key === 'chat' && chatUnread && (
                        <span
                          className="absolute right-1 top-0 h-2 w-2 rounded-full bg-[var(--tr-danger)]"
                          data-testid="chat-unread-dot"
                        />
                      )}
                    </span>
                    <span className="text-[10px] font-medium leading-none">{labels[key]}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* ---- Emergency sheet --------------------------------------- */}
        <Sheet
          open={emergencyOpen}
          onClose={() => setEmergencyOpen(false)}
          closeLabel={CLOSE_LABEL[locale]}
          title={
            <span className="flex items-center gap-2 text-[var(--tr-danger)]">
              <IconEmergency size={18} aria-hidden />
              {EMERGENCY_TITLE[locale]}
            </span>
          }
        >
          <EmergencyCard locale={locale} sos={sos} showTitle={false} />
        </Sheet>
      </div>
    </div>
  );
}
