import type { ReactNode } from "react";
import { Inter, Playfair_Display } from "next/font/google";
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

/** 메인과 동일: Header / Footer / BottomNav — 상세 본문은 `tour-product-v2-static-root` 안에서 v0 토큰 유지 */
export default function TourProductLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${tourV2Sans.variable} ${playfairSerif.variable}`}>
      <SitePageShell showBottomNav={false}>{children}</SitePageShell>
    </div>
  );
}
