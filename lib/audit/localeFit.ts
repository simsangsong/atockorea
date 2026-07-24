/**
 * §D A0.4 — 로케일 레이아웃 하니스. 순수부.
 *
 * A1.7이 노리는 표적은 명확하다: **"독일어·러시아어 긴 단어 붕괴"**.
 * 그건 스크린샷을 눈으로 봐야만 아는 것이 아니다 — 원인이 **끊을 수 없는 긴
 * 토큰**이라는 걸 알면 문자열만 보고도 잡을 수 있다.
 *
 * 독일어 합성어(`Sehenswürdigkeiten`)나 러시아어 장문 단어는 공백이 없어
 * `word-break: normal`에서 줄바꿈이 안 되고, 컨테이너를 그대로 밀어낸다.
 * CJK는 글자 단위로 끊기므로 같은 길이라도 안 터진다 — 그래서 **문자 수가 아니라
 * 최장 무공백 토큰**이 판정 기준이다.
 *
 * 🔴 이 하니스는 브라우저를 대신하지 않는다. 픽셀 검증은 A1.7이 실기기에서
 * 한다. 여기서 하는 일은 **의심 문자열을 좁혀 주는 것** — 3,000개 문자열을
 * 눈으로 보는 대신 상위 N개만 보게 만든다.
 */

/** 줄바꿈 기회를 주는 문자들(공백·하이픈류·슬래시·CJK). */
const BREAKABLE = /[\s\-–—/·,、。，]/u;

/** CJK·한글은 글자 단위로 끊기므로 긴 토큰이어도 레이아웃을 밀지 않는다. */
const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿가-힯＀-￯]/u;

/**
 * 문자열에서 **끊을 수 없는 가장 긴 조각**의 길이.
 * CJK가 섞인 조각은 끊긴다고 보고 세지 않는다.
 */
export function longestUnbreakableRun(text: string): number {
  let longest = 0;
  let current = 0;
  for (const ch of text) {
    if (BREAKABLE.test(ch) || CJK.test(ch)) {
      longest = Math.max(longest, current);
      current = 0;
    } else {
      current += 1;
    }
  }
  return Math.max(longest, current);
}

/**
 * 좁은 컨테이너(버튼·칩·라벨·탭)인가, 넓은 산문(약관·정책 본문)인가.
 *
 * 🔴 이 구분이 없으면 리포트가 쓸모없어진다. 첫 실행에서 후보 231건이 나왔는데
 * 상위권이 전부 약관 본문이었다 — 독일어 약관 문장에 30자 합성어가 있는 것은
 * 사실이지만, 그건 폭 넓은 문단이라 **터지지 않는다**. 진짜 위험은 같은 30자가
 * 설정 화면 **버튼 라벨**에 들어가는 쪽이다.
 */
export type Surface = 'chrome' | 'prose';

/** 본문 성격의 네임스페이스 — 넓은 컨테이너라 긴 토큰이 무해하다. */
const PROSE_NAMESPACES = new Set(['terms', 'privacy', 'cookiePolicy', 'refund', 'about', 'support']);

/** 키 자체가 문단임을 말하는 꼬리표(`.p1`, `.li2`, `.desc`, `.body` 등). */
const PROSE_LEAF = /\.(p\d+|li\d+|body|desc|description|paragraph|content|answer|intro|summary)$/i;

export function surfaceOf(key: string): Surface {
  const ns = key.split('.')[0];
  if (PROSE_NAMESPACES.has(ns)) return 'prose';
  if (PROSE_LEAF.test(key)) return 'prose';
  return 'chrome';
}

export interface FitRisk {
  locale: string;
  key: string;
  text: string;
  /** 좁은 컨테이너인가. `chrome`만 실제로 위험하다. */
  surface: Surface;
  /** 최장 무공백 토큰 길이 — 레이아웃을 미는 실제 원인. */
  longestRun: number;
  /** 기준 로케일(en) 대비 길이 배수. 1.6이면 60% 길다. */
  lengthRatio: number | null;
}

