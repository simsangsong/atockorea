"use client";

import Link from "next/link";
import { usePathnameWithoutLocale } from "@/lib/usePathnameWithoutLocale";
import { House, Compass, ShoppingBag, UserRound, type LucideIcon } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

/**
 * Mobile sticky bottom nav (md:hidden). Site-native upgrade (master plan
 * docs/bottom-nav-uiux-master-plan-2026-05-20.md):
 *  • frosted white surface matching the global Header (N2)
 *  • slate-900 active accent — blue retired (N1)
 *  • active = top indicator bar + heavier stroke + bold label (N3 — lucide
 *    icons are stroke-based, so active reads via weight/color, not solid fill)
 *  • 4 tabs, no center FAB (N4); i18n labels (N5); safe-area (N7);
 *    reduce-motion-gated spring tap (N8); aria-current (N9)
 * Icons: lucide-react (House / Compass / ShoppingBag / UserRound) — refined,
 * consistent, tree-shakeable. Cart count badge deferred (N6 — no count store).
 */

type NavItem = { key: string; labelKey: string; path: string; Icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  { key: "home", labelKey: "nav.home", path: "/", Icon: House },
  { key: "tours", labelKey: "nav.tours", path: "/tours/list", Icon: Compass },
  { key: "cart", labelKey: "nav.cart", path: "/cart", Icon: ShoppingBag },
  { key: "my", labelKey: "nav.mypage", path: "/mypage", Icon: UserRound },
];

export default function BottomNav() {
  // Locale-normalized (see lib/usePathnameWithoutLocale): the active-tab
  // branch must agree between the bare-path SSR HTML and the '/ko/...'
  // browser URL or every localized page hydrate-mismatches (React #418).
  const pathname = usePathnameWithoutLocale();
  const t = useTranslations();

  const activeIndex = NAV_ITEMS.findIndex((item) =>
    item.path === "/tours/list"
      ? pathname.startsWith("/tours")
      : item.path === "/"
        ? pathname === "/"
        : pathname.startsWith(item.path),
  );

  // Premium glass: top highlight edge (inset white) + hairline + soft lift shadow.
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-900/[0.07] bg-white/80 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_-1px_0_0_rgba(15,23,42,0.05),0_-12px_32px_-20px_rgba(15,23,42,0.28)] md:hidden [padding-bottom:env(safe-area-inset-bottom)]"
    >
      <div className="relative flex h-[60px] items-stretch justify-around px-1">
        {/* Active indicator — one soft-glow bar that slides between tabs. CSS
            translateX replaces framer's `layoutId` shared-layout animation
            (drops framer-motion from the global shell). `inset-x-1` overlays
            exactly the padded tab row, `w-1/4` is one tab column, so
            translateX(index*100%) lands pixel-centered on each tab. */}
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 top-0 h-[3px]"
          >
            <span
              className="flex h-full w-1/4 justify-center transition-transform duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ transform: `translateX(${activeIndex * 100}%)` }}
            >
              <span className="h-[3px] w-7 rounded-full bg-gradient-to-r from-slate-700 via-slate-900 to-slate-700 shadow-[0_1px_6px_-1px_rgba(15,23,42,0.5)]" />
            </span>
          </span>
        )}
        {NAV_ITEMS.map((item, i) => {
          const isActive = i === activeIndex;
          return (
            <Link
              key={item.key}
              href={item.path}
              aria-current={isActive ? "page" : undefined}
              className="group relative flex flex-1 flex-col items-center justify-center"
            >
              {/* Icon+label lift subtly when active for depth (CSS transform). */}
              <span
                className={`flex flex-col items-center gap-[3px] transition-transform duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                  isActive ? "-translate-y-px motion-reduce:translate-y-0" : ""
                }`}
              >
                {/* Icon scales down on tap — group-active fires on <Link> press. */}
                <span className="inline-flex transition-transform duration-150 group-active:scale-[0.88] motion-reduce:transition-none motion-reduce:group-active:scale-100">
                  <item.Icon
                    size={23}
                    strokeWidth={isActive ? 2.3 : 1.9}
                    className={`transition-colors duration-200 ${
                      isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-800"
                    }`}
                  />
                </span>

                <span
                  className={`text-[10px] leading-none transition-all duration-200 ${
                    isActive
                      ? "font-semibold tracking-[0.01em] text-slate-900"
                      : "font-medium tracking-[0.02em] text-slate-500 group-hover:text-slate-800"
                  }`}
                >
                  {t(item.labelKey)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
