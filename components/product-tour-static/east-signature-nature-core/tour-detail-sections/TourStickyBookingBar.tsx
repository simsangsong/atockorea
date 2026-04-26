"use client";

import type { ElementType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import DatePicker from "react-datepicker";
import { enUS } from "date-fns/locale/en-US";
import { ko } from "date-fns/locale/ko";
import { zhCN } from "date-fns/locale/zh-CN";
import { isSameDay } from "date-fns";
import { Check, ChevronDown, Home, Map, Minus, Plus, Ship, ShoppingCart, User, X } from "lucide-react";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";
import type { TourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";
import { useCurrencyOptional } from "@/lib/currency";
import { consumerTourCheckoutHref } from "@/lib/tour-consumer-visibility";

import "react-datepicker/dist/react-datepicker.css";

function NavItem({ icon: Icon, label, active = false }: { icon: ElementType; label: string; active?: boolean }) {
  return (
    <button type="button" className="flex flex-col items-center gap-0.5 px-5 py-1.5 transition-colors">
      <Icon className={`h-5 w-5 ${active ? "text-foreground" : "text-muted-foreground"}`} strokeWidth={active ? 2 : 1.5} />
      <span className={`text-[10px] ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{label}</span>
    </button>
  );
}

export type TourStickyBookingBarProps = Pick<EastSignatureNatureCoreDetailViewModel, "price"> & {
  checkout?: TourProductCheckoutContext | null;
  /**
   * Cruise shore-excursion products lift the selected docking port up to the
   * parent client so the CTA + drawer can echo the selection. Absent on
   * standard tours.
   */
  selectedPortLabel?: string;
  /**
   * Locale-aware copy for the port badge ("Docking at"). Optional — when
   * omitted, English defaults are used.
   */
  sectionUi?: TourProductSectionUiV1;
};

type PreferredLanguage = "en" | "zh" | "ko";

const DEFAULT_GUESTS = 1;
const MAX_GUESTS = 30;
const DEFAULT_LEAD_DAYS = 14;

const LANG_OPTIONS: {
  value: PreferredLanguage;
  title: string;
  subtitle: string;
}[] = [
  { value: "en", title: "English", subtitle: "Guided in English" },
  { value: "zh", title: "中文", subtitle: "中文服务" },
  { value: "ko", title: "한국어", subtitle: "한국어 안내" },
];

const fadeMenu = { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const };

function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayYmdLocal(): string {
  return ymdFromLocalDate(new Date());
}

function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return ymdFromLocalDate(dt);
}

function initialDateYmd(): string {
  return addDaysToYmd(todayYmdLocal(), DEFAULT_LEAD_DAYS);
}

function ymdToNoonIso(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function buildBookingPayload(
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

const fieldLabelClass = "text-[10px] font-medium tracking-wide text-muted-foreground";

const drawerEase = [0.16, 1, 0.3, 1] as const;

function clampGuests(n: number): number {
  if (Number.isNaN(n) || n < 1) return 1;
  if (n > MAX_GUESTS) return MAX_GUESTS;
  return n;
}

const FALLBACK_KRW_PER_USD = 1480;

/** Static VM price → USD (DB/checkout contract). */
function parseListUnitUsd(price: { amountLabel: string; currency: string }): number | null {
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

function PremiumLanguageSelect({
  value,
  onChange,
  labelId,
}: {
  value: PreferredLanguage;
  onChange: (v: PreferredLanguage) => void;
  labelId: string;
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
            className="absolute bottom-[calc(100%+0.375rem)] left-0 right-0 z-[60] overflow-hidden rounded-xl border border-border/90 bg-[var(--card)] shadow-[0_12px_40px_rgba(26,35,50,0.14),0_2px_8px_rgba(26,35,50,0.06)]"
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

export function TourStickyBookingBar({ price, checkout, selectedPortLabel, sectionUi }: TourStickyBookingBarProps) {
  const portCtaPrefix = sectionUi?.portSelectorCtaPrefix ?? "Docking at";
  const router = useRouter();
  const currencyCtx = useCurrencyOptional();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dateYmd, setDateYmd] = useState(initialDateYmd);
  const [guestCount, setGuestCount] = useState(DEFAULT_GUESTS);
  const [guestEditValue, setGuestEditValue] = useState(String(DEFAULT_GUESTS));
  const [guestFieldEditing, setGuestFieldEditing] = useState(false);
  const guestFieldEditingRef = useRef(false);
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>("en");

  const minYmd = todayYmdLocal();
  const minDateObj = useMemo(() => ymdToLocalDate(minYmd), [minYmd]);
  const selectedDate = useMemo(() => ymdToLocalDate(dateYmd), [dateYmd]);

  const datePickerLocale = preferredLanguage === "ko" ? ko : preferredLanguage === "zh" ? zhCN : enUS;

  const estimatedTotal = useMemo(() => {
    if (!checkout) return null;
    const unit = checkout.unitPriceUsd;
    if (checkout.priceType === "person") {
      return Math.round(unit * guestCount * 100) / 100;
    }
    return Math.round(unit * 100) / 100;
  }, [checkout, guestCount]);

  const unitPriceUsd = useMemo(() => {
    if (checkout?.unitPriceUsd != null && checkout.unitPriceUsd > 0) return checkout.unitPriceUsd;
    return parseListUnitUsd(price);
  }, [checkout, price]);

  const ctaUnitFormatted = useMemo(() => {
    if (unitPriceUsd == null || unitPriceUsd <= 0) return null;
    if (currencyCtx) return currencyCtx.formatPrice(unitPriceUsd);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(unitPriceUsd);
  }, [unitPriceUsd, currencyCtx]);

  const perUnitLabel = checkout?.priceType === "group" ? "group" : price.per;

  const estimatedTotalFormatted =
    estimatedTotal != null && currencyCtx
      ? currencyCtx.formatPrice(estimatedTotal)
      : estimatedTotal != null
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
          }).format(estimatedTotal)
        : null;

  const goToCheckout = useCallback(async () => {
    if (!checkout?.tourId || busy) return;
    if (!dateYmd || dateYmd < minYmd) {
      alert("Please choose a tour date on or after today.");
      return;
    }
    setBusy(true);
    try {
      try {
        const res = await fetch(
          `/api/tours/${checkout.tourId}/availability?date=${encodeURIComponent(dateYmd)}&guests=${guestCount}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { canAccommodate?: boolean; reason?: string };
          if (data.canAccommodate === false) {
            alert(data.reason || "This date or guest count is not available. Please adjust and try again.");
            setBusy(false);
            return;
          }
        }
      } catch {
        // availability API 실패 시 진행
      }

      const payload = buildBookingPayload(checkout, dateYmd, guestCount, preferredLanguage);
      sessionStorage.setItem("bookingData", JSON.stringify(payload));
      router.push(consumerTourCheckoutHref(checkout.tourId));
    } catch (e) {
      console.error(e);
      alert("Could not start booking. Please try again.");
      setBusy(false);
    }
  }, [checkout, busy, router, dateYmd, guestCount, minYmd, preferredLanguage]);

  const canBook = Boolean(checkout?.tourId);

  const bumpGuests = (delta: number) => {
    setGuestCount((prev) => {
      const next = clampGuests(prev + delta);
      if (guestFieldEditingRef.current) {
        queueMicrotask(() => setGuestEditValue(String(next)));
      }
      return next;
    });
  };

  const commitGuestInput = () => {
    const digits = guestEditValue.replace(/\D/g, "");
    const parsed = digits === "" ? 1 : parseInt(digits, 10);
    const next = clampGuests(parsed);
    setGuestCount(next);
    setGuestEditValue(String(next));
  };

  const handleGuestChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, "");
    setGuestEditValue(digitsOnly);
    if (digitsOnly === "") return;
    const n = parseInt(digitsOnly, 10);
    if (!Number.isNaN(n)) setGuestCount(clampGuests(n));
  };

  const guestDisplayValue = guestFieldEditing ? guestEditValue : String(guestCount);

  const handlePrimaryClick = () => {
    if (!canBook || busy) return;
    if (!drawerOpen) {
      setDrawerOpen(true);
      return;
    }
    void goToCheckout();
  };

  const btnClass =
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all outline-none focus-visible:border focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 bg-foreground text-white hover:bg-foreground/90 shadow-lg hover:shadow-xl";
  const mobileBtnClass =
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all outline-none focus-visible:border focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 bg-foreground text-white hover:bg-foreground/90 shadow-md";

  const spacerClass = drawerOpen
    ? "h-[calc(21rem+env(safe-area-inset-bottom,0px))] sm:h-[min(68vh,26rem)]"
    : "h-[calc(8.25rem+env(safe-area-inset-bottom,0px))] sm:h-24";

  const langLabelId = "tour-booking-lang-label";

  return (
    <>
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: drawerEase }}
            className="fixed inset-0 z-40 cursor-default bg-black/25 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex flex-col">
        <AnimatePresence initial={false}>
          {drawerOpen && (
            <motion.div
              key="tour-booking-drawer"
              initial={{ maxHeight: 0, opacity: 0 }}
              animate={{ maxHeight: 520, opacity: 1 }}
              exit={{ maxHeight: 0, opacity: 0 }}
              transition={{ duration: 0.78, ease: drawerEase }}
              className="tour-booking-drawer-panel pointer-events-auto overflow-hidden border-t border-border/90 shadow-[0_-16px_48px_rgba(26,35,50,0.14)] backdrop-blur-xl"
            >
              <div className="mx-auto flex max-h-[min(62vh,520px)] w-full max-w-3xl flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5 sm:px-5">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Booking</p>
                      <h2 className="text-sm font-semibold text-foreground">Choose date &amp; details</h2>
                      {selectedPortLabel ? (
                        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                          <Ship className="h-3 w-3 text-primary" aria-hidden />
                          <span className="text-muted-foreground">{portCtaPrefix}:</span>
                          <span>{selectedPortLabel}</span>
                        </p>
                      ) : null}
                      {estimatedTotal != null && checkout?.priceType === "person" && estimatedTotalFormatted && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                          Est. total · {guestCount} {guestCount === 1 ? "guest" : "guests"}: {estimatedTotalFormatted}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(false)}
                      className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.48, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                    className="card-premium-calendar-wrap card-premium-calendar-wrap--compact mb-1.5"
                  >
                    <DatePicker
                      selected={selectedDate}
                      onChange={(d) => {
                        if (d) setDateYmd(ymdFromLocalDate(d));
                      }}
                      minDate={minDateObj}
                      inline
                      monthsShown={1}
                      calendarClassName="premium-booking-datepicker"
                      locale={datePickerLocale}
                      dayClassName={(date) =>
                        isSameDay(date, selectedDate) ? "premium-cal-day-selected-exact" : ""
                      }
                    />
                  </motion.div>
                </div>

                <div className="tour-booking-drawer-footer shrink-0 overflow-visible border-t border-border/60 px-3 py-2 sm:px-5">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                    <div>
                      <span className={`${fieldLabelClass} mb-0.5 block`}>Guests</span>
                      <div className="tour-premium-guest-stepper flex h-9 max-w-[12.5rem] items-center gap-0.5 rounded-xl px-0.5">
                        <button
                          type="button"
                          aria-label="Decrease guests"
                          onClick={() => bumpGuests(-1)}
                          className="tour-premium-stepper-btn inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition disabled:opacity-40"
                          disabled={guestCount <= 1}
                        >
                          <Minus className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          aria-label="Number of guests"
                          value={guestDisplayValue}
                          onChange={(e) => handleGuestChange(e.target.value)}
                          onFocus={() => {
                            guestFieldEditingRef.current = true;
                            setGuestFieldEditing(true);
                            setGuestEditValue(String(guestCount));
                          }}
                          onBlur={() => {
                            commitGuestInput();
                            guestFieldEditingRef.current = false;
                            setGuestFieldEditing(false);
                          }}
                          className="min-w-[2.25rem] max-w-[3.5rem] flex-1 border-0 bg-transparent px-0.5 text-center text-[13px] font-semibold tabular-nums text-foreground outline-none focus:ring-0"
                        />
                        <button
                          type="button"
                          aria-label="Increase guests"
                          onClick={() => bumpGuests(1)}
                          className="tour-premium-stepper-btn inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition disabled:opacity-40"
                          disabled={guestCount >= MAX_GUESTS}
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                      </div>
                    </div>
                    <div className="min-w-0 overflow-visible pb-0.5">
                      <PremiumLanguageSelect
                        labelId={langLabelId}
                        value={preferredLanguage}
                        onChange={setPreferredLanguage}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="tour-sticky-cta-bar pointer-events-auto border-t border-border/80 sm:pb-0">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              {selectedPortLabel ? (
                <p className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                  <Ship className="h-3 w-3 text-primary" aria-hidden />
                  <span className="truncate">{selectedPortLabel}</span>
                </p>
              ) : null}
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground">From</p>
              <p className="text-lg font-semibold text-foreground tabular-nums sm:text-2xl">
                {ctaUnitFormatted != null ? (
                  <>
                    <span>{ctaUnitFormatted}</span>
                    <span className="text-xs font-normal text-muted-foreground sm:text-sm"> / {perUnitLabel}</span>
                  </>
                ) : (
                  <>
                    {price.amountLabel}
                    <span className="ml-0.5 text-xs font-medium text-muted-foreground sm:text-sm">{price.currency}</span>
                    <span className="text-xs font-normal text-muted-foreground sm:text-sm"> / {price.per}</span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={handlePrimaryClick}
              disabled={!canBook || busy}
              aria-expanded={drawerOpen}
              title={!canBook ? "Tour checkout is not linked yet (missing tours row or env)." : undefined}
              className={`${mobileBtnClass} px-6 h-9 sm:hidden`}
            >
              {busy ? "…" : drawerOpen ? "Continue" : "Book Now"}
            </button>
            <button
              type="button"
              onClick={handlePrimaryClick}
              disabled={!canBook || busy}
              aria-expanded={drawerOpen}
              title={!canBook ? "Tour checkout is not linked yet (missing tours row or env)." : undefined}
              className={`${btnClass} hidden px-10 h-10 sm:inline-flex`}
            >
              {busy ? "…" : drawerOpen ? "Continue to checkout" : "Book Now"}
            </button>
          </div>

          <div className="tour-sticky-cta-bar-mobile-nav flex items-center justify-around py-2 sm:hidden">
            <NavItem icon={Home} label="Home" />
            <NavItem icon={Map} label="Tours" active />
            <NavItem icon={ShoppingCart} label="Cart" />
            <NavItem icon={User} label="My Page" />
          </div>
        </div>
      </div>

      <div className={spacerClass} />
    </>
  );
}
