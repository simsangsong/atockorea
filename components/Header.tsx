// components/Header.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* 左侧 Logo */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#0c66ff] to-[#0050d0] text-[11px] font-semibold text-white">
            A2C
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[14px] font-semibold">AtoC Korea</span>
            <span className="text-[10px] text-gray-500">
              Agency-to-Customer Tours
            </span>
          </div>
        </button>

        {/* 中间简单导航（可选） */}
        <nav className="hidden gap-4 text-[12px] text-gray-600 sm:flex">
          <Link href="/seoul" className="hover:text-[#0c66ff]">
            Seoul
          </Link>
          <Link href="/busan" className="hover:text-[#0c66ff]">
            Busan
          </Link>
          <Link href="/jeju" className="hover:text-[#0c66ff]">
            Jeju
          </Link>
        </nav>

        {/* 右侧：搜索 + 登录 */}
        <div className="flex items-center gap-3">
          {/* 搜索图标按钮 */}
          <button
            aria-label="Search tours"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            // 以后可以打开搜索弹窗或跳转到 /search
            onClick={() => router.push("/search")}
          >
            {/* 简单放一个 SVG 放大镜 */}
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L19 20.49 20.49 19 15.5 14zm-6 0C8.01 14 6 11.99 6 9.5S8.01 5 10.5 5 15 7.01 15 9.5 12.99 14 10.5 14z"
                fill="currentColor"
              />
            </svg>
          </button>

          {/* 登录/我的账号 */}
          <Link
            href="/auth/signin"
            className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-medium text-gray-700 hover:border-[#0c66ff] hover:text-[#0c66ff]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
