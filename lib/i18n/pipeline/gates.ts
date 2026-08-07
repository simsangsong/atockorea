/**
 * i18n 파이프라인 [3단] — 결정론적 검증 G1~G11.
 *
 * 플랜 v3 §9 → v2.2 §3-[3]. **LLM이 아니라 스크립트가 잡는다.**
 * 숫자·토큰·태그·URL·구조는 100% 결정론적으로 판정되므로 여기서 끝내고,
 * LLM 판정([4] 적대적 역번역)은 뉘앙스만 본다.
 *
 * severity:
 *   'fail' → 해당 unit 재큐(최대 3회) → 3회 실패 시 미발행(영어 폴백)
 *   'flag' → 발행 가능하나 사람 감수 큐에 올린다
 */

import { countEmphasis } from '@/lib/text/emphasis';

export type Severity = 'fail' | 'flag';
export type GateId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8' | 'G9' | 'G10' | 'G11';

export interface Finding {
  gate: GateId;
  severity: Severity;
  pointer: string;
  message: string;
}

/**
 * 🔴 2026-08-02 확장. 원래 넷은 i18n 확장 트랙(de·fr·it·ru)의 대상이었고,
 * 룸 로케일 10종 중 나머지 넷(ja·es·zh·zh-TW)은 이 파이프라인보다 먼저 있던
 * 언어라 여기 없었다. 지역 해설 번역이 그 넷을 쓰면서 `LENGTH_RATIO_BOUNDS`
 * 조회가 `undefined` 가 되어 G8 이 예외로 죽었다 — 게이트가 침묵한 게 아니라
 * 터졌으니 그나마 낫지만, 타입 유니온과 표가 어긋나 있었다는 뜻이다.
 */
export type TargetLocale = 'de' | 'fr' | 'it' | 'ru' | 'ja' | 'es' | 'zh' | 'zh-TW';

export interface VerifyOptions {
  locale: TargetLocale;
  /** G11 금지어 — 스타일가이드/글로서리에서 주입. 소문자 비교. */
  bannedTerms?: string[];
  /** G9 예외 — 원문과 동일해도 정상인 값(브랜드·제품명). */
  keepAsIs?: string[];
  /** G8 길이비 검사 최소 원문 길이. 짧은 문구는 변동폭이 커서 의미가 없다. */
  lengthRatioMinChars?: number;
}

/** 플랜 v2.2 §3-[3] G8 — 언어별 허용 길이비. */
export const LENGTH_RATIO_BOUNDS: Record<TargetLocale, [number, number]> = {
  de: [0.9, 1.5],
  fr: [1.0, 1.4],
  it: [0.95, 1.35],
  ru: [0.85, 1.3],
  // 아래 넷의 기준 원문은 영어가 아니다. CJK 대상은 **한국어**를 원문으로 재는데
  // (만 단위 체계가 같아야 G3 가 성립한다 — apply-region-script-locale.ts 참고),
  // 한자는 같은 뜻을 한국어보다 짧게 담고 일본어는 가나 때문에 비슷하거나 조금
  // 길어진다. 스페인어만 영어 기준이고 로망스어 특유의 팽창이 있다.
  // 실측(2026-08-02, 한국어 기준 16편): 본문은 0.84~1.0 이지만 티저·제목 같은
  // 짧은 문자열은 0.63~0.81 로 떨어진다. 한자가 조사까지 함께 삼키기 때문이고
  // 잘못된 번역이 아니다 — 하한을 실측에 맞춘다.
  ja: [0.6, 1.35],
  // 실측(2026-08-02, 영어 기준 16편): 본문은 0.96~1.2 인데 티저·제목은 0.84~0.97 로
  // 내려간다. 카드 한 줄짜리 문구를 영어보다 길게 쓰면 오히려 잘리므로, 짧은
  // 문자열이 짧은 것은 결함이 아니다. 하한을 실측에 맞춘다.
  es: [0.84, 1.4],
  zh: [0.45, 1.0],
  'zh-TW': [0.45, 1.0],
};

// ── 토큰 추출기 ───────────────────────────────────────────────────────────────

/** 대상 언어 자체가 CJK 인 것들 — G10 의 전제가 성립하지 않는다. */
const CJK_LOCALES = new Set<TargetLocale>(['ja', 'zh', 'zh-TW']);

const GLOSSARY_TOKEN_RE = /⟦G\d+⟧/g;
const PLACEHOLDER_RE = /\{\{[^{}]*\}\}|\{[^{}]*\}|%\d+\$[sd]|%[sd]/g;
const TAG_RE = /<\/?([a-zA-Z][\w-]*)\b[^>]*>/g;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /(?:\+\d[\d\s()-]{6,}\d)/g;
const CURRENCY_RE = /[₩€$¥£₽]|\b(?:KRW|EUR|USD|JPY|GBP|RUB|CNY)\b/g;
const MD_LINK_RE = /\[[^\]]*\]\([^)]*\)/g;

/** 숫자 자릿수 구분기호로 쓰이는 공백류 — nbsp·narrow nbsp·thin space 포함. */
const DIGIT_SEPARATORS = /[.,    ]/;

