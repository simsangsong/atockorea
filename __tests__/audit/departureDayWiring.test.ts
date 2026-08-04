/**
 * @jest-environment node
 *
 * 운행 요일 규칙이 **모든 판정 표면에 연결돼 있는지**를 소스로 검사한다.
 *
 * 🔴 이 트랙의 지배 결함은 "만드는 문제"가 아니라 "연결하는 문제"다. 규칙 모듈이
 * 옳아도 소비처 하나가 안 부르면, 캘린더는 회색인데 예약 API 는 받아준다 —
 * 그리고 그 결함은 **호출자의 부재**라서 단위 테스트로는 절대 안 잡힌다.
 * 그래서 게이트는 모듈의 동작이 아니라 **배선**을 잰다.
 *
 * 함께 잰다: `product_inventory` 를 `.eq('is_available', true)` 로 읽는 짓.
 * 그러면 닫아 둔 행이 결과에서 빠지고, 바로 아래 "행 없음" 분기가 그 날짜를
 * 기본 정원으로 **되살린다.** 같은 결함이 네 파일에 복제돼 있었다.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/**
 * 날짜의 예약 가능 여부를 판정하는 표면 전부. 새 표면을 만들면 여기 추가하라 —
 * 목록에서 빠진 표면은 이 게이트가 지켜 주지 않는다.
 */
const DECISION_SURFACES = [
  'app/api/tours/[id]/availability/range/route.ts', // 캘린더
  'app/api/tours/[id]/availability/route.ts', // 단일 날짜 조회
  'app/api/bookings/route.ts', // 예약 생성
  'lib/agent/availability.ts', // 에이전트/MCP 채널
];

const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

describe('스캐너 자체', () => {
  it('검사 대상 파일이 실제로 존재하고 비어 있지 않다', () => {
    expect(DECISION_SURFACES.length).toBeGreaterThanOrEqual(4);
    for (const rel of DECISION_SURFACES) {
      expect(existsSync(path.join(ROOT, rel))).toBe(true);
      expect(read(rel).length).toBeGreaterThan(500);
    }
  });
});

describe('🔴 운행 요일 규칙은 판정 표면 전부가 읽는다', () => {
  it.each(DECISION_SURFACES)('%s 가 isDateOffDepartureDay 를 부른다', (rel) => {
    const text = read(rel);
    expect(text).toContain('tour-departure-days');
    // import 만 해 두고 안 부르는 것이 바로 이 트랙의 반복 결함이다.
    expect(text).toMatch(/isDateOffDepartureDay\s*\(/);
  });
});

describe('🔴 닫힌 인벤토리 행을 조회에서 빼지 않는다', () => {
  it.each(DECISION_SURFACES)('%s 에 is_available 필터가 없다', (rel) => {
    const text = read(rel);
    expect(text).not.toMatch(/\.eq\(\s*['"]is_available['"]\s*,\s*true\s*\)/);
  });

  it('product_inventory 를 읽는 어떤 프로덕션 파일도 그 필터를 쓰지 않는다', () => {
    // 목록 밖에서 같은 결함이 새로 자라는 것까지 막는다.
    const offenders: string[] = [];
    for (const rel of DECISION_SURFACES) {
      if (/\.eq\(\s*['"]is_available['"]\s*,\s*true\s*\)/.test(read(rel))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});

describe('🔴 요일 목록의 단일 소스', () => {
  it('판정 표면 어디에도 요일 배열이 하드코딩돼 있지 않다', () => {
    // 같은 상수가 두 곳에 살면 언젠가 한쪽만 고쳐진다. 요일은 모듈에만 있다.
    for (const rel of DECISION_SURFACES) {
      const text = read(rel);
      expect(text).not.toMatch(/weekdays\s*:\s*\[/);
      expect(text).not.toMatch(/TOUR_DEPARTURE_DAYS/);
    }
  });

  it('규칙 모듈은 실제로 슬러그를 담고 있다 — 빈 표를 초록으로 읽지 않는다', () => {
    // 표가 비면 위의 배선 검사는 전부 통과하면서 아무 날짜도 안 닫는다.
    const mod = read('lib/tour-departure-days.ts');
    const slugs = mod.match(/^\s{2}'[a-z0-9-]+':/gm) ?? [];
    expect(slugs.length).toBeGreaterThanOrEqual(4);
    expect(mod).toContain('seoul-suwon-hwaseong-waujeongsa-starfield');
    expect(mod).toContain('pocheon-sanjeong-lake-herb-island-art-valley');
  });
});
