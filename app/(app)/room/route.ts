import { NextRequest, NextResponse } from 'next/server';

/**
 * /room — 사람이 받아 적는 고정 주소 ("atockorea.com/room 에서 코드 입력").
 * 실제 화면은 /tour-mode 하나다 — 이 별칭은 안내문·바우처에 인쇄하기 좋은
 * 짧은 철자일 뿐이고, 쿼리(?code= 등)는 그대로 넘긴다.
 */
export async function GET(req: NextRequest) {
  // 상대 Location — /r/[code]/route.ts 와 같은 이유(호스트를 서버가 맞히지 않는다).
  const search = req.nextUrl.searchParams.toString();
  return new NextResponse(null, {
    status: 307,
    headers: { Location: `/tour-mode${search ? `?${search}` : ''}` },
  });
}
