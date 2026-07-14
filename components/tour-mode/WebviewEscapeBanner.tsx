'use client';

/**
 * T1.11 ⑤ (§O-1) — in-app webview escape banner.
 *
 * KakaoTalk / Instagram / Facebook / LINE / NAVER in-app browsers restrict
 * microphone, GPS, and speechSynthesis — chat reading works, but the room's
 * voice and location features don't. Detect the webview UA and offer a way
 * out: Android tries an intent:// jump straight into Chrome; iOS gets
 * "open in Safari" guidance (no programmatic escape exists). Dismissible,
 * never blocks the content underneath.
 */

import { useEffect, useState } from 'react';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import { detectEntryLocale } from '@/components/tour-mode/entryCopy';

const WEBVIEW_UA_PATTERN =
  /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|everytimeApp|WhatsApp|TelegramBot|; wv\)/i;

/** Pure UA classifier (exported for tests). */
export function isInAppWebview(userAgent: string): boolean {
  return WEBVIEW_UA_PATTERN.test(userAgent);
}

const COPY: Record<RoomLocale, { message: string; android: string; ios: string; dismiss: string }> = {
  en: {
    message: 'This in-app browser limits voice and location features.',
    android: 'Open in Chrome',
    ios: 'Tap ⋯ or the share icon → "Open in Safari"',
    dismiss: 'Dismiss',
  },
  ko: {
    message: '앱 내 브라우저에서는 음성·위치 기능이 제한됩니다.',
    android: 'Chrome에서 열기',
    ios: '⋯ 또는 공유 버튼 → "Safari로 열기"를 눌러 주세요',
    dismiss: '닫기',
  },
  ja: {
    message: 'アプリ内ブラウザでは音声・位置情報機能が制限されます。',
    android: 'Chromeで開く',
    ios: '⋯ または共有ボタン →「Safariで開く」をタップしてください',
    dismiss: '閉じる',
  },
  es: {
    message: 'Este navegador integrado limita las funciones de voz y ubicación.',
    android: 'Abrir en Chrome',
    ios: 'Toca ⋯ o el icono de compartir → "Abrir en Safari"',
    dismiss: 'Cerrar',
  },
  zh: {
    message: '应用内浏览器会限制语音和定位功能。',
    android: '在 Chrome 中打开',
    ios: '点按 ⋯ 或分享按钮 → "在 Safari 中打开"',
    dismiss: '关闭',
  },
};

export default function WebviewEscapeBanner() {
  const [visible, setVisible] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [locale, setLocale] = useState<RoomLocale>('en');

  useEffect(() => {
    // Deferred to post-hydration on purpose: UA sniffing must not create a
    // server/client markup mismatch (same shape as hooks/useMediaQuery).
    const apply = () => {
      const ua = navigator.userAgent || '';
      if (!isInAppWebview(ua)) return;
      setIsAndroid(/Android/i.test(ua));
      setLocale(detectEntryLocale());
      setVisible(true);
    };
    apply();
  }, []);

  if (!visible) return null;
  const copy = COPY[locale];

  const openInChrome = () => {
    try {
      const url = new URL(window.location.href);
      window.location.href = `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(
        ':',
        '',
      )};package=com.android.chrome;end`;
    } catch {
      /* stay in the webview — chat still works */
    }
  };

  return (
    <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
      <p className="text-[12px] leading-snug text-amber-900">{copy.message}</p>
      <div className="mt-1.5 flex items-center gap-3">
        {isAndroid ? (
          <button
            type="button"
            onClick={openInChrome}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            {copy.android}
          </button>
        ) : (
          <span className="text-[11px] text-amber-800">{copy.ios}</span>
        )}
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="ml-auto text-[11px] text-amber-700 underline"
        >
          {copy.dismiss}
        </button>
      </div>
    </div>
  );
}
