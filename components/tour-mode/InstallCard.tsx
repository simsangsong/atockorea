'use client';

/**
 * T-D2 (docs/pwa-ui-theme-design-master-plan-2026-07-27.md) — the persistent
 * "앱 설치" card. InstallBanner is a one-shot nudge (D-1 window, once per
 * booking); this card is the always-there entry point in Settings / Home /
 * StaffSettings, self-hiding when installing makes no sense (standalone,
 * webview, no event). One component, three surface grammars:
 *
 *   room  — guest Settings tab (tr-card)
 *   home  — guest home dashboard (tr-home-card tile grammar)
 *   staff — staff Settings tab (tr-card + hairline border, ko-only surface)
 *
 * Android/Chromium → one-tap native prompt. iOS Safari → inline 2-step
 * share-sheet guide (no programmatic install exists on iOS).
 */

import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import { IconInstall, IconShare, TR_ICON } from '@/components/tour-mode/icons';

interface InstallCopy {
  title: string;
  body: string;
  install: string;
  iosStep1: string;
  iosStep2: string;
}

const COPY: Record<RoomLocale, InstallCopy> = {
  en: {
    title: 'Add to home screen',
    body: 'One tap from your home screen straight into your tour.',
    install: 'Install',
    iosStep1: 'Tap the share button in Safari',
    iosStep2: 'Choose "Add to Home Screen"',
  },
  ko: {
    title: '홈 화면에 추가',
    body: '홈 화면에서 한 번의 탭으로 투어룸에 바로 들어와요.',
    install: '설치',
    iosStep1: 'Safari의 공유 버튼을 누르고',
    iosStep2: '"홈 화면에 추가"를 선택하세요',
  },
  ja: {
    title: 'ホーム画面に追加',
    body: 'ホーム画面からワンタップでツアールームへ。',
    install: 'インストール',
    iosStep1: 'Safariの共有ボタンをタップ',
    iosStep2: '「ホーム画面に追加」を選択',
  },
  es: {
    title: 'Añadir a pantalla de inicio',
    body: 'Un toque desde tu pantalla de inicio directo a tu tour.',
    install: 'Instalar',
    iosStep1: 'Toca el botón de compartir en Safari',
    iosStep2: 'Elige "Añadir a pantalla de inicio"',
  },
  zh: {
    title: '添加到主屏幕',
    body: '从主屏幕一键直达您的旅行房间。',
    install: '安装',
    iosStep1: '点按 Safari 的分享按钮',
    iosStep2: '选择"添加到主屏幕"',
  },
  fr: {
    title: 'Ajouter à l’écran d’accueil',
    body: 'Un seul geste depuis votre écran d’accueil pour rejoindre votre tour.',
    install: 'Installer',
    iosStep1: 'Touchez le bouton de partage dans Safari',
    iosStep2: 'Choisissez « Sur l’écran d’accueil »',
  },
  de: {
    title: 'Zum Home-Bildschirm hinzufügen',
    body: 'Ein Tipp auf dem Home-Bildschirm — direkt in Ihre Tour.',
    install: 'Installieren',
    iosStep1: 'Tippen Sie in Safari auf Teilen',
    iosStep2: 'Wählen Sie „Zum Home-Bildschirm“',
  },
  ru: {
    title: 'На экран «Домой»',
    body: 'Одно касание с экрана «Домой» — и вы в своем туре.',
    install: 'Установить',
    iosStep1: 'Нажмите кнопку «Поделиться» в Safari',
    iosStep2: 'Выберите «На экран Домой»',
  },
  it: {
    title: 'Aggiungi alla schermata Home',
    body: 'Un tocco dalla schermata Home e sei nel tuo tour.',
    install: 'Installa',
    iosStep1: 'Tocca il pulsante Condividi in Safari',
    iosStep2: 'Scegli “Aggiungi alla schermata Home”',
  },
};

export default function InstallCard({
  locale,
  surface = 'room',
}: {
  locale: RoomLocale;
  surface?: 'room' | 'home' | 'staff';
}) {
  const { mode, promptInstall } = useInstallPrompt();
  if (mode === 'unavailable') return null;
  const copy = COPY[locale] ?? COPY.en;

  const shell =
    surface === 'home'
      ? 'tr-home-card'
      : surface === 'staff'
        ? 'tr-card border border-[var(--tr-hairline)]'
        : 'tr-card';

  return (
    <section className={`${shell} p-4`} data-testid="install-card">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pwa/icon-192.png" alt="" width={40} height={40} className="mt-0.5 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h3 className="tr-card-text text-cjk-safe font-semibold text-[var(--tr-ink)]">{copy.title}</h3>
          <p className="tr-label mt-0.5 leading-snug text-[var(--tr-ink-2)]">{copy.body}</p>
        </div>
        {mode === 'native' && (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="tr-label text-cjk-safe tr-btn-raised flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-bubble-me-ink)]"
            data-testid="install-card-native"
          >
            <IconInstall size={TR_ICON.chip} aria-hidden />
            {copy.install}
          </button>
        )}
      </div>
      {mode === 'ios' && (
        <ol className="mt-2.5 space-y-1.5" data-testid="install-card-ios">
          <li className="tr-label flex items-center gap-2 text-[var(--tr-ink-2)]">
            <span className="tr-meta tr-num flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] font-bold text-[var(--tr-accent-deep)]">
              1
            </span>
            <IconShare size={TR_ICON.meta} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
            <span className="min-w-0">{copy.iosStep1}</span>
          </li>
          <li className="tr-label flex items-center gap-2 text-[var(--tr-ink-2)]">
            <span className="tr-meta tr-num flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] font-bold text-[var(--tr-accent-deep)]">
              2
            </span>
            <IconInstall size={TR_ICON.meta} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
            <span className="min-w-0">{copy.iosStep2}</span>
          </li>
        </ol>
      )}
    </section>
  );
}
