'use client';

/**
 * W4.1 / P-D7 — guest Web Push opt-in, restrained by design: one dismissible
 * banner, two critical kinds only (rally target + delay). The PwaRegistrar
 * already registered /sw-tour-mode.js on the /tour-mode scope; this banner
 * asks permission, subscribes, and posts the capability URL to the booking-
 * scoped subscribe API. Unsupported browsers / missing VAPID key / denied
 * permission → renders nothing.
 */

import { useEffect, useRef, useState } from 'react';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  { text: string; enable: string; later: string; done: string; failed: string; blocked: string; stopped: string }
> = {
  en: {
    text: '🔔 Get a ping for meeting times and vehicle delays?',
    enable: 'Turn on',
    later: 'Later',
    done: 'Notifications on — only meeting times and delays.',
    failed: "Couldn't turn these on — tap to try again.",
    blocked: 'Notifications are blocked. Allow them in your browser settings, then reopen.',
    stopped: "Notifications can't be turned on right now. Please try again later.",
  },
  ko: {
    text: '🔔 집합 시간·차량 지연 알림을 받아볼까요?',
    enable: '켜기',
    later: '나중에',
    done: '알림 켜짐 — 집합·지연만 알려드려요.',
    failed: '알림을 켜지 못했어요 — 다시 시도해 주세요.',
    blocked: '브라우저에서 알림이 차단돼 있어요. 설정에서 허용한 뒤 다시 열어주세요.',
    stopped: '지금은 알림을 켤 수 없어요. 잠시 후 다시 시도해 주세요.',
  },
  ja: {
    text: '🔔 集合時間・車両遅延の通知を受け取りますか?',
    enable: 'オンにする',
    later: '後で',
    done: '通知オン — 集合と遅延のみお知らせします。',
    failed: '通知をオンにできませんでした — もう一度お試しください。',
    blocked: '通知がブロックされています。ブラウザの設定で許可してから開き直してください。',
    stopped: '今は通知をオンにできません。しばらくしてからお試しください。',
  },
  es: {
    text: '🔔 ¿Recibir avisos de hora de reunión y retrasos del vehículo?',
    enable: 'Activar',
    later: 'Luego',
    done: 'Avisos activados: solo reuniones y retrasos.',
    failed: 'No se pudieron activar — toca para reintentar.',
    blocked: 'Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador y vuelve a abrir.',
    stopped: 'No se pueden activar ahora. Inténtalo de nuevo más tarde.',
  },
  zh: {
    text: '🔔 接收集合时间和车辆延误提醒?',
    enable: '开启',
    later: '以后',
    done: '已开启提醒——仅限集合与延误。',
    failed: '未能开启提醒 — 请再试一次。',
    blocked: '通知已被浏览器阻止。请在设置中允许后重新打开。',
    stopped: '暂时无法开启提醒，请稍后再试。',
  },
  fr: {
    text: '🔔 Recevoir une alerte pour les heures de rendez-vous et les retards du véhicule?',
    enable: 'Activer',
    later: 'Plus tard',
    done: 'Notifications activées — rendez-vous et retards uniquement.',
    failed: 'Activation impossible — touchez pour réessayer.',
    blocked: 'Les notifications sont bloquées. Autorisez-les dans les réglages du navigateur, puis rouvrez.',
    stopped: 'Impossible d’activer les notifications pour l’instant. Réessayez plus tard.',
  },
  de: {
    text: '🔔 Benachrichtigung bei Treffzeiten und Fahrzeugverspätungen erhalten?',
    enable: 'Aktivieren',
    later: 'Später',
    done: 'Benachrichtigungen an — nur Treffzeiten und Verspätungen.',
    failed: 'Aktivierung fehlgeschlagen — zum erneuten Versuch tippen.',
    blocked: 'Benachrichtigungen sind blockiert. Erlauben Sie sie in den Browser-Einstellungen und öffnen Sie neu.',
    stopped: 'Benachrichtigungen lassen sich gerade nicht aktivieren. Bitte später erneut versuchen.',
  },
  ru: {
    text: '🔔 Присылать уведомления о времени сбора и задержках машины?',
    enable: 'Включить',
    later: 'Позже',
    done: 'Уведомления включены — только время сбора и задержки.',
    failed: 'Не удалось включить — нажмите, чтобы повторить.',
    blocked: 'Уведомления заблокированы. Разрешите их в настройках браузера и откройте заново.',
    stopped: 'Сейчас включить уведомления не получается. Попробуйте позже.',
  },
  it: {
    text: '🔔 Vuoi un avviso per orari di ritrovo e ritardi del veicolo?',
    enable: 'Attiva',
    later: 'Più tardi',
    done: 'Avvisi attivi — solo ritrovi e ritardi.',
    failed: 'Attivazione non riuscita — tocca per riprovare.',
    blocked: 'Le notifiche sono bloccate. Consentile nelle impostazioni del browser e riapri.',
    stopped: 'Al momento non è possibile attivare gli avvisi. Riprova più tardi.',
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
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed' | 'blocked' | 'stopped'>('idle');
  // P0-4: bound the retries so the banner can never become an infinite
  // "tap to try again" loop when the environment simply can't subscribe.
  const attemptsRef = useRef(0);

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

  // P0-4: a failure is either a one-off (offer a single retry) or persistent
  // (the environment/config can't subscribe — stop, say so accurately, and let
  // the guest dismiss). Never loop a generic "try again" forever.
  const fail = () => {
    attemptsRef.current += 1;
    setState(attemptsRef.current >= 2 ? 'stopped' : 'failed');
  };

  const enable = async () => {
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        // Denied/blocked is an accurate, actionable reason — show it rather
        // than silently vanishing or looping a generic retry.
        setState('blocked');
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
      // A1.6 — the subscription exists in the browser but the server never
      // stored it, so nothing will ever be delivered; surface it rather than
      // reverting to the untouched look (which reads as "not enabled yet").
      fail();
    } catch {
      // subscribe() throwing (unsupported context / invalid VAPID key) or a
      // network error — both handled by the bounded retry ladder.
      fail();
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
              state === 'failed' || state === 'blocked'
                ? 'font-medium text-[var(--tr-danger)]'
                : state === 'stopped'
                  ? 'text-[var(--tr-ink-2)]'
                  : 'text-[var(--tr-ink)]'
            }`}
            data-testid={
              state === 'failed'
                ? 'push-failed'
                : state === 'blocked'
                  ? 'push-blocked'
                  : state === 'stopped'
                    ? 'push-stopped'
                    : undefined
            }
          >
            {state === 'blocked'
              ? copy.blocked
              : state === 'stopped'
                ? copy.stopped
                : state === 'failed'
                  ? copy.failed
                  : copy.text}
          </p>
          {/* Terminal states (blocked / stopped) offer no retry — dismiss only. */}
          {state !== 'blocked' && state !== 'stopped' && (
            <button
              type="button"
              disabled={state === 'busy'}
              onClick={() => void enable()}
              className="tr-label shrink-0 rounded-full bg-[var(--tr-accent)] px-3 py-1.5 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-50"
              data-testid="push-enable"
            >
              {state === 'busy' ? '…' : copy.enable}
            </button>
          )}
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
