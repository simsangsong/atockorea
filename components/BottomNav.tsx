// components/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  key: "main" | "tours" | "my";
};

const tabs: Tab[] = [
  { href: "/", label: "Main", key: "main" },
  { href: "/tours", label: "Tours", key: "tours" }, // 你可以做一个总列表页 /tours
  { href: "/my", label: "My", key: "my" },
];

export default function BottomNav() {
  const pathname = usePathname();

  const getActiveKey = (): Tab["key"] => {
    if (pathname === "/") return "main";
    if (pathname.startsWith("/my")) return "my";
    return "tours";
  };

  const activeKey = getActiveKey();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around px-4 py-2">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex flex-col items-center text-[11px] ${
                active ? "text-[#0c66ff] font-semibold" : "text-gray-500"
              }`}
            >
              {/* 简单用圆点当图标，之后可以换 SVG */}
              <span
                className={`mb-0.5 h-1.5 w-1.5 rounded-full ${
                  active ? "bg-[#0c66ff]" : "bg-gray-300"
                }`}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
