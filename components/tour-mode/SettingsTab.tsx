'use client';

/**
 * T1.12 — room settings tab (user decision 2026-07-14).
 *
 * Device-scoped preferences: theme (light/dark/system), voice-transcript
 * confirmation before sending (consumed by the Wave T2 voice flow), auto-read
 * of guide notices (wired in T2.5), text size, and the room language (synced
 * to the server participant row so translation targeting follows, D-8).
 */

import { QUICK_REPLY_PRESETS } from '@/lib/tour-room/quickReplies';
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';

const LOCALE_NAME: Record<RoomLocale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  es: 'Español',
  zh: '中文',
};

interface SettingsCopy {
  language: string;
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
    language: 'My language',
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
    language: '내 언어',
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
    language: 'Mi idioma',
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
    language: '我的语言',
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
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
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
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`flex-1 rounded-lg py-1.5 text-[12px] font-medium transition ${
            value === option.value
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-50'
              : 'text-gray-500 dark:text-gray-400'
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
}: {
  locale: RoomLocale;
  /** Also syncs the participant row server-side (translation targeting, D-8). */
  onLocaleChange: (locale: RoomLocale) => void;
}) {
  const { settings, update } = useTourRoomSettings();
  const copy = COPY[locale];

  return (
    <div className="space-y-4 overflow-y-auto pb-4" data-testid="settings-tab">
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
        <h3 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{copy.language}</h3>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {ROOM_LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => onLocaleChange(code)}
              aria-pressed={locale === code}
              className={`rounded-xl px-2 py-2 text-[13px] transition ${
                locale === code
                  ? 'bg-amber-500 font-semibold text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {LOCALE_NAME[code]}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
        <h3 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{copy.theme}</h3>
        <div className="mt-2">
          <SegmentedControl
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: 'light', label: `☀️ ${copy.themeLight}` },
              { value: 'dark', label: `🌙 ${copy.themeDark}` },
              { value: 'system', label: copy.themeSystem },
            ]}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{copy.voiceConfirm}</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">{copy.voiceConfirmHint}</p>
          </div>
          <Toggle
            checked={settings.voiceConfirm}
            onChange={(voiceConfirm) => update({ voiceConfirm })}
            label={copy.voiceConfirm}
          />
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{copy.autoRead}</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">{copy.autoReadHint}</p>
          </div>
          <Toggle checked={settings.autoRead} onChange={(autoRead) => update({ autoRead })} label={copy.autoRead} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
        <h3 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{copy.textSize}</h3>
        <div className="mt-2">
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
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REPLY_PRESETS.map((preset) => (
            <span
              key={preset.key}
              className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            >
              {preset.emoji} {preset.text[locale]}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
