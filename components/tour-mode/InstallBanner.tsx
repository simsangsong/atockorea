'use client';

/**
 * W1.2 — "add to home screen" banner for the Tour Room PWA.
 *
 * Android/Chrome: captures `beforeinstallprompt` and offers a one-tap install.
 * iOS Safari: no programmatic install exists, so a short share-sheet guide is
 * shown instead. Hidden when already running standalone, inside an in-app
 * webview (the escape banner owns that case), or after one dismissal
 * (localStorage). W5.1 layers tour-day gating on top of this component.
 */

import { useEffect, useState } from 'react';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import { detectEntryLocale } from '@/components/tour-mode/entryCopy';
import { isInAppWebview } from '@/components/tour-mode/WebviewEscapeBanner';
import { isStandaloneDisplayMode } from '@/hooks/useStandaloneDisplayMode';

const DISMISS_KEY = 'atoc-tour-mode-a2hs-dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const COPY: Record<RoomLocale, { title: string; body: string; install: string; iosGuide: string; dismiss: string }> = {
  en: {
    title: 'Add Tour Room to your home screen',
    body: 'One tap from your home screen straight into your live tour.',
    install: 'Install',
    iosGuide: 'Tap the share icon, then "Add to Home Screen".',
    dismiss: 'Not now',
  },
  ko: {
    title: '투어룸을 홈 화면에 추가하세요',
    body: '홈 화면에서 한 번의 탭으로 실시간 투어룸에 바로 들어올 수 있어요.',
    install: '설치',
    iosGuide: '공유 버튼을 누른 뒤 "홈 화면에 추가"를 선택하세요.',
    dismiss: '나중에',
  },
  ja: {
    title: 'ツアールームをホーム画面に追加',
    body: 'ホーム画面からワンタップでライブツアールームへ。',
    install: 'インストール',
    iosGuide: '共有ボタンをタップして「ホーム画面に追加」を選択してください。',
    dismiss: 'あとで',
  },
  es: {
    title: 'Añade Tour Room a tu pantalla de inicio',
    body: 'Un toque desde tu pantalla de inicio directo a tu tour en vivo.',
    install: 'Instalar',
    iosGuide: 'Toca el icono de compartir y luego "Añadir a pantalla de inicio".',
    dismiss: 'Ahora no',
  },
  zh: {
    title: '将旅行房间添加到主屏幕',
    body: '从主屏幕一键直达您的实时旅行房间。',
    install: '安装',
    iosGuide: '点按分享按钮，然后选择"添加到主屏幕"。',
    dismiss: '暂不',
  },
};

function isIosSafari(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export default function InstallBanner() {
  const [mode, setMode] = useState<'hidden' | 'android' | 'ios'>('hidden');
  const [locale, setLocale] = useState<RoomLocale>('en');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Deferred to post-hydration on purpose (same shape as
    // WebviewEscapeBanner): install eligibility is a client-only fact.
    if (isStandaloneDisplayMode()) return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* storage blocked — treat as not dismissed */
    }
    if (dismissed) return;
    const ua = navigator.userAgent || '';
    if (isInAppWebview(ua)) return;

    const show = (nextMode: 'android' | 'ios') => {
      setLocale(detectEntryLocale());
      setMode(nextMode);
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      show('android');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    const applyIos = () => {
      if (isIosSafari(ua)) show('ios');
    };
    applyIos();
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  if (mode === 'hidden') return null;
  const copy = COPY[locale];

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* session-only dismissal is fine */
    }
    setMode('hidden');
  };

  const install = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') setMode('hidden');
    } catch {
      /* prompt already consumed — keep the banner dismissible */
    }
  };

  return (
    <div
      role="dialog"
      aria-label={copy.title}
      className="fixed inset-x-3 z-40 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pwa/icon-192.png" alt="" width={40} height={40} className="mt-0.5 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-50">{copy.title}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-gray-600 dark:text-gray-300">
            {mode === 'ios' ? copy.iosGuide : copy.body}
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            {mode === 'android' && (
              <button
                type="button"
                onClick={install}
                className="min-h-[44px] rounded-xl bg-gray-900 px-4 text-[13px] font-semibold text-white dark:bg-gray-50 dark:text-gray-900"
              >
                {copy.install}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="min-h-[44px] px-2 text-[13px] text-gray-500 underline dark:text-gray-400"
            >
              {copy.dismiss}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
