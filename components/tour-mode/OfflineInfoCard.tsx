'use client';

/**
 * W4.2 / E6 — the offline safety net. While the room is healthy we silently
 * snapshot the essentials (meeting target, next stops, emergency numbers)
 * into localStorage; when the device drops offline mid-tour the card renders
 * those saved facts instead of a dead screen. No service-worker HTML caching
 * — this covers the realistic case (app already open, signal gone).
 */

import { useEffect, useState } from 'react';
import { activeNotice, formatTargetTime } from '@/lib/tour-room/notices';
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
  savedAt: number;
}

const storageKey = (bookingId: string) => `tour_mode_offline:${bookingId}`;

export default function OfflineInfoCard({
  bookingId,
  locale,
  tourDate,
  messages,
  schedule,
}: {
  bookingId: string;
  locale: RoomLocale;
  tourDate: string | null | undefined;
  messages: RoomMessage[];
  schedule: Array<Record<string, unknown>>;
}) {
  const copy = COPY[locale];
  const [offline, setOffline] = useState(false);
  const [saved, setSaved] = useState<SavedInfo | null>(null);

  // Keep the snapshot fresh while online.
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
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
      window.localStorage.setItem(storageKey(bookingId), JSON.stringify({ meeting, stops, savedAt: Date.now() }));
    } catch {
      /* best effort */
    }
  }, [bookingId, locale, messages, schedule, tourDate]);

  useEffect(() => {
    const sync = () => {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      setOffline(isOffline);
      if (isOffline) {
        try {
          const raw = window.localStorage.getItem(storageKey(bookingId));
          setSaved(raw ? (JSON.parse(raw) as SavedInfo) : null);
        } catch {
          setSaved(null);
        }
      }
    };
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, [bookingId]);

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
      <p className="tr-label mt-1.5 text-[var(--tr-ink)]">{copy.numbers}</p>
      <p className="tr-meta mt-1 text-[var(--tr-ink-3)]">{copy.note}</p>
    </div>
  );
}
