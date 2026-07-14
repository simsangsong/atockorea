'use client';

/**
 * T1.6 — room shell: header (tour name · date · lifecycle badge · connection
 * dot) + emergency card (T1.10) + tabs. The map tab activates with T3.3; the
 * schedule tab lists the tour schedule with departure times.
 */

import { useState, type ReactNode } from 'react';
import EmergencyCard from '@/components/tour-mode/EmergencyCard';
import type { RoomConnection } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const TAB_LABEL: Record<RoomLocale, { chat: string; map: string; schedule: string }> = {
  en: { chat: 'Chat', map: 'Map', schedule: 'Today' },
  ko: { chat: '채팅', map: '지도', schedule: '오늘 일정' },
  ja: { chat: 'チャット', map: '地図', schedule: '本日の日程' },
  es: { chat: 'Chat', map: 'Mapa', schedule: 'Hoy' },
  zh: { chat: '聊天', map: '地图', schedule: '今日行程' },
};

const MAP_SOON: Record<RoomLocale, string> = {
  en: 'Live map is coming soon.',
  ko: '실시간 지도는 곧 제공됩니다.',
  ja: 'ライブマップは近日公開です。',
  es: 'El mapa en vivo llegará pronto.',
  zh: '实时地图即将上线。',
};

const LIFECYCLE_BADGE: Record<string, { label: string; className: string }> = {
  lobby: { label: 'D-day soon', className: 'bg-sky-100 text-sky-700' },
  live: { label: 'LIVE', className: 'bg-emerald-100 text-emerald-700' },
  ended: { label: 'Ended', className: 'bg-gray-200 text-gray-600' },
};

const CONNECTION_DOT: Record<RoomConnection, string> = {
  connecting: 'bg-gray-300',
  realtime: 'bg-emerald-500',
  sse: 'bg-amber-400',
  offline: 'bg-red-400',
};

export type RoomTab = 'chat' | 'map' | 'schedule';

interface ScheduleItem {
  time?: string;
  departure_time?: string;
  title?: string;
  name?: string;
  [key: string]: unknown;
}

export default function RoomShell({
  title,
  subtitle,
  lifecycle,
  connection,
  locale,
  schedule,
  chat,
}: {
  title: string;
  subtitle?: string;
  lifecycle: 'lobby' | 'live' | 'ended';
  connection: RoomConnection;
  locale: RoomLocale;
  schedule: ScheduleItem[];
  /** Chat tab content (feed + composer), supplied by the page. */
  chat: ReactNode;
}) {
  const [tab, setTab] = useState<RoomTab>('chat');
  const badge = LIFECYCLE_BADGE[lifecycle] ?? LIFECYCLE_BADGE.live;
  const labels = TAB_LABEL[locale];

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col px-4 pb-4 pt-5">
      <header className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-[12px] text-gray-500">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-2">
          <span className={`h-2 w-2 rounded-full ${CONNECTION_DOT[connection]}`} title={connection} />
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
        </div>
      </header>

      <div className="mt-3">
        <EmergencyCard locale={locale} />
      </div>

      <nav className="mt-3 flex gap-1 rounded-2xl bg-gray-100 p-1" role="tablist">
        {(['chat', 'map', 'schedule'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-xl py-2 text-[13px] font-medium transition ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {labels[key]}
          </button>
        ))}
      </nav>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {tab === 'chat' && chat}
        {tab === 'map' && (
          <div className="flex flex-1 items-center justify-center text-[13px] text-gray-400">
            🗺 {MAP_SOON[locale]}
          </div>
        )}
        {tab === 'schedule' && (
          <ol className="space-y-2 overflow-y-auto">
            {schedule.length === 0 && <p className="pt-10 text-center text-[13px] text-gray-400">—</p>}
            {schedule.map((item, index) => (
              <li key={index} className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
                <div className="text-[13px] font-medium text-gray-900">
                  {String(item.title ?? item.name ?? '')}
                </div>
                <div className="mt-0.5 text-[12px] text-gray-500">
                  {[item.time, item.departure_time ? `🚌 ${item.departure_time}` : null].filter(Boolean).join(' · ')}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
