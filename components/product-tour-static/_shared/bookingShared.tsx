"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import type { TourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";

/** Booking-flow primitives shared by the mobile sticky bar and the desktop right-rail card. */

export type PreferredLanguage = "en" | "zh" | "ko";

export const DEFAULT_GUESTS = 1;
export const MAX_GUESTS = 30;
export const DEFAULT_LEAD_DAYS = 14;
export const FALLBACK_KRW_PER_USD = 1480;

export const LANG_OPTIONS: {
  value: PreferredLanguage;
  title: string;
  subtitle: string;
}[] = [
  { value: "en", title: "English", subtitle: "Guided in English" },
  { value: "zh", title: "中文", subtitle: "中文服务" },
  { value: "ko", title: "한국어", subtitle: "한국어 안내" },
];

export type AvailabilityState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; spots: number | null; priceUsd: number | null }
  | { status: "unavailable"; reason: string };

export const fieldLabelClass = "text-[10px] font-medium tracking-wide text-muted-foreground";
export const drawerEase = [0.16, 1, 0.3, 1] as const;
const fadeMenu = { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const };

export function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayYmdLocal(): string {
  return ymdFromLocalDate(new Date());
}

export function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return ymdFromLocalDate(dt);
}

export function initialDateYmd(): string {
  return addDaysToYmd(todayYmdLocal(), DEFAULT_LEAD_DAYS);
}

/**
 * Deep-link seeding — validate a `?date=YYYY-MM-DD` query param so an AI agent
 * (or a shared link) can pre-fill the booking card. Returns `undefined` for
 * malformed or past dates so the card keeps its default lead-time date.
 */
export function coerceSeedDateYmd(raw: string | string[] | undefined | null): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  if (Number.isNaN(new Date(`${v}T00:00:00`).getTime())) return undefined;
  return v >= todayYmdLocal() ? v : undefined;
}

/**
 * Deep-link seeding — map a `?language=` query param onto the booking card's
 * guide-language toggle. Only en/zh/ko have a dedicated toggle; other locales
 * (ja/es) fall through to `undefined` so the card keeps its default.
 */
export function coerceSeedLanguage(
  raw: string | string[] | undefined | null,
): PreferredLanguage | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  if (s === "ko" || s === "kr" || s === "korean") return "ko";
  if (s.startsWith("zh") || s === "cn" || s === "chinese") return "zh";
  if (s === "en" || s === "english") return "en";
  return undefined;
}

export function ymdToNoonIso(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

export function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function clampGuests(n: number): number {
  if (Number.isNaN(n) || n < 1) return 1;
  if (n > MAX_GUESTS) return MAX_GUESTS;
  return n;
}

export function buildBookingPayload(
  ctx: TourProductCheckoutContext,
  dateYmd: string,
  guests: number,
  preferredLanguage: PreferredLanguage,
) {
  const unit = ctx.unitPriceUsd;
  const totalPrice =
    ctx.priceType === "person"
      ? Math.round(unit * guests * 100) / 100
      : Math.round(unit * 100) / 100;
  return {
    tourId: ctx.tourId,
    date: ymdToNoonIso(dateYmd),
    guests,
    pickup: null as number | string | null,
    paymentMethod: "full" as const,
    preferredLanguage,
    totalPrice,
  };
}

/** Static VM price → USD (DB/checkout contract). */
export function parseListUnitUsd(price: { amountLabel: string; currency: string }): number | null {
  if (String(price.currency).toUpperCase() === "USD") {
    const n = parseFloat(String(price.amountLabel).replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  }
  const digits = String(price.amountLabel).replace(/[^\d]/g, "");
  if (!digits) return null;
  const krw = parseInt(digits, 10);
  if (!Number.isFinite(krw) || krw <= 0) return null;
  return Math.round((krw / FALLBACK_KRW_PER_USD) * 100) / 100;
}

export function PremiumLanguageSelect({
  value,
  onChange,
  labelId,
  menuPlacement = "top",
}: {
  value: PreferredLanguage;
  onChange: (v: PreferredLanguage) => void;
  labelId: string;
  /** Whether the popover opens above (default, used in bottom-drawers) or below the trigger. */
  menuPlacement?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const current = LANG_OPTIONS.find((o) => o.value === value) ?? LANG_OPTIONS[0];
  const menuPositionClass =
    menuPlacement === "bottom"
      ? "top-[calc(100%+0.375rem)]"
      : "bottom-[calc(100%+0.375rem)]";

  return (
    <div className="relative z-[55] w-full max-w-xs">
      <span id={labelId} className={`${fieldLabelClass} mb-0.5 block`}>
        Tour language
      </span>
      <button
        ref={triggerRef}
        type="button"
        id={`${labelId}-trigger`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${labelId}-trigger`}
        onClick={() => setOpen((o) => !o)}
        className="tour-premium-lang-trigger tour-premium-lang-trigger--compact flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-border/90 bg-background px-3 text-left outline-none transition-[box-shadow,border-color] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-tight text-foreground">{current.title}</span>
          <span className="block truncate text-[10px] leading-tight text-muted-foreground">{current.subtitle}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="lang-menu-layer"
            ref={menuRef}
            role="listbox"
            aria-labelledby={labelId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeMenu}
            className={`absolute ${menuPositionClass} left-0 right-0 z-[60] overflow-hidden rounded-xl border border-border/90 bg-[var(--card)] shadow-[0_12px_40px_rgba(26,35,50,0.14),0_2px_8px_rgba(26,35,50,0.06)]`}
          >
            <ul className="divide-y divide-border/60 py-0.5">
              {LANG_OPTIONS.map((opt) => {
                const selected = opt.value === value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`tour-premium-lang-item tour-premium-lang-item--compact flex w-full items-center gap-2.5 px-2.5 py-2 text-left ${
                        selected ? "tour-premium-lang-item--selected" : ""
                      }`}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0">
                        <span className="text-[13px] font-semibold leading-tight text-foreground">{opt.title}</span>
                        <span className="text-[10px] leading-tight text-muted-foreground">{opt.subtitle}</span>
                      </span>
                      {selected ? (
                        <Check className="h-4 w-4 shrink-0 text-[var(--primary)]" strokeWidth={2.5} aria-hidden />
                      ) : (
                        <span className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
