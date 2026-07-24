/**
 * @jest-environment node
 *
 * §D A1.0 — 커버리지 원장이 낡지 않는다는 보증.
 *
 * 🔴 A-plan-review R6: A1은 "하나도 빠짐없이 소진"이라고 적어 놓고 62개 중
 * **34개만 호명**하고 있었다. 원장을 만드는 것으로는 부족하다 — 원장도 낡는다.
 * 컴포넌트가 하나 생기면 **이 테스트가 먼저 운다.**
 *
 * 문서 규율에 맡기지 않는 이유는 이 세션에서 이미 두 번 확인했다:
 * A4.6의 "사전존재 실패 무시"도, A4.1의 로케일 사본도, 전부 사람이 지키기로 한
 * 규칙이 지켜지지 않은 결과였다.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { checkCoverage, isComplete, parseLedger } from '@/lib/audit/a1Coverage';

const ROOT = process.cwd();
const SOURCE_DIR = 'components/tour-mode';
const LEDGER = 'docs/audit/A1-coverage.md';

function listComponents(dir: string, prefix = ''): string[] {
  const abs = path.join(ROOT, dir);
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    if (entry === '__tests__') continue;
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(path.join(abs, entry)).isDirectory()) {
      out.push(...listComponents(path.join(dir, entry), rel));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(rel);
    }
  }
  return out.sort();
}

const files = listComponents(SOURCE_DIR);
const rows = parseLedger(readFileSync(path.join(ROOT, LEDGER), 'utf8'));
const result = checkCoverage(files, rows);

describe('스캐너 자체', () => {
  it('실제로 컴포넌트를 읽었다 (경로 오타로 "0건 통과"가 나오지 않게)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('실제로 원장을 파싱했다', () => {
    expect(rows.length).toBeGreaterThan(50);
  });
});

describe('🔴 A1 커버리지 원장', () => {
  it('원장에 행이 없는 컴포넌트가 없다 — 있으면 A1은 "전수"가 아니다', () => {
    // 새 컴포넌트를 만들었다면 docs/audit/A1-coverage.md 에 행을 추가하세요.
    expect(result.missing).toEqual([]);
  });

  it('사라진 파일을 가리키는 유령 행이 없다 — 지워진 것을 감사했다고 적혀 있으면 안 된다', () => {
    expect(result.ghosts).toEqual([]);
  });

  it('담당 티켓이 비어 있는 행이 없다', () => {
    expect(result.unassigned).toEqual([]);
  });

  it('원장이 구조적으로 완전하다', () => {
    expect(isComplete(result)).toBe(true);
  });
});

describe('진행 상황 (실패가 아니라 기록)', () => {
  it('현재 미감사 개수를 남긴다 — A1이 끝나면 0이 된다', () => {
    const total = rows.length;
    const judged = total - result.unjudged.length;
    // eslint-disable-next-line no-console
    console.log(`A1 커버리지: ${judged}/${total} 판정 완료 · 미감사 ${result.unjudged.length}`);
    // 🔴 여기서 0을 강제하지 않는다. 강제하면 원장을 만드는 순간 빨개지고,
    // 빨간 것을 없애려고 판정을 대충 채우게 된다 — 원장의 목적이 뒤집힌다.
    expect(result.unjudged.length).toBeLessThanOrEqual(total);
  });
});
