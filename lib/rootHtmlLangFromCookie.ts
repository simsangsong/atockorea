/**
 * `NEXT_LOCALE` 쿠키 값 → `<html lang>` (BCP 47 근사).
 * CSS `html[lang="…"]` / 초기 폰트 스택과 맞춤. `zh-CN` 쿠키는 `zh`로 정규화(앱 Locale 타입과 동일).
 */
export function rootHtmlLangFromNextLocaleCookie(raw: string | null | undefined): string {
  const v = raw?.trim();
  if (!v) return "en";
  if (v === "zh-CN" || v === "zh") return "zh";
  if (v === "zh-TW") return "zh-TW";
  if (v === "ko" || v === "en" || v === "es" || v === "ja") return v;
  return "en";
}
