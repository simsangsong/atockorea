/**
 * DE2 상설 게이트 — 완성된 관리자 화면이 아무 데서도 열리지 않는 것을 막는다.
 *
 * 2026-07-27 진입점 감사에서 어드민 페이지 49개 중 3개가 사이드바에도 없고 다른
 * 화면에서 링크되지도 않아 URL을 직접 쳐야만 열렸다(상담 티켓 205줄 · 투어모드
 * 스팟 좌표 313줄 · POI 동영상 검수 232줄). 셋 다 코드는 완성이었고 테스트도
 * 통과했다 — 그래서 **어떤 단위 테스트도 이걸 잡을 수 없었다.** 화면 워크도 못
 * 잡는다: 워크는 열 수 있는 것만 열어보므로 열 수 없는 것은 방문하지 않는다.
 *
 * 판정은 소스에서 한다. 페이지가 도달 가능하려면 둘 중 하나여야 한다:
 *   ① `app/admin/layout.tsx`의 메뉴 배열에 있거나 (사이드바 + ⌘K 팔레트)
 *   ② 다른 화면이 그 경로로 링크하거나 (부모 화면의 카드·탭 등)
 *
 * 동적 세그먼트(`[id]`)는 목록 화면에서 행을 눌러 들어가므로 대상에서 뺀다.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
// X13: pages live under a route group now. Resolved rather than hard-coded so
// the next move fails the build with a real message instead of an ENOENT.
const ADMIN_DIR = ['(marketing)/admin', 'admin']
  .map((rel) => path.join(ROOT, 'app', ...rel.split('/')))
  .find((dir) => fs.existsSync(dir))!;

/**
 * Route-group segments are `(name)` and do NOT appear in the URL.
 * X13 put every page under `(marketing)` or `(app)`; deriving the URL by string
 * position rather than by meaning would have produced `/(marketing)/admin/...`,
 * which is a path that does not exist and would have failed every check below
 * for the wrong reason.
 */
function urlForPageDir(dir: string): string {
  const segments = path
    .relative(ROOT, dir)
    .split(path.sep)
    .filter((seg) => seg !== 'app' && !/^\(.*\)$/.test(seg));
  return `/${segments.join('/')}`;
}

function adminPageUrls(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'page.tsx') {
        out.push(urlForPageDir(dir));
      }
    }
  };
  walk(ADMIN_DIR);
  // 동적 라우트는 목록에서 행을 눌러 들어간다 — 고정 링크가 있을 수 없다.
  return out.filter((u) => !u.includes('['));
}

/** 그 경로를 언급하는 **다른** 소스 파일들. 자기 하위 트리는 제외한다. */
function inboundLinks(url: string): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(ROOT, full).split(path.sep).join('/');
      if (entry.isDirectory()) {
        if (/(^|\/)(node_modules|\.next|\.git|coverage)$/.test(rel)) continue;
        walk(full);
        continue;
      }
      if (!/\.(tsx|ts)$/.test(entry.name)) continue;
      if (rel.startsWith('__tests__/')) continue;
      // 자기 자신과 자기 하위 페이지의 언급은 "들어오는 링크"가 아니다.
      // The page's own subtree. Compare by derived URL so a route group in the
      // path does not make a self-mention look like an inbound link.
      if (rel.startsWith('app/') && urlForPageDir(path.dirname(full)).startsWith(url + '/')) continue;
      if (rel.startsWith('app/') && urlForPageDir(path.dirname(full)) === url) continue;
      const body = fs.readFileSync(full, 'utf8');
      if (body.includes(`'${url}'`) || body.includes(`"${url}"`) || body.includes('`' + url)) {
        hits.push(rel);
      }
    }
  };
  for (const top of ['app', 'components']) walk(path.join(ROOT, top));
  return hits;
}

describe('🔴 DE2 — 완성된 어드민 화면은 반드시 열 수 있어야 한다', () => {
  const urls = adminPageUrls();

  it('감사 대상 페이지를 실제로 찾았다', () => {
    // 0건이면 조용히 통과하는 게이트가 된다 — 그게 이 감사가 막으려는 실패다.
    expect(urls.length).toBeGreaterThan(20);
    expect(urls).toContain('/admin/poi-videos');
  });

  it.each(urls)('%s 는 사이드바에 있거나 어딘가에서 링크된다', (url) => {
    const links = inboundLinks(url);
    expect(
      links.length > 0
        ? true
        : `${url} 는 어디서도 도달할 수 없다 — admin/layout.tsx 의 adminMenuGroups 에 ` +
          `추가하거나, 부모 화면에서 링크해라. (URL 직접 입력은 도달 경로가 아니다)`,
    ).toBe(true);
  });
});
