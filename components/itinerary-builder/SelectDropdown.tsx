"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Premium on-brand dropdown (language / duration dial / any single-select).
 *
 * Replaces the native `<select>` (which pops the un-brandable OS picker sheet
 * on mobile) with a button + custom popover list — same family as
 * IntakeDateField. Closes on outside-click / Escape; the popover is absolutely
 * positioned so it never resizes the grid/flex cell it lives in. The trigger is
 * `w-full`, so callers control width via the wrapping cell (e.g. a `w-24` or
 * `min-w-[180px]` container).
 *
 * Shared by the hero build-mode card (landing-planner-card) and the builder
 * PlannerTopRail so every time/language picker reads as one family.
 */
export default function SelectDropdown({
  id,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  id: string;
  value: string;
  options: { code: string; label: string }[];
  onChange: (code: string) => void;
  ariaLabel: string;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.code === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "focus-ring flex h-11 w-full items-center justify-between gap-2 rounded-button border bg-slate-50 px-3 text-left text-[13px] font-semibold text-slate-900 transition-colors duration-200 md:h-12 md:text-[14px]",
          open ? "border-slate-300 bg-white" : "border-slate-200/70 hover:border-slate-300",
        )}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            role="listbox"
            aria-label={ariaLabel}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-full min-w-[10rem] overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)]"
          >
            {options.map((o) => {
              const active = o.code === value;
              return (
                <li key={o.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(o.code);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors duration-150",
                      active
                        ? "bg-slate-900 font-semibold text-white"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {active ? <Check className="h-4 w-4 flex-shrink-0" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