export interface FitThresholds {
  /**
   * 이 길이를 넘는 무공백 토큰은 좁은 칩·버튼에서 넘칠 수 있다.
   * 22는 임의값이 아니라 관측값이다: 영어 UI 문자열의 최장 토큰은 대부분
   * 15자 이하이고, 독일어 합성어가 그 위로 튄다.
   */
  maxRun: number;
  /** en 대비 이 배수를 넘으면 같은 자리에 안 들어갈 가능성이 높다. */
  maxLengthRatio: number;
  /** 이 길이 이하의 짧은 문자열은 배수가 튀어도 무해하다(예: "OK" → "Хорошо"). */
  ignoreShorterThan: number;
}

export const DEFAULT_THRESHOLDS: FitThresholds = {
  maxRun: 22,
  maxLengthRatio: 1.9,
  ignoreShorterThan: 12,
};

/** 중첩 JSON을 `a.b.c` 키의 평면 문자열 맵으로. */
export function flattenMessages(obj: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof obj === 'string') {
    out[prefix] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flattenMessages(v, prefix ? `${prefix}[${i}]` : String(i), out));
    return out;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flattenMessages(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

/**
 * 레이아웃이 터질 **가능성이 있는** 문자열을 좁힌다.
 *
 * 두 축을 따로 본다:
 *   ① 최장 무공백 토큰 — 독일어 합성어의 실제 파괴 기전
 *   ② en 대비 길이 배수 — 같은 버튼에 안 들어가는 부류(러시아어가 흔하다)
 *
 * 둘 중 하나만 넘어도 후보다. 눈으로 볼 목록을 만드는 것이 목적이지
 * 판정을 내리는 것이 아니다.
 */
export function findFitRisks(
  bundles: Record<string, Record<string, string>>,
  baseLocale = 'en',
  thresholds: FitThresholds = DEFAULT_THRESHOLDS,
): FitRisk[] {
  const base = bundles[baseLocale] ?? {};
  const risks: FitRisk[] = [];

  for (const [locale, messages] of Object.entries(bundles)) {
    if (locale === baseLocale) continue;
    for (const [key, text] of Object.entries(messages)) {
      if (typeof text !== 'string' || !text.trim()) continue;

      const run = longestUnbreakableRun(text);
      const baseText = base[key];
      const ratio =
        typeof baseText === 'string' && baseText.length >= thresholds.ignoreShorterThan
          ? Number((text.length / baseText.length).toFixed(2))
          : null;

      const runRisk = run > thresholds.maxRun;
      const ratioRisk = ratio !== null && ratio > thresholds.maxLengthRatio;
      if (runRisk || ratioRisk) {
        risks.push({ locale, key, text, surface: surfaceOf(key), longestRun: run, lengthRatio: ratio });
      }
    }
  }

  // 🔴 좁은 컨테이너(chrome)를 먼저. 산문은 같은 토큰 길이라도 안 터지므로
  // 위에 올라오면 진짜 위험을 가린다.
  risks.sort(
    (a, b) =>
      Number(a.surface === 'prose') - Number(b.surface === 'prose') ||
      b.longestRun - a.longestRun ||
      (b.lengthRatio ?? 0) - (a.lengthRatio ?? 0),
  );
  return risks;
}

/** 로케일별 누락 키 — 번역이 빠진 자리는 영어가 그대로 노출된다. */
export function findMissingKeys(
  bundles: Record<string, Record<string, string>>,
  baseLocale = 'en',
): Array<{ locale: string; missing: string[] }> {
  const baseKeys = Object.keys(bundles[baseLocale] ?? {});
  return Object.entries(bundles)
    .filter(([locale]) => locale !== baseLocale)
    .map(([locale, messages]) => ({
      locale,
      missing: baseKeys.filter((k) => !(k in messages)),
    }))
    .filter((r) => r.missing.length > 0);
}
