'use client';

/**
 * T1.11 / §O-1 ⑥ — lobby view: what a traveller sees when they open their
 * room link before the tour day. No error screen, no dead end — a warm
 * D-day countdown, the pickup plan, and a nudge that the chat below already
 * works (guide greetings land here as ordinary messages).
 *
 * Static 5-locale constants, zero LLM calls — same pattern as entryCopy /
 * emergency.ts, so the card renders offline from the join snapshot.
 */

import { kstDaysUntil } from '@/lib/tour-room/time';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

interface PickupPoint {
  name?: string | null;
  address?: string | null;
  pickup_time?: string | null;
}

const COPY: Record<
  RoomLocale,
  {
    dday: (n: number) => string;
    title: string;
    meetOn: string;
    pickupTitle: string;
    chatHint: string;
  }
> = {
  en: {
    dday: (n) => (n === 0 ? 'Today' : `D-${n}`),
    title: 'Your tour room is ready',
    meetOn: 'We meet on',
    pickupTitle: 'Pickup',
    chatHint: 'Messages from your guide will arrive here. Questions? Ask below anytime.',
  },
  ko: {
    dday: (n) => (n === 0 ? '오늘' : `D-${n}`),
    title: '투어룸이 준비됐어요',
    meetOn: '만나는 날',
    pickupTitle: '픽업',
    chatHint: '가이드의 안내 메시지가 여기에 도착해요. 궁금한 점은 지금 남겨도 좋아요.',
  },
  ja: {
    dday: (n) => (n === 0 ? '本日' : `あと${n}日`),
    title: 'ツアールームの準備ができました',
    meetOn: '集合日',
    pickupTitle: 'お迎え',
    chatHint: 'ガイドからのご案内はここに届きます。ご質問はいつでもどうぞ。',
  },
  es: {
    dday: (n) => (n === 0 ? 'Hoy' : `Faltan ${n} días`),
    title: 'Tu sala de tour está lista',
    meetOn: 'Nos vemos el',
    pickupTitle: 'Recogida',
    chatHint: 'Los mensajes de tu guía llegarán aquí. ¿Preguntas? Escríbenos abajo.',
  },
  zh: {
    dday: (n) => (n === 0 ? '今天' : `还有${n}天`),
    title: '您的旅行房间已就绪',
    meetOn: '集合日期',
    pickupTitle: '接送',
    chatHint: '导游的通知会显示在这里。有问题随时在下方留言。',
  },
};

function firstPickup(pickupPoints: unknown): PickupPoint | null {
  if (!pickupPoints) return null;
  const point = Array.isArray(pickupPoints) ? pickupPoints[0] : pickupPoints;
  if (!point || typeof point !== 'object') return null;
  return point as PickupPoint;
}

export default function LobbyCard({
  locale,
  tourDate,
  tourTime,
  pickupPoints,
}: {
  locale: RoomLocale;
  tourDate: string | null;
  tourTime?: string | null;
  pickupPoints?: unknown;
}) {
  const copy = COPY[locale];
  const pickup = firstPickup(pickupPoints);
  const days = tourDate ? kstDaysUntil(tourDate) : null;
  const time = tourTime ? String(tourTime).slice(0, 5) : null;

  return (
    <div
      data-testid="lobby-card"
      className="mb-2 rounded-2xl bg-gradient-to-br from-sky-50 to-white px-4 py-4 shadow-sm ring-1 ring-sky-100 dark:from-sky-950 dark:to-gray-900 dark:ring-sky-900"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-50">✨ {copy.title}</p>
        {days !== null && (
          <span className="shrink-0 rounded-full bg-sky-500 px-3 py-1 text-[13px] font-bold text-white">
            {copy.dday(days)}
          </span>
        )}
      </div>

      {tourDate && (
        <p className="mt-2 text-[13px] text-gray-600 dark:text-gray-300">
          📅 {copy.meetOn} <span className="font-semibold text-gray-900 dark:text-gray-100">{tourDate}</span>
          {time && <span className="font-semibold text-gray-900 dark:text-gray-100"> · {time}</span>}
        </p>
      )}

      {pickup && (pickup.name || pickup.address) && (
        <div className="mt-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
          <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">🚌 {copy.pickupTitle}</p>
          {pickup.name && (
            <p className="mt-0.5 text-[13px] font-medium text-gray-900 dark:text-gray-100">
              {pickup.name}
              {pickup.pickup_time && (
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {' '}
                  · {String(pickup.pickup_time).slice(0, 5)}
                </span>
              )}
            </p>
          )}
          {pickup.address && <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">{pickup.address}</p>}
        </div>
      )}

      <p className="mt-2.5 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">{copy.chatHint}</p>
    </div>
  );
}
