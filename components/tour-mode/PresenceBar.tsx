'use client';

/**
 * T3.5 — who's here right now, from Realtime Presence (join/leave sync).
 * Guide first, then travellers; initial-letter chips with a live dot.
 * Presence entries disappear within the channel's presence timeout (~30s)
 * of a closed tab — no polling, no server writes.
 */

import type { RoomPresence } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const ONLINE_LABEL: Record<RoomLocale, (n: number) => string> = {
  en: (n) => `${n} online`,
  ko: (n) => `${n}명 접속 중`,
  ja: (n) => `${n}人オンライン`,
  es: (n) => `${n} en línea`,
  zh: (n) => `${n}人在线`,
};

function initialOf(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export default function PresenceBar({
  presence,
  locale,
  myParticipantId,
}: {
  presence: RoomPresence[];
  locale: RoomLocale;
  myParticipantId?: string | null;
}) {
  if (presence.length === 0) return null;
  const ordered = [...presence].sort((a, b) => {
    const rank = (p: RoomPresence) => (p.role === 'guide' ? 0 : p.role === 'admin' ? 1 : 2);
    return rank(a) - rank(b);
  });

  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800" data-testid="presence-bar">
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {ONLINE_LABEL[locale](presence.length)}
      </span>
      <div className="flex items-center gap-1">
        {ordered.slice(0, 12).map((entry) => (
          <span
            key={entry.participantId}
            title={entry.displayName}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              entry.role === 'guide'
                ? 'bg-amber-500 text-white'
                : entry.participantId === myParticipantId
                  ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300 dark:bg-emerald-900 dark:text-emerald-200'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {entry.role === 'guide' ? '🚩' : initialOf(entry.displayName)}
          </span>
        ))}
        {ordered.length > 12 && (
          <span className="text-[10px] text-gray-400">+{ordered.length - 12}</span>
        )}
      </div>
    </div>
  );
}
