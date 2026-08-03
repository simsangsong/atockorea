/**
 * 시더가 늘어날 때 세션 태그를 안 쓰는 시더가 조용히 끼어드는 것을 막는 소스 게이트.
 *
 * 🔴 이 테스트가 있는 이유는 실제로 그렇게 됐기 때문이다. 2026-08-03 에 세션별 태그를 넣으면서
 * `sim-tour-day.ts` 와 `k4-seed.ts` 는 고쳤는데 **`sim-lobby-booking.ts` 를 빠뜨렸다.**
 * 결과는 조용했다 — 로비 예약이 레거시 태그 `'sim'` 으로 들어가서, **내 드레인이 내가 시드한
 * 행을 "다른 세션 것"으로 보고 남겨 두었다.** 오류도 경고도 없고, 드레인은 "완료"라고 했다.
 *
 * 단위 테스트로는 안 잡힌다 — 각 시더는 자기 안에서 완결이고, 결함은 **세 파일이 같은 값을
 * 써야 한다는 계약** 쪽에 있다. 그래서 소스를 읽는다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SCRIPTS = path.join(process.cwd(), 'scripts');

/**
 * `bookings` 에 `sim_tag` 를 **써 넣는** 스크립트 = 시더.
 *
 * ⚠ 첫판은 오탐이 났다. `/sim_tag\s*:\s*[A-Za-z_$]/` 하나로는 **타입 표기**
 * (`sim_tag: string | null`) 까지 잡혀서, 읽기 전용인 `qa-live-silence.ts` 가
 * 시더로 분류됐다. 이 저장소에서 새 판정기의 첫판이 과잉 매칭되는 건 되풀이되는 패턴이다.
 * 그래서 두 조건을 함께 요구한다 — ① 값이 타입 키워드가 아니고 ② 파일에 실제 insert/upsert 가 있다.
 */
function seederFiles(): string[] {
  return readdirSync(SCRIPTS)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.mjs'))
    .filter((f) => {
      const src = readFileSync(path.join(SCRIPTS, f), 'utf8');
      const writes = /\bsim_tag\s*:\s*(?!string\b|number\b|boolean\b|any\b|unknown\b|null\b)[A-Za-z_$]/.test(src);
      const inserts = /\.(insert|upsert)\s*\(/.test(src);
      return writes && inserts;
    });
}

describe('시뮬 시더는 전부 세션 태그를 쓴다', () => {
  const files = seederFiles();

  // 🔴 비-공허 단정. 탐지기가 0개를 찾고도 초록이면 이 게이트는 아무것도 안 지킨다.
  it('시더를 실제로 찾았다', () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it.each(files)('%s 는 SESSION_SIM_TAG 를 쓴다', (file) => {
    const src = readFileSync(path.join(SCRIPTS, file), 'utf8');
    expect(src).toMatch(/SESSION_SIM_TAG/);
    // 하드코딩된 전역 태그로 되돌아가면 실패한다.
    expect(src).not.toMatch(/const\s+SIM_TAG\s*=\s*['"]sim['"]/);
  });

  it('세션 태그는 워크트리마다 다르고 같은 워크트리에선 안정적이다', async () => {
    const { SESSION_SIM_TAG, isAnySimTag } = await import('../../scripts/simSessionTag');
    expect(SESSION_SIM_TAG).toMatch(/^sim:[0-9a-f]{8}$/);
    expect(isAnySimTag(SESSION_SIM_TAG)).toBe(true);
    expect(isAnySimTag('sim')).toBe(true);
    // 사장님 수동 테스트는 시뮬 태그가 아니다 — `--all` 도 건드리면 안 된다.
    expect(isAnySimTag('manual-test-2026-07')).toBe(false);
  });
});
