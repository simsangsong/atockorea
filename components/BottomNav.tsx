"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "@/lib/i18n";

/**
 * Mobile sticky bottom nav (md:hidden). Site-native upgrade (master plan
 * docs/bottom-nav-uiux-master-plan-2026-05-20.md):
 *  • frosted white surface matching the global Header (N2)
 *  • slate-900 active accent — blue retired (N1)
 *  • active = top indicator bar + filled icon + bold label (N3)
 *  • 4 tabs, no center FAB (N4); i18n labels (N5); safe-area (N7);
 *    reduce-motion-gated spring tap (N8); aria-current (N9)
 * Cart count badge intentionally deferred — no global client cart-count store
 * yet; showing a fabricated number would violate N6.
 */

type NavItem = {
  key: string;
  labelKey: string;
  path: string;
  /** outline (inactive) + solid (active) icon paths share the same 24x24 box. */
  outline: React.ReactNode;
  solid: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "home",
    labelKey: "nav.home",
    path: "/",
    outline: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3 11.5 12 4l9 7.5M5.5 10v9.5a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5V10"
      />
    ),
    solid: <path d="M11.3 3.3a1 1 0 0 1 1.4 0l8 7.1a1 1 0 0 1-.66 1.75H19v7.35a.5.5 0 0 1-.5.5h-4.1v-5.2h-4.8v5.2H5.5a.5.5 0 0 1-.5-.5V12.15h-1.04a1 1 0 0 1-.66-1.75l8-7.1Z" />,
  },
  {
    key: "tours",
    labelKey: "nav.tours",
    path: "/tours/list",
    outline: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 19.5 3.8 17a1 1 0 0 1-.55-.9V5.7a1 1 0 0 1 1.45-.9L9 7m0 12.5 6-3m-6 3V7m6 9.5 4.75 2.4a1 1 0 0 0 1.45-.9V6.9a1 1 0 0 0-.55-.9L15 4m0 12.5V4m0 0L9 7"
      />
    ),
    solid: <path d="M8.6 6.2 3.9 4.9A1.4 1.4 0 0 0 2 6.25v10.4a1.4 1.4 0 0 0 .9 1.3l5.7 2.1V6.2Zm1.8 13.6 4-2V4.4l-4 2v13.4Zm5.8-15.6v13.6l4.9 1.3a1.4 1.4 0 0 0 1.9-1.3V7.35a1.4 1.4 0 0 0-.9-1.3l-5.8-2.05Z" />,
  },
  {
    key: "cart",
    labelKey: "nav.cart",
    path: "/cart",
    outline: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3 4h2l1.2 11.2a1 1 0 0 0 1 .9h8.9a1 1 0 0 0 1-.82L19.5 7H6M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01"
      />
    ),
    solid: <path d="M3 3.2a.9.9 0 0 0 0 1.8h1.3l1.27 10.5a1.6 1.6 0 0 0 1.6 1.4h9.16a1.6 1.6 0 0 0 1.57-1.27L19.9 7.1a.8.8 0 0 0-.78-.96H6.05l-.2-1.67A1.6 1.6 0 0 0 4.26 3.2H3Zm6.4 15.3a1.65 1.65 0 1 0 0 3.3 1.65 1.65 0 0 0 0-3.3Zm7.4 0a1.65 1.65 0 1 0 0 3.3 1.65 1.65 0 0 0 0-3.3Z" />,
  },
  {
    key: "my",
    labelKey: "nav.mypage",
    path: "/mypage",
    outline: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15.5 8.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM5 20a7 7 0 0 1 14 0"
      />
    ),
    solid: <path d="M12 12.4a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.4c-4.2 0-7.6 2.8-7.6 6.2 0 .55.45 1 1 1h13.2c.55 0 1-.45 1-1 0-3.4-3.4-6.2-7.6-6.2Z" />,
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations();
  const reduce = useReducedMotion() === true;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-300 bg-white/85 backdrop-blur-xl shadow-[0_-1px_0_0_rgba(15,23,42,0.12),0_-8px_24px_-16px_rgba(15,23,42,0.18)] md:hidden [padding-bottom:env(safe-area-inset-bottom)]"
    >
      <div className="flex h-16 items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/tours/list"
              ? pathname.startsWith("/tours")
              : item.path === "/"
                ? pathname === "/"
                : pathname.startsWith(item.path);
          return (
            <Link
              key={item.key}
              href={item.path}
              aria-current={isActive ? "page" : undefined}
              className={`group relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {/* Active top indicator bar (N3) */}
              {isActive ? (
                <motion.span
                  layoutId={reduce ? undefined : "bottomnav-indicator"}
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-slate-900"
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  aria-hidden
                />
              ) : null}

              <motion.svg
                viewBox="0 0 24 24"
                className="h-[22px] w-[22px]"
                fill={isActive ? "currentColor" : "none"}
                stroke={isActive ? "none" : "currentColor"}
                aria-hidden
                whileTap={reduce ? undefined : { scale: 0.9 }}
                transition={{ type: "spring", stiffness: 560, damping: 22 }}
              >
                {isActive ? item.solid : item.outline}
              </motion.svg>

              <span
                className={`text-[10.5px] leading-none tracking-tight ${
                  isActive ? "font-semibold" : "font-medium"
                }`}
              >
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
