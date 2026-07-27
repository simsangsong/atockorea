/**
 * @jest-environment node
 *
 * G1 / U-D10 — 상설 로케일 완결성 게이트.
 *
 * 왜 필요한가: 룸 카피 대부분은 느슨한 `Record<string, …>` 객체 리터럴이다.
 * 5→9 로케일 확장에서 **tsc는 한 마디도 하지 않았다** — 키가 5개인
 * `Record<string, string>`도 완벽히 유효한 `Record<string, string>`이기 때문이다.
 *
 * 대가는 크래시가 아니라 **틀린 언어의 답변**이다. `vision-ask`는 5개짜리 맵에서
 * 답변 언어를 골라, 프랑스어·독일어·러시아어·이탈리아어 손님에게 몇 주간 영어로
 * 답하고 있었다(2026-07-27 PR #508에서 수정). 병렬 세션도 같은 유형을
 * "zh 있고 fr 없는 파일" grep으로 손수 찾아냈다. 그 grep을 게이트로 승격한 것이
 * 이 파일이다 — typeDiscipline과 같은 패턴이다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { findIncompleteLocaleBlocks } from '@/lib/audit/localeBlocks';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

const SCANNED_DIRS = ['components/tour-mode', 'components/tour-ops', 'lib/tour-room', 'lib/ops'];

/**
 * 의도적 부분집합만 여기 적는다. **이유 없이 추가 금지** — 이 목록이 늘어나면
 * 게이트가 아니라 장식이 된다.
 */
const ALLOWLIST: Array<{ file: string; why: string }> = [
  {
    file: 'lib/ops/whatsapp/presets.ts',
    why: '크루즈/왓츠앱 프리셋은 waLocaleKey로 fr/de/ru/it→en 폴백이 의도된 설계다(플랜 재리뷰 백로그). 서구권 크루즈 타깃 확대 시 승격 대상.',
  },
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) ? [full.replace(/\\/g, '/')] : [];
  });
}

interface Violation {
  file: string;
  line: number;
  have: string;
  missing: string;
}

function scan(): Violation[] {
  const allowed = new Set(ALLOWLIST.map((a) => a.file));
  const out: Violation[] = [];
  for (const dir of SCANNED_DIRS) {
    for (const file of walk(dir)) {
      if (allowed.has(file)) continue;
      const blocks = findIncompleteLocaleBlocks(readFileSync(file, 'utf8'), ROOM_LOCALES);
      for (const block of blocks) {
        out.push({
          file,
          line: block.line,
          have: block.localeKeys.join(','),
          missing: block.missing.join(','),
        });
      }
    }
  }
  return out;
}

describe('🔴 G1 — 인라인 카피 블록은 ROOM_LOCALES 전 키를 갖는다 (U-D10)', () => {
  it('로케일 맵으로 보이는 객체 리터럴에 빠진 로케일이 없다', () => {
    const violations = scan();
    const report = violations
      .map((v) => `  ${v.file}:${v.line}  have=[${v.have}]  MISSING=[${v.missing}]`)
      .join('\n');
    expect(
      violations.length === 0
        ? ''
        : `\n${violations.length}개 카피 블록이 로케일을 빠뜨렸다 — tsc는 이걸 못 잡는다:\n${report}\n`,
    ).toBe('');
  });

  it('허용 목록의 파일은 실재하고 이유가 적혀 있다', () => {
    for (const entry of ALLOWLIST) {
      expect(() => statSync(entry.file)).not.toThrow();
      expect(entry.why.length).toBeGreaterThan(20);
    }
  });
});
