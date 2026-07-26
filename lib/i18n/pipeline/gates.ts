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

export type Severity = 'fail' | 'flag';
// G12는 플랜에서 **교차 유닛 일관성** 검사용으로 예약돼 있다(§9, 미구현).
// 로케일 조판 검사는 그 뒤 번호를 쓴다.
export type GateId =
  | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6'
  | 'G7' | 'G8' | 'G9' | 'G10' | 'G11' | 'G13';

export interface Finding {
  gate: GateId;
  severity: Severity;
  pointer: string;
  message: string;
}

export type TargetLocale = 'de' | 'fr' | 'it' | 'ru';

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
};

// ── 토큰 추출기 ───────────────────────────────────────────────────────────────

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
export function numberMultiset(
  text: string,
  options: { spaceAsGroupSeparator?: boolean } = {},
): string[] {
  const separators = options.spaceAsGroupSeparator === false ? '[.,]' : DIGIT_SEPARATORS.source;
  const collapsed = text.replace(
    new RegExp(`(\\d)${separators}(\\d{3})(?!\\d)`, 'g'),
    '$1$2',
  );
  return (collapsed.match(/\d+/g) ?? []).slice().sort();
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
 * 숫자가 통째로 흡수되는 관용구. 다의성이 없으므로 **완전 면제**한다.
 *
 * 2026-07-26 실측 오탐: `open 24h` · `24-hour pedestrian street` 를 독일어로 옮기면
 * `rund um die Uhr geöffnet` 가 되어 `24`가 사라진다. 사실은 그대로다.
 * `24/7` 은 같은 관용구가 **두 숫자를 함께** 삼키므로 `7` 도 같은 표를 쓴다.
 */
const ROUND_THE_CLOCK: Record<TargetLocale, RegExp[]> = {
  de: [/rund um die uhr/i, /durchgehend geöffnet/i, /ganztägig geöffnet/i],
  fr: [/en continu/i, /jour et nuit/i, /jour comme nuit/i],
  it: [/giorno e notte/i, /sempre apert[oa]/i],
  ru: [/круглосуточн/i],
};

const NUMERAL_IDIOMS: Record<TargetLocale, Record<string, RegExp[]>> = {
  de: { '24': ROUND_THE_CLOCK.de, '7': ROUND_THE_CLOCK.de },
  fr: { '24': ROUND_THE_CLOCK.fr, '7': ROUND_THE_CLOCK.fr },
  it: { '24': ROUND_THE_CLOCK.it, '7': ROUND_THE_CLOCK.it },
  ru: { '24': ROUND_THE_CLOCK.ru, '7': ROUND_THE_CLOCK.ru },
};

/**
 * 철자로 쓴 수사. 각 언어 관례상 작은 수는 낱말로 적는다
 * (독일어 Duden: 12 이하 — `~1 hour` → `rund eine Stunde`).
 *
 * 🔴 **면제가 아니라 flag 강등**이다. `eine`·`un`·`una` 는 부정관사와 형태가 겹쳐
 * 문장 어디에나 나타난다 — 면제해 버리면 `1 hour`→`zwei Stunden` 같은 진짜 변조도
 * 함께 통과한다. 발행은 막지 않되 감수 큐에는 올린다.
 *
 * 🔴 **뒤쪽 경계를 두지 않는다** — 수사는 합성어·서수의 앞머리로 붙는다.
 * `4-story` → `vierstöckig` · `world's 5th tallest` → `fünfthöchster`
 * (2026-07-26 실측). 예외는 `1` 하나뿐이다: 독일어 `ein-`은 `einige`·`einfach`·
 * `einmal` 등 수와 무관한 낱말의 앞머리이기도 해서 뒤쪽 경계를 유지한다.
 *
 * 서수가 기수와 어간을 공유하지 않는 언어(이탈리아어 `quinto`, 러시아어 `пятый`,
 * 프랑스어 `premier`)는 서수형을 따로 넣는다.
 */
const NUMERAL_WORDS: Record<TargetLocale, Record<string, RegExp[]>> = {
  de: {
    // 정각의 분은 생략될 수 있다 — `14:00` → `14 Uhr`. 아래 fr 주석 참조.
    '0': [/\d\s*Uhr(?!\s*\d)/u],
    '1': [/(?<!\p{L})ein(e[mnrs]?|s)?(?!\p{L})/iu, /(?<!\p{L})erst/iu],
    '2': [/(?<!\p{L})zwei/iu, /(?<!\p{L})zweit/iu], '3': [/(?<!\p{L})drei/iu],
    '4': [/(?<!\p{L})vier/iu], '5': [/(?<!\p{L})fünf/iu], '6': [/(?<!\p{L})sech/iu],
    '7': [/(?<!\p{L})sieb/iu], '8': [/(?<!\p{L})acht/iu], '9': [/(?<!\p{L})neun/iu],
    '10': [/(?<!\p{L})zehn/iu], '11': [/(?<!\p{L})elf/iu], '12': [/(?<!\p{L})zwölf/iu],
  },
  fr: {
    // 🔴 프랑스어 시각 표기는 **정각의 분을 적지 않는다** — `14:00–14:30` → `14 h–14 h 30`.
    //    `00`이 사라지지만 값은 그대로다(2026-07-26 실측). 분이 뒤따르지 않는
    //    시(時) 표시가 있으면 소실된 `0`을 그 관례로 본다.
    '0': [/\d\s*h(?!\s*\d)/u],
    '1': [/(?<!\p{L})une?(?!\p{L})/iu, /(?<!\p{L})premi[eè]r/iu],
    '2': [/(?<!\p{L})deux/iu, /(?<!\p{L})second/iu], '3': [/(?<!\p{L})trois/iu],
    '4': [/(?<!\p{L})quatr/iu], '5': [/(?<!\p{L})cinq/iu], '6': [/(?<!\p{L})six/iu],
    '7': [/(?<!\p{L})sept/iu], '8': [/(?<!\p{L})huit/iu], '9': [/(?<!\p{L})neuv?/iu],
    '10': [/(?<!\p{L})dix/iu], '11': [/(?<!\p{L})onz/iu], '12': [/(?<!\p{L})douz/iu],
  },
  it: {
    '0': [/(?<!\p{L})ore\s*\d/iu, /\d\s*h(?!\s*\d)/u],
    '1': [/(?<!\p{L})un[oa']?(?!\p{L})/iu, /(?<!\p{L})prim[oaie]/iu],
    '2': [/(?<!\p{L})due/iu, /(?<!\p{L})second/iu],
    '3': [/(?<!\p{L})tre(?!\p{L})/iu, /(?<!\p{L})terz/iu],
    '4': [/(?<!\p{L})quattro/iu, /(?<!\p{L})quart/iu],
    '5': [/(?<!\p{L})cinque/iu, /(?<!\p{L})quint/iu],
    '6': [/(?<!\p{L})sei(?!\p{L})/iu, /(?<!\p{L})sest/iu],
    '7': [/(?<!\p{L})sette/iu, /(?<!\p{L})settim/iu],
    '8': [/(?<!\p{L})otto/iu, /(?<!\p{L})ottav/iu],
    '9': [/(?<!\p{L})nove/iu, /(?<!\p{L})non[oaie](?!\p{L})/iu],
    '10': [/(?<!\p{L})dieci/iu, /(?<!\p{L})decim/iu],
    '11': [/(?<!\p{L})undic/iu], '12': [/(?<!\p{L})dodic/iu],
  },
  ru: {
    '0': [/\d\s*ч(?!\s*\d)/u],
    '1': [/(?<!\p{L})од(ин|на|но)(?!\p{L})/iu, /(?<!\p{L})перв/iu],
    '2': [/(?<!\p{L})дв[ае](?!\p{L})/iu, /(?<!\p{L})втор/iu],
    '3': [/(?<!\p{L})тр[еи][хй]?(?!\p{L})/iu, /(?<!\p{L})трет/iu],
    '4': [/(?<!\p{L})четыр/iu, /(?<!\p{L})четв[её]рт/iu],
    '5': [/(?<!\p{L})пят/iu], '6': [/(?<!\p{L})шест/iu], '7': [/(?<!\p{L})седьм/iu, /(?<!\p{L})семь(?!\p{L})/iu],
    '8': [/(?<!\p{L})восьм/iu, /(?<!\p{L})восемь(?!\p{L})/iu], '9': [/(?<!\p{L})девят/iu],
    '10': [/(?<!\p{L})десят/iu], '11': [/(?<!\p{L})одиннадцат/iu], '12': [/(?<!\p{L})двенадцат/iu],
  },
};

/**
 * 월 이름. 날짜 현지화는 **양방향**으로 숫자를 옮긴다.
 *   `12 Oct 2009` → `12.10.2009`  월 이름이 숫자가 된다 → 이미 `숫자 추가` flag
 *   `Global Geopark 2010-10` → `Oktober 2010`  숫자가 월 이름이 된다 → 여기
 * (2026-07-26 실측). 철자 수사와 같은 정책으로 **flag 강등**한다.
 */
const MONTH_NAMES: Record<TargetLocale, Record<string, RegExp[]>> = {
  de: {
    '1': [/(?<!\p{L})jan/iu], '2': [/(?<!\p{L})feb/iu], '3': [/(?<!\p{L})mär/iu],
    '4': [/(?<!\p{L})apr/iu], '5': [/(?<!\p{L})mai(?!\p{L})/iu], '6': [/(?<!\p{L})jun/iu],
    '7': [/(?<!\p{L})jul/iu], '8': [/(?<!\p{L})aug/iu], '9': [/(?<!\p{L})sep/iu],
    '10': [/(?<!\p{L})okt/iu], '11': [/(?<!\p{L})nov/iu], '12': [/(?<!\p{L})dez/iu],
  },
  fr: {
    '1': [/(?<!\p{L})janv/iu], '2': [/(?<!\p{L})f[ée]vr/iu], '3': [/(?<!\p{L})mars(?!\p{L})/iu],
    '4': [/(?<!\p{L})avr/iu], '5': [/(?<!\p{L})mai(?!\p{L})/iu], '6': [/(?<!\p{L})juin/iu],
    '7': [/(?<!\p{L})juil/iu], '8': [/(?<!\p{L})ao[uû]t/iu], '9': [/(?<!\p{L})septembre/iu],
    '10': [/(?<!\p{L})oct/iu], '11': [/(?<!\p{L})nov/iu], '12': [/(?<!\p{L})d[ée]c/iu],
  },
  it: {
    '1': [/(?<!\p{L})genn/iu], '2': [/(?<!\p{L})febb/iu], '3': [/(?<!\p{L})marzo/iu],
    '4': [/(?<!\p{L})aprile/iu], '5': [/(?<!\p{L})magg/iu], '6': [/(?<!\p{L})giugno/iu],
    '7': [/(?<!\p{L})luglio/iu], '8': [/(?<!\p{L})agosto/iu], '9': [/(?<!\p{L})sett/iu],
    '10': [/(?<!\p{L})ottobre/iu], '11': [/(?<!\p{L})novembre/iu], '12': [/(?<!\p{L})dicembre/iu],
  },
  ru: {
    '1': [/(?<!\p{L})янв/iu], '2': [/(?<!\p{L})февр?/iu], '3': [/(?<!\p{L})март/iu],
    '4': [/(?<!\p{L})апрел?/iu], '5': [/(?<!\p{L})ма[йя](?!\p{L})/iu], '6': [/(?<!\p{L})июн/iu],
    '7': [/(?<!\p{L})июл/iu], '8': [/(?<!\p{L})авг/iu], '9': [/(?<!\p{L})сент/iu],
    '10': [/(?<!\p{L})окт/iu], '11': [/(?<!\p{L})нояб/iu], '12': [/(?<!\p{L})дек/iu],
  },
};

function matchesAny(text: string, patterns: RegExp[] | undefined): boolean {
  return patterns !== undefined && patterns.some((re) => re.test(text));
}

/**
 * 연대를 낱말로 적은 표기. `1950s fires` → it `incendi degli anni Cinquanta`
 * (2026-07-26 실측). 십의 자리만 보면 되므로 표는 10~90 아홉 칸이면 충분하다.
 */
const DECADE_WORDS: Record<TargetLocale, Record<string, RegExp>> = {
  de: {
    10: /zehner/i, 20: /zwanziger/i, 30: /dreißiger/i, 40: /vierziger/i, 50: /fünfziger/i,
    60: /sechziger/i, 70: /siebziger/i, 80: /achtziger/i, 90: /neunziger/i,
  },
  fr: {
    10: /(?<!\p{L})dix(?!\p{L})/iu, 20: /vingt/i, 30: /trente/i, 40: /quarante/i, 50: /cinquante/i,
    60: /soixante/i, 70: /soixante-dix/i, 80: /quatre-vingt/i, 90: /quatre-vingt-dix/i,
  },
  it: {
    10: /dieci/i, 20: /venti/i, 30: /trenta/i, 40: /quaranta/i, 50: /cinquanta/i,
    60: /sessanta/i, 70: /settanta/i, 80: /ottanta/i, 90: /novanta/i,
  },
  ru: {
    10: /десят/i, 20: /двадцат/i, 30: /тридцат/i, 40: /сороков/i, 50: /пятидесят/i,
    60: /шестидесят/i, 70: /семидесят/i, 80: /восьмидесят/i, 90: /девяност/i,
  },
};

/**
 * 소실된 숫자가 연대이고, 번역에 그 연대 표기가 있는가.
 *
 * 두 가지 형태를 본다.
 *   낱말   `1950s` → it `anni Cinquanta`
 *   축약   `1930s` → it `anni '30 del Novecento` (2026-07-26 실측)
 * 축약형은 아포스트로피 뒤 두 자리라 언어를 가리지 않는다.
 */
function hasDecadeWord(text: string, token: string, locale: TargetLocale): boolean {
  const m = /^(?:1[89]|20)(\d)0$/.exec(token);
  if (m === null) return false;

  const tens = `${m[1]}0`;
  if (new RegExp(`['’]\\s?${tens}(?!\\d)`).test(text)) return true;

  const re = DECADE_WORDS[locale][tens];
  return re !== undefined && re.test(text);
}

/** 40 이하 정수의 로마 숫자. 세기 표기에만 쓰이므로 상한을 낮게 둔다. */
function toRoman(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 40) return null;
  const table: Array<[number, string]> = [[40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let rest = value;
  let out = '';
  for (const [v, s] of table) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

/**
 * 로마 숫자로 적힌 같은 값이 번역에 있는가.
 *
 * 프랑스어·이탈리아어·러시아어는 **세기를 로마 숫자로 적는다** —
 * `18th-century scholar` → `le lettré du XVIIIe siècle` (2026-07-26 실측).
 * 대문자로만 비교해 낱말 속 `i`·`v`·`x` 를 잘못 집지 않는다.
 */
function hasRomanForm(text: string, token: string): boolean {
  const roman = toRoman(Number(token));
  if (roman === null) return false;
  return new RegExp(`(?<!\\p{L})${roman}(?:e|er|ᵉ|ème)?(?!\\p{L})`, 'u').test(text);
}

/**
 * 앞자리 0 제거 — 값 비교용. 자릿수 패딩은 값을 바꾸지 않는다.
 *
 * 2026-07-26 실측 오탐: `dedicated April 6, 1951` → `am 06.04.1951` 로 옮기면
 * 날짜 서식이 일(日)을 두 자리로 채워 `6` 이 `06` 이 된다. 값은 그대로다.
 */
function stripLeadingZeros(n: string): string {
  return n.replace(/^0+(?=\d)/, '');
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
 *
 * `locale`을 주면 **수사가 낱말로 바뀐 경우**를 구분한다 — 아래 두 표 참조.
 * 주지 않으면 순수 숫자 비교로만 동작한다(하위 호환).
 */
export function checkNumbers(
  source: string,
  target: string,
  pointer: string,
  locale?: TargetLocale,
): Finding[] {
  const a = numberMultiset(source);
  const b = numberMultiset(target);
  if (sameMultiset(a, b)) return [];

  // 값 비교는 앞자리 0을 무시한다. 표시용 멀티셋(a·b)은 원문 그대로 둔다.
  const aNorm = a.map(stripLeadingZeros);

  // 공백은 두 가지로 읽힌다: fr/ru 천단위 구분기호(`1 234`)이거나, 어순이 바뀌어
  // 나란히 놓인 두 별개 숫자의 어절 간격이거나.
  //   `810,000 … arrived … in 2024` → de `2024 810.000`
  // 구분기호로 읽으면 `2024 810` 이 `2024810` 으로 붙어 두 값이 동시에 사라진다
  // (2026-07-26 실측). 원문을 더 많이 보존하는 쪽으로 읽는다.
  const bNorm = [b, numberMultiset(target, { spaceAsGroupSeparator: false })]
    .map((tokens) => tokens.map(stripLeadingZeros))
    .reduce((best, cur) =>
      missingFrom(aNorm, cur).length < missingFrom(aNorm, best).length ? cur : best,
    );

  const findings: Finding[] = [];
  const added = missingFrom(bNorm, aNorm);

  // 소실 숫자를 세 갈래로 나눈다: 관용구 흡수(면제) · 철자 수사(flag 강등) · 진짜 소실(fail).
  const lost: string[] = [];
  const spelled: string[] = [];
  for (const n of missingFrom(aNorm, bNorm)) {
    if (locale && matchesAny(target, NUMERAL_IDIOMS[locale][n])) continue;
    if (
      locale &&
      (matchesAny(target, NUMERAL_WORDS[locale][n]) ||
        matchesAny(target, MONTH_NAMES[locale][n]) ||
        hasRomanForm(target, n) ||
        hasDecadeWord(target, n, locale))
    ) spelled.push(n);
    else lost.push(n);
  }

  if (lost.length > 0) {
    findings.push({
      gate: 'G3',
      severity: 'fail',
      pointer,
      message: `숫자 소실 — 원문의 [${lost.join(' ')}] 이 번역에 없다 (원문 [${a.join(' ')}] vs 번역 [${b.join(' ')}])`,
    });
  }
  if (spelled.length > 0) {
    findings.push({
      gate: 'G3',
      severity: 'flag',
      pointer,
      message: `숫자가 철자 수사로 바뀐 것으로 보인다 — [${spelled.join(' ')}] (값이 맞는지 감수 필요)`,
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
 */
const IMPERIAL_RE = /\d[\d.,]*[\s -]*(?<![\p{L}])(miles?|mi\.|Meilen?|miglia|miglio|мил[ья]|inch(?:es)?|Zoll|pollici|дюйм|foot|feet|Fuß|piedi|фут|pounds?|lbs?|Pfund|libbre|фунт)(?![\p{L}])/giu;

/**
 * G4 — 통화 기호·ISO 코드 동일 + 단위 변환 검출.
 *
 * 🔴 **어떤 통화인지(집합)로 판정하고, 몇 번 나오는지(개수)로는 판정하지 않는다.**
 * 이 게이트가 막아야 하는 것은 `₩70,000` → `€70` 같은 **통화 바꿔치기**다. 반면
 * 기호가 몇 번 적히는지는 언어마다 다르다 — 프랑스어는 기호를 숫자 뒤에 놓고
 * 범위에서 한 번만 쓴다: `$300–$500+` → `de 300 à 500 $ et plus` (2026-07-26 실측).
 * 값 자체는 G3가 따로 지킨다.
 */
export function checkCurrencyAndUnits(source: string, target: string, pointer: string): Finding[] {
  const findings: Finding[] = [];

  const a = multiset(source, CURRENCY_RE);
  const b = multiset(target, CURRENCY_RE);
  const aKinds = [...new Set(a)].sort();
  const bKinds = [...new Set(b)].sort();

  if (!sameMultiset(aKinds, bKinds)) {
    findings.push({
      gate: 'G4',
      severity: 'fail',
      pointer,
      message: `통화 종류 불일치 — 원문 [${aKinds.join(' ')}] vs 번역 [${bKinds.join(' ')}]`,
    });
  } else if (!sameMultiset(a, b)) {
    findings.push({
      gate: 'G4',
      severity: 'flag',
      pointer,
      message: `통화 기호 개수 차이 — 원문 ${a.length}회 vs 번역 ${b.length}회 (범위 표기 관례면 정상)`,
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

  const aBold = countMatches(source, /\*\*/g);
  const bBold = countMatches(target, /\*\*/g);
  if (aBold !== bBold) {
    findings.push({
      gate: 'G6',
      severity: 'flag',
      pointer,
      message: `강조 마크업 개수 불일치 — 원문 ${aBold} vs 번역 ${bBold}`,
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

  const cjkTarget = countMatches(target, CJK_RE);
  const cjkSource = countMatches(source, CJK_RE);
  if (cjkTarget > cjkSource) {
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
    if (letters >= 10 && cyrillic / letters < 0.6) {
      findings.push({
        gate: 'G10',
        severity: 'fail',
        pointer,
        message: `키릴 비율 ${((cyrillic / letters) * 100).toFixed(0)}% < 60% — 러시아어 미번역 의심`,
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
 * G13 — 로케일 조판 관례.
 *
 * 지금은 프랑스어의 **좁은 비분리 공백(U+202F)** 만 본다. 프랑스어 조판은
 * `;` `:` `!` `?` `»` 앞과 `«` 뒤에 이 공백을 요구하고, 스타일가이드도 🔴로 못박고 있다.
 *
 * 왜 게이트가 필요한가 (2026-07-26 실측): 번역 서브에이전트가 "U+202F를 적용했다"고
 * **보고했지만 실제로는 일반 공백을 쓴** 유닛이 있었다. 같은 슬러그의 나머지 13개 파일은
 * 전부 U+202F를 써서 한 상품 안에서 조판이 갈렸다. 자기보고는 검증이 아니다.
 *
 * 천단위 구분은 일부러 보지 않는다 — `2024 810` 처럼 나란히 놓인 두 숫자와
 * 구분할 수 없어서다(G3에서 겪은 것과 같은 모호성).
 *
 * severity는 `flag`. 조판은 렌더를 깨지 않으므로 발행을 막을 이유가 없다.
 */
const PLAIN_SPACE_BEFORE_PUNCT_RE = / [;:!?»]/g;
const PLAIN_SPACE_AFTER_GUILLEMET_RE = /« /g;

export function checkTypography(
  target: string,
  pointer: string,
  locale: TargetLocale,
): Finding[] {
  if (locale !== 'fr') return [];

  const count =
    countMatches(target, PLAIN_SPACE_BEFORE_PUNCT_RE) +
    countMatches(target, PLAIN_SPACE_AFTER_GUILLEMET_RE);
  if (count === 0) return [];

  return [{
    gate: 'G13',
    severity: 'flag',
    pointer,
    message: `좁은 비분리 공백 누락 ${count}곳 — 프랑스어는 «…» 안쪽과 ; : ! ? 앞에 U+202F를 쓴다`,
  }];
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
      ...checkNumbers(src, tgt, pointer, options.locale),
      ...checkCurrencyAndUnits(src, tgt, pointer),
      ...checkPlaceholders(src, tgt, pointer),
      ...checkMarkup(src, tgt, pointer),
      ...checkVerbatim(src, tgt, pointer),
      ...checkLengthRatio(src, tgt, pointer, options.locale, options.lengthRatioMinChars),
      ...checkUntranslated(src, tgt, pointer, options.keepAsIs),
      ...checkCharset(tgt, pointer, options.locale, src),
      ...checkTypography(tgt, pointer, options.locale),
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