/**
 * 숫자 값 멀티셋. **서식은 무시하고 값만 비교한다.**
 *
 * 천단위 구분기호만 제거한다 — **구분기호 뒤에 정확히 3자리가 올 때만.**
 *   `1,234.5`(en) → `1234` `5`
 *   `1.234,5`(de) → `1234` `5`   ← 같은 값으로 판정 (서식 변경 허용)
 *   `₩70,000` → `70000` vs `€70` → `70`   ← 다른 값 (H2 변조 검출)
 *
 * 🔴 "자릿수 사이 구분기호를 전부 제거"하면 **날짜가 뭉개진다** — 독일어 `12.10.2009`가
 * `12102009` 하나로 합쳐져 원문 `12 Oct 2009`([12, 2009])와 어긋난다(2026-07-26 실측 오탐).
 * 3자리 규칙은 천단위만 걸러내고 날짜는 `12` `10` `2009`로 남긴다.
 */
export function numberMultiset(text: string): string[] {
  const collapsed = text.replace(
    new RegExp(`(\\d)${DIGIT_SEPARATORS.source}(\\d{3})(?!\\d)`, 'g'),
    '$1$2',
  );
  // 🔴 선행 0은 값이 아니라 서식이다. 날짜를 현지 관례로 다시 쓰면 자리수가 채워진다 —
  // 원문 `6/18–7/5`(en) → `18/06–05/07`(fr)은 **같은 값**인데, 문자열로 비교하면
  // `06`≠`6`이라 "숫자 소실"로 잡혔다(2026-07-28 POI 번역 실측 오탐, 4개 언어 동시 탈락).
  // 이 함수의 계약은 "서식은 무시하고 값만 비교한다"이므로 여기서 정규화한다.
  return (collapsed.match(/\d+/g) ?? [])
    .map((n) => n.replace(/^0+(?=\d)/, ''))
    .sort();
}

/** 멀티셋 차집합 — a에는 있는데 b에는 없는 원소(중복 횟수까지 고려). */
function missingFrom(a: string[], b: string[]): string[] {
  const pool = [...b];
  const missing: string[] = [];
  for (const v of a) {
    const i = pool.indexOf(v);
    if (i === -1) missing.push(v);
    else pool.splice(i, 1);
  }
  return missing;
}

function multiset(text: string, re: RegExp): string[] {
  return (text.match(re) ?? []).slice().sort();
}

function tagNames(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TAG_RE)) out.push(m[1].toLowerCase());
  return out.sort();
}

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

// ── 개별 게이트 ───────────────────────────────────────────────────────────────

/** G2 — 글로서리 토큰이 그대로 살아 있는가. 마스킹 방어(H1)의 검증부. */
export function checkGlossaryTokens(source: string, target: string, pointer: string): Finding[] {
  const a = multiset(source, GLOSSARY_TOKEN_RE);
  const b = multiset(target, GLOSSARY_TOKEN_RE);
  if (sameMultiset(a, b)) return [];
  return [{
    gate: 'G2',
    severity: 'fail',
    pointer,
    message: `글로서리 토큰 불일치 — 원문 [${a.join(' ')}] vs 번역 [${b.join(' ')}]`,
  }];
}

/**
 * G3 — 숫자 값. H2(수치 변조) 검출.
 *
 * **비대칭 판정**이다.
 *   원문에 있는 숫자가 번역에서 사라짐 → `fail` (사실 손실. "40분"→"30분", ₩70,000→€70)
 *   번역에만 있는 숫자        → `flag` (대개 서식 변환. `12 Oct 2009`→`12.10.2009`는
 *                                     월 이름이 숫자가 되므로 `10`이 새로 생긴다)
 *
 * 대칭 비교로 두면 정상적인 날짜 현지화가 전부 실패로 잡혀 재큐 루프에 빠진다
 * (2026-07-26 실측 오탐).
 */
/**
 * 시각 표기 현지화 때문에 사라지는 숫자 토큰만 골라낸다. 두 갈래뿐이다.
 *
 *  - **`HH:00` 의 분** — 프랑스어·이탈리아어는 정각을 `9 h` 로 쓴다. 시(hour)가
 *    번역에 남아 있을 때만 `0` 하나를 면제한다.
 *  - **12시제 → 24시제** — 독일어·러시아어는 `2 pm` 을 `14:00` 으로 쓴다.
 *    `H` 나 `H+12` 가 번역에 있을 때만 `H` 하나를 면제한다.
 *
 * 면제에는 항상 상한이 있다 — 원문이 그 표기를 쓴 횟수만큼만. 그래서 번역이
 * 통째로 잘려도 나머지 숫자는 면제 대상이 아니고 fail 로 남는다.
 */
