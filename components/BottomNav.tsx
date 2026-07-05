"use client";

import Link from "next/link";
import { usePathnameWithoutLocale } from "@/lib/usePathnameWithoutLocale";
import { motion, useReducedMotion } from "framer-motion";
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
  const reduce = useReducedMotion() === true;

  // Premium glass: top highlight edge (inset white) + hairline + soft lift shadow.
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-900/[0.07] bg-white/80 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_-1px_0_0_rgba(15,23,42,0.05),0_-12px_32px_-20px_rgba(15,23,42,0.28)] md:hidden [padding-bottom:env(safe-area-inset-bottom)]"
    >
      <div className="flex h-[60px] items-stretch justify-around px-1">
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
              className="group relative flex flex-1 flex-col items-center justify-center"
            >
              {/* Active indicator — refined soft-glow bar with shared-layout slide. */}
              {isActive ? (
                <motion.span
                  layoutId={reduce ? undefined : "bottomnav-indicator"}
                  className="absolute top-0 h-[3px] w-7 rounded-full bg-gradient-to-r from-slate-700 via-slate-900 to-slate-700 shadow-[0_1px_6px_-1px_rgba(15,23,42,0.5)]"
                  transition={{ type: "spring", stiffness: 480, damping: 34 }}
                  aria-hidden
                />
              ) : null}

              {/* Icon lifts subtly when active for depth. */}
              <motion.span
                className="flex flex-col items-center gap-[3px]"
                animate={reduce ? undefined : { y: isActive ? -1 : 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
              >
                <motion.span
                  className="inline-flex"
                  whileTap={reduce ? undefined : { scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 600, damping: 20 }}
                  aria-hidden
                  // Explicit tabIndex makes the rendered attribute deterministic:
                  // framer-motion auto-adds tabIndex={0} to gesture elements
                  // (whileTap) unless one is set, and whileTap is reduce-gated —
                  // so the server (reduce=false) emitted tabindex="0" while the
                  // reduce-motion client emitted none → hydration mismatch. -1 is
                  // also correct here: this is an aria-hidden decorative wrapper,
                  // not a focus target (the parent <Link> is).
                  tabIndex={-1}
                >
                  <item.Icon
                    size={23}
                    strokeWidth={isActive ? 2.3 : 1.9}
                    className={`transition-colors duration-200 ${
                      isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-800"
                    }`}
                  />
                </motion.span>

                <span
                  className={`text-[10px] leading-none transition-all duration-200 ${
                    isActive
                      ? "font-semibold tracking-[0.01em] text-slate-900"
                      : "font-medium tracking-[0.02em] text-slate-500 group-hover:text-slate-800"
                  }`}
                >
                  {t(item.labelKey)}
                </span>
              </motion.span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
