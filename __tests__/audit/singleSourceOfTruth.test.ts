/**
 * @jest-environment node
 *
 * §D A4.1 — 중복 진실 사냥.
 *
 * 🔴 드리프트는 이 저장소의 **반복 실패모드**다(§H-4). 같은 상수가 두 곳에
 * 살면 언젠가 한쪽만 고쳐지고, 그 사실은 고친 사람도 모른다.
 *
 * 이 스위트는 저장소를 실제로 훑어 **알려진 단일 소스가 복제되지 않았는지**를
 * 확인한다. 일반적인 중복 탐지가 아니라, 이미 값을 치른 지점들의 재발 방지다.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'components', 'lib', 'hooks'];

function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const rel = path.join(dir, entry);
    const full = path.join(ROOT, rel);
    if (statSync(full).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(rel.replace(/\\/g, '/'));
  }
  return out;
}

const files = walk('').length ? [] : [];
const sources = SCAN_DIRS.flatMap((d) => walk(d)).map((f) => ({
  path: f,
  text: readFileSync(path.join(ROOT, f), 'utf8'),
}));

describe('스캐너 자체', () => {
  it('저장소를 실제로 읽었다', () => {
    expect(sources.length).toBeGreaterThan(500);
    expect(files).toEqual([]); // 위 walk('')는 의도적 no-op (린트 정적 참조 방지)
  });
});

describe('🔴 로케일 목록은 하나뿐이다', () => {
  /**
   * 2026-07-25 A4.1 실측: 이 목록이 **프로덕션 파일 5곳**에 복제돼 있었고,
   * 그중 `TourRoomClient.tsx`는 **순서까지 달랐다**(`['en','ko','ja','es','zh']`).
   * 순서가 다르다는 것은 이미 어긋났다는 뜻이다.
   *
   * `broadcast/route.ts`는 `ROOM_LOCALES`를 import해 놓고 **바로 아래에** 사본을
   * 정의하고 있었다 — 복제가 얼마나 쉽게 생기는지 보여주는 사례라 적어 둔다.
   */
  const CANONICAL = 'lib/tour-room/snapshot.ts';

  /**
   * 🔴 허용 목록은 **이유와 함께** 적는다. 이유 없는 예외는 다음 사람이
   * "여기 넣으면 통과하네"로 읽고, 그 순간 이 검사는 죽는다.
   *
   * `tour-content/generate`의 AUDIO_LOCALES는 **투어 콘텐츠 오디오 생성** 집합이지
   * 룸 로케일이 아니다. 지금 구성원이 같은 것은 우연이고, 룸에 6번째 로케일이
   * 생겨도 오디오가 따라가야 할 이유는 없다. 묶는 것이 오히려 결합 오류다.
   */
  const ALLOWED = new Set(['app/api/admin/tour-content/generate/route.ts']);

  // 순서와 무관하게 5개 로케일이 한 배열 리터럴에 나열된 형태.
  const literalRe = /\[\s*(['"])(en|ko|zh|ja|es)\1(\s*,\s*(['"])(en|ko|zh|ja|es)\4){4}\s*,?\s*\]/;

  it('정본이 존재한다', () => {
    expect(ROOM_LOCALES).toHaveLength(5);
    expect([...ROOM_LOCALES].sort()).toEqual(['en', 'es', 'ja', 'ko', 'zh']);
  });

  it('🔴 정본 밖 어디에도 5로케일 배열 리터럴이 없다', () => {
    const offenders = sources
      .filter((s) => s.path !== CANONICAL && !ALLOWED.has(s.path) && literalRe.test(s.text))
      .map((s) => s.path);
    expect(offenders).toEqual([]);
  });
});

describe('🔴 정원 해석 순서는 한 곳에만 있다 (B2.1b)', () => {
  /**
   * B2-D3가 "숫자가 두 테이블에 사는 이상 우선순위를 안 적으면 드리프트가
   * 확정된다"고 못 박은 지점. 그 순서(그룹 예외 → 상품값 → price_type 기본값)를
   * 구현하는 코드는 `capacity.ts` 하나여야 한다.
   */
  it('스몰그룹 기본값 12가 capacity.ts 밖 ops 코드에 하드코딩돼 있지 않다', () => {
    const offenders = sources
      .filter((s) => s.path.startsWith('lib/ops/') && s.path !== 'lib/ops/seating/capacity.ts')
      .filter((s) => /max_room_guests\s*[:=]\s*12\b|capacity\s*[:=]\s*12\b/.test(s.text))
      .map((s) => s.path);
    expect(offenders).toEqual([]);
  });

  it('정원 해석기가 실제로 한 파일에만 있다', () => {
    const definers = sources.filter((s) => /export function (productCapacity|effectiveCapacity)\b/.test(s.text));
    expect(definers.map((d) => d.path)).toEqual(['lib/ops/seating/capacity.ts']);
  });
});

describe('🔴 집계기는 하나뿐이다 (B1-D3)', () => {
  /**
   * B1-D3: "같은 숫자를 두 곳에서 따로 계산하면 반드시 어긋난다 — 이 저장소의
   * 반복 실패모드(§H-4)". 통합 통계는 자기 리졸버를 갖고, 일일 보고서는
   * 자기 집계기를 갖되, **룸 누락 판정**처럼 겹치는 규칙은 복제되면 안 된다.
   */
  it('룸 누락 판정이 한 곳에만 있다', () => {
    const definers = sources.filter((s) => /export function roomGapFor\b/.test(s.text));
    expect(definers.map((d) => d.path)).toEqual(['lib/ops/bookings/unified.ts']);
  });

  it('CSV 인코더를 두 번 만들지 않았다 — 세무 서식 것을 재사용한다', () => {
    const definers = sources.filter((s) => /export function aoaToCsv\b/.test(s.text));
    expect(definers.map((d) => d.path)).toEqual(['lib/ops/tax/forms.ts']);
  });
});

describe('🔴 초과요금 단가는 overtime.ts 밖에 없다', () => {
  /**
   * `lib/tour-room/overtime.ts`가 스스로 적어 둔 계약:
   * "no rate is hardcoded elsewhere, so the promise can never drift (plan §12 Q3)".
   * 그 약속을 테스트로 고정한다 — 주석은 지켜지지 않아도 아무 일이 없지만
   * 테스트는 운다.
   */
  it('시급 30000/40000이 tour-room·ops 코드의 다른 곳에 없다', () => {
    const offenders = sources
      .filter((s) => s.path.startsWith('lib/tour-room/') || s.path.startsWith('lib/ops/'))
      .filter((s) => s.path !== 'lib/tour-room/overtime.ts')
      .filter((s) => /\brate:\s*(30000|40000)\b|OVERTIME_RATE\w*\s*=\s*\d/.test(s.text))
      .map((s) => s.path);
    expect(offenders).toEqual([]);
  });
});

describe('🔴 LLM 예산은 usage.ts 하나가 정한다 (§L)', () => {
  it('투어당 호출 예산 상수가 한 곳에만 정의된다', () => {
    const definers = sources.filter((s) => /export const LLM_CALLS_PER_TOUR_BUDGET\b/.test(s.text));
    expect(definers.map((d) => d.path)).toEqual(['lib/ai/usage.ts']);
  });

  it('목적별 출력 상한 기본값도 한 곳뿐이다', () => {
    const definers = sources.filter((s) => /export const DEFAULT_MAX_OUTPUT_TOKENS\b/.test(s.text));
    expect(definers.map((d) => d.path)).toEqual(['lib/ai/usage.ts']);
  });
});
