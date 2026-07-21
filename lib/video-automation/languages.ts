export type VideoLanguageCode = 'en' | 'zh-Hant' | 'ja' | 'es';

export interface VideoLanguageProfile {
  code: VideoLanguageCode;
  sourceLocale: string;
  roomLocale: 'en' | 'zh' | 'ja' | 'es';
  label: string;
  ttsLocale: string;
  subtitleFileSuffix: string;
}

export const VIDEO_TARGET_LANGUAGES: readonly VideoLanguageProfile[] = [
  {
    code: 'en',
    sourceLocale: 'en',
    roomLocale: 'en',
    label: 'English',
    ttsLocale: 'en-US',
    subtitleFileSuffix: 'en',
  },
  {
    code: 'zh-Hant',
    sourceLocale: 'zh-TW',
    roomLocale: 'zh',
    label: 'Traditional Chinese',
    ttsLocale: 'zh-TW',
    subtitleFileSuffix: 'zh-Hant',
  },
  {
    code: 'ja',
    sourceLocale: 'ja',
    roomLocale: 'ja',
    label: 'Japanese',
    ttsLocale: 'ja-JP',
    subtitleFileSuffix: 'ja',
  },
  {
    code: 'es',
    sourceLocale: 'es',
    roomLocale: 'es',
    label: 'Spanish',
    ttsLocale: 'es-ES',
    subtitleFileSuffix: 'es',
  },
] as const;

export const DEFAULT_VIDEO_LANGUAGE_CODES = VIDEO_TARGET_LANGUAGES.map((language) => language.code);

const LANGUAGE_BY_CODE = new Map(VIDEO_TARGET_LANGUAGES.map((language) => [language.code, language]));
const LANGUAGE_BY_SOURCE_LOCALE = new Map(VIDEO_TARGET_LANGUAGES.map((language) => [language.sourceLocale, language]));

export function normalizeVideoLanguageCode(value: string): VideoLanguageCode | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (LANGUAGE_BY_CODE.has(trimmed as VideoLanguageCode)) return trimmed as VideoLanguageCode;
  if (trimmed === 'zh-TW' || trimmed === 'zh_Hant' || trimmed === 'zh-hant' || trimmed === 'zh') return 'zh-Hant';
  if (trimmed === 'en-US' || trimmed === 'en_GB') return 'en';
  if (trimmed === 'ja-JP') return 'ja';
  if (trimmed === 'es-ES' || trimmed === 'es-US') return 'es';
  return null;
}

export function videoLanguageProfile(code: VideoLanguageCode): VideoLanguageProfile {
  const profile = LANGUAGE_BY_CODE.get(code);
  if (!profile) throw new Error(`Unsupported video language: ${code}`);
  return profile;
}

export function videoLanguageFromSourceLocale(sourceLocale: string): VideoLanguageProfile | null {
  return LANGUAGE_BY_SOURCE_LOCALE.get(sourceLocale) ?? null;
}

