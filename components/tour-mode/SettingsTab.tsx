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
import { quickRepliesForRole, type QuickReplyRole } from '@/lib/tour-room/quickReplies';
import { CHAT_LANGUAGES } from '@/lib/tour-room/languages';
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';
import AppManual from '@/components/tour-mode/AppManual';
import CompanionInviteCard from '@/components/tour-mode/CompanionInviteCard';
import type { ManualKind } from '@/lib/tour-room/appManual';
import {
  IconLanguage,
  IconTextSize,
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem,
} from '@/components/tour-mode/icons';

const LOCALE_NAME: Record<RoomLocale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  es: 'Español',
  zh: '中文',
};

interface SettingsCopy {
  language: string;
  appLanguage: string;
  appLanguageHint: string;
  chatLanguage: string;
  chatLanguageHint: string;
  chatAuto: string;
  theme: string;
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
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`tr-press relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-[var(--tr-dur-base)] ${
        checked ? 'bg-[var(--tr-accent)]' : 'bg-[var(--tr-bubble-system)]'
      }`}
    >
      <span
        className={`tr-knob absolute top-1 h-6 w-6 rounded-full bg-white shadow ${checked ? 'left-[24px]' : 'left-1'}`}
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
          className={`tr-label tr-press flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-lg font-medium transition-colors duration-[var(--tr-dur-fast)] ${
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
  viewerRole = 'customer',
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
  /** A6 — which role's quick-reply set to preview in the reminder card. */
  viewerRole?: QuickReplyRole;
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
      {/* A5 — display mode promoted above the language card so the theme
          control is discoverable without scrolling. */}
      <section className="tr-card p-4">
        <h3 className="tr-card-text flex items-center gap-1.5 font-semibold text-[var(--tr-ink)]">
          <IconThemeSystem size={15} className="text-[var(--tr-ink-3)]" aria-hidden />
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
                    <IconThemeLight size={13} aria-hidden /> {copy.themeLight}
                  </>
                ),
              },
              {
                value: 'dark',
                label: (
                  <>
                    <IconThemeDark size={13} aria-hidden /> {copy.themeDark}
                  </>
                ),
              },
              { value: 'system', label: copy.themeSystem },
            ]}
          />
        </div>
      </section>
      {/* One "Language" card with two clearly-labelled sub-controls so the app
          language (chrome, 5 locales) and the chat language (translation target,
          any language) don't read as two competing top-level settings. */}
      <section className="tr-card p-4">
        <h3 className="tr-card-text flex items-center gap-1.5 font-semibold text-[var(--tr-ink)]">
          <IconLanguage size={15} className="text-[var(--tr-ink-3)]" aria-hidden />
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
                aria-pressed={locale === code}
                className={`tr-card-text tr-press min-h-[44px] rounded-xl px-2 transition-colors duration-[var(--tr-dur-fast)] ${
                  locale === code
                    ? 'bg-[var(--tr-accent)] font-semibold text-[var(--tr-bubble-me-ink)]'
                    : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                }`}
              >
                {LOCALE_NAME[code]}
              </button>
            ))}
          </div>
        </div>

        {onChatLocaleChange && (
          <div className="mt-4 border-t border-[var(--tr-hairline)] pt-3" data-testid="chat-language-section">
            <p className="tr-label font-semibold text-[var(--tr-ink)]">{copy.chatLanguage}</p>
            <p className="tr-meta mt-0.5 leading-snug text-[var(--tr-ink-3)]">{copy.chatLanguageHint}</p>
            <select
              value={chatLocale ?? ''}
              onChange={(e) => onChatLocaleChange(e.target.value)}
              className="tr-card-text mt-2 min-h-[44px] w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-3 text-[var(--tr-ink)] focus:border-[var(--tr-accent)] focus:outline-none"
              data-testid="chat-language-select"
            >
              <option value="">{copy.chatAuto}</option>
              {CHAT_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
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
          <IconTextSize size={15} className="text-[var(--tr-ink-3)]" aria-hidden />
          {copy.textSize}
        </h3>
        <div className="mt-2.5">
          <SegmentedControl
            value={settings.textScale}
            onChange={(textScale) => update({ textScale })}
            options={[
              { value: 'normal', label: copy.textNormal },
              { value: 'large', label: copy.textLarge },
            ]}
          />
        </div>
      </section>

      {/* Quick replies always send in every language — shown here as a reminder of what a tap sends. */}
      <section className="tr-card p-4">
        <div className="flex flex-wrap gap-1.5">
          {quickRepliesForRole(viewerRole).map((preset) => (
            <span
              key={preset.key}
              className="tr-meta rounded-full bg-[var(--tr-surface-2)] px-2.5 py-1 text-[var(--tr-ink-2)]"
            >
              {preset.emoji} {preset.text[locale]}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
