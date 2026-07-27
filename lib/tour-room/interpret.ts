/**
 * V1 대면 통역 모드 — 순수 파트.
 *
 * 통화(V3)보다 이걸 먼저 만드는 이유는 실측이 아니라 실사용 빈도다. 가이드와
 * 손님은 **대부분 같은 공간에 있다.** 통역이 정말 아쉬운 순간은 손님이 식당 주인·
 * 약사·기사·상점 직원 앞에 서 있을 때인데, 그건 통화가 아니라 **폰 하나를 둘이
 * 보는** 상황이다. 미디어 전송 계층이 아예 필요 없고(=구현 난이도가 통화의 1/5),
 * 여기서 소음·고유명사·숫자 문제를 먼저 실측할 수 있다.
 *
 * 모델은 아주 작다: 화면이 둘로 갈리고, 각 면이 자기 언어로 말한다.
 *   · `guest` 면 — 손님. 손님 로케일로 말하고 상대 언어로 옮겨진다.
 *   · `local`  면 — 눈앞의 한국인. 한국어로 말하고 손님 언어로 옮겨진다.
 *
 * 🔴 `to`(도착 언어)만 있으면 번역은 된다 — 라우터가 원어를 스스로 감지한다.
 * `from` 을 같이 들고 다니는 건 UI 라벨과 자막 방향 때문이지 번역 입력이 아니다.
 * 사람이 엉뚱한 면에 대고 말하는 일은 늘 있고, 그때 감지가 라벨을 이긴다.
 */

/** 눈앞의 상대는 한국인이라는 게 이 기능의 전제. 파라미터로 열어는 둔다. */
export const INTERPRET_LOCAL_LOCALE = 'ko';

/** 한 턴의 상한. 대면 대화는 짧다 — 길면 STT 가 문장을 뭉갠 것에 가깝다. */
export const MAX_INTERPRET_CHARS = 500;

export type InterpretSide = 'guest' | 'local';

export interface InterpretDirection {
  /** 말하는 쪽 언어 (라벨·자막 방향용, 번역 입력 아님). */
  from: string;
  /** 옮겨질 언어 — 이게 번역의 유일한 입력이다. */
  to: string;
}

export function normalizeInterpretSide(raw: unknown): InterpretSide | null {
  return raw === 'guest' || raw === 'local' ? raw : null;
}

/**
 * 어느 면이 말했는지 → 어느 언어로 옮길지.
 *
 * 손님 로케일이 상대 언어와 같으면(한국어를 쓰는 손님) 통역할 게 없다 — 그때는
 * 양쪽 다 `to` 가 자기 언어가 되어 호출부가 번역을 건너뛸 수 있게 한다.
 */
export function interpretDirection(
  side: InterpretSide,
  guestLocale: string,
  localLocale: string = INTERPRET_LOCAL_LOCALE,
): InterpretDirection {
  const guest = (guestLocale || '').trim().toLowerCase() || 'en';
  const local = (localLocale || '').trim().toLowerCase() || INTERPRET_LOCAL_LOCALE;
  return side === 'guest' ? { from: guest, to: local } : { from: local, to: guest };
}

/** 옮길 것이 없는 턴인가 (같은 언어끼리). */
export function isNoopDirection(direction: InterpretDirection): boolean {
  return direction.from === direction.to;
}

/**
 * 대면 통역에서 가장 사고가 나는 건 숫자다 — 시간·금액·인원·호실. 자막에 원문
 * 숫자를 같이 보여줘서 상대가 눈으로 대조할 수 있게 한다(§C V-D8 의 대면판).
 * 한국어 금액 표기(3,000)와 서구식(3.000)이 갈리므로 구분자는 빼고 비교한다.
 */
export function extractNumericTokens(text: string): string[] {
  const tokens = text.match(/\d[\d.,:]*/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    const trimmed = token.replace(/[.,:]+$/, '');
    if (!trimmed) continue;
    const key = trimmed.replace(/[.,]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * 한 토큰이 가질 수 있는 모든 해석.
 *
 * 구분자가 의미를 갖는지가 언어마다 다르기 때문에 하나로 못 정한다:
 *   · `25,000` 과 `25.000` 은 **같은 수** — 구분자를 지워야 맞는다.
 *   · `3:30` 은 `3` 과 `30` **두 수** — 쪼개야 맞는다("3시 30분"의 번역).
 * 그래서 붙인 형태와 쪼갠 조각을 **모두** 후보로 넣고, 어느 쪽으로든 맞으면
 * 살아남은 것으로 본다. 놓치는 쪽(오탐)이 헛경고보다 나쁘다고 보지 않는다 —
 * 헛경고가 잦으면 사람이 경고 자체를 무시하게 된다.
 */
function numericKeys(token: string): string[] {
  const joined = token.replace(/[.,:]/g, '');
  const parts = token.match(/\d+/g) ?? [];
  return [joined, ...parts].filter(Boolean);
}

/**
 * 원문에 있던 숫자가 번역에서 사라졌는지. 사라졌으면 자막에 원문을 같이 띄워
 * 사람이 확인하게 한다 — 조용히 틀린 시각을 말하는 것보다 낫다.
 */
export function droppedNumbers(sourceText: string, translatedText: string): string[] {
  const present = new Set<string>();
  for (const token of extractNumericTokens(translatedText)) {
    for (const key of numericKeys(token)) present.add(key);
  }
  return extractNumericTokens(sourceText).filter(
    (token) => !numericKeys(token).some((key) => present.has(key)),
  );
}
