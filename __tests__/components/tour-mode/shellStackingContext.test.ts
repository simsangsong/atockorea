/**
 * 🔴 상설 가드 — 셸의 콘텐츠 래퍼는 **스택 컨텍스트를 만들면 안 된다.**
 *
 * `Sheet`는 `fixed inset-0 z-50`으로 화면 전체를 덮는다. 그런데 그 시트를 여는
 * 컴포넌트의 조상 중 하나라도 `position:relative` + `z-index`를 갖고 있으면
 * **z-50이 그 상자 안에서만 유효해지고**, 바깥의 헤더(z-30)·하단 탭바에게 진다.
 * 증상이 고약하다: 시트는 **보이는데** 아래쪽 절반이 안 눌린다. 화면만 봐서는
 * 정상이고, 스크린샷에도 정상으로 찍힌다.
 *
 * 실제로 두 번 났다:
 *   - 2026-07-27 패널 래퍼 `z-[1]` → Today 탭 스톱 상세 드로어(z-[71])가 위아래로
 *     잘림 (사장님 기기 리포트).
 *   - 2026-07-28 배너 존 `z-20` → 시간추가 확인 시트의 [취소]/[추가하기]가 하단
 *     탭바 밑에 깔려 안 눌림. 첫 번째를 고칠 때 **바로 위 형제를 빠뜨린 것**이다.
 *
 * 한 번 빠뜨린 자리는 또 빠뜨린다. 그래서 텍스트 가드다: 시트를 띄우는 자식을
 * 담는 래퍼에 z-index를 다시 붙이면 여기서 실패한다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** `className="… relative … z-N …"` on one element (any order). */
const RELATIVE_WITH_Z = /className="[^"]*\brelative\b[^"]*\bz-(?:\[[^\]]+\]|\d+)[^"]*"/;

/**
 * Wrappers that hold tab panels / banners — i.e. anything that can mount a
 * Sheet. Chrome itself (header, tab bar) SHOULD stack; it is the thing sheets
 * must clear, so it is not scanned.
 */
const SCOPES: Array<{ file: string; marker: string; what: string }> = [
  {
    file: 'components/tour-mode/RoomShell.tsx',
    marker: '{banner}',
    what: 'guest room banner zone (countdown / notices open sheets from here)',
  },
  {
    file: 'components/tour-mode/RoomShell.tsx',
    marker: "data-testid=\"home-panel\"",
    what: 'guest room tab-panel wrapper',
  },
];

describe('shell wrappers do not trap fixed overlays (stacking context)', () => {
  it.each(SCOPES)('$what', ({ file, marker }) => {
    const src = readFileSync(path.join(process.cwd(), file), 'utf8');
    const at = src.indexOf(marker);
    expect(at).toBeGreaterThan(-1);

    // Walk back to the opening tag of the element that contains the marker and
    // check that element plus its immediate wrapper — the two places the two
    // real incidents happened.
    const before = src.slice(Math.max(0, at - 1200), at);
    const offenders = before.match(new RegExp(RELATIVE_WITH_Z, 'g')) ?? [];
    expect(offenders).toEqual([]);
  });
});
