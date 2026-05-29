"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Premium custom date picker for the itinerary-builder intake form.
 *
 * Replaces the native `<input type="date">` (which on mobile pops the OS
 * calendar — un-brandable, green Samsung sheet etc.) with an on-brand,
 * inline-expanding control that supports BOTH ways to pick a date:
 *   • click a day in the month grid, and
 *   • type it directly (YYYY-MM-DD) in the field at the top.
 *
 * The calendar opens as a left-anchored popover (`absolute`) at its natural
 * width. Earlier it expanded inline in normal flow, which inherited the width
 * of the trigger — fine when the field is full-width, but every real caller
 * now drops it into a narrow column (landing planner card's 50% grid cell,
 * PlannerTopRail's `min-w-[180px]`). Inline there crushed the 7-col grid:
 * weekday headers collapsed ("SunMonTue…") and the day cells overlapped.
 * Absolute positioning takes the panel out of grid/flex track sizing, so the
 * parent layout is untouched and the calendar always renders at full size.
 * A `max-w` viewport guard keeps it from clipping on small screens.
 *
 * No new deps (V11) — framer-motion + lucide are already in the bundle.
 * Month/weekday names are locale-aware via `Intl.DateTimeFormat`.
 */

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(y, mo - 1, d);
  // reject overflow (e.g. 2026-02-31 → Mar 3)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

interface Props {
  /** Selected date as "YYYY-MM-DD" or "". */
  value: string;
  onChange: (iso: string) => void;
  /** Minimum selectable date ("YYYY-MM-DD"). Earlier days are disabled. */
  min?: string;
  locale: string;
  /** Visually flags the trigger when the form was submitted without a date. */
  invalid?: boolean;
  placeholder: string;
  todayLabel: string;
  tomorrowLabel: string;
  id?: string;
}

export default function IntakeDateField({
  value,
  onChange,
  min,
  locale,
  invalid,
  placeholder,
  todayLabel,
  tomorrowLabel,
  id,
}: Props) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(value);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const minDate = useMemo(() => (min ? fromISO(min) : null), [min]);
  const selected = useMemo(() => (value ? fromISO(value) : null), [value]);
  const todayISO = toISO(new Date());

  const [view, setView] = useState<Date>(() =>
    startOfMonth(selected ?? minDate ?? new Date())
  );

  // Keep the typed buffer + visible month in sync when the value changes
  // (e.g. via the quick chips or an external reset).
  useEffect(() => {
    setTyped(value);
    if (selected) setView(startOfMonth(selected));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click + Escape.
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

  const weekdays = useMemo(() => {
    const sunday = new Date(2024, 5, 2); // a known Sunday
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(addDays(sunday, i)));
  }, [locale]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(view),
    [locale, view]
  );

  const triggerLabel = useMemo(() => {
    if (!selected) return placeholder;
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
    }).format(selected);
  }, [selected, locale, placeholder]);

  const cells = useMemo(() => {
    const first = startOfMonth(view);
    const gridStart = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [view]);

  function isDisabled(d: Date) {
    return minDate ? toISO(d) < toISO(minDate) : false;
  }

  function pick(d: Date) {
    if (isDisabled(d)) return;
    onChange(toISO(d));
    setOpen(false);
  }

  function commitTyped(raw: string) {
    const parsed = fromISO(raw.trim());
    if (parsed && !isDisabled(parsed)) {
      onChange(toISO(parsed));
      setView(startOfMonth(parsed));
    }
  }

  function quick(offsetDays: number) {
    let d = addDays(new Date(), offsetDays);
    if (minDate && toISO(d) < toISO(minDate)) d = minDate;
    onChange(toISO(d));
    setView(startOfMonth(d));
    setOpen(false);
  }

  const triggerCls = cn(
    "focus-ring flex w-full items-center gap-2 rounded-button border bg-slate-50 px-3.5 py-2.5 text-left text-sm transition-colors duration-200",
    invalid
      ? "border-rose-300 bg-rose-50/40"
      : "border-slate-200/70 hover:border-slate-300",
    open && "border-slate-300 bg-white"
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={triggerCls}
      >
        <Calendar className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
        <span className={cn("flex-1 truncate", selected ? "text-slate-900" : "text-slate-400")}>
          {triggerLabel}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-label={placeholder}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-full z-50 mt-2 w-[18rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)]"
          >
            {/* Type-in row */}
            <input
              type="text"
              inputMode="numeric"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onBlur={(e) => commitTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTyped((e.target as HTMLInputElement).value);
                }
              }}
              placeholder="YYYY-MM-DD"
              aria-label="YYYY-MM-DD"
              className="focus-ring mb-3 w-full rounded-button border border-slate-200/70 bg-slate-50 px-3 py-2 text-center text-sm tabular-nums tracking-wide text-slate-900 placeholder:text-slate-300 focus:border-slate-300 focus:bg-white"
            />

            {/* Month nav */}
            <div className="mb-2 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setView((v) => addMonths(v, -1))}
                aria-label="Previous month"
                className="focus-ring rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <span className="text-caption font-semibold text-slate-900">{monthLabel}</span>
              <button
                type="button"
                onClick={() => setView((v) => addMonths(v, 1))}
                aria-label="Next month"
                className="focus-ring rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7 gap-0.5 px-1">
              {weekdays.map((w, i) => (
                <div
                  key={i}
                  className="py-1 text-center text-[11px] font-medium text-slate-400"
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5 px-1">
              {cells.map((d) => {
                const iso = toISO(d);
                const inMonth = d.getMonth() === view.getMonth();
                const disabled = isDisabled(d);
                const isSel = value === iso;
                const isToday = iso === todayISO;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(d)}
                    className={cn(
                      "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors duration-150",
                      disabled && "cursor-not-allowed text-slate-300",
                      !disabled && !isSel && "text-slate-700 hover:bg-slate-100",
                      !inMonth && !isSel && !disabled && "text-slate-400",
                      isSel && "bg-slate-900 font-semibold text-white",
                      isToday && !isSel && "ring-1 ring-inset ring-slate-300"
                    )}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Quick chips */}
            <div className="mt-3 flex gap-2 border-t border-slate-100 px-1 pt-3">
              {[
                { label: todayLabel, offset: 0 },
                { label: tomorrowLabel, offset: 1 },
              ].map((c) => (
                <button
                  key={c.offset}
                  type="button"
                  onClick={() => quick(c.offset)}
                  className="focus-ring flex-1 rounded-full border border-slate-200/70 bg-slate-50 px-3 py-1.5 text-caption font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
