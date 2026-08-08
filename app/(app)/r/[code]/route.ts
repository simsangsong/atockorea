import { NextRequest, NextResponse } from 'next/server';

/**
 * /r/{code} — 짧은 링크의 문 (smart-guide-entry-code plan §C-2 문 1).
 *
 * 여기서는 아무것도 발급하지 않는다: 이메일 스캐너·왓츠앱 미리보기 봇이 GET 을
 * 따라와도 토큰·원장 행이 생기면 안 된다(§O-1 ⑦과 같은 이유). 순수 리다이렉트로
 * /tour-mode?code= 에 넘기면, 사람 브라우저의 JS 만 POST /api/tour-mode/entry 로
 * 열쇠를 받아 방으로 들어간다.
 *
 * ?to=plan 은 프라이빗 투어 초대 메일의 "일정 만들기" CTA 가 쓴다 — 같은 코드,
 * 착지만 /plan.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const search = new URLSearchParams({ code });
  if (req.nextUrl.searchParams.get('to') === 'plan') search.set('to', 'plan');
  // 상대 Location(RFC 7231 — 브라우저가 현재 오리진으로 해석한다).
  // 절대 URL 을 조립하면 호스트를 서버가 맞혀야 하는데, dev 의 -H 0.0.0.0 은
  // req.url·nextUrl 둘 다 0.0.0.0 을 넣어 브라우저가 오리진 이탈로 거부했다
  // (실측 2026-08-08). 프록시 뒤에서도 상대 경로가 유일하게 안전하다.
  return new NextResponse(null, {
    status: 307,
    headers: { Location: `/tour-mode?${search.toString()}` },
  });
}
