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
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import EmergencyCard from '@/components/tour-mode/EmergencyCard';
import Sheet from '@/components/tour-mode/Sheet';
import { useKeyboardOpen } from '@/components/tour-mode/useKeyboardOpen';
import {
  IconConcierge,
  IconEmergency,
  IconTabChat,
  IconTabHome,
  IconTabMap,
  IconTabSchedule,
  IconTabSettings,
  IconPickup,
} from '@/components/tour-mode/icons';
import { EMERGENCY_TITLE } from '@/lib/tour-room/emergency';
import { CONCIERGE_COPY } from '@/lib/tour-room/concierge';
import type { RoomConnection } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const TAB_LABEL: Record<
  RoomLocale,
  { home: string; chat: string; map: string; schedule: string; settings: string }
> = {
  en: { home: 'Home', chat: 'Chat', map: 'Map', schedule: 'Today', settings: 'Settings' },
  ko: { home: '홈', chat: '채팅', map: '지도', schedule: '오늘 일정', settings: '설정' },
  ja: { home: 'ホーム', chat: 'チャット', map: '地図', schedule: '本日', settings: '設定' },
  es: { home: 'Inicio', chat: 'Chat', map: 'Mapa', schedule: 'Hoy', settings: 'Ajustes' },
  zh: { home: '首页', chat: '聊天', map: '地图', schedule: '今日', settings: '设置' },
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

export type RoomTab = 'home' | 'chat' | 'map' | 'schedule' | 'settings';

/**
 * H1 — what the home dashboard can drive on the shell: tab switches and the
 * two shell-owned sheets (Smart Guide, emergency). `chatUnread` mirrors the
 * tab-bar dot so the home chat-preview row can echo it.
 */
export interface RoomShellHomeApi {
  selectTab: (tab: RoomTab) => void;
  openConcierge: () => void;
  openEmergency: () => void;
  chatUnread: boolean;
}

/**
 * A1 — what the chat tab can drive on the shell. Lets the chat's own Smart
 * Guide entry row open the (shell-owned) concierge sheet from where the guest
 * is already typing, without lifting the sheet's open state out of the shell.
 */
export interface RoomShellChatApi {
  openConcierge: () => void;
}

interface ScheduleItem {
  time?: string;
  departure_time?: string;
  title?: string;
  name?: string;
  [key: string]: unknown;
}

const BASE_TABS: Array<{ key: RoomTab; Icon: typeof IconTabChat }> = [
  { key: 'chat', Icon: IconTabChat },
  { key: 'map', Icon: IconTabMap },
  { key: 'schedule', Icon: IconTabSchedule },
  { key: 'settings', Icon: IconTabSettings },
];

const HOME_TABS: Array<{ key: RoomTab; Icon: typeof IconTabChat }> = [{ key: 'home', Icon: IconTabHome }, ...BASE_TABS];

/** A1 — device-scoped flag: the guest has opened the Smart Guide at least once. */
const CONCIERGE_SEEN_KEY = 'tour_mode_concierge_seen';

/**
 * U6.1 — index of the schedule item currently underway: the last stop whose
 * HH:MM start is at or before the KST wall clock (live rooms only).
 * Exported for the home dashboard's now/next card (H2).
 */
export function currentScheduleIndex(schedule: ScheduleItem[], lifecycle: string, nowMs: number): number {
  if (lifecycle !== 'live') return -1;
  let nowHm: string;
  try {
    nowHm = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(nowMs));
  } catch {
    return -1;
  }
  let current = -1;
  schedule.forEach((item, index) => {
    const start = String(item.time ?? '').slice(0, 5);
    if (/^\d{2}:\d{2}$/.test(start) && start <= nowHm) current = index;
  });
  return current;
}

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
  concierge,
  home,
  theme = 'light',
  chatActivityKey,
  initialTab,
  backHref,
}: {
  title: string;
  subtitle?: string;
  lifecycle: 'lobby' | 'live' | 'ended';
  connection: RoomConnection;
  locale: RoomLocale;
  schedule: ScheduleItem[];
  /** Chat tab content (feed + composer), supplied by the page. A render
   *  function receives the chat API (A1 — open the concierge sheet). */
  chat: ReactNode | ((api: RoomShellChatApi) => ReactNode);
  /** Settings tab content (T1.12), supplied by the page. */
  settings: ReactNode;
  /** T2.8 — live caption / notice banners, floating over every tab. */
  banner?: ReactNode;
  /** T3.3 — map tab content; the "coming soon" placeholder shows when absent. */
  map?: ReactNode;
  /** T7.3 — the SOS control inside the emergency sheet. */
  sos?: ReactNode;
  /** V2.2 — Smart Guide panel; the header sparkle button shows when present. */
  concierge?: ReactNode;
  /**
   * H1 — home dashboard render prop. When present the shell gains a 5th
   * "Home" tab, lands on it, and hands the dashboard the shell API (tab
   * switches + sheet openers). Absent → the classic chat-first 4-tab shell.
   */
  home?: (api: RoomShellHomeApi) => ReactNode;
  /** Resolved theme — 'system' is resolved by the caller before this prop. */
  theme?: 'light' | 'dark';
  /** U1.2 — bumps on chat activity; while on another tab it lights the unread dot. */
  chatActivityKey?: number;
  /** Phase 3 — deep-link: land on this tab instead of the default. */
  initialTab?: RoomTab;
  /** Optional in-app back target (e.g. guide → console, guest → tour-mode home).
   *  Renders a back chevron so phone users aren't stuck exiting the whole app. */
  backHref?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<RoomTab>(initialTab ?? (home ? 'home' : 'chat'));
  // Back-stack of visited tabs so "back" steps one screen at a time (chat→map,
  // back→chat) instead of leaving the room / dumping to the booking gate.
  const [tabStack, setTabStack] = useState<RoomTab[]>([]);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  // A1 — first-visit pulse on the concierge button. Defaults to no pulse to
  // avoid an SSR flash; an effect turns it on only for a guest who has never
  // opened the Smart Guide (localStorage-gated, once per device).
  const [conciergePulse, setConciergePulse] = useState(false);
  const [chatUnread, setChatUnread] = useState(false);
  const keyboardOpen = useKeyboardOpen();
  const badge = LIFECYCLE_BADGE[lifecycle] ?? LIFECYCLE_BADGE.live;
  const labels = TAB_LABEL[locale];
  // The "now" marker on the schedule advances on a 1-min tick (kept out of
  // render so it stays pure — Date.now() in render is impure/unstable).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // A1 — light the first-visit pulse only when the Smart Guide exists and the
  // guest has never opened it on this device.
  useEffect(() => {
    if (!concierge) return;
    // Nested so the effect body doesn't call setState directly (a cascading-
    // render lint guard); localStorage is client-only, hence the effect.
    const lightPulseIfUnseen = () => {
      try {
        if (window.localStorage.getItem(CONCIERGE_SEEN_KEY) !== '1') setConciergePulse(true);
      } catch {
        /* private mode — no pulse, no harm */
      }
    };
    lightPulseIfUnseen();
  }, [concierge]);

  // Single opener (header button / chat entry row / home CTA) — opens the sheet
  // and retires the first-visit pulse for good.
  const openConcierge = () => {
    setConciergeOpen(true);
    setConciergePulse(false);
    try {
      window.localStorage.setItem(CONCIERGE_SEEN_KEY, '1');
    } catch {
      /* noop */
    }
  };
  const currentIndex = currentScheduleIndex(schedule, lifecycle, nowMs);

  // Unread dot: chat activity while another tab is up. Refs update in effects,
  // not during render (they're only read in the activity effect below).
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  const activityRef = useRef(chatActivityKey);
  useEffect(() => {
    const onActivity = () => {
      if (chatActivityKey === activityRef.current) return;
      activityRef.current = chatActivityKey;
      if (tabRef.current !== 'chat') setChatUnread(true);
    };
    onActivity();
  }, [chatActivityKey]);

  const selectTab = (next: RoomTab) => {
    if (next !== tab) setTabStack((stack) => [...stack, tab]);
    setTab(next);
    if (next === 'chat') setChatUnread(false);
  };

  // Unified back step, shared by the header chevron and the hardware/browser
  // back button (via the popstate trap below). Returns whether it stayed inside
  // the room or wants to exit to backHref. One click = one step:
  //   open sheet → close it → pop a tab → (root) exit to console / stay.
  const goBack = (): 'stayed' | 'exit' | 'noop' => {
    if (conciergeOpen) {
      setConciergeOpen(false);
      return 'stayed';
    }
    if (emergencyOpen) {
      setEmergencyOpen(false);
      return 'stayed';
    }
    if (tabStack.length > 0) {
      const prev = tabStack[tabStack.length - 1];
      setTabStack((stack) => stack.slice(0, -1));
      setTab(prev);
      if (prev === 'chat') setChatUnread(false);
      return 'stayed';
    }
    return backHref ? 'exit' : 'noop';
  };

  // Latest-closure ref so the popstate listener (registered once) always calls
  // the current goBack without re-subscribing every render.
  const goBackRef = useRef(goBack);
  useEffect(() => {
    goBackRef.current = goBack;
  });

  const handleBack = () => {
    if (goBack() === 'exit' && backHref) router.push(backHref);
  };

  // Trap the hardware/browser back button: a sentinel history entry means a
  // back press fires popstate (which we consume with an in-room step) instead
  // of leaving the PWA. Only exits to backHref when nothing is left to pop.
  useEffect(() => {
    window.history.pushState({ tourRoomGuard: true }, '');
    const onPop = () => {
      const result = goBackRef.current();
      if (result === 'exit' && backHref) {
        router.push(backHref);
      } else {
        // stayed (sheet/tab) or customer-at-root: re-arm the sentinel so the
        // next back press is trapped too, never exiting to the browser.
        window.history.pushState({ tourRoomGuard: true }, '');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [backHref, router]);

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
          {(backHref || tabStack.length > 0) && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="뒤로"
              className="-ml-1.5 flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink-2)] active:bg-[var(--tr-surface-2)]"
              data-testid="room-back"
            >
              <ChevronLeft size={24} strokeWidth={2.25} aria-hidden />
            </button>
          )}
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
          {concierge && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={openConcierge}
                aria-label={CONCIERGE_COPY[locale].title}
                className="relative flex h-11 w-11 items-center justify-center rounded-full text-[var(--tr-accent-deep)] active:bg-[var(--tr-accent-soft)]"
                data-testid="concierge-open"
              >
                {conciergePulse && (
                  <span
                    className="tr-concierge-pulse absolute inset-1 rounded-full bg-[var(--tr-accent-soft)]"
                    aria-hidden
                  />
                )}
                <IconConcierge size={21} strokeWidth={2} className="relative" />
              </button>
              {conciergePulse && (
                <span
                  className="tr-meta absolute right-0 top-full z-40 mt-1 whitespace-nowrap rounded-full bg-[var(--tr-accent)] px-2.5 py-1 font-medium text-[var(--tr-bubble-me-ink)] shadow-md"
                  role="status"
                  data-testid="concierge-hint"
                >
                  {CONCIERGE_COPY[locale].hint}
                </span>
              )}
            </div>
          )}
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
        <div
          className={`relative flex min-h-0 flex-1 flex-col ${
            tab === 'home' ? '[background:var(--tr-home-canvas)]' : ''
          }`}
        >
          {/* In-flow (not an overlay) so a notice/parking banner never covers the
              Settings language picker or other tab content — it pushes content
              down instead of floating over it. */}
          {banner && (
            <div className="z-20 mx-auto w-full max-w-2xl shrink-0 px-3 pt-2">{banner}</div>
          )}

          <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
            {tab === 'home' && home && (
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3" data-testid="home-panel">
                {home({
                  selectTab,
                  openConcierge,
                  openEmergency: () => setEmergencyOpen(true),
                  chatUnread,
                })}
              </div>
            )}
            {tab === 'chat' &&
              (typeof chat === 'function' ? chat({ openConcierge: () => setConciergeOpen(true) }) : chat)}
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
              <ol className="overflow-y-auto px-4 py-4">
                {schedule.length === 0 && (
                  <p className="tr-card-text pt-10 text-center text-[var(--tr-ink-3)]">—</p>
                )}
                {schedule.map((item, index) => {
                  const active = index === currentIndex;
                  return (
                    <li key={index} className="relative flex gap-3">
                      <div
                        className={`tr-meta w-11 shrink-0 pt-1 text-right tabular-nums ${
                          active ? 'font-bold text-[var(--tr-accent-deep)]' : 'text-[var(--tr-ink-3)]'
                        }`}
                      >
                        {item.time ? String(item.time).slice(0, 5) : ''}
                      </div>
                      <div className="flex flex-col items-center">
                        <span
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                            active
                              ? 'bg-[var(--tr-accent)] ring-4 ring-[var(--tr-accent-soft)]'
                              : index < (currentIndex === -1 ? -1 : currentIndex)
                                ? 'bg-[var(--tr-ink-3)]'
                                : 'bg-[var(--tr-bubble-system)]'
                          }`}
                        />
                        {index < schedule.length - 1 && (
                          <span className="w-px flex-1 bg-[var(--tr-hairline)]" aria-hidden />
                        )}
                      </div>
                      <div className={`min-w-0 flex-1 ${index < schedule.length - 1 ? 'pb-4' : ''}`}>
                        {/* W2.4 — the current stop lifts into an accent card so
                            "now" is unmistakable; -mx/px cancels so text stays
                            aligned with the rest of the timeline. */}
                        <div
                          className={
                            active
                              ? '-mx-2 rounded-xl bg-[var(--tr-accent-soft)] px-2 py-1.5 shadow-[var(--tr-tile-shadow)]'
                              : ''
                          }
                        >
                          <div
                            className={`tr-card-text ${
                              active ? 'font-semibold text-[var(--tr-accent-deep)]' : 'font-medium text-[var(--tr-ink)]'
                            }`}
                          >
                            {String(item.title ?? item.name ?? '')}
                          </div>
                          {item.departure_time && (
                            <div className="tr-meta mt-0.5 flex items-center gap-1 text-[var(--tr-ink-2)]">
                              <IconPickup size={12} aria-hidden />
                              {String(item.departure_time)}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
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
              {(home ? HOME_TABS : BASE_TABS).map(({ key, Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectTab(key)}
                    className={`relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 pb-1 pt-1.5 transition-transform active:scale-95 ${
                      active ? 'text-[var(--tr-safe)]' : 'text-[var(--tr-ink-3)]'
                    }`}
                  >
                    <span
                      className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-all duration-200 ${
                        active ? 'scale-100 bg-[var(--tr-safe-soft)]' : 'scale-90'
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

        {/* ---- Smart Guide sheet (V2.2) ------------------------------- */}
        {concierge && (
          <Sheet
            open={conciergeOpen}
            onClose={() => setConciergeOpen(false)}
            closeLabel={CLOSE_LABEL[locale]}
            title={
              <span className="flex items-center gap-2 text-[var(--tr-accent-deep)]">
                <IconConcierge size={18} aria-hidden />
                {CONCIERGE_COPY[locale].title}
              </span>
            }
          >
            {concierge}
          </Sheet>
        )}
      </div>
    </div>
  );
}