function clockNotationLosses(source: string, target: string): string[] {
  const inTarget = new Set(numberMultiset(target));
  const forgivable: string[] = [];

  for (const m of source.matchAll(/(?<!\d)(\d{1,2}):00(?!\d)/g)) {
    if (inTarget.has(String(Number(m[1])))) forgivable.push('0');
  }

  for (const m of source.matchAll(/(?<!\d)(\d{1,2})\s*([ap])\.?m\.?(?![\p{L}])/giu)) {
    const h = Number(m[1]);
    if (h < 1 || h > 12) continue;
    const twentyFour = String(m[2].toLowerCase() === 'p' ? (h % 12) + 12 : h % 12);
    if (inTarget.has(twentyFour) || inTarget.has(String(h))) forgivable.push(String(h));
  }

  // 12시제 **범위** — meridiem 이 범위의 끝에만 한 번 붙는다.
  //   `between 6:30 and 7:00 p.m.` → `zwischen 18:30 und 19:00` · `entre 18 h 30 et 19 h 00`
  // 위 규칙은 숫자에 **바로 붙은** meridiem 만 보므로 `6` 이 소실로 남았다
  // (`7:00 p.m.` 조차 매치되는 건 `00` 이라 시간대 밖으로 걸러진다).
  // 상한 두 겹: 원문에 실제로 있는 `H:MM` 토큰 수만큼만, 그리고 **`H+12` 가 번역에
  // 있고 `H` 는 없을 때만**. 잘린 번역에는 `H+12` 가 없으니 면제되지 않는다.
  if (/(?<!\d)\d{1,2}(?::\d{2})?\s*p\.?m\.?(?![\p{L}])/iu.test(source)) {
    for (const m of source.matchAll(/(?<!\d)(\d{1,2}):\d{2}(?!\d)/g)) {
      const h = Number(m[1]);
      if (h < 1 || h > 12) continue;
      const shifted = String((h % 12) + 12);
      if (inTarget.has(shifted) && !inTarget.has(String(h))) forgivable.push(String(h));
    }
  }

  return forgivable;
}

/**
 * 숫자가 **낱말로** 옮겨진 자리를 골라낸다. 값이 사라진 게 아니라 표기가 바뀐 것이라
 * `fail` 이 아니라 `flag` 로 내린다 — 연대 축약(`shorthandYears`)과 똑같은 층위다.
 * `flag` 는 `PUBLISHABLE` 이라 발행되면서 사람 감수 큐에는 남는다.
 *
 *   `in the 1970s`  → `negli anni Settanta`(it) · `in den Siebzigern`(de)
 *   `open 24 hours` → `rund um die Uhr geöffnet`(de)
 *
 * 🔴 **범위는 원문의 리터럴 패턴으로만 정한다** — 번역에 무엇이 있는지로 정하지 않는다.
 * 그래서 잘린 번역이 잃는 나머지 숫자는 전부 그대로 `fail` 이다(뮤테이션 테스트가 못박음).
 * 로케일별 어휘표가 필요 없는 것도 이 때문이다: 「어떤 낱말로 옮겼는가」를 묻지 않고
 * 「낱말로 옮겨지는 게 정상인 자리인가」만 묻는다.
 */
function spelledOutLosses(source: string, lost: string[]): string[] {
  const remaining = [...lost];
  const out: string[] = [];
  const take = (n: string): void => {
    const i = remaining.indexOf(n);
    if (i >= 0) {
      remaining.splice(i, 1);
      out.push(n);
    }
  };
  // 연대 — `1970s` 처럼 `s` 가 붙은 4자리만. 맨 연도(`1771`)는 해당 없다.
  for (const m of source.matchAll(/(?<!\d)((?:18|19|20)\d0)s(?![\p{L}])/gu)) take(m[1]);
  // 상시개방 관용구 — `open 24 hours`. 독일어는 숫자를 아예 안 쓴다.
  for (const m of source.matchAll(/(?<!\d)(24)\s*hours?(?![\p{L}])/giu)) take(m[1]);
  return out;
}

