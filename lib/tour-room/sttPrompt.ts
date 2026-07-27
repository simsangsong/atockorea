/**
 * V0.1 — STT 용어 바이어싱 프롬프트 (순수 파트).
 *
 * `stt-router.ts` 는 `prompt` 를 받아 Whisper 계열에 넘길 준비가 이미 돼 있었지만,
 * **아무도 이 필드를 채우지 않고 있었다** (2026-07-27 전수 확인: 클라이언트에서
 * `sttPrompt` 를 보내는 곳 0, `captions/route.ts` 는 `{}` 를 넘김).
 *
 * 이게 왜 중요한지는 실측이 답한다 (`scripts/qa-voice-latency.mjs`, 2026-07-27):
 *
 *   groq/whisper-large-v3   long  bias OFF → "만장불 … 해녀당물관"
 *                                 bias ON  → "만장굴 … 해녀박물관"   ✅
 *   groq/whisper-large-v3-turbo   bias OFF → "만장불"
 *                                 bias ON  → "만장굴"                ✅
 *   openai/gpt-4o-mini-transcribe bias OFF → "성산 유튜봉"
 *                                 bias ON  → "성산 일출봉"            ✅
 *
 * 레이턴시 비용은 프로바이더마다 다르다 — **groq 은 사실상 공짜**(medium p50
 * 730→447ms, 오차 범위), **openai/whisper-1 은 2배 이상 느려진다**(735→1792ms).
 * 라우터 1순위가 groq 이므로 상시 주입이 이득이다. 🔴 STT_PRIMARY_PROVIDER 를
 * openai 로 바꾸면 이 트레이드오프를 다시 계산할 것.
 *
 * 프롬프트 형태는 위 실측에서 검증된 것을 그대로 쓴다. Whisper 의 `prompt` 는
 * 지시문이 아니라 **"앞선 발화의 예시"** 로 동작하므로, 명령형이 아니라 그 어휘가
 * 자연스럽게 등장하는 한국어 문장이어야 한다.
 */

/** stt-router.ts 가 어차피 900자로 자른다 — 잘린 뒤 깨진 이름이 남지 않게 여기서 맞춘다. */
export const MAX_STT_PROMPT_CHARS = 900;

/** 1글자 이름은 충돌만 유발한다(산, 굴). 글로서리 로더의 MIN_SURFACE_LENGTH 와 같은 이유. */
const MIN_TERM_LENGTH = 2;

const PREFIX = '제주 투어 가이드 안내입니다. 고유명사: ';
const SUFFIX = '.';

/**
 * 고유명사 목록을 STT `prompt` 문자열로. 순서가 우선순위다 — 900자에 걸리면
 * **뒤에서부터 버린다**(호출부가 오늘 일정 순으로 넣으면 지금 있는 곳이 살아남는다).
 *
 * 빈 문자열을 돌려주면 호출부는 프롬프트를 아예 보내지 않아야 한다.
 * `prompt=''` 를 보내는 것과 필드를 생략하는 것은 프로바이더에 따라 다르게 동작한다.
 */
export function buildSttPrompt(terms: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const clean: string[] = [];

  for (const raw of terms) {
    if (typeof raw !== 'string') continue;
    const term = raw.trim().replace(/\s+/g, ' ');
    if (term.length < MIN_TERM_LENGTH) continue;
    // 쉼표는 구분자다 — 이름 안에 있으면 목록이 깨진다.
    if (term.includes(',')) continue;
    const dedupeKey = term.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    clean.push(term);
  }

  if (clean.length === 0) return '';

  const budget = MAX_STT_PROMPT_CHARS - PREFIX.length - SUFFIX.length;
  const kept: string[] = [];
  let used = 0;
  for (const term of clean) {
    const cost = term.length + (kept.length > 0 ? 2 : 0); // ', '
    if (used + cost > budget) break;
    kept.push(term);
    used += cost;
  }

  if (kept.length === 0) return '';
  return `${PREFIX}${kept.join(', ')}${SUFFIX}`;
}

/**
 * 스케줄 항목에서 고유명사 후보를 뽑는다. `resolveDaySchedule` 의 ScheduleItemLike 는
 * 인덱스 시그니처가 열려 있어 소스(day_plan / product_page / tour_schedule)마다
 * 이름이 실려 오는 키가 다르다 — 알려진 키를 순서대로 훑는다.
 */
export function scheduleTerms(schedule: Array<Record<string, unknown>>): string[] {
  const terms: string[] = [];
  for (const item of schedule) {
    if (!item || typeof item !== 'object') continue;
    for (const key of ['title', 'name', 'spot_title', 'place_name']) {
      const value = item[key];
      if (typeof value === 'string' && value.trim()) {
        terms.push(value.trim());
        break; // 한 스톱당 하나면 충분하다 — 900자는 금방 찬다.
      }
    }
  }
  return terms;
}
