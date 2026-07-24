'use client';

/**
 * W4.1 / P-D7 — guest Web Push opt-in, restrained by design: one dismissible
 * banner, two critical kinds only (rally target + delay). The PwaRegistrar
 * already registered /sw-tour-mode.js on the /tour-mode scope; this banner
 * asks permission, subscribes, and posts the capability URL to the booking-
 * scoped subscribe API. Unsupported browsers / missing VAPID key / denied
 * permission → renders nothing.
 */

import { useEffect, useState } from 'react';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  { text: string; enable: string; later: string; done: string; failed: string }
> = {
  en: {
    text: '🔔 Get a ping for meeting times and vehicle delays?',
    enable: 'Turn on',
    later: 'Later',
    done: 'Notifications on — only meeting times and delays.',
    failed: "Couldn't turn these on — tap to try again.",
  },
  ko: {
    text: '🔔 집합 시간·차량 지연 알림을 받아볼까요?',
    enable: '켜기',
    later: '나중에',
    done: '알림 켜짐 — 집합·지연만 알려드려요.',
    failed: '알림을 켜지 못했어요 — 다시 시도해 주세요.',
  },
  ja: {
    text: '🔔 集合時間・車両遅延の通知を受け取りますか?',
    enable: 'オンにする',
    later: '後で',
    done: '通知オン — 集合と遅延のみお知らせします。',
    failed: '通知をオンにできませんでした — もう一度お試しください。',
  },
  es: {
    text: '🔔 ¿Recibir avisos de hora de reunión y retrasos del vehículo?',
    enable: 'Activar',
    later: 'Luego',
    done: 'Avisos activados: solo reuniones y retrasos.',
    failed: 'No se pudieron activar — toca para reintentar.',
  },
  zh: {
    text: '🔔 接收集合时间和车辆延误提醒?',
    enable: '开启',
    later: '以后',
    done: '已开启提醒——仅限集合与延误。',
    failed: '未能开启提醒 — 请再试一次。',
  },
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

const stateKey = (bookingId: string) => `tour_mode_push_optin:${bookingId}`;

export default function PushOptInBanner({
  bookingId,
  roomSession,
  locale,
}: {
  bookingId: string;
  roomSession: string;
  locale: RoomLocale;
}) {
  const copy = COPY[locale];
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');

  useEffect(() => {
    // Deferred a beat: the room settles first, then the (dismissible) ask.
    const timer = setTimeout(() => {
      try {
        if (
          !('serviceWorker' in navigator) ||
          !('PushManager' in window) ||
          !('Notification' in window) ||
          !process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ||
          Notification.permission === 'denied' ||
          window.localStorage.getItem(stateKey(bookingId))
        ) {
          return;
        }
        setVisible(true);
      } catch {
        /* stay hidden */
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [bookingId]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(stateKey(bookingId), 'dismissed');
    } catch {
      /* session-only dismiss */
    }
    setVisible(false);
  };

  const enable = async () => {
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        dismiss();
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY!)
          .buffer as ArrayBuffer,
      });
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/push-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (res.ok) {
        try {
          window.localStorage.setItem(stateKey(bookingId), 'subscribed');
        } catch {
          /* noop */
        }
        setState('done');
        setTimeout(() => setVisible(false), 3000);
        return;
      }
      // 🔴 A1.6 — the subscription exists in the browser but the server never
      // stored it, so nothing will ever be delivered. Falling back to 'idle'
      // put the banner back to its untouched look, which reads as "not enabled
      // yet" to a guest who just granted OS permission and would otherwise wait
      // for a departure ping that cannot arrive.
      setState('failed');
    } catch {
      setState('failed');
    }
  };

  return (
    <div
      data-testid="push-optin-banner"
      className="mb-2 flex items-center gap-2.5 rounded-[var(--tr-radius-card)] bg-[var(--tr-surface)] px-4 py-2.5"
      style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
    >
      {state === 'done' ? (
        <p className="tr-label flex-1 font-medium text-[var(--tr-safe)]">{copy.done}</p>
      ) : (
        <>
          <p
            className={`tr-label min-w-0 flex-1 ${
              state === 'failed' ? 'font-medium text-[var(--tr-danger)]' : 'text-[var(--tr-ink)]'
            }`}
            data-testid={state === 'failed' ? 'push-failed' : undefined}
          >
            {state === 'failed' ? copy.failed : copy.text}
          </p>
          <button
            type="button"
            disabled={state === 'busy'}
            onClick={() => void enable()}
            className="tr-label shrink-0 rounded-full bg-[var(--tr-accent)] px-3 py-1.5 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-50"
            data-testid="push-enable"
          >
            {state === 'busy' ? '…' : copy.enable}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="tr-meta shrink-0 px-1 font-medium text-[var(--tr-ink-3)]"
          >
            {copy.later}
          </button>
        </>
      )}
    </div>
  );
}
