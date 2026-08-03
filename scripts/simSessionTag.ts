/**
 * 세션별 시뮬 태그 — 시더 두 개(`sim-tour-day.ts` · `k4-seed.ts`)가 공유한다.
 *
 * 🔴 왜 생겼나 (2026-08-03 사고):
 * 두 세션이 같은 라이브 DB 에 시딩하고 있었는데, `--cleanup` 이 `sim_tag='sim'` **하나로**
 * 지우는 바람에 한쪽의 드레인이 **다른 쪽 예약 5건을 같이 지웠다.** 상대 세션은 렌더 계측
 * 도중에 예약이 사라져 "예약을 찾을 수 없습니다" 화면을 재고 있었고, 그 하니스는 그걸
 * 모른 채 "위반 0"을 초록으로 보고했다.
 *
 * 근본 원인은 사람이 아니라 **드레인의 기본값이 전역이었던 것**이다. 런북의
 * *"드레인 경로는 하나다"* 는 *어떤 명령을 쓰라*는 뜻이었는데 *끝나면 항상 돌려라*로
 * 읽히기 쉬웠고, 그 독해가 자연스럽다.
 *
 * 그래서 태그를 **워크트리 단위**로 가른다. 워크트리는 이 저장소가 이미 쓰는 세션 격리
 * 단위라 별도 합의가 필요 없다 — 같은 워크트리면 항상 같은 태그가 나오고, 다른 워크트리와는
 * 절대 겹치지 않는다.
 *
 * ⚠ 판정은 형식에 무관하다. `lib/ops/sim/simScope.ts` 의 `isSimBooking` 은
 * **비어 있지 않은 `sim_tag` 면 전부 시뮬**로 보고(주석: *"다른 값도 시뮬로 취급된다"*),
 * 쿼리 배제는 `.is('sim_tag', null)` 이다. 즉 `sim:ab12cd34` 도 집계·돈에서 똑같이 빠진다.
 * 이 파일은 **누가 지울 수 있는가**만 바꾸고, **무엇이 시뮬인가**는 건드리지 않는다.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';

/** 컬럼 도입 이전부터 쓰이던 전역 태그. 여전히 "시뮬"로 인정된다. */
export const LEGACY_SIM_TAG = 'sim';

/**
 * 이 워크트리의 시더가 쓰는 태그.
 *
 * 기준을 `process.cwd()` 가 아니라 **스크립트 자신의 위치**로 잡는다 — cwd 는 어디서
 * 실행하느냐에 따라 바뀌고, 그러면 같은 워크트리가 서로 다른 태그를 만들어 자기 것도
 * 못 지운다. `SIM_TAG` 환경변수로 덮어쓸 수 있다(CI 등에서 고정하고 싶을 때).
 */
export const SESSION_SIM_TAG: string =
  process.env.SIM_TAG?.trim() ||
  `${LEGACY_SIM_TAG}:${createHash('sha1').update(path.resolve(__dirname, '..')).digest('hex').slice(0, 8)}`;

/** 이 값이 시뮬 태그인가(레거시 전역 태그 포함). 드레인 `--all` 이 쓰는 판정. */
export function isAnySimTag(tag: string | null | undefined): boolean {
  if (typeof tag !== 'string') return false;
  const t = tag.trim();
  return t === LEGACY_SIM_TAG || t.startsWith(`${LEGACY_SIM_TAG}:`);
}