export function checkNumbers(source: string, target: string, pointer: string): Finding[] {
  const a = numberMultiset(source);
  const b = numberMultiset(target);
  if (sameMultiset(a, b)) return [];

  const findings: Finding[] = [];
  const lostRaw0 = missingFrom(a, b);
  const added = missingFrom(b, a);

  // 로마 숫자는 다른 기수법이지 다른 값이 아니다. 이탈리아어·프랑스어는 세기를
  // 이렇게 쓴다 — `15th-17th century` → `XV-XVII secolo` · `XVe-XVIIe siècle`.
  // 아라비아 숫자만 세면 15와 17이 통째로 "소실"로 잡혀 이탈리아어 다수가 탈락했다
  // (2026-07-28 실측). 천단위 구분기호를 이미 이해하는 것과 같은 층위의 처리다.
  const romanValues = romanNumeralValues(target);
  const lostRaw = lostRaw0.filter((n) => !romanValues.has(n));

  // 연대 축약은 소실이 아니라 서식이다 — 위의 "월 이름 → 숫자" 선례와 같은 부류.
  // `1970s-1980s`(en) → `anni '70-'80`(it) · `70er-80er`(de)는 그 언어의 정상
  // 표기이고 독자가 잃는 정보가 없다. 2026-07-28 실측: gemini·openai **둘 다**
  // 이렇게 쓴다 — 즉 모델을 바꿔 해결할 문제가 아니다. fail로 두면 이탈리아어
  // 손님은 현지 관용구 대신 **영어 전문**을 받게 되어 더 나쁘다.
  // 범위는 좁게: 원문의 4자리 연도(18xx~20xx)이고 그 뒤 두 자리가 번역에 있을 때만.
  const shorthandYears = lostRaw.filter(
    (n) => /^(1[89]|20)\d{2}$/.test(n) && added.includes(String(Number(n.slice(2)))),
  );
  // 시각 표기는 언어마다 다르고, 그 차이가 숫자 토큰으로 새어 나온다.
  //   `09:00–18:00`(en) → `9 h à 18 h`(fr) — `:00` 이 사라져 `0` 두 개가 "소실"
  //   `around 2 pm`(en) → `gegen 14:00 Uhr`(de) — 12시제→24시제라 `2` 가 "소실"
  // 두 경우 다 같은 시각이고 손님이 잃는 정보가 없다. 로마 숫자·연대 축약과 같은
  // 층위의 서식 처리다(2026-08-07 실측: 프랑스어·이탈리아어 fail 의 대부분이 이것).
  // 흡수 범위는 **그 시각에서 비롯한 토큰만**이라, 잘린 번역이 잃는 나머지 숫자는
  // 그대로 fail 로 남는다 — 아래 뮤테이션 테스트가 그걸 못박는다.
  // 멀티셋 차집합으로 뺀다 — 원문이 `HH:00` 을 두 번 썼으면 `0` 도 두 개까지만
  // 면제된다. `filter(includes)` 로 두면 같은 값 전부가 한꺼번에 면제돼 버린다.
  const clockOnly = clockNotationLosses(source, target);
  const lostAfterClock = missingFrom(
    lostRaw.filter((n) => !shorthandYears.includes(n)),
    clockOnly,
  );
  // 낱말로 옮겨진 자리는 fail 에서 빼고 아래에서 flag 로 따로 알린다.
  const spelledOut = spelledOutLosses(source, lostAfterClock);
  const lost = missingFrom(lostAfterClock, spelledOut);

  if (lost.length > 0) {
    findings.push({
      gate: 'G3',
      severity: 'fail',
      pointer,
      message: `숫자 소실 — 원문의 [${lost.join(' ')}] 이 번역에 없다 (원문 [${a.join(' ')}] vs 번역 [${b.join(' ')}])`,
    });
  }
  if (shorthandYears.length > 0) {
    findings.push({
      gate: 'G3',
      severity: 'flag',
      pointer,
      message: `연대 축약 — 원문 [${shorthandYears.join(' ')}] 이 두 자리로 표기됐다 (현지 관례면 정상)`,
    });
  }
  if (spelledOut.length > 0) {
    findings.push({
      gate: 'G3',
      severity: 'flag',
      pointer,
      message: `숫자가 낱말로 표기됨 — 원문 [${spelledOut.join(' ')}] (anni Settanta·rund um die Uhr 류면 정상)`,
    });
  }
  if (added.length > 0) {
    findings.push({
      gate: 'G3',
      severity: 'flag',
      pointer,
      message: `숫자 추가 — 번역에만 [${added.join(' ')}] 이 있다 (날짜 서식 변환이면 정상)`,
    });
  }
  return findings;
}

/**
 * 야드파운드법 흔적 — km→mile 류 단위 변환은 금지(규칙 3).
 *
 * 두 가지를 실측 오탐으로 배웠다(2026-07-26).
 *
 * 1. **`\b`를 쓰면 안 된다.** JS `\w`는 ASCII만이라 `ß`·`ü` 앞뒤에 가짜 경계가 생겨
 *    `\bFuß\b` 가 `Fußweg`(보행로)에 매치한다.
 * 2. **숫자가 앞에 와야 단위다.** 독일어 `Fuß`는 "발·밑동"이 본뜻이고 측정 단위는
 *    드문 용법이다 — `Becken am Fuß`(밑동의 웅덩이) · `zu Fuß`(걸어서)가 전부
 *    오탐이었다. 실제 단위 변환은 언제나 `30 miles` · `12 Fuß`처럼 수치를 동반한다.
 *
 * 3. **약어 `mi` 도 세어야 한다.** 재는 것은 "번역이 원문보다 야드파운드를 더 쓰는가"
 *    이므로, 원문 쪽의 `0.6 mi` 를 놓치면 번역의 `0,6 mile` 이 새로 생긴 단위로
 *    보인다(2026-08-07 실측 오탐 — 영어 원문 자체가 `mi` 로 적혀 있었다).
 *    수치가 앞서고 뒤가 글자가 아닐 때만이라 이탈리아어 `mi`(=나에게)는 안 걸린다.
 */
const IMPERIAL_RE = /\d[\d.,]*[\s -]*(?<![\p{L}])(miles?|mi\.|mi|Meilen?|miglia|miglio|мил[ья]|inch(?:es)?|Zoll|pollici|дюйм|foot|feet|Fuß|piedi|фут|pounds?|lbs?|Pfund|libbre|фунт)(?![\p{L}])/giu;

/**
 * 텍스트 안 로마 숫자의 값 집합.
 *
 * 좁게 잡는다 — 2글자 이상만 센다. 한 글자 `I`·`V`·`X`·`C`·`D`·`M`은 이탈리아어
 * 관사·약어·머리글자와 충돌해서 오탐이 너무 많다(`I giardini`, `D. Kim`).
 * 세기 표기는 언제나 두 글자 이상(`IX`·`XV`·`XVII`)이므로 실제 용도는 다 걸린다.
 * 이탈리아어·프랑스어의 서수 접미사(`XVe`·`XVII°`)도 뒤에 붙을 수 있어 허용한다.
 */
