/**
 * DE6 상설 게이트 — 코드가 읽는 테이블이 라이브에 없으면 CI를 실패시킨다.
 *
 * 2026-07-28 2차 감사에서 코드가 `.from('...')` 로 참조하는 테이블 **16개가
 * 라이브에 존재하지 않는다**는 것이 드러났다. 그리고 그 대부분은 **조용히**
 * 실패한다 — `recordObservation`은 주석에 적힌 대로 "best-effort"라 에러를
 * 통째로 삼키고, CMS 오버라이드 읽기는 빈 값으로 떨어진다. 즉 기능이 배포된
 * 이래 한 번도 동작한 적이 없는데 아무도 몰랐다.
 *
 * 이건 진입점 감사(DE1~DE5)와 같은 병의 마지막 형태다: 코드는 완성이고 테스트도
 * green인데 **저장소가 없어서** 아무 일도 일어나지 않는다.
 *
 * 판정 방식: 라이브 스키마 스냅샷(`data/db-tables.json`)과 소스의 `.from('...')`
 * 를 대조한다. 새로 생긴 드리프트는 즉시 실패하고, 이미 알려진 16개는 아래
 * `KNOWN_MISSING`에 **이유와 함께** 박아 둔다 — 목록이 줄어들 수는 있어도
 * 조용히 늘어나지는 못한다.
 *
 * ⚠ `supabase.storage.from('bucket')`은 테이블이 아니다. 처음 추출했을 때
 * `avatars` 버킷이 "없는 테이블"로 잡혔다. 그래서 storage 호출을 먼저 지운다.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SNAPSHOT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'db-tables.json'), 'utf8')) as {
  tables: string[];
};

/**
 * 라이브에 없다는 것이 확인된 참조. 값 = 무엇이 걸려 있고 왜 아직 미해결인가.
 * 🔴 여기에 줄을 **추가하려면** 그건 새 드리프트라는 뜻이다 — 마이그레이션을
 * 쓰거나, 그 코드를 지워라. 목록은 줄어드는 방향으로만 움직여야 한다.
 */
const KNOWN_MISSING: Record<string, string> = {
  // 2026-07-28 기준 비어 있다 — 발견된 16건은 전부 해소됐다.
  //   · 11건은 실제로 없어서 만들었다(site_settings · 픽업 3 · 파서 4 · 크루즈 3 · email_replies · notifications)
  //   · analytics_events_daily / analytics_sessions_daily 는 **머티리얼라이즈드 뷰**라
  //     원래 있었는데 스냅샷 쿼리가 pg_matviews 를 안 봐서 없는 것으로 오판했다
  //   · error_logs 는 insert 블록이 통째로 주석 안이라 참조 자체가 아니었다
};

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const r = path.relative(ROOT, full).split(path.sep).join('/');
      if (e.isDirectory()) {
        if (/(^|\/)(node_modules|\.next|\.git|coverage|__tests__)$/.test(r)) continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(e.name)) out.push(r);
    }
  };
  for (const top of ['app', 'lib', 'components', 'hooks']) walk(path.join(ROOT, top));
  return out;
}

function referencedTables(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const f of sourceFiles()) {
    const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const body = raw
      // 주석 안의 코드는 실행되지 않는다. `error_logs` 는 insert 블록 전체가
      // /* */ 로 감싸져 있는데도 "라이브에 없는 테이블"로 잡혔다.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      // 버킷은 테이블이 아니다 — `avatars` 가 이렇게 잡혔다.
      .replace(/storage\s*\.\s*from\(\s*['"][a-z0-9_-]+['"]\s*\)/g, '');
    for (const m of body.matchAll(/(?<!storage)\.from\(\s*['"]([a-z0-9_]+)['"]\s*\)/g)) {
      const list = found.get(m[1]) ?? [];
      if (!list.includes(f)) list.push(f);
      found.set(m[1], list);
    }
  }
  return found;
}

describe('🔴 DE6 — 코드가 읽는 테이블은 라이브에 있어야 한다', () => {
  const refs = referencedTables();
  const live = new Set(SNAPSHOT.tables);

  it('스냅샷과 참조를 실제로 읽었다', () => {
    // 둘 중 하나가 비면 이 게이트는 조용히 통과하는 장식이 된다.
    expect(SNAPSHOT.tables.length).toBeGreaterThan(100);
    expect(refs.size).toBeGreaterThan(100);
  });

  it('알려지지 않은 새 드리프트가 없다', () => {
    const drift = [...refs.keys()].filter((t) => !live.has(t) && !(t in KNOWN_MISSING));
    expect(
      drift.length === 0
        ? []
        : drift.map((t) => `${t}  ← ${refs.get(t)!.slice(0, 3).join(', ')}`),
    ).toEqual([]);
  });

  it('KNOWN_MISSING 은 실제로 아직 없는 것만 담는다 — 고쳐졌으면 지워라', () => {
    const stale = Object.keys(KNOWN_MISSING).filter((t) => live.has(t));
    expect(stale).toEqual([]);
  });

  it('KNOWN_MISSING 은 실제로 코드가 참조하는 것만 담는다 — 코드가 사라졌으면 지워라', () => {
    const orphan = Object.keys(KNOWN_MISSING).filter((t) => !refs.has(t));
    expect(orphan).toEqual([]);
  });
});
