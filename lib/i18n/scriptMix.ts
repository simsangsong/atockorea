/**
 * 로케일에 속하지 않는 **문자 체계**가 섞였는지 본다.
 *
 * 왜 별도 게이트인가 — G1~G11 어느 것도 이걸 묻지 않는다. 숫자도 태그도 URL도
 * 아니고, 길이비도 정상이며, 미번역 검사(G9)는 원문과 **같은** 문자열을 찾지
 * 원문에 없던 제3의 문자를 찾지 않는다. 그래서 중국어 본문 32곳에 한글이
 * 그대로 박힌 채 열 개 로케일이 전부 초록으로 통과했다(2026-08-02, 사장님이
 * 화면을 보고 지적하기 전까지).
 *
 * 🔴 유럽어에 남은 로마자 음차(jeongnang·oreum)는 읽을 수라도 있지만, 중국어
 * 독자에게 한글은 **읽을 수 없는 기호**다. 같은 실수라도 결과가 다르다.
 *
 * 표기 원칙(이 트랙):
 *   한자어면 한자 · 확정된 현지 표기가 있으면 그것 · 없으면 로마자.
 *   한글은 어느 경우에도 남기지 않는다 — 단 하나의 예외를 빼고.
 */

export type ScriptName = 'hangul' | 'kana' | 'han' | 'cyrillic' | 'latin';

const SCRIPT_RE: Record<ScriptName, RegExp> = {
  // 한글 자모(ㆍ 포함)와 음절.
  hangul: /[가-힣ᄀ-ᇿ㄰-㆏]+/g,
  kana: /[぀-ゟ゠-ヿ]+/g,
  han: /[一-鿿]+/g,
  cyrillic: /[Ѐ-ӿ]+/g,
  latin: /[A-Za-z][A-Za-z'’.-]*/g,
};

/**
 * 로케일별로 본문에 있어도 되는 문자 체계.
 *
 * 한국어에 한자가 허용되는 것은 원고가 삼다(三多)처럼 한자를 병기하기 때문이고,
 * 일본어에 로마자가 허용되는 것은 학명·고유명사 표기 관례 때문이다. 중국어에
 * 로마자를 허용하는 이유는 하나뿐 — 확정된 중국어 표기가 없는 제주어 낱말
 * (ganse·beoksumeori)을 음차할 자리가 필요해서다.
 */
export const ALLOWED_SCRIPTS: Record<string, ScriptName[]> = {
  en: ['latin'],
  ko: ['hangul', 'latin', 'han'],
  ja: ['han', 'kana', 'latin'],
  zh: ['han', 'latin'],
  'zh-TW': ['han', 'latin'],
  de: ['latin'],
  fr: ['latin'],
  it: ['latin'],
  es: ['latin'],
  ru: ['cyrillic', 'latin'],
};

/**
 * 🔴 유일한 예외. 「제주어」편은 **한글을 보여주는 것이 주제 자체**다 —
 * 혼저옵서예·하영 반갑수다·폭싹 속았수다를 로마자로만 적으면 "이건 방언이
 * 아니라 언어다"라는 그 편의 논지가 사라진다. 예외를 주제 하나로 못박아 두면
 * 다른 편이 슬그머니 편승하지 못한다.
 */
export const SCRIPT_MIX_EXEMPT_TOPICS = new Set(['jeju-language']);

export interface ScriptMixFinding {
  topicKey: string;
  field: string;
  script: ScriptName;
  samples: string[];
}

/** 한 로케일의 한 유닛을 검사한다. 위반이 없으면 빈 배열. */
export function findScriptMix(
  locale: string,
  topicKey: string,
  fields: Record<string, string | null | undefined>,
): ScriptMixFinding[] {
  if (SCRIPT_MIX_EXEMPT_TOPICS.has(topicKey)) return [];
  const allowed = ALLOWED_SCRIPTS[locale];
  // 모르는 로케일은 검사하지 않는다 — 조용히 통과시키는 것이 아니라, 이 표에
  // 없는 로케일이 생기면 그건 표를 고칠 일이지 여기서 추측할 일이 아니다.
  if (!allowed) return [];

  const out: ScriptMixFinding[] = [];
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    for (const [name, re] of Object.entries(SCRIPT_RE) as Array<[ScriptName, RegExp]>) {
      if (allowed.includes(name)) continue;
      const hits = [...value.matchAll(re)].map((m) => m[0]);
      if (hits.length > 0) {
        out.push({ topicKey, field, script: name, samples: [...new Set(hits)].slice(0, 8) });
      }
    }
  }
  return out;
}