const ROMAN_RE = /(?<![\p{L}])([IVXLCDM]{2,})(?:[eè°º]|er|ème|mo|esimo)?(?![\p{L}])/gu;
const ROMAN_DIGITS: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export function romanNumeralValues(text: string): Set<string> {
  const values = new Set<string>();
  for (const match of text.matchAll(ROMAN_RE)) {
    const glyphs = match[1].toUpperCase();
    let total = 0;
    let valid = true;
    for (let i = 0; i < glyphs.length; i += 1) {
      const current = ROMAN_DIGITS[glyphs[i]];
      const next = ROMAN_DIGITS[glyphs[i + 1]];
      if (!current) {
        valid = false;
        break;
      }
      total += next && next > current ? -current : current;
    }
    if (valid && total > 0) values.add(String(total));
  }
  return values;
}

/** ISO 코드 ↔ 기호는 같은 통화다. 비교 전에 한쪽으로 모은다. */
const CURRENCY_ALIAS: Record<string, string> = {
  KRW: '₩',
  EUR: '€',
  USD: '$',
  JPY: '¥',
  GBP: '£',
  RUB: '₽',
  CNY: '¥',
};

function normalizeCurrency(token: string): string {
  return CURRENCY_ALIAS[token.toUpperCase()] ?? token;
}

/** G4 — 통화 기호·ISO 코드 동일 + 단위 변환 검출. */
export function checkCurrencyAndUnits(source: string, target: string, pointer: string): Finding[] {
  const findings: Finding[] = [];

  // 코드와 기호는 **같은 통화의 다른 표기**다. `KRW` → `₩` 는 값도 통화도 바뀌지
  // 않았는데 문자열 비교로는 불일치였다(2026-07-28 실측, 프랑스어 다수 탈락).
  // 정규화 후 비교하므로 `₩` → `€` 같은 진짜 통화 변조는 그대로 잡힌다.
  //
  // **횟수가 아니라 종류를 센다.** 기호를 몇 번 되풀이하는지는 통화가 아니라 서식이다 —
  // 프랑스어는 기호를 숫자 뒤에 두고 범위마다 다시 쓰지 않는다:
  //   `≈₩15,000–₩25,000` → `≈15 000–25 000 ₩`  (₩ 5개 → 4개, 금액은 그대로)
  // 잡아야 할 것은 종류가 어긋나는 것이고, 그건 집합 차집합으로 양방향 다 걸린다 —
  // `₩`→`€`(변조)도, `₩`→없음(잘림·소실)도 그대로 실패한다. 금액 자체가 사라지는
  // 경우는 G3 이 숫자 소실로 따로 잡는다.
  const a = [...new Set(multiset(source, CURRENCY_RE).map(normalizeCurrency))].sort();
  const b = [...new Set(multiset(target, CURRENCY_RE).map(normalizeCurrency))].sort();
  const dropped = a.filter((c) => !b.includes(c));
  const appeared = b.filter((c) => !a.includes(c));
  if (dropped.length > 0 || appeared.length > 0) {
    findings.push({
      gate: 'G4',
      severity: 'fail',
      pointer,
      message: `통화 표기 불일치 — 원문 [${a.join(' ')}] vs 번역 [${b.join(' ')}]`,
    });
  }

  const sourceImperial = countMatches(source, IMPERIAL_RE);
  const targetImperial = countMatches(target, IMPERIAL_RE);
  if (targetImperial > sourceImperial) {
    findings.push({
      gate: 'G4',
      severity: 'fail',
      pointer,
      message: '단위 변환 흔적 — 원문에 없는 야드파운드 단위가 번역에 등장(km→mile 금지)',
    });
  }

  return findings;
}

/** G5 — 플레이스홀더 개수·이름 동일. */
export function checkPlaceholders(source: string, target: string, pointer: string): Finding[] {
  const a = multiset(source, PLACEHOLDER_RE);
  const b = multiset(target, PLACEHOLDER_RE);
  if (sameMultiset(a, b)) return [];
  return [{
    gate: 'G5',
    severity: 'fail',
    pointer,
    message: `플레이스홀더 불일치 — 원문 [${a.join(' ')}] vs 번역 [${b.join(' ')}]`,
  }];
}

/** G6 — HTML 태그 트리 + 마크다운 구조 동일. */
export function checkMarkup(source: string, target: string, pointer: string): Finding[] {
  const findings: Finding[] = [];

  const a = tagNames(source);
  const b = tagNames(target);
  if (!sameMultiset(a, b)) {
    findings.push({
      gate: 'G6',
      severity: 'fail',
      pointer,
      message: `HTML 태그 불일치 — 원문 [${a.join(' ')}] vs 번역 [${b.join(' ')}]`,
    });
  }

  const aLinks = countMatches(source, MD_LINK_RE);
  const bLinks = countMatches(target, MD_LINK_RE);
  if (aLinks !== bLinks) {
    findings.push({
      gate: 'G6',
      severity: 'fail',
      pointer,
      message: `마크다운 링크 개수 불일치 — 원문 ${aLinks} vs 번역 ${bLinks}`,
    });
  }

  // 🔴 별표 **문자**가 아니라 **짝이 맞는 강조**를 센다. `/\*\*/g` 로 세면
  // 빈 강조 `****` 가 2로, 짝 없는 `**` 하나가 1로 잡히는데 렌더러는 둘 다
  // 강조로 치지 않는다 — 세는 쪽과 그리는 쪽이 다른 규칙을 쓰면, 번역이 멀쩡한데
  // 경고가 뜨거나 강조가 통째로 사라졌는데 조용하다. 판정은 렌더러와 같은
  // 파일(`lib/text/emphasis.ts`)에서 온다.
  const aBold = countEmphasis(source);
  const bBold = countEmphasis(target);
  if (aBold !== bBold) {
    findings.push({
      gate: 'G6',
      severity: 'flag',
      pointer,
      message: `강조 개수 불일치 — 원문 ${aBold} vs 번역 ${bBold}`,
    });
  }

  return findings;
}

