import type { ReactNode } from "react";
import { Inter, Noto_Sans_JP, Noto_Sans_KR, Noto_Sans_SC, Noto_Sans_TC, Playfair_Display } from "next/font/google";
import "@/components/product-tour-static/east-signature-nature-core/tour-product-v2-scope.css";
import { SitePageShell } from "@/src/components/layout/SitePageShell";

/** TourDetailV2는 Geist; 현재 Next `next/font/google`에 Geist 미포함 → Inter로 sans 슬롯 대체 */
const tourV2Sans = Inter({
  subsets: ["latin"],
  variable: "--font-tour-v2-sans",
  display: "swap",
});

const playfairSerif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-tour-v2-serif",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** CJK/한글 히어로·본문 가독성 — `tour-product-v2-scope.css` 에서 lang 별로 선두에 둔다 */
const notoKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-noto-kr",
  display: "swap",
});

const notoSc = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-noto-sc",
  display: "swap",
});

const notoTc = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-noto-tc",
  display: "swap",
});

const notoJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-noto-jp",
  display: "swap",
});

/** 메인과 동일: Header / Footer / BottomNav — 상세 본문은 `tour-product-v2-static-root` 안에서 v0 토큰 유지 */
export default function TourProductLayout({ children }: { children: ReactNode }) {
  const fontVars = [
    tourV2Sans.variable,
    playfairSerif.variable,
    notoKr.variable,
    notoSc.variable,
    notoTc.variable,
    notoJp.variable,
  ].join(" ");

  return (
    <div className={fontVars}>
      <SitePageShell showBottomNav={false}>{children}</SitePageShell>
    </div>
  );
}
