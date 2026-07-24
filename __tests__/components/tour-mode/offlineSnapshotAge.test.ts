/**
 * §D A1.2 P1 — 오프라인 스냅샷 나이 표기.
 *
 * 🔴 이 카드는 **오프라인일 때만** 뜬다. 그때 손님은 화면의 집합 장소가 최신인지
 * 확인할 방법이 없다 — 가이드가 장소를 바꿨는데 스냅샷이 어제 것이면 손님은
 * 확신을 갖고 틀린 곳으로 간다. 카드가 존재하는 이유(S5 회복력)를 정면으로
 * 배반하는 실패라, 나이 표기는 장식이 아니라 계약이다.
 *
 * `savedAt`은 원래도 저장되고 있었다. 보여주지 않았을 뿐이다.
 */

/** OfflineInfoCard의 relativeAge와 같은 규칙(컴포넌트는 client-only라 로직만 검증). */
function relativeAge(
  savedAt: number,
  copy: {
    justNow: string;
    minutesAgo: (n: number) => string;
    hoursAgo: (n: number) => string;
    daysAgo: (n: number) => string;
  },
  nowMs: number,
): string {
  const minutes = Math.floor(Math.max(0, nowMs - savedAt) / 60_000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return copy.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return copy.hoursAgo(hours);
  return copy.daysAgo(Math.floor(hours / 24));
}

const ko = {
  justNow: '방금',
  minutesAgo: (n: number) => `${n}분 전`,
  hoursAgo: (n: number) => `${n}시간 전`,
  daysAgo: (n: number) => `${n}일 전`,
};

const NOW = Date.parse('2026-08-17T09:00:00Z');
const ago = (ms: number) => relativeAge(NOW - ms, ko, NOW);

describe('relativeAge — 손님이 알아야 하는 건 "지금 것인가"다', () => {
  it('1분 미만은 "방금"', () => {
    expect(ago(0)).toBe('방금');
    expect(ago(59_000)).toBe('방금');
  });

  it('분 단위', () => {
    expect(ago(60_000)).toBe('1분 전');
    expect(ago(45 * 60_000)).toBe('45분 전');
  });

  it('시간 단위', () => {
    expect(ago(60 * 60_000)).toBe('1시간 전');
    expect(ago(23 * 60 * 60_000)).toBe('23시간 전');
  });

  it('🔴 하루가 넘으면 일 단위 — 여기가 실제 위험 구간이다', () => {
    expect(ago(24 * 60 * 60_000)).toBe('1일 전');
    expect(ago(3 * 24 * 60 * 60_000)).toBe('3일 전');
  });

  it('시계가 뒤로 간 경우에도 음수를 보여주지 않는다', () => {
    // 기기 시각이 서버보다 앞서면 savedAt이 미래가 된다.
    expect(relativeAge(NOW + 60_000, ko, NOW)).toBe('방금');
  });

  it('경계에서 단위가 정확히 넘어간다', () => {
    expect(ago(59 * 60_000)).toBe('59분 전');
    expect(ago(60 * 60_000)).toBe('1시간 전');
    expect(ago(24 * 60 * 60_000 - 1)).toBe('23시간 전');
  });
});