/** G7 — URL·이메일·전화번호는 문자 단위 동일. */
export function checkVerbatim(source: string, target: string, pointer: string): Finding[] {
  const findings: Finding[] = [];
  const pairs: Array<[string, RegExp]> = [
    ['URL', URL_RE],
    ['이메일', EMAIL_RE],
    ['전화번호', PHONE_RE],
  ];
  for (const [label, re] of pairs) {
    const a = multiset(source, re);
    const b = multiset(target, re);
    if (!sameMultiset(a, b)) {
      findings.push({
        gate: 'G7',
        severity: 'fail',
        pointer,
        message: `${label} 불일치 — 원문 [${a.join(' ')}] vs 번역 [${b.join(' ')}]`,
      });
    }
  }
  return findings;
}

/** G8 — 길이비. 레이아웃 붕괴·요약·증량의 신호. 플래그만. */
export function checkLengthRatio(
  source: string,
  target: string,
  pointer: string,
  locale: TargetLocale,
  minChars = 30,
): Finding[] {
  if (source.trim().length < minChars) return [];
  const [lo, hi] = LENGTH_RATIO_BOUNDS[locale];
  const ratio = target.length / source.length;
  if (ratio >= lo && ratio <= hi) return [];
  return [{
    gate: 'G8',
    severity: 'flag',
    pointer,
    message: `길이비 ${ratio.toFixed(2)} 가 ${locale} 허용범위 ${lo}–${hi} 밖`,
  }];
}

/**
 * 🔴 번역 **생성 중** 잘림 탐지 — 게이트(G8)가 아니라 translate.ts 가 쓰는 것이다.
 *
 * 2026-08-07 실행에서 독일어 세그먼트 3개가 **문장 중간에서 끊긴 채** 출력 파일에
 * 들어갔다. 셋 다 독일어 여는 따옴표 `„` 직후에 끊겼고, 한 건은 `note` 에
 * `.}]}``` 같은 JSON 파편이 같이 담겨 있었다 — 모델이 문자열 밖으로 튀어나간 뒤
 * 스키마가 그 잔해를 삼킨 것이다. `max_tokens` 가 아니다: 잘린 포인터 **뒤의**
 * 세그먼트들은 멀쩡히 번역돼 있었고 총 출력은 상한의 20%도 안 됐다.
 *
 * translate.ts 는 포인터 **집합**만 맞으면 통과시켜서 이걸 못 봤고, 몇 시간 뒤
 * verify 의 G3(숫자 소실)가 대신 잡았다. 생성하는 자리에서 잡아야 재시도가 싸다.
 *
 * 🔴 G8 과 문턱이 다른 것은 의도다. G8(de 0.9–1.5)은 **품질** 대역이라 플래그만
 * 하지만, 이건 재요청을 발동시키므로 정상적인 압축에는 절대 걸리면 안 된다.
 * 실측(2026-08-07, de·fr·it 번역 세그먼트 6,752개): 0.6 미만은 정확히 3개이고
 * **셋 다 진짜 잘림**이었다. 오탐 0. 문턱을 올리려면 같은 corpus 로 다시 재라.
 */
export const TRUNCATION_RATIO_FLOOR = 0.6;
/** 짧은 문구는 길이비 변동이 커서 의미가 없다 — G8 의 30자보다 훨씬 보수적으로 잡는다. */
export const TRUNCATION_MIN_CHARS = 200;

/**
 * 잘린 것으로 보이는 포인터를 돌려준다. 빈 문자열은 규칙 6(확신 없음)이라 제외한다 —
 * 그건 의도된 값이고 apply.ts 가 영어로 폴백한다.
 */
export function findTruncatedSegments(
  sources: Record<string, string>,
  targets: Record<string, string>,
): Array<{ pointer: string; ratio: number }> {
  const hits: Array<{ pointer: string; ratio: number }> = [];
  for (const [pointer, target] of Object.entries(targets)) {
    const source = sources[pointer];
    if (typeof source !== 'string' || source.length < TRUNCATION_MIN_CHARS) continue;
    if (!target.trim()) continue;
    const ratio = target.length / source.length;
    if (ratio < TRUNCATION_RATIO_FLOOR) hits.push({ pointer, ratio });
  }
  return hits;
}

/** G9 — 미번역 잔존. 원문과 동일하면 플래그(고유명사·브랜드는 예외). */
export function checkUntranslated(
  source: string,
  target: string,
  pointer: string,
  keepAsIs: string[] = [],
): Finding[] {
  const s = source.trim();
  const t = target.trim();
  if (s !== t) return [];
  if (s.length <= 3) return [];
  // 글로서리 토큰만으로 이뤄진 문자열은 원문 유지가 정상.
  if (s.replace(GLOSSARY_TOKEN_RE, '').trim().length === 0) return [];
  if (keepAsIs.some((term) => term.length > 0 && s.toLowerCase() === term.toLowerCase())) return [];
  return [{
    gate: 'G9',
    severity: 'flag',
    pointer,
    message: '미번역 잔존 — 번역이 원문과 동일',
  }];
}

