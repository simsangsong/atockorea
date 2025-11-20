// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// 공통 레이아웃에 쓸 헤더/푸터 컴포넌트
// components 폴더 위치에 따라 경로만 맞춰주면 된다.
// (프로젝트 루트에 /components 있다면 아래처럼)
import Header from "../components/Header";
import Footer from "../components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AtoC Korea",
  description: "Direct connection to trusted Korea tours.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#f5f5f7] text-[#111] text-[13px] sm:text-[14px]`}
      >
        <div className="min-h-screen flex flex-col">
          {/* 공통 헤더 */}
          <Header />

          {/* 페이지별 콘텐츠 영역 */}
          <main className="flex-1 pb-16">{children}</main>

          {/* 공통 푸터 */}
          <Footer />
        </div>
      </body>
    </html>
  );
}
