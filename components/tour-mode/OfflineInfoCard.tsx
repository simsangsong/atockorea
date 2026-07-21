'use client';

/**
 * W4.2 / E6 → J3 — the offline safety net, now ENCRYPTED. While the room is
 * healthy we silently snapshot the essentials (meeting target, next stops,
 * the latest arrival guidance, emergency numbers) into the AES-GCM offline
 * vault (IndexedDB, key derived from the room session — never stored); when
 * the device drops offline mid-tour the card decrypts and renders those
 * facts instead of a dead screen. The old PLAINTEXT localStorage snapshot is
 * removed on sight (content-protection requirement, 2026-07-22).
 */

import { useEffect, useState } from 'react';
import { activeNotice, formatTargetTime } from '@/lib/tour-room/notices';
import { loadVault, saveVault } from '@/lib/tour-room/offlineVault';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  { title: string; meeting: string; nextStops: string; numbers: string; note: string }
> = {
  en: {
    title: '📴 You’re offline — saved info',
    meeting: 'Meeting',
    nextStops: 'Today',
    numbers: 'Emergency: 119 (medical) · 112 (police) · 1330 (interpreter)',
    note: 'The room reconnects automatically when signal returns.',
  },
  ko: {
    title: '📴 오프라인 — 저장된 정보',
    meeting: '집합',
    nextStops: '오늘 일정',
    numbers: '긴급: 119(구급) · 112(경찰) · 1330(통역)',
    note: '신호가 돌아오면 자동으로 다시 연결돼요.',
  },
  ja: {
    title: '📴 オフライン — 保存済み情報',
    meeting: '集合',
    nextStops: '本日',
    numbers: '緊急: 119(救急) · 112(警察) · 1330(通訳)',
    note: '電波が戻ると自動的に再接続します。',
  },
  es: {
    title: '📴 Sin conexión — información guardada',
    meeting: 'Reunión',
    nextStops: 'Hoy',
    numbers: 'Emergencias: 119 (médica) · 112 (policía) · 1330 (intérprete)',
    note: 'La sala se reconecta sola al volver la señal.',
  },
  zh: {
    title: '📴 已离线 — 已保存的信息',
    meeting: '集合',
    nextStops: '今日',
    numbers: '紧急: 119(急救) · 112(警察) · 1330(翻译)',
    note: '信号恢复后将自动重新连接。',
  },
};

interface SavedInfo {
  meeting: string | null;
  stops: string[];
  /** J3 — the latest arrival guidance (guest-locale bundle text). */
  guidance: string | null;
  savedAt: number;
}

/** Pre-J3 plaintext snapshot key — purged on sight (content protection). */
const LEGACY_KEY = (bookingId: string) => `tour_mode_offline:${bookingId}`;

export default function OfflineInfoCard({
  bookingId,
  roomSession,
  locale,
  tourDate,
  messages,
  schedule,
}: {
  bookingId: string;
  /** J3 — derives the vault key; without it nothing is persisted. */
  roomSession: string;
  locale: RoomLocale;
  tourDate: string | null | undefined;
  messages: RoomMessage[];
  schedule: Array<Record<string, unknown>>;
}) {
  const copy = COPY[locale];
  const [offline, setOffline] = useState(false);
  const [saved, setSaved] = useState<SavedInfo | null>(null);

  // Keep the ENCRYPTED snapshot fresh while online (fire-and-forget).
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      window.localStorage.removeItem(LEGACY_KEY(bookingId)); // purge plaintext
    } catch {
      /* ignore */
    }
    try {
      const notice = activeNotice(messages, tourDate);
      const meeting =
        notice && !notice.cancelled
          ? `${notice.targetMs ? formatTargetTime(notice.targetMs, locale) : ''}${notice.point ? ` @ ${notice.point}` : ''}`.trim()
          : null;
      const stops = (schedule ?? [])
        .map((item) => {
          const time = typeof item.time === 'string' ? `${item.time} ` : '';
          const title = typeof item.title === 'string' ? item.title : '';
          return `${time}${title}`.trim();
        })
        .filter(Boolean)
        .slice(0, 8);
      // Latest arrival bundle = the full guidance for the current stop
      // (meeting, follow/free, ticket price, route note) in the guest locale.
      let guidance: string | null = null;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message.metadata?.kind !== 'arrival_bundle') continue;
        guidance = message.translations?.[locale] ?? message.source_text ?? null;
        break;
      }
      const payload: SavedInfo = { meeting, stops, guidance, savedAt: Date.now() };
      void saveVault(roomSession, bookingId, payload).catch(() => undefined);
    } catch {
      /* best effort */
    }
  }, [bookingId, roomSession, locale, messages, schedule, tourDate]);

  useEffect(() => {
    const sync = () => {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      setOffline(isOffline);
      if (isOffline) {
        void loadVault<SavedInfo>(roomSession, bookingId)
          .then((value) => setSaved(value))
          .catch(() => setSaved(null));
      }
    };
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, [bookingId, roomSession]);

  if (!offline) return null;

  return (
    <div
      data-testid="offline-info-card"
      className="mb-2 rounded-[var(--tr-radius-card)] border border-[var(--tr-danger-soft)] bg-[var(--tr-surface)] px-4 py-3"
      style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
    >
      <p className="tr-card-text font-bold text-[var(--tr-danger)]">{copy.title}</p>
      {saved?.meeting && (
        <p className="tr-card-text mt-1 text-[var(--tr-ink)]">
          <span className="font-semibold">{copy.meeting}:</span> {saved.meeting}
        </p>
      )}
      {saved && saved.stops.length > 0 && (
        <p className="tr-label mt-1 text-[var(--tr-ink-2)]">
          <span className="font-semibold">{copy.nextStops}:</span> {saved.stops.join(' → ')}
        </p>
      )}
      {saved?.guidance && (
        <p className="tr-label mt-1.5 whitespace-pre-line text-[var(--tr-ink-2)]" data-testid="offline-guidance">
          {saved.guidance}
        </p>
      )}
      <p className="tr-label mt-1.5 text-[var(--tr-ink)]">{copy.numbers}</p>
      <p className="tr-meta mt-1 text-[var(--tr-ink-3)]">{copy.note}</p>
    </div>
  );
}