const CJK_RE = /[　-〿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]/g;
const CYRILLIC_RE = /\p{Script=Cyrillic}/gu;

/**
 * G10 — 문자셋. 로케일 교차 오염(H8) 검출.
 *
 * 🔴 CJK는 **원문 대비**로 판정한다. 이 상품 원문(en)에는 한국어 병기가 흔하다 —
 * `haenyeo (해녀, women divers)` · `1100 Rest Area (1100 휴게소)`. 규칙 1(정보 삭제 금지)에
 * 따라 번역은 이걸 **보존해야** 하므로, 타깃만 보고 CJK를 막으면 올바른 번역이
 * 전부 실패한다(2026-07-26 실측 오탐). 원문보다 **늘어났을 때만** 오염이다.
 */
export function checkCharset(
  target: string,
  pointer: string,
  locale: TargetLocale,
  source = '',
): Finding[] {
  const findings: Finding[] = [];

  // 🔴 대상 언어 자체가 CJK 면 이 검사는 물음이 성립하지 않는다.
  //
  // G10 이 잡으려는 것은 "원문 언어의 글자가 번역에 새어 들어왔다"이다 —
  // 독일어 번역에 한국어가 남아 있으면 미번역이니까. 그런데 중국어·일본어
  // 번역은 **CJK 문자가 늘어나는 것이 정상**이고, 한국어를 원문으로 재면
  // 늘어나지 않는 편이 오히려 이상하다(2026-08-02 실측: 올바른 중국어 번역
  // 8건이 전부 여기서 탈락했다).
  //
  // 이 게이트는 넷(de·fr·it·ru)만 있던 시절에 쓰였고 그때는 전제가 참이었다.
  // 대상 언어가 늘면 전제도 같이 확인해야 한다.
  const cjkTarget = countMatches(target, CJK_RE);
  const cjkSource = countMatches(source, CJK_RE);
  if (!CJK_LOCALES.has(locale) && cjkTarget > cjkSource) {
    findings.push({
      gate: 'G10',
      severity: 'fail',
      pointer,
      message: `CJK 문자가 원문 ${cjkSource}자 → 번역 ${cjkTarget}자로 증가 — 로케일 교차 오염`,
    });
  }

  const letters = (target.match(/\p{L}/gu) ?? []).length;
  const cyrillic = countMatches(target, CYRILLIC_RE);

  if (locale === 'ru') {
    // 키릴 비율 하한. 라틴 고유명사가 섞이므로 60%.
    //
    // 🔴 원문에 그대로 있던 라틴 낱말은 분모에서 뺀다. 고유명사가 빽빽한 짧은
    // 문구 — `Lost Valley Audi Q5 safari + Zoo-Topia` — 는 **올바르게 번역해도**
    // 키릴 60%에 닿을 수 없다. 즉 어떤 정답도 통과 못 하는 입력이었다
    // (2026-07-28 실측: everland 26%, arte_museum 40%).
    // 원문에 없던 라틴 낱말이 그대로 남는 진짜 미번역은 그대로 잡힌다.
    const kept = new Set(
      (source.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).map((w) => w.toLowerCase()),
    );
    const latinFromSource = (target.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [])
      .filter((w) => kept.has(w.toLowerCase()))
      .reduce((sum, w) => sum + (w.match(/\p{L}/gu) ?? []).length, 0);
    const judged = letters - latinFromSource;
    if (letters >= 10 && cyrillic === 0) {
      // 🔴 위 공제가 열 뻔한 구멍: 영어를 통째로 되돌려주면 분모가 0이 되어
      // 비율 검사를 건너뛴다 — G10 이 막으라고 있는 바로 그 경우다. 키릴이 한 자도
      // 없으면 고유명사 밀도와 무관하게 미번역이다.
      findings.push({
        gate: 'G10',
        severity: 'fail',
        pointer,
        message: '키릴 문자가 하나도 없다 — 러시아어 미번역',
      });
    } else if (judged >= 10 && cyrillic / judged < 0.6) {
      findings.push({
        gate: 'G10',
        severity: 'fail',
        pointer,
        message: `키릴 비율 ${((cyrillic / judged) * 100).toFixed(0)}% < 60% (원문 고유명사 ${latinFromSource}자 제외) — 러시아어 미번역 의심`,
      });
    }
  } else if (cyrillic > 0) {
    findings.push({
      gate: 'G10',
      severity: 'fail',
      pointer,
      message: `키릴 문자 ${cyrillic}자 혼입 — ${locale} 번역에 있을 수 없다`,
    });
  }

  return findings;
}

/**
 * 메타언급 — 번역 결과물이 자신이 번역임을 말하면 안 된다.
 *
 * 어순이 언어마다 다르므로(독일어 `von KI übersetzt` / `übersetzt von KI`)
 * 「AI 지칭어」와 「번역 동사」를 각각 잡고 근접 여부로 판정한다.
 */
