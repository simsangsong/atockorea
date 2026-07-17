'use client';

/**
 * W2.4 — guest one-tap SIGNAL chips (§D SIGNAL: no free text, 2 taps max).
 * Three fixed signals above the composer: running late (B6), rest stop (C2),
 * lost (E3 — attaches a one-shot location pin when the guest allows it).
 * Fires POST /signals; the server fans out the 5-locale capsule.
 */

import { useState } from 'react';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  { late: string; rest: string; lost: string; lostConfirm: string; sent: string }
> = {
  en: {
    late: '🕒 Running late',
    rest: '🚻 Need a stop',
    lost: '🧭 I’m lost',
    lostConfirm: 'Share your current location with the guide once?',
    sent: 'Sent to your guide ✓',
  },
  ko: {
    late: '🕒 늦어요',
    rest: '🚻 잠깐 서고 싶어요',
    lost: '🧭 길을 잃었어요',
    lostConfirm: '현재 위치를 가이드에게 1회 공유할까요?',
    sent: '가이드에게 전달됐어요 ✓',
  },
  ja: {
    late: '🕒 遅れています',
    rest: '🚻 少し止まりたい',
    lost: '🧭 道に迷いました',
    lostConfirm: '現在地をガイドに1回共有しますか?',
    sent: 'ガイドに送信しました ✓',
  },
  es: {
    late: '🕒 Voy tarde',
    rest: '🚻 Necesito parar',
    lost: '🧭 Estoy perdido',
    lostConfirm: '¿Compartir tu ubicación actual con el guía una vez?',
    sent: 'Enviado a tu guía ✓',
  },
  zh: {
    late: '🕒 我会迟到',
    rest: '🚻 想停一下',
    lost: '🧭 我迷路了',
    lostConfirm: '向导游一次性共享当前位置?',
    sent: '已发送给导游 ✓',
  },
};

async function currentPosition(timeoutMs = 6000): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

export default function QuickSignalBar({
  bookingId,
  roomSession,
  locale,
}: {
  bookingId: string;
  roomSession: string;
  locale: RoomLocale;
}) {
  const copy = COPY[locale];
  const [busy, setBusy] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);

  const fire = async (type: 'running_late' | 'rest_stop' | 'lost') => {
    setBusy(type);
    try {
      let coords: { lat: number; lng: number } | null = null;
      if (type === 'lost' && window.confirm(copy.lostConfirm)) {
        coords = await currentPosition();
      }
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({ type, ...(coords ?? {}) }),
      });
      if (res.ok) setSentAt(Date.now());
    } catch {
      /* the chat composer remains the fallback */
    } finally {
      setBusy(null);
    }
  };

  const justSent = Date.now() - sentAt < 4000;

  return (
    <div className="mb-1.5 flex items-center gap-1.5 overflow-x-auto" data-testid="quick-signal-bar">
      {justSent ? (
        <span className="tr-label px-1 py-1 font-semibold text-[var(--tr-safe)]" aria-live="polite">
          {copy.sent}
        </span>
      ) : (
        (
          [
            ['running_late', copy.late],
            ['rest_stop', copy.rest],
            ['lost', copy.lost],
          ] as Array<['running_late' | 'rest_stop' | 'lost', string]>
        ).map(([type, label]) => (
          <button
            key={type}
            type="button"
            disabled={busy !== null}
            onClick={() => void fire(type)}
            className="tr-label shrink-0 rounded-full bg-[var(--tr-accent-soft)] px-3 py-1.5 font-semibold text-[var(--tr-accent-deep)] disabled:opacity-50"
            data-testid={`signal-${type}`}
          >
            {busy === type ? '…' : label}
          </button>
        ))
      )}
    </div>
  );
}
