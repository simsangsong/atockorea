'use client';

/**
 * W2.5 — the sub-rally Tier-0 card (P-D8 ladder tail): delay ETA →
 * vehicle-find pin → pending settlement. One compact card in the banner
 * zone; suppressed entirely while a rally/free-time notice is active
 * (NoticeBanner owns the top slot) so exactly one card shows.
 */

import { useEffect, useState } from 'react';
import { activeNotice } from '@/lib/tour-room/notices';
import { secondaryCard } from '@/lib/tour-room/activeCard';
import { formatKrw } from '@/lib/tour-room/ledger';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  {
    delay: (m: number) => string;
    parking: string;
    arrived: string;
    open: string;
    settlement: (n: number, total: string) => string;
  }
> = {
  en: {
    delay: (m) => `🚐 Vehicle running ~${m} min behind — thanks for waiting.`,
    parking: '🅿️ Vehicle parked — tap for the walking pin.',
    arrived: '🚐 Your vehicle has arrived — tap for the pin.',
    open: 'Map',
    settlement: (n, total) => `💰 ${n} expense${n > 1 ? 's' : ''} to confirm (${total}) — check the chat.`,
  },
  ko: {
    delay: (m) => `🚐 차량이 약 ${m}분 늦어요 — 조금만 기다려 주세요.`,
    parking: '🅿️ 차량이 주차됐어요 — 위치 핀을 확인하세요.',
    arrived: '🚐 차량이 도착했어요 — 위치 핀을 확인하세요.',
    open: '지도',
    settlement: (n, total) => `💰 확인할 지출 ${n}건 (${total}) — 채팅에서 확인해 주세요.`,
  },
  ja: {
    delay: (m) => `🚐 車両が約${m}分遅れています — 少々お待ちください。`,
    parking: '🅿️ 車両が駐車しました — 位置ピンをご確認ください。',
    arrived: '🚐 車両が到着しました — 位置ピンをご確認ください。',
    open: '地図',
    settlement: (n, total) => `💰 ご確認待ちの支出${n}件 (${total}) — チャットでご確認ください。`,
  },
  es: {
    delay: (m) => `🚐 El vehículo llega ~${m} min tarde; gracias por esperar.`,
    parking: '🅿️ Vehículo estacionado: toca para ver el pin.',
    arrived: '🚐 Tu vehículo llegó: toca para ver el pin.',
    open: 'Mapa',
    settlement: (n, total) => `💰 ${n} gasto${n > 1 ? 's' : ''} por confirmar (${total}); revisa el chat.`,
  },
  zh: {
    delay: (m) => `🚐 车辆约晚${m}分钟——请稍候。`,
    parking: '🅿️ 车辆已停好——点按查看位置。',
    arrived: '🚐 车辆已到达——点按查看位置。',
    open: '地图',
    settlement: (n, total) => `💰 待确认支出${n}笔 (${total})——请在聊天中确认。`,
  },
};

export default function SecondaryCardBanner({
  messages,
  tourDate,
  locale,
}: {
  messages: RoomMessage[];
  tourDate: string | null | undefined;
  locale: RoomLocale;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // The rally/free-time notice owns the top slot — one card at a time (P-D8).
  if (activeNotice(messages, tourDate, nowMs)) return null;
  const card = secondaryCard(messages, nowMs);
  if (!card) return null;
  const copy = COPY[locale];

  return (
    <div
      data-testid="secondary-card"
      className="mb-2 flex items-center gap-3 rounded-[var(--tr-radius-card)] bg-[var(--tr-surface)] px-4 py-2.5"
      style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
    >
      <p className="tr-card-text min-w-0 flex-1 font-medium text-[var(--tr-ink)]">
        {card.kind === 'delay' && copy.delay(card.minutes)}
        {card.kind === 'vehicle' && (card.pin === 'parking' ? copy.parking : copy.arrived)}
        {card.kind === 'settlement' && copy.settlement(card.count, formatKrw(card.totalKrw))}
      </p>
      {card.kind === 'vehicle' && (
        <a
          href={card.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="tr-label shrink-0 rounded-full bg-[var(--tr-accent)] px-3 py-1.5 font-bold text-[var(--tr-bubble-me-ink)]"
        >
          {copy.open}
        </a>
      )}
    </div>
  );
}
