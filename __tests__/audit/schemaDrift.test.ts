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
  // ── OTA 파서 학습 루프 (DE5). 저장소가 없어 실패를 모으기만 하고 못 배운다.
  ops_parse_observations: 'DE5 — recordObservation 이 에러를 삼켜 조용히 전부 실패해 왔다',
  ops_parse_metrics: 'DE5 — 퍼널 계측이 저장되지 않는다',
  ops_parse_format_templates: 'DE5 — 포맷 템플릿 저장소 없음',
  ops_parse_learning_health: 'DE5 — 뷰 부재. health.ts 는 null 을 "측정 불가"로 처리(설계된 폴백)',
  // ── 픽업 정규화. OTA 픽업지 표기를 표준 지점으로 모으는 사전이 통째로 없다.
  ops_pickup_locations: 'DE5 — 픽업 표준 지점 사전 부재',
  ops_pickup_aliases: 'DE5 — 픽업 표기 별칭 부재',
  ops_pickup_learning_queue: 'DE5 — 픽업 학습 큐 부재(queuePickupProposal 도 best-effort 삼킴)',
  // ── 크루즈. 선박·기항 데이터가 앉을 자리가 없다(크루즈 트랙 진행 중).
  ops_cruise_ships: '크루즈 트랙 — 선박 마스터 부재',
  ops_cruise_ship_aliases: '크루즈 트랙 — 선박명 별칭 부재',
  ops_cruise_port_calls: '크루즈 트랙 — 기항 스케줄 부재(파서 백스톱이 이걸 본다)',
  // ── 사이트 설정 / CMS. 읽기는 빈 값으로 조용히 떨어지고 저장은 실패한다.
  site_settings: '🔴 CMS 오버라이드·홈 카드 이미지·시스템 설정이 저장되지 않는다',
  // ── 애널리틱스 롤업.
  analytics_events_daily: '어드민 분석 롤업 테이블 부재',
  analytics_sessions_daily: '어드민 분석 롤업 테이블 부재',
  // ── 옛 마켓플레이스 계층(TIER 3). 테이블을 만들 게 아니라 코드를 지울 후보.
  notifications: 'TIER 3 잔해 — 표면 없음. 만들지 말고 지울 대상',
  email_replies: '어드민 메일 답장 기록이 남지 않는다',
  error_logs: '클라이언트 에러 로그가 저장되지 않는다',
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
    // 버킷은 테이블이 아니다 — 지우고 나서 본다.
    const body = raw.replace(/storage\s*\.\s*from\(\s*['"][a-z0-9_-]+['"]\s*\)/g, '');
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
