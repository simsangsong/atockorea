"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import DatePicker from "react-datepicker";
import { enUS } from "date-fns/locale/en-US";
import { ko } from "date-fns/locale/ko";
import { zhCN } from "date-fns/locale/zh-CN";
import { isSameDay } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Ship,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";
import type { TourProductCheckoutContext } from "@/lib/tour-product/eastSignatureCheckoutContext";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";
import { useCurrencyOptional } from "@/lib/currency";
import { useTranslations } from "@/lib/i18n";
import { consumerTourCheckoutHref } from "@/lib/tour-consumer-visibility";
import {
  type AvailabilityState,
  type PreferredLanguage,
  DEFAULT_GUESTS,
  MAX_GUESTS,
  PremiumLanguageSelect,
  buildBookingPayload,
  clampGuests,
  drawerEase,
  fieldLabelClass,
  initialDateYmd,
  parseListUnitUsd,
  todayYmdLocal,
  ymdFromLocalDate,
  ymdToLocalDate,
} from "@/components/product-tour-static/_shared/bookingShared";

import "react-datepicker/dist/react-datepicker.css";

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

export function TourStickyBookingBar({ price, checkout, selectedPortLabel, sectionUi }: TourStickyBookingBarProps) {
  const portCtaPrefix = sectionUi?.portSelectorCtaPrefix ?? "Docking at";
  const router = useRouter();
  const currencyCtx = useCurrencyOptional();
  const t = useTranslations();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dateYmd, setDateYmd] = useState(initialDateYmd);
  const [guestCount, setGuestCount] = useState(DEFAULT_GUESTS);
  const [guestEditValue, setGuestEditValue] = useState(String(DEFAULT_GUESTS));
  const [guestFieldEditing, setGuestFieldEditing] = useState(false);
  const guestFieldEditingRef = useRef(false);
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>("en");
  const [availability, setAvailability] = useState<AvailabilityState>({ status: "idle" });

  const minYmd = todayYmdLocal();
  const minDateObj = useMemo(() => ymdToLocalDate(minYmd), [minYmd]);
  const selectedDate = useMemo(() => ymdToLocalDate(dateYmd), [dateYmd]);

  const datePickerLocale = preferredLanguage === "ko" ? ko : preferredLanguage === "zh" ? zhCN : enUS;

  /** Auto-check availability whenever date/guests change while drawer is open */
  useEffect(() => {
    if (!drawerOpen || !checkout?.tourId) return;
    if (!dateYmd || dateYmd < minYmd) return;

    let cancelled = false;

    (async () => {
      setAvailability({ status: "checking" });
      try {
        const res = await fetch(
          `/api/tours/${checkout.tourId}/availability?date=${encodeURIComponent(dateYmd)}&guests=${guestCount}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setAvailability({ status: "idle" });
          return;
        }
        const data = (await res.json()) as {
          canAccommodate?: boolean;
          available?: boolean;
          availableSpots?: number;
          price?: number;
          reason?: string;
        };
        if (cancelled) return;
        if (data.canAccommodate === false || data.available === false) {
          setAvailability({ status: "unavailable", reason: data.reason || "This date isn't available." });
        } else {
          setAvailability({
            status: "available",
            spots: typeof data.availableSpots === "number" ? data.availableSpots : null,
            priceUsd: typeof data.price === "number" && data.price > 0 ? data.price : null,
          });
        }
      } catch {
        if (!cancelled) setAvailability({ status: "idle" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [drawerOpen, checkout?.tourId, dateYmd, guestCount, minYmd]);

  /** Resolved unit price, prefers live priceOverride from availability when present. */
  const unitPriceUsd = useMemo(() => {
    if (availability.status === "available" && availability.priceUsd != null && availability.priceUsd > 0) {
      return availability.priceUsd;
    }
    if (checkout?.unitPriceUsd != null && checkout.unitPriceUsd > 0) return checkout.unitPriceUsd;
    return parseListUnitUsd(price);
  }, [availability, checkout, price]);

  const estimatedTotal = useMemo(() => {
    if (!checkout || unitPriceUsd == null) return null;
    if (checkout.priceType === "person") {
      return Math.round(unitPriceUsd * guestCount * 100) / 100;
    }
    return Math.round(unitPriceUsd * 100) / 100;
  }, [checkout, guestCount, unitPriceUsd]);

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
      toast.error("Please choose a tour date on or after today.");
      return;
    }
    if (availability.status === "unavailable") {
      toast.error(availability.reason);
      return;
    }
    setBusy(true);
    try {
      const payload = buildBookingPayload(checkout, dateYmd, guestCount, preferredLanguage);
      sessionStorage.setItem("bookingData", JSON.stringify(payload));
      router.push(consumerTourCheckoutHref(checkout.tourId));
    } catch (e) {
      console.error(e);
      toast.error("Could not start booking. Please try again.");
      setBusy(false);
    }
  }, [checkout, busy, router, dateYmd, guestCount, minYmd, preferredLanguage, availability]);

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
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all outline-none focus-visible:border focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 bg-foreground text-white hover:bg-foreground/90 shadow-md sm:shadow-lg sm:hover:shadow-xl";

  const spacerClass = drawerOpen
    ? "h-[calc(20rem+env(safe-area-inset-bottom,0px))] sm:h-[min(68vh,26rem)]"
    : "h-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:h-24";

  /** Resolved CTA label — progresses from check → reserve → choose-another based on availability state. */
  const ctaLabel = (() => {
    if (busy) return "…";
    if (!drawerOpen) return t("tour.checkAvailability");
    if (availability.status === "checking") return t("tour.checkingAvailability");
    if (availability.status === "unavailable") return t("tour.chooseAnotherDate");
    return t("tour.reserve");
  })();
  const ctaDisabled =
    !canBook || busy || availability.status === "checking" || availability.status === "unavailable";

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
                          Est. total · {guestCount} {guestCount === 1 ? "guest" : "guests"}:{" "}
                          <span className="font-semibold text-foreground">{estimatedTotalFormatted}</span>
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

                  {/* Reassurance row — emphasises low-commitment, not italic, color + weight only */}
                  <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-emerald-50/60 px-2.5 py-1.5">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                      {t("tour.freeCancellation")}
                    </span>
                    <span aria-hidden className="h-3 w-px bg-emerald-700/20" />
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <Wallet className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                      {t("tour.payLater")}
                    </span>
                  </div>

                  {/* Inline availability status — colored + bold, never italic */}
                  <div className="mb-2 min-h-[24px]">
                    {availability.status === "checking" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        {t("tour.checkingAvailability")}
                      </span>
                    )}
                    {availability.status === "available" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                        {availability.spots != null && availability.spots <= 8 && availability.spots > 0
                          ? t("tour.spotsLeftTemplate").replace("{count}", String(availability.spots))
                          : "Available"}
                      </span>
                    )}
                    {availability.status === "unavailable" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                        <AlertCircle className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                        {availability.reason}
                      </span>
                    )}
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
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground">
                {estimatedTotalFormatted && checkout?.priceType === "person" && guestCount > 1
                  ? `Total · ${guestCount} guests`
                  : "From"}
              </p>
              <p className="text-lg font-semibold text-foreground tabular-nums sm:text-2xl">
                {estimatedTotalFormatted && checkout?.priceType === "person" && guestCount > 1 ? (
                  <>
                    <span>{estimatedTotalFormatted}</span>
                    <span className="text-xs font-normal text-muted-foreground sm:text-sm">
                      {" "}
                      ({ctaUnitFormatted ?? `${price.amountLabel}${price.currency ?? ""}`} / {perUnitLabel})
                    </span>
                  </>
                ) : ctaUnitFormatted != null ? (
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
              disabled={ctaDisabled}
              aria-expanded={drawerOpen}
              title={!canBook ? "Tour checkout is not linked yet (missing tours row or env)." : undefined}
              className={`${btnClass} h-9 px-6 sm:h-10 sm:px-10`}
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>

      <div className={spacerClass} />
    </>
  );
}
