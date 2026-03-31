import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

/**
 * 전역 body::before 파스텔 메시가 비치도록 래퍼는 투명. Header/Footer/BottomNav 동일.
 */
export function SitePageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent text-slate-900 selection:bg-blue-100">
      <div className="relative z-10">
        <Header />
        {children}
        <Footer />
        <BottomNav />
        <div className="h-16 md:hidden" aria-hidden />
      </div>
    </div>
  );
}
