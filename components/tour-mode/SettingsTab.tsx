'use client';

/**
 * T1.12 — room settings tab (user decision 2026-07-14).
 *
 * Device-scoped preferences: theme (light/dark/system), voice-transcript
 * confirmation before sending (consumed by the Wave T2 voice flow), auto-read
 * of guide notices (wired in T2.5), text size, and the room language (synced
 * to the server participant row so translation targeting follows, D-8).
 */

import type { ReactNode } from 'react';
import { CHAT_LANGUAGES } from '@/lib/tour-room/languages';
import { localeFlag } from '@/lib/tour-room/localeFlags';
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';
import {
  useTourRoomSettings,
  TEXT_SCALE_STEPS,
  type TextScaleStep,
} from '@/hooks/useTourRoomSettings';
import AppManual from '@/components/tour-mode/AppManual';
import InstallCard from '@/components/tour-mode/InstallCard';
import SkinPicker from '@/components/tour-mode/SkinPicker';
import CompanionInviteCard from '@/components/tour-mode/CompanionInviteCard';
import type { ManualKind } from '@/lib/tour-room/appManual';
import {
  IconLanguage,
  IconTextSize,
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem,
  TR_ICON,
} from '@/components/tour-mode/icons';

const LOCALE_NAME: Record<RoomLocale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  es: 'Español',
  zh: '中文',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
  it: 'Italiano',
};

interface SettingsCopy {
  language: string;
  appLanguage: string;
  appLanguageHint: string;
  chatLanguage: string;
  chatLanguageHint: string;
  chatAuto: string;
  theme: string;
  skin: string;
  themeLight: string;
  themeDark: string;
  themeSystem: string;
  voiceConfirm: string;
  voiceConfirmHint: string;
  autoRead: string;
  autoReadHint: string;
  textSize: string;
  textNormal: string;
  textLarge: string;
}

