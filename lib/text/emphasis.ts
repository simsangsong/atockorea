/**
 * `**강조**` — 손님 화면에 들어가는 최소 인라인 마크업.
 *
 * 🔴 **그리는 쪽과 세는 쪽이 이 파일 하나를 쓴다.** 렌더러(`RegionScriptDoor`)와
 * 번역 게이트(`lib/i18n/pipeline/gates.ts` G6)가 각자 규칙을 갖고 있으면, 게이트는
 * 초록인데 화면에는 별표가 남는 상태가 만들어진다. 그래서 도메인 어느 쪽에도
 * 속하지 않는 자리에 둔다 — tour-room이 i18n 파이프라인을 끌어오거나 그 반대가
 * 되면 안 되므로.
 *
 * 마크다운 렌더러가 아니다. 굵기 하나뿐이고 중첩도 이탤릭도 없다. 쓸 수 있게
 * 해두면 원고에 섞여 들어오고, 그때부터 규칙이 둘이 된다.
 */

export interface RichSpan {
  text: string;
  strong: boolean;
}

/**
 * 설계 결정 둘:
 *
 *   1. **짝이 안 맞는 `**`는 글자 그대로 남긴다.** 삼키면 원고 오타가 화면에서는
 *      멀쩡해 보이고 아무도 모른다. 별표가 보이면 누군가 고친다.
 *   2. **빈 강조(`****`)는 강조가 아니다.** 굵은 빈칸은 렌더링 사고로만 생긴다.
 */
export function parseEmphasis(text: string): RichSpan[] {
  const spans: RichSpan[] = [];
  let plain = '';
  let i = 0;

  const flush = () => {
    if (plain) {
      spans.push({ text: plain, strong: false });
      plain = '';
    }
  };

  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      const close = text.indexOf('**', i + 2);
      const inner = close < 0 ? '' : text.slice(i + 2, close);
      if (close < 0 || inner.length === 0) {
        plain += '**';
        i += 2;
        continue;
      }
      flush();
      spans.push({ text: inner, strong: true });
      i = close + 2;
      continue;
    }
    plain += text[i];
    i += 1;
  }
  flush();
  return spans;
}

/** 강조 표시를 걷어낸 평문. 굵기가 의미 없는 곳(검색·요약)에서 쓴다. */
export function stripEmphasis(text: string): string {
  return parseEmphasis(text)
    .map((s) => s.text)
    .join('');
}

/**
 * 짝이 맞는 강조의 **개수**.
 *
 * 🔴 별표 **문자**를 세는 것과 다르다. 정규식으로 별표 쌍만 세면 빈 강조가 2로,
 * 짝 없는 별표 하나가 1로 잡힌다 — 렌더러는 둘 다 강조로 치지 않는데 게이트만
 * 다르게 세면, 번역이 멀쩡한데 경고가 뜨거나 그 반대가 된다.
 *
 * ⚠ 이 파일 주석에 별표-슬래시 조합을 쓰지 말 것. 블록 주석이 거기서 끊긴다
 * (2026-08-02에 실제로 끊겼다).
 */
export function countEmphasis(text: string): number {
  return parseEmphasis(text).filter((s) => s.strong).length;
}