const META_DIRECT_RE = /\b(?:as an AI|machine[- ]translat\w*|KI[- ]übersetzt|maschinell übersetzt|traduction automatique|traduzione automatica|машинный перевод|ChatGPT|Claude|GPT-\d)\b/gi;
const META_AI_NOUN_RE = /\b(?:AI|KI|IA|ИИ)\b/g;
const META_TRANSLATE_VERB_RE = /\b(?:translated|übersetzt|traduit|traduite|tradotto|tradotta|перевед\w+)\b/gi;

function findMetaMention(text: string): string | null {
  const direct = text.match(META_DIRECT_RE);
  if (direct) return direct[0];

  // AI 지칭어와 번역 동사가 같은 문자열에 함께 등장하면 메타언급으로 본다.
  META_AI_NOUN_RE.lastIndex = 0;
  META_TRANSLATE_VERB_RE.lastIndex = 0;
  const noun = text.match(META_AI_NOUN_RE);
  const verb = text.match(META_TRANSLATE_VERB_RE);
  if (noun && verb) return `${noun[0]} … ${verb[0]}`;

  return null;
}

/** G11 — 금지어·메타언급. */
export function checkBannedTerms(
  target: string,
  pointer: string,
  bannedTerms: string[] = [],
): Finding[] {
  const findings: Finding[] = [];

  const meta = findMetaMention(target);
  if (meta) {
    findings.push({
      gate: 'G11',
      severity: 'fail',
      pointer,
      message: `메타언급 검출 — "${meta}"`,
    });
  }

  const lower = target.toLowerCase();
  for (const term of bannedTerms) {
    const t = term.trim().toLowerCase();
    if (t.length > 0 && lower.includes(t)) {
      findings.push({
        gate: 'G11',
        severity: 'flag',
        pointer,
        message: `금지어 "${term}" 사용`,
      });
    }
  }

  return findings;
}

// ── G1 구조 + 전체 실행 ───────────────────────────────────────────────────────

export interface UnitPayload {
  /** pointer → 텍스트. */
  segments: Record<string, string>;
}

export interface VerifyResult {
  findings: Finding[];
  /** fail 1건 이상 → 재큐 대상. */
  failed: boolean;
  /** flag만 있음 → 발행 가능하나 감수 큐. */
  flagged: boolean;
  stats: { segments: number; fails: number; flags: number };
}

/**
 * G1 — 구조. **포인터 집합이 정확히 같아야 한다.**
 *
 * 누락(문장 삭제)·추가(창작)·병합(문장 합치기)이 전부 여기서 잡힌다.
 * v2.2가 지적한 대로 API `json_schema`를 쓸 수 없으므로 이것이 스키마 강제의 대체물이다.
 */
export function checkStructure(source: UnitPayload, target: UnitPayload): Finding[] {
  const findings: Finding[] = [];
  const a = new Set(Object.keys(source.segments));
  const b = new Set(Object.keys(target.segments));

  for (const p of a) {
    if (!b.has(p)) {
      findings.push({ gate: 'G1', severity: 'fail', pointer: p, message: '포인터 누락 — 번역 출력에 없음' });
    }
  }
  for (const p of b) {
    if (!a.has(p)) {
      findings.push({ gate: 'G1', severity: 'fail', pointer: p, message: '포인터 추가 — 입력에 없는 포인터' });
    }
  }
  return findings;
}

/** 빈 문자열 — 규칙 6(불확실하면 빈 문자열)의 산출물. 발행 제외 대상이라 플래그. */
function checkEmpty(target: string, pointer: string): Finding[] {
  if (target.trim().length > 0) return [];
  return [{
    gate: 'G1',
    severity: 'flag',
    pointer,
    message: '빈 번역 — 규칙 6에 따른 미번역. 이 포인터는 발행에서 제외(영어 폴백)',
  }];
}

/** G1~G11 전부 실행. */
export function verifyUnit(
  source: UnitPayload,
  target: UnitPayload,
  options: VerifyOptions,
): VerifyResult {
  const findings: Finding[] = [...checkStructure(source, target)];

  for (const [pointer, src] of Object.entries(source.segments)) {
    const tgt = target.segments[pointer];
    if (typeof tgt !== 'string') continue; // G1이 이미 보고했다.

    findings.push(...checkEmpty(tgt, pointer));
    if (tgt.trim().length === 0) continue; // 빈 값에 나머지 게이트를 돌릴 의미가 없다.

    findings.push(
      ...checkGlossaryTokens(src, tgt, pointer),
      ...checkNumbers(src, tgt, pointer),
      ...checkCurrencyAndUnits(src, tgt, pointer),
      ...checkPlaceholders(src, tgt, pointer),
      ...checkMarkup(src, tgt, pointer),
      ...checkVerbatim(src, tgt, pointer),
      ...checkLengthRatio(src, tgt, pointer, options.locale, options.lengthRatioMinChars),
      ...checkUntranslated(src, tgt, pointer, options.keepAsIs),
      ...checkCharset(tgt, pointer, options.locale, src),
      ...checkBannedTerms(tgt, pointer, options.bannedTerms),
    );
  }

  const fails = findings.filter((f) => f.severity === 'fail').length;
  const flags = findings.length - fails;

  return {
    findings,
    failed: fails > 0,
    flagged: fails === 0 && flags > 0,
    stats: { segments: Object.keys(source.segments).length, fails, flags },
  };
}
