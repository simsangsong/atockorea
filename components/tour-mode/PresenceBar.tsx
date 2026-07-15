'use client';

/**
 * T3.5 — who's here right now, from Realtime Presence (join/leave sync).
 * Guide first, then travellers; initial-letter chips with a live dot.
 * Presence entries disappear within the channel's presence timeout (~30s)
 * of a closed tab — no polling, no server writes.
 */

import Avatar from '@/components/tour-mode/Avatar';
import type { RoomPresence } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const ONLINE_LABEL: Record<RoomLocale, (n: number) => string> = {
  en: (n) => `${n} online`,
  ko: (n) => `${n}명 접속 중`,
  ja: (n) => `${n}人オンライン`,
  es: (n) => `${n} en línea`,
  zh: (n) => `${n}人在线`,
};

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
    <div className="tr-card flex items-center gap-2 overflow-x-auto px-3 py-2" data-testid="presence-bar">
      <span className="tr-meta flex shrink-0 items-center gap-1 font-medium text-[var(--tr-safe)]">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {ONLINE_LABEL[locale](presence.length)}
      </span>
      <div className="flex items-center gap-1">
        {ordered.slice(0, 12).map((entry) => (
          <span
            key={entry.participantId}
            title={entry.displayName}
            className={`rounded-full ${
              entry.participantId === myParticipantId ? 'ring-2 ring-[var(--tr-safe)] ring-offset-1' : ''
            }`}
          >
            <Avatar role={entry.role} name={entry.displayName} size={24} />
          </span>
        ))}
        {ordered.length > 12 && (
          <span className="tr-meta text-[var(--tr-ink-3)]">+{ordered.length - 12}</span>
        )}
      </div>
    </div>
  );
}
