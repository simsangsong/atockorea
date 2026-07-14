"use client";

// v3 Phase D.2 — mobile-only bottom-sheet matcher result.
//
// Renders as a fixed bottom-sheet sliding up from the bottom when:
//   - the home_result_bottomsheet experiment is variant "B"
//   - viewport width < 768px (mobile)
//   - phase !== "idle"
//
// Variant A users / desktop / idle phase get nothing (existing flow).
//
// Contains the same BestMatchPreview component the slot-2 section
// already uses, so the result UI is consistent. The sheet adds: handle
// bar, drag-to-dismiss, escape key, backdrop tap, focus trap entry.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useHomeV2Match } from "@/components/home/v2/HomeV2MatchProvider";
import { useMediaQuery } from "@/components/home/v2/use-media-query";
import { useTranslations } from "@/lib/i18n";
import { getExperimentVariantAsync } from "@/src/design/analytics";

const BestMatchPreview = dynamic(
  () =>
    import("@/components/home/v2/sections/best-match-preview").then(
      (mod) => mod.BestMatchPreview,
    ),
  { ssr: false },
);

export function MatcherBottomSheet() {
  const { phase, resetMatchToIdle } = useHomeV2Match();
  const reduceMotion = useReducedMotion();
  const t = useTranslations("home");
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const [variant, setVariant] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");

  // home_result_bottomsheet A/B — variant resolves once the shared experiment
  // registry fetch settles. Async `.then(setVariant)` keeps the assignment off
  // the synchronous effect body (no setState-in-effect); the experiment key and
  // assignment logic are unchanged.
  useEffect(() => {
    let cancelled = false;
    void getExperimentVariantAsync("home_result_bottomsheet").then((v) => {
      if (cancelled) return;
      if (v) setVariant(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape key closes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "idle" && variant === "B" && isMobile) {
        resetMatchToIdle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, variant, isMobile, resetMatchToIdle]);

  // Lock body scroll while open
  useEffect(() => {
    if (typeof document === "undefined") return;
    const shouldLock =
      variant === "B" && isMobile && phase !== "idle";
    if (!shouldLock) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [variant, isMobile, phase]);

  const open = variant === "B" && isMobile && phase !== "idle";

  // Focus management (audit 2026-07-14 B6) — move focus into the dialog on
  // open and restore it to the invoker on close, honoring the aria-modal
  // contract this sheet declares.
  useEffect(() => {
    if (open) {
      restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
      sheetRef.current?.focus();
      return;
    }
    restoreFocusRef.current?.focus?.();
    restoreFocusRef.current = null;
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={resetMatchToIdle}
            aria-hidden
          />
          <motion.div
            key="sheet"
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("premium.v2.matcherSheet.sheetLabel")}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] min-h-[40vh] flex-col rounded-t-3xl bg-white shadow-2xl"
            style={{ height: "70vh" }}
            initial={reduceMotion ? { y: 0 } : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { y: 0 } : { y: "100%" }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", damping: 32, stiffness: 280 }
            }
            drag={reduceMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) {
                resetMatchToIdle();
              }
            }}
          >
            <div className="flex flex-col items-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-slate-300" aria-hidden />
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {t("premium.v2.matcherSheet.pullToClose")}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <BestMatchPreview />
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
