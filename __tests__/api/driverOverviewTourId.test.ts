/**
 * 🔴 상설 가드 — 하루를 해석하는 호출은 `tourId`를 넘겨야 한다.
 *
 * `resolveDaySchedule`은 `tourId`가 있으면 stage ②.5(상품 페이지의 번역된
 * itinerary)를 읽고, 없으면 그걸 건너뛰어 `tours.schedule`로 떨어진다 —
 * 단일 언어 blob이고 **스톱에 `poi_key`가 없다.**
 *
 * 그 아래 모든 소비처가 `poi_key`로 걸린다: 내비 좌표, 도착 카드 콘텐츠,
 * 시설 핀. 그래서 기사 콕핏은 **장소가 하나도 없는 하루**를 보여주고 있었고,
 * 가이드가 [도착]을 눌러도 카드에 할 말이 없었다.
 *
 * 실측 2026-07-29, 라이브 예약 21건 · 투어 5종:
 *   스톱 130개 (양쪽 동일)
 *   poi_key 있는 스톱  0 → 124
 *
 * 인자가 없던 게 아니라 **안 넘긴** 것이다. 기능 부재처럼 읽히지만 인자 누락이고,
 * 이 레포에 기록된 지배적 결함 유형("안 채운 인자")이 정확히 이것이다.
 *
 * 소스 게이트인 이유: 런타임 판정은 DB가 있어야 하고, 실제로 일어날 법한 회귀는
 * **새 호출부가 인자를 빠뜨리는 것**이다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const NEEDLE = 'resolveDaySchedule';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

/** Every call site, with its argument text. */
function callSites(): Array<{ file: string; args: string }> {
  const out: Array<{ file: string; args: string }> = [];
  for (const root of ['app', 'lib', 'components']) {
    for (const file of walk(path.join(process.cwd(), root))) {
      const src = readFileSync(file, 'utf8');
      let from = 0;
      while (from < src.length) {
        const at = src.indexOf(NEEDLE + '(', from);
        if (at < 0) break;
        from = at + NEEDLE.length;
        // Skip the declaration itself.
        const before = src.slice(Math.max(0, at - 40), at);
        if (/function\s+$/.test(before)) continue;

        let depth = 0;
        let i = at + NEEDLE.length;
        while (i < src.length) {
          if (src[i] === '(') depth += 1;
          else if (src[i] === ')') {
            depth -= 1;
            if (depth === 0) break;
          }
          i += 1;
        }
        out.push({
          file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
          args: src.slice(at, i + 1),
        });
      }
    }
  }
  return out;
}

describe('resolveDaySchedule callers', () => {
  it('there are callers to check', () => {
    expect(callSites().length).toBeGreaterThanOrEqual(3);
  });

  it('🔴 every caller passes tourId', () => {
    const missing = callSites()
      .filter((c) => !/\btourId\b/.test(c.args))
      .map((c) => c.file + '\n    ' + c.args.replace(/\s+/g, ' ').slice(0, 160));
    expect(missing.join('\n\n')).toBe('');
  });

  it('the driver overview passes it — the one that was measured empty', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'app/api/tour-mode/driver/overview/route.ts'),
      'utf8',
    );
    const at = src.indexOf(NEEDLE + '(');
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 900)).toMatch(/\btourId\b/);
  });
});
