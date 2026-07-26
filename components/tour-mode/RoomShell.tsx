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

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import EmergencyCard from '@/components/tour-mode/EmergencyCard';
import Sheet from '@/components/tour-mode/Sheet';
import PlanStopCards from '@/components/tour-mode/plan/PlanStopCards';
import { useKeyboardOpen } from '@/components/tour-mode/useKeyboardOpen';
import { useTourRoomSettings, textScaleFactor } from '@/hooks/useTourRoomSettings';
import {
  IconBack,
  IconConcierge,
  IconDrawer,
  IconEmergency,
  IconTabChat,
  IconTabHome,
  IconTabMap,
  IconTabSchedule,
  IconTabSettings,
  IconPickup,
  TR_ICON,
  TR_STROKE,
} from '@/components/tour-mode/icons';
import { EMERGENCY_TITLE } from '@/lib/tour-room/emergency';
import { scheduleClock } from '@/lib/tour-room/time';
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

/** P0-5 — the rich stop cards are view-only here; only "Details" is used. */
const STOP_CARD_LABELS: Record<RoomLocale, { add: string; added: string; details: string }> = {
  en: { add: 'Add', added: 'Added', details: 'Details' },
  ko: { add: '담기', added: '담김', details: '자세히' },
  ja: { add: '追加', added: '追加済み', details: '詳細' },
  es: { add: 'Añadir', added: 'Añadido', details: 'Detalles' },
  zh: { add: '添加', added: '已添加', details: '详情' },
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

/** 손님 노출 아이콘 버튼의 스크린리더 라벨 — ko 하드코딩 금지 (감사 #3). */
const BACK_LABEL: Record<RoomLocale, string> = {
  en: 'Back',
  ko: '뒤로',
  ja: '戻る',
  es: 'Atrás',
  zh: '返回',
};
const DRAWER_LABEL: Record<RoomLocale, string> = {
  en: 'Menu',
  ko: '메뉴',
  ja: 'メニュー',
  es: 'Menú',
  zh: '菜单',
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
  /**
   * C — the composer's "+" tray reaches the emergency sheet (SOS + contacts).
   * The sheet stays shell-owned: duplicating the SOS flow into the tray would
   * give an emergency two code paths, and one of them would rot.
   */
  openEmergency: () => void;
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
    const start = scheduleClock(item.time);
    if (/^\d{2}:\d{2}$/.test(start) && start <= nowHm) current = index;
  });
  return current;
}

