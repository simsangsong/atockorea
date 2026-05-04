import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import ReviewWriteWizard from '@/components/reviews/ReviewWriteWizard';
import { isReviewFlowPreviewEnabled } from '@/lib/review-flow-preview';
import { generateMetadata as generateSEOMetadata } from '@/lib/seo';

export const metadata = generateSEOMetadata({
  title: 'Review flow preview (sandbox)',
  description:
    'Mock review wizard for UX checks. Set NEXT_PUBLIC_REVIEW_FLOW_PREVIEW=1 in .env.local and use http://localhost (dev server uses HTTP by default).',
  url: '/reviews/preview',
  noindex: true,
  nofollow: true,
});

export default function ReviewFlowPreviewPage() {
  const enabled = isReviewFlowPreviewEnabled();

  if (!enabled) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30 pt-20 pb-24">
          <div className="container mx-auto max-w-2xl px-4 py-10 sm:px-6">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Review preview is turned off
            </h1>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
              <p>
                이 페이지를 쓰려면 프로젝트 루트 <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">.env.local</code> 에
                다음을 넣고{' '}
                <strong className="text-slate-800">개발 서버를 한 번 재시작</strong>하세요.
              </p>
              <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-[13px] text-slate-800 shadow-sm">
                NEXT_PUBLIC_REVIEW_FLOW_PREVIEW=1
              </pre>
              <p>
                값은 <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">1</code>,{' '}
                <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">true</code>,{' '}
                <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">on</code> 도 인식합니다.
              </p>
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
                <strong className="font-semibold">Chrome 오류·콘솔에 chrome-error://chromewebdata 가 보이면:</strong> 보통{' '}
                <strong>https://localhost:3000</strong> 로 연 경우입니다. Next 기본 개발 서버는{' '}
                <strong>http://localhost:3000/reviews/preview</strong> 로 여세요 (직접 TLS 설정한 경우만 https).
              </p>
            </div>
          </div>
        </main>
        <Footer />
        <BottomNav />
        <div className="mobile-bottom-nav-spacer md:hidden" aria-hidden />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30 pt-20 pb-24">
        <div className="container mx-auto max-w-3xl px-4 pb-4 sm:px-6">
          <div
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-snug text-amber-950"
            role="status"
          >
            <strong className="font-semibold">Sandbox mode.</strong> Mock booking only — nothing is saved. No login
            required. Use <strong>http://</strong> locally unless you configured HTTPS yourself.
          </div>
        </div>
        <div className="container mx-auto max-w-3xl px-4 pb-10 sm:px-6">
          <ReviewWriteWizard sandbox heading="Write a review (sandbox)" />
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="mobile-bottom-nav-spacer md:hidden" aria-hidden />
    </>
  );
}
