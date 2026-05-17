import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import FloatingLanguageToggle from "@/components/FloatingLanguageToggle";

export type SitePageShellProps = {
  children: React.ReactNode;
  /** false: 하단 고정 네비 숨김(예: /tour-product 스티키 예약 바와 겹침 방지) */
  showBottomNav?: boolean;
};

/**
 * 전역 body::before 파스텔 메시가 비치도록 래퍼는 투명. Header/Footer/BottomNav 동일.
 */
export function SitePageShell({ children, showBottomNav = true }: SitePageShellProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent text-slate-900 selection:bg-slate-200/55 selection:text-slate-900">
      <div className="relative z-10">
        <Header />
        {children}
        <Footer />
        {showBottomNav ? (
          <>
            <BottomNav />
            <div className="h-16 md:hidden" aria-hidden />
            <FloatingLanguageToggle />
          </>
        ) : null}
      </div>
    </div>
  );
}