export default function RoomShell({
  title,
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
  homeHref,
  richStops,
  headerTitleSlot,
  renderDrawer,
}: {
  title: string;
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
  /**
   * P1-2 — always-visible home entry point. Unlike backHref this navigates
   * straight to the app home in one tap, from whichever tab is open.
   */
  homeHref?: string;
  /**
   * P0-5 — the product page's itinerary for this guest's language (photo,
   * description, highlights, facilities). When present the Today tab renders
   * the same rich cards + detail drawer the product page and the /plan editor
   * use; when empty it keeps the plain time/title timeline.
   */
  richStops?: unknown[];
  /**
   * B1 (§11.B) — replaces the title/subtitle block in the header. Used by the
   * GUIDE view only to swap the tour title for the seat strip; when absent the
   * classic title+badge+subtitle renders (customer/driver unchanged).
   */
  headerTitleSlot?: ReactNode;
  /**
   * U4-D5 — the room drawer (카톡 서랍). When present the header gains a ☰
   * button (rightmost); the render prop receives the shell API so drawer
   * shortcuts can switch tabs / open the concierge or emergency sheets.
   */
  renderDrawer?: (api: {
    close: () => void;
    selectTab: (tab: 'schedule' | 'map' | 'settings') => void;
    openConcierge: () => void;
    openEmergency: () => void;
  }) => ReactNode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<RoomTab>(initialTab ?? (home ? 'home' : 'chat'));
  // Back-stack of visited tabs so "back" steps one screen at a time (chat→map,
  // back→chat) instead of leaving the room / dumping to the booking gate.
  const [tabStack, setTabStack] = useState<RoomTab[]>([]);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // A1 — first-visit pulse on the concierge button. Defaults to no pulse to
  // avoid an SSR flash; an effect turns it on only for a guest who has never
  // opened the Smart Guide (localStorage-gated, once per device).
  const [conciergePulse, setConciergePulse] = useState(false);
  const [chatUnread, setChatUnread] = useState(false);
  const keyboardOpen = useKeyboardOpen();
  // Device store: text scale + skin stamp. (The theme control itself lives in
  // the Settings tab and the drawer's 화면 모드 tile — C-D1 header diet.)
  const { settings: deviceSettings } = useTourRoomSettings();
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
    if (drawerOpen) {
      setDrawerOpen(false);
      return 'stayed';
    }
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
        // C-D5 — background skin: token overrides key off this attribute.
        data-tr-skin={deviceSettings.skin}
        // P1-6 — one variable scales the whole tour-room typography scale.
        style={{ '--tr-font-scale': textScaleFactor(deviceSettings.textScale) } as CSSProperties}
      >
        {/* ---- Slim header (C-D1/C-D2 — KakaoTalk grammar) --------------
            Chrome shares the canvas color (no white bar, no divider), the
            right cluster is capped at THREE icons (theme control moved to the
            drawer tile + Settings tab), buttons are a uniform 40px column on a
            44px touch row, and the static subtitle line is gone — the title
            owns the width. This is what un-truncates the tour name. */}
        <header
          className="tr-safe-top tr-chrome-line-b z-30 flex shrink-0 items-center gap-1 bg-[var(--tr-chrome)] px-3"
          style={{ minHeight: 'var(--tr-header-h)' }}
        >
          {(backHref || tabStack.length > 0) && (
            <button
              type="button"
              onClick={handleBack}
              aria-label={BACK_LABEL[locale]}
              className="-ml-1 flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink)] active:bg-[var(--tr-bubble-system)]"
              data-testid="room-back"
            >
              <IconBack size={TR_ICON.nav} strokeWidth={TR_STROKE.default} aria-hidden />
            </button>
          )}
          {/* P1-2 — one tap to the app home from ANY tab. The chevron above is a
              ladder (close sheet → pop tab → only then navigate), so it is not
              a home affordance; guests reach home via their Home tab, and the
              operator shells (which have no Home tab) need this.
              폭 예산 (적대적 리뷰 #4): backHref와 같은 곳을 가리키면 생략한다 —
              가이드 룸 헤더는 좌석 스트립이 살아야 한다. */}
          {homeHref && homeHref !== backHref && (
            <a
              href={homeHref}
              aria-label="홈으로"
              data-testid="room-home"
              className="-ml-1 flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink-2)] active:bg-[var(--tr-bubble-system)]"
            >
              <IconTabHome size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
            </a>
          )}
          <div className="min-w-0 flex-1 px-1 py-1.5">
            {headerTitleSlot ? (
              headerTitleSlot
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="tr-title truncate text-[var(--tr-ink)]">{title}</h1>
                  <span
                    className={`tr-meta shrink-0 rounded-full px-2 py-0.5 font-semibold ${badge.className}`}
                    data-testid="lifecycle-badge"
                  >
                    {badge.label}
                  </span>
                </div>
                {degraded && connectionHint && (
                  <p className="tr-meta mt-0.5 flex items-center gap-1.5 truncate font-medium text-[var(--tr-accent-deep)]">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        connection === 'offline' ? 'bg-[var(--tr-danger)]' : 'animate-pulse bg-[var(--tr-accent)]'
                      }`}
                    />
                    {connectionHint}
                  </p>
                )}
              </>
            )}
          </div>
          {concierge && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={openConcierge}
                aria-label={CONCIERGE_COPY[locale].title}
                className="relative flex h-11 w-10 items-center justify-center rounded-full text-[var(--tr-accent-deep)] active:bg-[var(--tr-accent-soft)]"
                data-testid="concierge-open"
              >
                {conciergePulse && (
                  <span
                    className="tr-concierge-pulse absolute inset-1 rounded-full bg-[var(--tr-accent-soft)]"
                    aria-hidden
                  />
                )}
                <IconConcierge size={TR_ICON.nav} strokeWidth={TR_STROKE.default} className="relative" />
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
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[var(--tr-danger)] active:bg-[var(--tr-danger-soft)]"
            data-testid="emergency-open"
          >
            <IconEmergency size={TR_ICON.nav} strokeWidth={TR_STROKE.default} />
          </button>
          {renderDrawer && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={DRAWER_LABEL[locale]}
              className="-mr-1 flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink)] active:bg-[var(--tr-bubble-system)]"
              data-testid="room-drawer-open"
            >
              <IconDrawer size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
            </button>
          )}
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
              <div className="tr-anim-panel-in min-h-0 flex-1 overflow-y-auto px-3 py-3" data-testid="home-panel">
                {home({
                  selectTab,
                  openConcierge,
                  openEmergency: () => setEmergencyOpen(true),
                  chatUnread,
                })}
              </div>
            )}
            {tab === 'chat' &&
              (typeof chat === 'function'
                ? chat({
                    // 공용 opener 를 쓴다. 예전에는 여기서 setConciergeOpen(true)를
                    // 직접 불러 첫 방문 펄스와 seen 키가 갱신되지 않았고, 그래서
                    // 채팅에서 스마트가이드를 열어도 헤더 버튼은 계속 반짝였다.
                    openConcierge,
                    openEmergency: () => setEmergencyOpen(true),
                  })
                : chat)}
            {tab === 'map' && (
              <div className="tr-anim-panel-in flex min-h-0 flex-1 flex-col px-3 py-2">
                {map ?? (
                  <div className="tr-card-text flex flex-1 items-center justify-center gap-2 text-[var(--tr-ink-3)]">
                    <IconTabMap size={TR_ICON.chip} aria-hidden />
                    {MAP_SOON[locale]}
                  </div>
                )}
              </div>
            )}
            {/* P0-5 — when the product page has this tour's itinerary in the
                guest's language, show the SAME rich cards they saw when
                booking (photo + Details drawer with description, highlights,
                facilities), instead of a bare time/title list. */}
            {tab === 'schedule' && richStops && richStops.length > 0 && (
              <div className="tr-anim-panel-in overflow-y-auto px-4 py-4">
                <PlanStopCards
                  stops={richStops as Parameters<typeof PlanStopCards>[0]['stops']}
                  locale={locale}
                  canEdit={false}
                  labels={STOP_CARD_LABELS[locale]}
                />
              </div>
            )}
            {tab === 'schedule' && !(richStops && richStops.length > 0) && (
              <ol className="tr-anim-panel-in overflow-y-auto px-4 py-4">
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
                        {item.time ? scheduleClock(item.time) : ''}
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
                              <IconPickup size={TR_ICON.meta} strokeWidth={TR_STROKE.small} aria-hidden />
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
            {tab === 'settings' && (
              <div className="tr-anim-panel-in min-h-0 flex-1 overflow-y-auto px-3 py-3">{settings}</div>
            )}
          </div>
        </div>

        {/* ---- Bottom tab bar ---------------------------------------- */}
        {!keyboardOpen && (
          <nav
            className="tr-safe-bottom tr-chrome-line-t z-30 shrink-0 bg-[var(--tr-chrome)]"
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
                    className={`tr-press relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 pb-1 pt-1.5 ${
                      active ? 'text-[var(--tr-safe)]' : 'text-[var(--tr-ink-3)]'
                    }`}
                  >
                    <span
                      className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-all duration-200 ${
                        active ? 'scale-100 bg-[var(--tr-safe-soft)]' : 'scale-90'
                      }`}
                    >
                      <Icon size={TR_ICON.nav} strokeWidth={active ? TR_STROKE.small : TR_STROKE.default} aria-hidden />
                      {key === 'chat' && chatUnread && (
                        <span
                          className="absolute right-1 top-0 h-2 w-2 rounded-full bg-[var(--tr-danger)]"
                          data-testid="chat-unread-dot"
                        />
                      )}
                    </span>
                    <span className="tr-meta text-cjk-safe max-w-full font-medium leading-none">{labels[key]}</span>
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
              <IconEmergency size={TR_ICON.action} aria-hidden />
              {EMERGENCY_TITLE[locale]}
            </span>
          }
        >
          <EmergencyCard locale={locale} sos={sos} showTitle={false} />
        </Sheet>

        {/* ---- Room drawer (U4-D5, 카톡 서랍) -------------------------- */}
        {renderDrawer &&
          drawerOpen &&
          renderDrawer({
            close: () => setDrawerOpen(false),
            selectTab: (t) => {
              setDrawerOpen(false);
              selectTab(t);
            },
            openConcierge: () => {
              setDrawerOpen(false);
              openConcierge();
            },
            openEmergency: () => {
              setDrawerOpen(false);
              setEmergencyOpen(true);
            },
          })}

        {/* ---- Smart Guide sheet (V2.2) ------------------------------- */}
        {concierge && (
          <Sheet
            open={conciergeOpen}
            onClose={() => setConciergeOpen(false)}
            closeLabel={CLOSE_LABEL[locale]}
            title={
              <span className="flex items-center gap-2 text-[var(--tr-accent-deep)]">
                <IconConcierge size={TR_ICON.action} aria-hidden />
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
