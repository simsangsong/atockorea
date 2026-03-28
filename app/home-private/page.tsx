import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AtoC Korea",
  robots: { index: false, follow: false },
};

/**
 * 메인 홈 비공개 시 미들웨어가 rewrite로만 진입 (URL은 / 또는 /ko 등 유지).
 * 검색·스크린샷용 최소 안내.
 */
export default function HomePrivatePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 text-center">
      <p className="text-sm font-medium tracking-wide text-slate-400 uppercase">
        AtoC Korea
      </p>
      <h1 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
        페이지 업그레이드 중입니다
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
        atockorea.com 공개 서비스는 준비 중입니다. 내부 작업은 브라우저에서 localhost:3000 으로 접속해 주세요.
      </p>
    </div>
  );
}
