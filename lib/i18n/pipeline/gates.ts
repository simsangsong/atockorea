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
export type GateId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8' | 'G9' | 'G10' | 'G11';

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
 * 자릿수 사이의 구분기호를 제거해 자릿수열로 환원한다.
 *   `1,234.5`(en) → `12345`
 *   `1.234,5`(de) → `12345`   ← 같은 값으로 판정 (서식 변경 허용)
 *   `₩70,000` → `70000` vs `€70` → `70`   ← 다른 값으로 판정 (H2 변조 검출)
 *
 * 서식 관례 자체는 스타일가이드/사람 감수가 본다. 이 게이트의 목적은 **값 변조**다.
 */
export function numberMultiset(text: string): string[] {
  const collapsed = text.replace(
    new RegExp(`(\\d)${DIGIT_SEPARATORS.source}(?=\\d)`, 'g'),
    '$1',
  );
  return (collapsed.match(/\d+/g) ?? []).slice().sort();
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

/** G3 — 숫자 값 멀티셋 동일. H2(수치 변조) 검출. */
export function checkNumbers(source: string, target: string, pointer: string): Finding[] {
  const a = numberMultiset(source);
  const b = numberMultiset(target);
  if (sameMultiset(a, b)) return [];
  return [{
    gate: 'G3',
    severity: 'fail',
    pointer,
    message: `숫자 값 불일치 — 원문 [${a.join(' ')}] vs 번역 [${b.join(' ')}]`,
  }];
}

/** 야드파운드법 흔적 — km→mile 류 단위 변환은 금지(규칙 3). */
const IMPERIAL_RE = /\b(miles?|mi\.|Meilen?|miglia|miglio|мил[ья]|inch(?:es)?|Zoll|pollici|дюйм|foot|feet|Fuß|piedi|фут|pounds?|lbs?|Pfund|libbre|фунт)\b/gi;

/** G4 — 통화 기호·ISO 코드 동일 + 단위 변환 검출. */
export function checkCurrencyAndUnits(source: string, target: string, pointer: string): Finding[] {
  const findings: Finding[] = [];

  const a = multiset(source, CURRENCY_RE);
  const b = multiset(target, CURRENCY_RE);
  if (!sameMultiset(a, b)) {
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

/** G10 — 문자셋. 로케일 교차 오염(H8) 검출. */
export function checkCharset(target: string, pointer: string, locale: TargetLocale): Finding[] {
  const findings: Finding[] = [];

  const cjk = countMatches(target, CJK_RE);
  if (cjk > 0) {
    findings.push({
      gate: 'G10',
      severity: 'fail',
      pointer,
      message: `CJK 문자 ${cjk}자 혼입 — ${locale} 번역에 있을 수 없다(로케일 교차 오염)`,
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
      ...checkCharset(tgt, pointer, options.locale),
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