const COPY: Record<RoomLocale, SettingsCopy> = {
  en: {
    language: 'Language',
    appLanguage: 'App language',
    appLanguageHint: 'Screen text and notices.',
    chatLanguage: 'Chat language',
    chatLanguageHint: 'Guide and driver messages are shown in this language.',
    chatAuto: 'Auto (match my typing)',
    theme: 'Appearance',
    skin: 'Background theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'Auto',
    voiceConfirm: 'Review voice text before sending',
    voiceConfirmHint: 'After you speak, check and edit the transcribed text before it goes out.',
    autoRead: 'Read guide notices aloud',
    autoReadHint: 'Guide announcements are spoken in your language (screen must stay on).',
    textSize: 'Text size',
    textNormal: 'Normal',
    textLarge: 'Large',
  },
  ko: {
    language: '언어',
    appLanguage: '앱 언어',
    appLanguageHint: '화면과 안내 문구에 쓰는 언어',
    chatLanguage: '채팅 언어',
    chatLanguageHint: '가이드·기사 메시지를 이 언어로 보여줍니다.',
    chatAuto: '자동 (내가 쓰는 언어)',
    theme: '화면 모드',
    skin: '배경 테마',
    themeLight: '라이트',
    themeDark: '다크',
    themeSystem: '자동',
    voiceConfirm: '보내기 전 음성 텍스트 확인',
    voiceConfirmHint: '말한 내용이 문자로 변환된 뒤, 확인·수정하고 나서 전송됩니다.',
    autoRead: '가이드 공지 소리로 읽기',
    autoReadHint: '가이드 공지를 내 언어로 읽어 줍니다 (화면이 켜져 있어야 해요).',
    textSize: '글자 크기',
    textNormal: '보통',
    textLarge: '크게',
  },
  ja: {
    language: '言語',
    appLanguage: 'アプリの言語',
    appLanguageHint: '画面や案内に使う言語',
    chatLanguage: 'チャット言語',
    chatLanguageHint: 'ガイド・ドライバーのメッセージをこの言語で表示します。',
    chatAuto: '自動（入力に合わせる）',
    theme: '画面モード',
    skin: '背景テーマ',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    themeSystem: '自動',
    voiceConfirm: '送信前に音声テキストを確認',
    voiceConfirmHint: '話した内容が文字に変換された後、確認・編集してから送信します。',
    autoRead: 'ガイドのお知らせを読み上げ',
    autoReadHint: 'ガイドのお知らせをあなたの言語で読み上げます（画面オンが必要）。',
    textSize: '文字サイズ',
    textNormal: '標準',
    textLarge: '大きい',
  },
  es: {
    language: 'Idioma',
    appLanguage: 'Idioma de la app',
    appLanguageHint: 'Pantallas y avisos.',
    chatLanguage: 'Idioma del chat',
    chatLanguageHint: 'Los mensajes del guía y del conductor se muestran en este idioma.',
    chatAuto: 'Automático (según lo que escribo)',
    theme: 'Apariencia',
    skin: 'Tema de fondo',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    themeSystem: 'Auto',
    voiceConfirm: 'Revisar el texto de voz antes de enviar',
    voiceConfirmHint: 'Tras hablar, revisa y edita el texto transcrito antes de enviarlo.',
    autoRead: 'Leer avisos del guía en voz alta',
    autoReadHint: 'Los avisos del guía se leen en tu idioma (la pantalla debe estar encendida).',
    textSize: 'Tamaño del texto',
    textNormal: 'Normal',
    textLarge: 'Grande',
  },
  zh: {
    language: '语言',
    appLanguage: '应用语言',
    appLanguageHint: '界面和通知语言',
    chatLanguage: '聊天语言',
    chatLanguageHint: '导游和司机的消息将以此语言显示。',
    chatAuto: '自动（按我的输入）',
    theme: '显示模式',
    skin: '背景主题',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '自动',
    voiceConfirm: '发送前确认语音文字',
    voiceConfirmHint: '说话内容转换成文字后，先确认和修改再发送。',
    autoRead: '朗读导游通知',
    autoReadHint: '用您的语言朗读导游通知（需保持屏幕常亮）。',
    textSize: '字体大小',
    textNormal: '标准',
    textLarge: '大',
  },
  fr: {
    language: 'Langue',
    appLanguage: 'Langue de l’app',
    appLanguageHint: 'Textes de l’écran et annonces.',
    chatLanguage: 'Langue du chat',
    chatLanguageHint: 'Les messages du guide et du chauffeur s’affichent dans cette langue.',
    chatAuto: 'Auto (selon ce que j’écris)',
    theme: 'Affichage',
    skin: 'Thème de fond',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    themeSystem: 'Auto',
    voiceConfirm: 'Relire le texte dicté avant l’envoi',
    voiceConfirmHint: 'Après avoir parlé, vérifiez et corrigez le texte transcrit avant qu’il parte.',
    autoRead: 'Lire les annonces du guide à voix haute',
    autoReadHint: 'Les annonces du guide sont lues dans votre langue (l’écran doit rester allumé).',
    textSize: 'Taille du texte',
    textNormal: 'Normale',
    textLarge: 'Grande',
  },
  de: {
    language: 'Sprache',
    appLanguage: 'App-Sprache',
    appLanguageHint: 'Sprache für Oberfläche und Hinweise.',
    chatLanguage: 'Chat-Sprache',
    chatLanguageHint: 'Nachrichten von Guide und Fahrer werden in dieser Sprache angezeigt.',
    chatAuto: 'Automatisch (wie ich schreibe)',
    theme: 'Darstellung',
    skin: 'Hintergrund-Design',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    themeSystem: 'Auto',
    voiceConfirm: 'Diktierten Text vor dem Senden prüfen',
    voiceConfirmHint: 'Nach dem Sprechen prüfen und korrigieren Sie den Text, bevor er gesendet wird.',
    autoRead: 'Guide-Ansagen vorlesen',
    autoReadHint: 'Ansagen des Guides werden in Ihrer Sprache vorgelesen (Bildschirm muss an bleiben).',
    textSize: 'Textgröße',
    textNormal: 'Normal',
    textLarge: 'Groß',
  },
  ru: {
    language: 'Язык',
    appLanguage: 'Язык приложения',
    appLanguageHint: 'Язык интерфейса и уведомлений.',
    chatLanguage: 'Язык чата',
    chatLanguageHint: 'Сообщения гида и водителя показываются на этом языке.',
    chatAuto: 'Авто (как я пишу)',
    theme: 'Оформление',
    skin: 'Тема фона',
    themeLight: 'Светлая',
    themeDark: 'Темная',
    themeSystem: 'Авто',
    voiceConfirm: 'Проверять голосовой текст перед отправкой',
    voiceConfirmHint: 'После записи проверьте и поправьте расшифровку, прежде чем она отправится.',
    autoRead: 'Озвучивать объявления гида',
    autoReadHint: 'Объявления гида читаются вслух на вашем языке (экран должен быть включен).',
    textSize: 'Размер текста',
    textNormal: 'Обычный',
    textLarge: 'Крупный',
  },
  it: {
    language: 'Lingua',
    appLanguage: 'Lingua dell’app',
    appLanguageHint: 'Testi delle schermate e avvisi.',
    chatLanguage: 'Lingua della chat',
    chatLanguageHint: 'I messaggi della guida e dell’autista appaiono in questa lingua.',
    chatAuto: 'Auto (come scrivo io)',
    theme: 'Aspetto',
    skin: 'Tema di sfondo',
    themeLight: 'Chiaro',
    themeDark: 'Scuro',
    themeSystem: 'Auto',
    voiceConfirm: 'Rileggi il testo vocale prima dell’invio',
    voiceConfirmHint: 'Dopo aver parlato, controlla e correggi il testo trascritto prima che parta.',
    autoRead: 'Leggi ad alta voce gli avvisi della guida',
    autoReadHint: 'Gli avvisi della guida vengono letti nella tua lingua (lo schermo deve restare acceso).',
    textSize: 'Dimensione del testo',
    textNormal: 'Normale',
    textLarge: 'Grande',
  },
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  // T-D6 ① — knob color is state-split instead of hard white: checked rides
  // the accent, so bubble-me-ink (the ≥4.5 pairing invariant) is the one color
  // guaranteed visible on it in EVERY skin — hard white vanished on the
  // high-contrast dark skin, whose accent IS white. Unchecked uses surface +
  // hairline so the knob keeps a silhouette on the muted track in dark themes.
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      /* 컴팩트 스위치 (사용자 지시 2026-07-27): 트랙 높이가 노브를 꼭 맞게
         감싼다(패딩 2px) — 32px 트랙에 24px 노브는 위아래가 뚱뚱하게 남았다.
         시각은 26px로 줄이되 히트영역은 after 확장으로 44px 유지. */
      className={`tr-press relative h-[26px] min-h-0 w-11 min-w-0 shrink-0 rounded-full transition-colors duration-[var(--tr-dur-base)] after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] ${
        checked ? 'bg-[var(--tr-accent)]' : 'bg-[var(--tr-bubble-system)]'
      }`}
    >
      <span
        /* 병합: T-D6 상태분리 색(고대비 스킨에서 흰 노브 소실 방지) ×
           컴팩트 지오메트리(22px 노브, 2px 패딩). */
        className={`tr-knob absolute top-[2px] h-[22px] w-[22px] rounded-full shadow ${
          checked
            ? 'left-5 bg-[var(--tr-bubble-me-ink)]'
            : 'left-[2px] border border-[var(--tr-hairline)] bg-[var(--tr-surface)]'
        }`}
      />
    </button>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-[var(--tr-bubble-system)] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`tr-label tr-press flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-lg font-medium transition-colors duration-[var(--tr-dur-fast)] ${
            value === option.value
              ? 'bg-[var(--tr-surface)] text-[var(--tr-ink)] shadow-sm'
              : 'text-[var(--tr-ink-2)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsTab({
  locale,
  onLocaleChange,
  chatLocale,
  onChatLocaleChange,
  manualKind,
  companionInvite,
}: {
  locale: RoomLocale;
  /** Also syncs the participant row server-side (translation targeting, D-8). */
  onLocaleChange: (locale: RoomLocale) => void;
  /** The guest's chat-translation language ('' = auto-detect from typing). */
  chatLocale?: string;
  /** Any LLM language; sets participant.chat_locale so operator bubbles come in
   *  it. Absent = the chat-language picker is hidden (non-guest surfaces). */
  onChatLocaleChange?: (code: string) => void;
  /** A5 — usage-manual shape; absent hides the manual card (non-room surfaces). */
  manualKind?: ManualKind;
  /**
   * §5.2 C-6 — auth for the lead-only [동행자 초대] card. Absent hides it
   * (staff surfaces); present, the card still self-hides unless the server
   * says this viewer is the lead guest.
   */
  companionInvite?: { bookingId: string; roomSession: string };
}) {
  const { settings, update } = useTourRoomSettings();
  const copy = COPY[locale];

  // U6.3 — grouped-list settings (iOS grammar): flat groups with hairline
  // dividers on the room surface, 44px rows, one accent (amber = action).
  return (
    <div className="tr-stagger space-y-4 pb-4" data-testid="settings-tab">
      {/* A5 — the always-reachable copy of the first-entry manual. */}
      {manualKind ? <AppManual variant="inline" kind={manualKind} locale={locale} /> : null}
      {/* §5.2 C-6 — lead only; the card asks the server and hides itself otherwise. */}
      {companionInvite ? (
        <CompanionInviteCard
          bookingId={companionInvite.bookingId}
          roomSession={companionInvite.roomSession}
          locale={locale}
        />
      ) : null}
      {/* T-D2 — persistent install entry point, top zone on purpose: the
          drawer's iOS install tile lands here (no scroll hunt). Self-hides
          when already standalone / no install path exists. */}
      <InstallCard locale={locale} />
      {/* A5 — display mode promoted above the language card so the theme
          control is discoverable without scrolling. */}
      <section className="tr-card p-4">
        <h3 className="tr-card-text flex items-center gap-1.5 font-semibold text-[var(--tr-ink)]">
          <IconThemeSystem size={TR_ICON.chip} className="text-[var(--tr-ink-3)]" aria-hidden />
          {copy.theme}
        </h3>
        <div className="mt-2.5">
          <SegmentedControl
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              {
                value: 'light',
                label: (
                  <>
                    <IconThemeLight size={TR_ICON.meta} aria-hidden /> {copy.themeLight}
                  </>
                ),
              },
              {
                value: 'dark',
                label: (
                  <>
                    <IconThemeDark size={TR_ICON.meta} aria-hidden /> {copy.themeDark}
                  </>
                ),
              },
              { value: 'system', label: copy.themeSystem },
            ]}
          />
        </div>
        {/* C-D6 — background skins (KakaoTalk theme grammar, colors only). */}
        <p className="tr-label mt-4 font-semibold text-[var(--tr-ink-2)]">{copy.skin}</p>
        <div className="mt-2">
          <SkinPicker locale={locale} />
        </div>
      </section>
      {/* One "Language" card with two clearly-labelled sub-controls so the app
          language (chrome, 5 locales) and the chat language (translation target,
          any language) don't read as two competing top-level settings. */}
      <section className="tr-card p-4">
        <h3 className="tr-card-text flex items-center gap-1.5 font-semibold text-[var(--tr-ink)]">
          <IconLanguage size={TR_ICON.chip} className="text-[var(--tr-ink-3)]" aria-hidden />
          {copy.language}
        </h3>

        <div className="mt-3">
          <p className="tr-label font-semibold text-[var(--tr-ink)]">{copy.appLanguage}</p>
          <p className="tr-meta mt-0.5 leading-snug text-[var(--tr-ink-3)]">{copy.appLanguageHint}</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {ROOM_LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onLocaleChange(code)}
                data-testid={`app-locale-${code}`}
                aria-pressed={locale === code}
                /* R3 — flag + native name, one chip grammar shared with the
                   chat-language control below. */
                className={`tr-press flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl px-2 transition-colors duration-[var(--tr-dur-fast)] ${
                  locale === code
                    ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)] shadow-[var(--tr-tile-shadow)]'
                    : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                }`}
              >
                <span className="tr-card-text leading-none" aria-hidden>
                  {localeFlag(code)}
                </span>
                <span className={`tr-card-text text-cjk-safe ${locale === code ? 'font-bold' : ''}`}>
                  {LOCALE_NAME[code]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {onChatLocaleChange && (
          <div className="mt-4 border-t border-[var(--tr-hairline)] pt-3" data-testid="chat-language-section">
            <p className="tr-label font-semibold text-[var(--tr-ink)]">{copy.chatLanguage}</p>
            <p className="tr-meta mt-0.5 leading-snug text-[var(--tr-ink-3)]">{copy.chatLanguageHint}</p>
            {/* R3 — the same flag-chip grammar as the app language above. A
                native <select> looked like a different app; 32 languages stay
                reachable as a horizontally scrolling chip rail, with the
                current pick pinned first via Auto. */}
            <div
              className="mt-2 flex flex-wrap gap-1.5"
              role="radiogroup"
              aria-label={copy.chatLanguage}
              data-testid="chat-language-chips"
            >
              {[{ code: '', name: copy.chatAuto }, ...CHAT_LANGUAGES].map((lang) => {
                const active = (chatLocale ?? '') === lang.code;
                return (
                  <button
                    key={lang.code || 'auto'}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChatLocaleChange(lang.code)}
                    data-testid={`chat-locale-${lang.code || 'auto'}`}
                    className={`tr-press flex min-h-[40px] items-center gap-1.5 rounded-full px-3 transition-colors duration-[var(--tr-dur-fast)] ${
                      active
                        ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                        : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                    }`}
                  >
                    <span className="tr-card-text leading-none" aria-hidden>
                      {lang.code ? localeFlag(lang.code) : '🌐'}
                    </span>
                    <span className={`tr-label text-cjk-safe ${active ? 'font-bold' : 'font-medium'}`}>
                      {lang.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="tr-card divide-y divide-[var(--tr-hairline)] px-4">
        <div className="flex items-start justify-between gap-3 py-3.5">
          <div>
            <h3 className="tr-card-text font-semibold text-[var(--tr-ink)]">{copy.voiceConfirm}</h3>
            <p className="tr-meta mt-0.5 leading-snug text-[var(--tr-ink-2)]">{copy.voiceConfirmHint}</p>
          </div>
          <Toggle
            checked={settings.voiceConfirm}
            onChange={(voiceConfirm) => update({ voiceConfirm })}
            label={copy.voiceConfirm}
          />
        </div>

        <div className="flex items-start justify-between gap-3 py-3.5">
          <div>
            <h3 className="tr-card-text font-semibold text-[var(--tr-ink)]">{copy.autoRead}</h3>
            <p className="tr-meta mt-0.5 leading-snug text-[var(--tr-ink-2)]">{copy.autoReadHint}</p>
          </div>
          <Toggle checked={settings.autoRead} onChange={(autoRead) => update({ autoRead })} label={copy.autoRead} />
        </div>
      </section>

      <section className="tr-card p-4">
        <h3 className="tr-card-text flex items-center gap-1.5 font-semibold text-[var(--tr-ink)]">
          <IconTextSize size={TR_ICON.chip} className="text-[var(--tr-ink-3)]" aria-hidden />
          {copy.textSize}
        </h3>
        {/* P1-6 — 5 steps. A slider rather than 5 segmented buttons: five CJK
            labels in flex-1 cells is exactly the P1-5 breaking trap, and a
            slider is the easier target in a moving vehicle. */}
        <div className="mt-2.5">
          <div className="flex items-center gap-3">
            <span className="tr-meta shrink-0 text-[var(--tr-ink-3)]" aria-hidden>
              {copy.textNormal}
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={settings.textScale}
              onChange={(event) =>
                update({ textScale: Number(event.target.value) as TextScaleStep })
              }
              aria-label={copy.textSize}
              aria-valuetext={`${settings.textScale} / 5`}
              data-testid="text-scale-slider"
              className="tr-press h-9 min-w-0 flex-1 accent-[var(--tr-accent)]"
            />
            <span className="tr-title shrink-0 text-[var(--tr-ink-3)]" aria-hidden>
              {copy.textLarge}
            </span>
          </div>
          <div className="mt-1 flex justify-between px-9" aria-hidden>
            {TEXT_SCALE_STEPS.map((step) => (
              <span
                key={step}
                className={`tr-meta tr-num ${
                  step === settings.textScale
                    ? 'font-bold text-[var(--tr-accent-deep)]'
                    : 'text-[var(--tr-ink-3)]'
                }`}
              >
                {step}
              </span>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
