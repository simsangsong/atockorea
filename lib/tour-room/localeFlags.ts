/**
 * R3 (docs/ops-staff-design-unification-master-plan-2026-07-27.md §D-2) —
 * flag emoji per language code, for the settings language chips.
 *
 * A flag is a COUNTRY, a code is a LANGUAGE — they are not the same thing, so
 * each entry is a deliberate "most recognizable flag for a speaker of this
 * language" pick, not an algorithmic code→country mapping:
 *   en → 🇬🇧 (the app's English is British-neutral; 🇺🇸 would read as US-only)
 *   zh → 🇨🇳 simplified · zh-TW → 🇹🇼 traditional (the one split we honor)
 *   pt → 🇧🇷 (Brazilian speakers dominate our traffic), ar → 🇸🇦, hi → 🇮🇳
 * Unknown codes get a globe rather than a wrong flag.
 */

const FLAG: Record<string, string> = {
  en: '🇬🇧',
  ko: '🇰🇷',
  ja: '🇯🇵',
  zh: '🇨🇳',
  'zh-tw': '🇹🇼',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  ru: '🇷🇺',
  pt: '🇧🇷',
  ar: '🇸🇦',
  hi: '🇮🇳',
  th: '🇹🇭',
  vi: '🇻🇳',
  id: '🇮🇩',
  ms: '🇲🇾',
  tl: '🇵🇭',
  tr: '🇹🇷',
  pl: '🇵🇱',
  nl: '🇳🇱',
  sv: '🇸🇪',
  no: '🇳🇴',
  da: '🇩🇰',
  fi: '🇫🇮',
  cs: '🇨🇿',
  el: '🇬🇷',
  he: '🇮🇱',
  uk: '🇺🇦',
  ro: '🇷🇴',
  hu: '🇭🇺',
  mn: '🇲🇳',
};

/** Flag emoji for a language code; 🌐 when we have no honest pick. */
export function localeFlag(code: string | null | undefined): string {
  if (!code) return '🌐';
  const raw = code.trim().toLowerCase();
  return FLAG[raw] ?? FLAG[raw.slice(0, 2)] ?? '🌐';
}
