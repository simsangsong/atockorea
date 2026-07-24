/**
 * @jest-environment node
 *
 * 로케일 우회 경로 회귀 방지.
 *
 * 이 앱의 미들웨어는 접두사가 없는 경로에 사용자의 로케일을 붙여 리다이렉트한다
 * (`/foo` → `/ko/foo`). 그래서 **로케일 라우트가 없는 표면**은 명시적으로 우회
 * 목록에 있어야 하고, 빠지면 "한국어 브라우저에서만 404"라는, 영어 환경 테스트로는
 * 절대 안 걸리는 버그가 된다.
 *
 * 가이드 셀프 스케줄(`/g/schedule/[token]`, §11.F)이 정확히 그 사례다 — 링크를
 * 받는 사람이 대부분 한국어 브라우저를 쓰므로 우회가 없으면 실사용자 거의 전원이
 * 404를 본다. 관제(`/admin`)와 투어룸(`/tour-mode`)도 같은 이유로 우회된다.
 */

// jest.setup.js의 Request 폴리필은 NextRequest와 호환되지 않는다 — 다른 node-env
// 라우트 스위트와 같은 방식으로 진짜 웹 프리미티브를 복원한다.
import '@/test-utils/restoreWebPrimitives';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// 세션 갱신(@supabase/ssr)은 이 테스트의 관심사가 아니다 — 네트워크를 막는다.
jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

// 로케일 협상 라이브러리는 ESM-only라 jest 변환 대상이 아니다. 이 스위트가
// 검증하려는 것은 "협상 결과가 ko일 때 경로가 어떻게 되는가"이지 협상 알고리즘
// 자체가 아니므로, Accept-Language를 그대로 돌려주는 최소 대역으로 대체한다.
jest.mock('negotiator', () => {
  return class {
    private header: string;
    constructor(opts: { headers: Record<string, string> }) {
      this.header = opts.headers['accept-language'] ?? '';
    }
    languages() {
      return this.header
        .split(',')
        .map((part) => part.split(';')[0].trim())
        .filter(Boolean);
    }
  };
});
jest.mock('@formatjs/intl-localematcher', () => ({
  match: (requested: string[], supported: string[], fallback: string) =>
    requested.find((r) => supported.includes(r)) ??
    requested.map((r) => r.split('-')[0]).find((r) => supported.includes(r)) ??
    fallback,
}));

/** 한국어를 선호하는 방문자 — 로케일 접두사가 붙는 조건. */
function koRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`https://atockorea.com${pathname}`), {
    headers: { 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8' },
  });
}

/**
 * ⚠ 점 없는 토큰을 쓰는 것이 이 테스트의 핵심이다.
 *
 * 실제 토큰은 `base64url(payload).hex(sig)` 형태라 항상 점을 포함하고, 미들웨어
 * config.matcher(`/((?!_next|api|.*\..*).*)`)는 점이 있는 경로를 아예 제외한다.
 * 즉 현재 토큰 포맷은 **우연히** 로케일 리다이렉트를 피해 간다. 우회 규칙이 없으면
 * 그 우연이 사라지는 순간(토큰 인코딩 변경 등) 한국어 사용자 전원이 404를 보게
 * 되므로, 점 없는 경로로 미들웨어 본문을 실제로 통과시켜 규칙 자체를 검증한다.
 */
const DOTLESS_TOKEN = 'dotless-token-for-routing-check';

describe('middleware — 로케일 중립 표면', () => {
  it('does not locale-prefix the guide self-schedule link', async () => {
    const res = await middleware(koRequest(`/g/schedule/${DOTLESS_TOKEN}`));
    // 리다이렉트가 아니어야 한다 (307이면 /ko/g/... 로 갔다는 뜻 = 404).
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('keeps the token intact (no rewrite of the path)', async () => {
    const res = await middleware(koRequest(`/g/schedule/${DOTLESS_TOKEN}`));
    const rewrite = res.headers.get('x-middleware-rewrite');
    if (rewrite) expect(rewrite).toContain(`/g/schedule/${DOTLESS_TOKEN}`);
  });

  it('bypasses tour-mode and admin the same way', async () => {
    for (const path of ['/tour-mode/driver', '/admin/guides']) {
      const res = await middleware(koRequest(path));
      expect(res.headers.get('location')).toBeNull();
    }
  });

  // 대조군: 우회 목록에 없는 일반 경로는 실제로 접두사가 붙는다 —
  // 이게 붙지 않으면 위 검사들이 아무것도 증명하지 못한다.
  it('still locale-prefixes an ordinary page for a Korean visitor', async () => {
    const res = await middleware(koRequest('/about'));
    expect(res.headers.get('location')).toContain('/ko/about');
  });
});
