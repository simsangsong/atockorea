'use client';

/**
 * U4-D1/D2 (docs/smartapp-ui-premium-upgrade-master-plan-2026-07-26.md §D) —
 * the staff shell: ONE frame for the operator's whole day.
 *
 * Before this, the guide's day was a single tall scroll (hero → seats → rooms
 * → day tools → feed) with three separate doors (console / room chat /
 * cockpit). This shell gives staff the same bottom-tab grammar guests already
 * know from RoomShell:
 *
 *   [대화] rooms + broadcast + recent feed   [좌석·명단] seat dashboard
 *   [운행] drive tools                        [설정] theme · text size
 *
 * The chat surface stays ONE surface: room cards still open the guest-grade
 * RoomShell chat, and drive mode stays the cockpit display-state of that same
 * room channel. This component is pure presentation — data/state stay in the
 * console that mounts it.
 *
 * Theme: same resolution as RoomShell (settings 'system' → media query),
 * wrapped in a room-scoped `.dark` ancestor. The old console was light-only —
 * staff get the toggle guests always had.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useKeyboardOpen } from '@/components/tour-mode/useKeyboardOpen';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTourRoomSettings, textScaleFactor } from '@/hooks/useTourRoomSettings';
import {
  IconRefresh,
  IconSeat,
  IconTabChat,
  IconTabHome,
  IconTabSettings,
  IconVehicle,
  TR_ICON,
  TR_STROKE,
} from '@/components/tour-mode/icons';

export type StaffTabKey = 'chat' | 'seats' | 'ops' | 'settings';

const TABS: Array<{ key: StaffTabKey; label: string; Icon: typeof IconTabChat }> = [
  { key: 'chat', label: '대화', Icon: IconTabChat },
  { key: 'seats', label: '좌석·명단', Icon: IconSeat },
  { key: 'ops', label: '운행', Icon: IconVehicle },
  { key: 'settings', label: '설정', Icon: IconTabSettings },
];

const LIFECYCLE_BADGE: Record<'lobby' | 'live' | 'ended', { label: string; cls: string }> = {
  lobby: { label: '대기', cls: 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]' },
  live: { label: 'LIVE', cls: 'bg-[var(--tr-safe-soft)] text-[var(--tr-safe)]' },
  ended: { label: '종료', cls: 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]' },
};

export default function StaffShell({
  title,
  lifecycle,
  subtitle,
  onRefresh,
  refreshing = false,
  chat,
  seats,
  ops,
  settings,
  chatBadge = 0,
  seatsBadge = 0,
  initialTab = 'chat',
  tab: controlledTab,
  onTabChange,
  overlay,
}: {
  title: string;
  lifecycle: 'lobby' | 'live' | 'ended';
  /** e.g. `2026-07-27 · 예약 3` — one quiet line under the title. */
  subtitle?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  chat: ReactNode;
  seats: ReactNode;
  ops: ReactNode;
  settings: ReactNode;
  /** Rooms needing a reply — shown as a red count on the 대화 tab. */
  chatBadge?: number;
  /** Attention count on the 좌석·명단 tab (e.g. unseated parties). */
  seatsBadge?: number;
  initialTab?: StaffTabKey;
  /** Controlled mode — the console can jump tabs (seat sheet → 대화 compose). */
  tab?: StaffTabKey;
  onTabChange?: (tab: StaffTabKey) => void;
  /**
   * Sheets/modals. MUST render inside this themed root — a Sheet mounted as a
   * sibling of the shell sits outside `.tr-root` and renders transparent (a
   * real field incident, 2026-07-26 pressure test).
   */
  overlay?: ReactNode;
}) {
  const [internalTab, setInternalTab] = useState<StaffTabKey>(initialTab);
  const tab = controlledTab ?? internalTab;
  const selectTab = (next: StaffTabKey) => {
    onTabChange?.(next);
    if (controlledTab === undefined) setInternalTab(next);
  };
  const { settings: deviceSettings } = useTourRoomSettings();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme =
    deviceSettings.theme === 'system' ? (systemDark ? 'dark' : 'light') : deviceSettings.theme;
  const keyboardOpen = useKeyboardOpen();
  const badge = LIFECYCLE_BADGE[lifecycle];
  // 적대적 리뷰 #1 — 네 탭이 스크롤 컨테이너 하나를 공유하므로, 전환 시
  // scrollTop을 리셋하지 않으면 좌석판에서 내려간 위치 그대로 대화 탭 중간에
  // 착지한다 (탭은 각자 맨 위에서 시작하는 것이 탭 문법이다).
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div
        className="tr-root tr-plan-root mx-auto flex h-dvh w-full max-w-xl flex-col bg-[var(--tr-canvas)]"
        data-locale="ko"
        lang="ko"
        data-tr-skin={deviceSettings.skin}
        style={{ '--tr-font-scale': textScaleFactor(deviceSettings.textScale) } as CSSProperties}
        data-testid="staff-shell"
      >
        {/* ---- Slim header (C-D1 diet: home · title · refresh — 2 icons).
            Chrome shares the canvas color; the theme control lives in the
            설정 tab (one tap away on the tab bar), not the header. ----- */}
        <header
          className="tr-safe-top tr-chrome-line-b z-30 flex shrink-0 items-center gap-1 bg-[var(--tr-chrome)] px-3"
          style={{ minHeight: 'var(--tr-header-h)' }}
        >
          <a
            href="/tour-mode"
            aria-label="홈으로"
            data-testid="staff-home"
            className="-ml-1 flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink-2)] active:bg-[var(--tr-bubble-system)]"
          >
            <IconTabHome size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
          </a>
          <div className="min-w-0 flex-1 px-1 py-1.5">
            <div className="flex items-center gap-2">
              <h1 className="tr-title truncate text-[var(--tr-ink)]">{title}</h1>
              <span
                className={`tr-meta text-cjk-safe shrink-0 rounded-full px-2 py-0.5 font-semibold ${badge.cls}`}
                data-testid="staff-lifecycle-badge"
              >
                {badge.label}
              </span>
            </div>
            {subtitle && <p className="tr-meta tr-num mt-0.5 truncate text-[var(--tr-ink-3)]">{subtitle}</p>}
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              aria-label="새로고침"
              className="-mr-1 flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink)] active:bg-[var(--tr-bubble-system)]"
              data-testid="staff-refresh"
            >
              <IconRefresh
                size={TR_ICON.action}
                strokeWidth={TR_STROKE.default}
                className={refreshing ? 'animate-spin' : ''}
                aria-hidden
              />
            </button>
          )}
        </header>

        {/* ---- Tab panels -------------------------------------------- */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={panelRef} className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 pb-6 pt-3">
            {tab === 'chat' && (
              <div className="tr-anim-panel-in" data-testid="staff-tab-chat">
                {chat}
              </div>
            )}
            {tab === 'seats' && (
              <div className="tr-anim-panel-in" data-testid="staff-tab-seats">
                {seats}
              </div>
            )}
            {tab === 'ops' && (
              <div className="tr-anim-panel-in" data-testid="staff-tab-ops">
                {ops}
              </div>
            )}
            {tab === 'settings' && (
              <div className="tr-anim-panel-in" data-testid="staff-tab-settings">
                {settings}
              </div>
            )}
          </div>
        </div>

        {/* ---- Bottom tab bar (RoomShell grammar, staff set) --------- */}
        {!keyboardOpen && (
          <nav
            className="tr-safe-bottom tr-chrome-line-t z-30 shrink-0 bg-[var(--tr-chrome)]"
            role="tablist"
            data-testid="staff-tabbar"
          >
            <div className="mx-auto flex w-full max-w-xl items-stretch" style={{ minHeight: 'var(--tr-tabbar-h)' }}>
              {TABS.map(({ key, label, Icon }) => {
                const active = tab === key;
                const count = key === 'chat' ? chatBadge : key === 'seats' ? seatsBadge : 0;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectTab(key)}
                    data-testid={`staff-tab-btn-${key}`}
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
                      {count > 0 && (
                        <span
                          className="tr-meta tr-num absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--tr-danger)] px-1 font-bold leading-none text-white"
                          data-testid={`staff-tab-badge-${key}`}
                        >
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </span>
                    <span className="tr-meta text-cjk-safe max-w-full font-medium leading-none">{label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {overlay}
      </div>
    </div>
  );
}
