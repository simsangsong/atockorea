// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Header from "../components/Header";
import Footer from "../components/Footer";
import BottomNav from "../components/BottomNav";

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
          {/* 顶部 Header（含搜索图标） */}
          <Header />

          {/* 主内容区域 */}
          <main className="flex-1 pb-14 sm:pb-16">
            {children}
          </main>

          {/* 底部业务信息 Footer（滚动内容的一部分） */}
          <Footer />

          {/* 固定在最底部的 Main / Tours / My Bar */}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
