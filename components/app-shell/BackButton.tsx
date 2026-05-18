"use client";

/**
 * App shell back button — iOS PWA / in-app browser fallback.
 *
 * Phase B.2 of docs/app-shell-uiux-master-plan-2026-05-17.md.
 *
 * Visibility is decided by the parent (Header in B.3) via `useIosBackbar()`.
 * This component is "dumb" about whether it should render — it just renders
 * a button and handles click behaviour when invoked.
 *
 * §B #9: clicking falls back to `/` when there is no real history (deep-link
 * entry from Kakao/Instagram in-app browser), so the user never gets stuck
 * and never accidentally leaves the AtoC origin.
 */

import { useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { analytics } from "@/src/design/analytics";
import { cn } from "@/lib/utils";

/**
 * Captures `window.history.length` the first time we read it in this tab
 * session and persists it in sessionStorage. Every subsequent read returns
 * the same anchor value. The anchor represents "how deep the history stack
 * was when the user first arrived" — anything beyond it is a navigation
 * we (AtoC) made and can safely undo with router.back().
 *
 * Anchored against tab session (sessionStorage), not localStorage, so two
 * separate browser tabs each get their own anchor. Cleared automatically
 * on tab close — same lifecycle as window.history itself.
 */
const HISTORY_ANCHOR_KEY = "atoc_history_anchor";

function getHistoryAnchor(): number {
  if (typeof window === "undefined") return 0;
  try {
    const stored = window.sessionStorage.getItem(HISTORY_ANCHOR_KEY);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    const current = window.history.length;
    window.sessionStorage.setItem(HISTORY_ANCHOR_KEY, String(current));
    return current;
  } catch {
    // sessionStorage can throw in privacy modes — fall back to "treat current
    // page as anchor" which forces fallback-to-home (safe default).
    return typeof window !== "undefined" ? window.history.length : 0;
  }
}

export type BackButtonProps = {
  /** Optional wrapper className — Header (B.3) positions this in the left slot. */
  className?: string;
  /** Optional icon size override. Default 24px to land inside a 44px touch target. */
  iconSize?: number;
};

export default function BackButton({
  className,
  iconSize = 24,
}: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const label = t("appShell.backButton.label");

  const handleClick = useCallback(() => {
    // §B #9 + Phase B.4 external-referrer guard.
    //
    // A naive `history.length <= 1` check is NOT enough. Example failure:
    //   Insta → /tour-product (length=2) → /cart (length=3)
    //   user presses back on /cart   → router.back() to /tour-product ✓
    //   user presses back on /tour-product (length=2) → router.back() goes
    //   to Insta ✗ — they get dumped off our origin.
    //
    // Fix: anchor the history depth at the moment the user first enters AtoC
    // in this tab (sessionStorage, lazy capture). router.back() is only safe
    // when the current history is deeper than the anchor — i.e., we have at
    // least one AtoC-internal navigation to undo.
    const fallbackUsed =
      typeof window === "undefined"
        ? false
        : window.history.length <= getHistoryAnchor();

    analytics.appShellBackClick({
      routeFrom: pathname ?? "",
      fallbackUsed,
    });

    if (fallbackUsed) {
      router.push("/");
    } else {
      router.back();
    }
  }, [router, pathname]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      // 44px min touch target per iOS HIG. `min-h-touch` comes from
      // tailwind.config.js theme.extend.minHeight.touch = '44px'. minWidth has
      // no `touch` entry yet so use arbitrary value (avoids a config change
      // out of B.2's scope).
      // focus-ring utility from app/globals.css @layer utilities (L97-99).
      className={cn(
        "inline-flex min-h-touch min-w-[44px] items-center justify-center rounded-full",
        "text-slate-700 transition-colors duration-200 ease-out",
        "hover:bg-slate-100 active:bg-slate-200",
        "focus-ring",
        // reduce-motion: tailwind transition automatically respects motion-reduce.
        "motion-reduce:transition-none",
        className,
      )}
    >
      <ChevronLeft size={iconSize} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
