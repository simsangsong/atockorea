/**
 * @jest-environment node
 *
 * §K B2.5 — **판매 표면 회귀.**
 *
 * B2-D1은 "정원은 판매 차단이 아니라 운영 캡"이다. 그런데 그 규칙은 문서에만
 * 있으면 반드시 깨진다: 다음 사람이 상품 페이지에서 `max_room_guests`를 읽어
 * "3자리 남음"을 띄우는 데 5분이면 된다. 그리고 그건 확정 결정 —
 * *온디맨드 = 무한, product_inventory가 비어 있는 것은 의도, 희소성 UI 금지* —
 * 을 **조용히** 뒤집는다. 조용하다는 것이 핵심이다. 아무도 알아채지 못한다.
 *
 * 그래서 이 스위트는 파일 시스템을 직접 훑는다. 컴포넌트 하나를 렌더해서는
 * "어디에도 없다"를 증명할 수 없기 때문이다.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/** 손님이 보는 판매·탐색 표면. 여기에 정원이 닿으면 안 된다. */
const SALES_SURFACES = [
  'app/tour-product',
  'app/tours',
  'app/checkout',
  'components/tour-product',
  'components/home',
  'lib/agent',
  'lib/chatbot',
];

/** 정원 관련 심볼 — 판매 표면에 하나도 등장하면 안 된다. */
const CAPACITY_SYMBOLS = [
  'max_room_guests',
  'effectiveCapacity',
  'capacityVerdict',
  'productCapacity',
  'overCapacityNotice',
  'ops_tour_groups',
];

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return []; // 표면이 없는 환경이면 검사할 것도 없다
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(abs, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(path.join(dir, entry)));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe('B2.5 — 정원이 판매 표면에 새지 않는다', () => {
  const files = SALES_SURFACES.flatMap(walk);

  it('검사 대상 파일이 실제로 존재한다 (경로 오타로 통과하는 것을 막는다)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(CAPACITY_SYMBOLS)('🔴 판매 표면 어디에도 `%s`가 없다', (symbol) => {
    const offenders = files
      .filter((file) => readFileSync(file, 'utf8').includes(symbol))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('정원 모듈이 자기 계약을 주석으로 들고 있다 — 다음 사람이 이유를 읽는다', () => {
    const source = readFileSync(path.join(ROOT, 'lib/ops/seating/capacity.ts'), 'utf8');
    expect(source).toContain('B2-D1');
    expect(source).toContain('희소성');
  });
});
