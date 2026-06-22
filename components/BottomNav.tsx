"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { House, Compass, ShoppingBag, UserRound, MessagesSquare, type LucideIcon } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { useTourRoomBooking } from "@/lib/tour-room/use-tour-room-booking";

/**
 * Mobile sticky bottom nav (md:hidden). Site-native upgrade (master plan
 * docs/bottom-nav-uiux-master-plan-2026-05-20.md):
 *  • frosted white surface matching the global Header (N2)
 *  • slate-900 active accent — blue retired (N1)
 *  • active = top indicator bar + heavier stroke + bold label (N3 — lucide
 *    icons are stroke-based, so active reads via weight/color, not solid fill)
 *  • i18n labels (N5); safe-area (N7); reduce-motion-gated spring tap (N8);
 *    aria-current (N9)
 *
 * Adaptive 3rd slot (docs/tour-room-adaptive-tab-master-plan-2026-05-22.md,
 * supersedes N4's static Cart): when the signed-in user has a tour today or
 * tomorrow, the slot morphs Cart → Tour Room and deep-links to that booking's
 * live room (amber "live" pulse). Otherwise it stays Cart — the ~90% of sessions
 * with no imminent tour see no change and the commerce path is untouched. The
 * morph is mounted-gated so the server / first client paint always render Cart
 * (hydration-safe); it flips on the next client render once the booking resolves.
 */

type NavItem = {
  key: string;
  labelKey: string;
  path: string;
  Icon: LucideIcon;
  /** Base path for active-state matching (defaults to `path`). */
  match?: string;
  /** Amber "live" pulse — Tour Room when the room is open. */
  live?: boolean;
};

export default function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations();
  const reduce = useReducedMotion() === true;
  const { booking } = useTourRoomBooking();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const roomActive = mounted && Boolean(booking?.isRoomActive);

  const thirdItem: NavItem = roomActive
    ? {
        key: "tourroom",
        labelKey: "nav.tourRoom",
        path: `/tour-room/${booking!.bookingId}`,
        match: "/tour-room",
        Icon: MessagesSquare,
        live: true,
      }
    : { key: "cart", labelKey: "nav.cart", path: "/cart", Icon: ShoppingBag };

  const items: NavItem[] = [
    { key: "home", labelKey: "nav.home", path: "/", Icon: House },
    { key: "tours", labelKey: "nav.tours", path: "/tours/list", match: "/tours", Icon: Compass },
    thirdItem,
    { key: "my", labelKey: "nav.mypage", path: "/mypage", Icon: UserRound },
  ];

  // Premium glass: top highlight edge (inset white) + hairline + soft lift shadow.
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-900/[0.07] bg-white/80 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_-1px_0_0_rgba(15,23,42,0.05),0_-12px_32px_-20px_rgba(15,23,42,0.28)] md:hidden [padding-bottom:env(safe-area-inset-bottom)]"
    >
      <div className="flex h-[60px] items-stretch justify-around px-1">
        {items.map((item) => {
          const base = item.match ?? item.path;
          const isActive = base === "/" ? pathname === "/" : pathname.startsWith(base);
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
                  className="relative inline-flex"
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

                  {/* Live pulse — the room is open right now (amber, meaningful per N6). */}
                  {item.live ? (
                    <span className="absolute -right-1.5 -top-1 flex h-2.5 w-2.5">
                      {!reduce ? (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70" />
                      ) : null}
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                    </span>
                  ) : null}
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
