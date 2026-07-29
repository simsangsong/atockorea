import type { Metadata } from 'next';
import { verifyGuideScheduleToken } from '@/lib/ops/guides/selfToken';
import GuideScheduleClient from './GuideScheduleClient';

export const dynamic = 'force-dynamic';

/**
 * 가이드 셀프 스케줄 (§11.F) — `/g/schedule/[token]`.
 *
 * 토큰 검증을 서버에서 한 번 하고 이름만 넘긴다. 만료·위조 토큰은 클라이언트를
 * 아예 렌더하지 않고 안내 문구만 보여준다 — 깨진 화면에서 API 401을 만나는 것보다
 * 낫다.
 *
 * noindex: 링크 하나가 곧 권한이므로 검색엔진에 색인될 이유가 없다.
 */

export const metadata: Metadata = {
  title: '내 휴무 등록',
  robots: { index: false, follow: false },
};

export default async function GuideSchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = verifyGuideScheduleToken(token);

  if (!payload) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-20 text-center">
        <h1 className="text-[18px] font-bold text-slate-900">링크가 만료되었어요</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
          이 링크는 더 이상 사용할 수 없습니다.
          <br />
          담당자에게 새 링크를 요청해 주세요.
        </p>
      </main>
    );
  }

  return <GuideScheduleClient token={token} guideName={payload.name} />;
}
