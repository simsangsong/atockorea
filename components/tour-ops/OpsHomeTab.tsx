'use client';

/**
 * 관제센터 홈 — the ops hub: today's vitals + one-tap entry into every ops
 * job (룸/링크 만들기, 모니터링, 메시지 모아보기, 위치, 문답 학습). The tiles
 * exist so an operator never has to remember which tab or admin page owns a
 * task — the hub is the task list.
 */

import {
  BarChart3,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Link2,
  Map as MapIcon,
} from 'lucide-react';
import { isRecent, type OpsRoom, type SosInfo } from '@/components/tour-ops/opsShared';
import type { AttentionItem } from '@/lib/tour-ops/attention';
import type { OpsTab } from '@/components/tour-ops/OpsApp';

export default function OpsHomeTab({
  rooms,
  sosRooms,
  attention,
  unreadTotal,
  onNavigate,
  onOpenManager,
  onOpenInbox,
}: {
  rooms: OpsRoom[];
  sosRooms: Map<string, SosInfo>;
  attention: AttentionItem[];
  unreadTotal: number;
  onNavigate: (tab: OpsTab) => void;
  onOpenManager: () => void;
  onOpenInbox: () => void;
}) {
  const liveCount = rooms.filter(
    (room) =>
      isRecent(room.last_message?.created_at) ||
      room.participants.some((participant) => isRecent(participant.last_seen_at)),
  ).length;
  const sosCount = sosRooms.size;

  const stats: Array<{ label: string; value: number; tone?: 'red' | 'amber' | 'emerald' }> = [
    { label: '오늘 룸', value: rooms.length },
    { label: 'LIVE', value: liveCount, tone: 'emerald' },
    { label: '안읽음', value: unreadTotal },
    { label: '응대 필요', value: attention.length, tone: attention.length ? 'amber' : undefined },
    { label: 'SOS', value: sosCount, tone: sosCount ? 'red' : undefined },
  ];

  const tiles: Array<{
    key: string;
    title: string;
    desc: string;
    icon: typeof Link2;
    badge?: number;
    badgeTone?: 'red' | 'amber' | 'blue';
    onClick?: () => void;
    href?: string;
  }> = [
    {
      key: 'manager',
      title: '룸 · 링크 만들기',
      desc: '룸 생성 · 손님/가이드 링크 · QR · 초대 메일',
      icon: Link2,
      onClick: onOpenManager,
    },
    {
      key: 'monitor',
      title: '실시간 모니터링',
      desc: '룸 피드 · 응대 큐 · 안읽음',
      icon: LayoutDashboard,
      badge: unreadTotal + attention.length,
      badgeTone: attention.length ? 'amber' : 'blue',
      onClick: () => onNavigate('dashboard'),
    },
    {
      key: 'inbox',
      title: '메시지 모아보기',
      desc: '모든 룸의 메시지를 한 타임라인으로',
      icon: Inbox,
      onClick: onOpenInbox,
    },
    {
      key: 'map',
      title: '위치 보기',
      desc: '가이드 · 손님 실시간 지도',
      icon: MapIcon,
      onClick: () => onNavigate('map'),
    },
    {
      key: 'qa',
      title: '문답 학습',
      desc: '컨시어지 Q&A 검토 · 승인 · 학습',
      icon: GraduationCap,
      href: '/admin/qa-review',
    },
    {
      key: 'analytics',
      title: '챗봇 분석',
      desc: '해결률 · 커버리지 갭 · 피드백',
      icon: BarChart3,
      href: '/admin/chatbot-analytics',
    },
  ];

  const badgeClass = (tone?: 'red' | 'amber' | 'blue') =>
    tone === 'red'
      ? 'bg-red-500 text-white'
      : tone === 'amber'
        ? 'bg-amber-400 text-slate-950'
        : 'bg-blue-500 text-white';

  return (
    <div className="space-y-4 pb-4">
      {/* Vitals */}
      <div className="grid grid-cols-5 gap-1.5" data-testid="ops-home-stats">
        {stats.map(({ label, value, tone }) => (
          <div key={label} className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-1 py-2.5 text-center">
            <p
              className={`text-[17px] font-bold tabular-nums ${
                tone === 'red' && value
                  ? 'text-red-600 dark:text-red-400'
                  : tone === 'amber' && value
                    ? 'text-amber-700 dark:text-amber-300'
                    : tone === 'emerald' && value
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-[var(--tr-ink)]'
              }`}
            >
              {value}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--tr-ink-3)]">{label}</p>
          </div>
        ))}
      </div>

      {/* SOS shortcut rides above the tiles only while one is active. */}
      {sosCount > 0 && (
        <button
          type="button"
          onClick={() => onNavigate('sos')}
          className="flex w-full items-center justify-between rounded-2xl border border-red-200 bg-red-50 dark:border-red-500/50 dark:bg-red-950/40 px-4 py-3 text-left"
        >
          <span className="text-[13px] font-bold text-red-700 dark:text-red-100">
            <span className="animate-pulse">🆘</span> 활성 SOS {sosCount}건 — 지금 확인
          </span>
          <span className="text-[12px] text-red-600 dark:text-red-300">SOS 탭 →</span>
        </button>
      )}

      {/* Action tiles */}
      <div className="grid grid-cols-2 gap-2" data-testid="ops-home-tiles">
        {tiles.map(({ key, title, desc, icon: Icon, badge, badgeTone, onClick, href }) => {
          const body = (
            <>
              <span className="relative inline-flex">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--tr-surface-2)]">
                  <Icon className="size-[18px] text-[var(--tr-ink-2)]" />
                </span>
                {badge ? (
                  <span
                    className={`absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${badgeClass(badgeTone)}`}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </span>
              <span className="mt-2.5 block text-[13px] font-semibold text-[var(--tr-ink)]">{title}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-[var(--tr-ink-3)]">{desc}</span>
            </>
          );
          const className =
            'block min-h-[104px] rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-3.5 text-left transition-colors active:bg-[var(--tr-surface-2)]';
          return href ? (
            <a key={key} href={href} className={className}>
              {body}
            </a>
          ) : (
            <button key={key} type="button" onClick={onClick} className={className}>
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}
