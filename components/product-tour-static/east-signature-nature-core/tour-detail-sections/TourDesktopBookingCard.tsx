"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { enUS } from "date-fns/locale/en-US";

/**
 * react-datepicker is a heavy module (calendar engine + locales) that we don't
 * need until the right rail is interactive. Dynamic import + ssr:false defers
 * its JS chunk until after first paint and keeps it out of the SSR HTML, where
 * it would otherwise bloat hydration on every tour-product page render.
 *
 * The CSS stays as a static import below (small, paints empty calendar shell
 * during the brief async load) — only the JS engine is deferred.
 */
const DatePicker = dynamic(
  () => import("@/components/product-tour-static/_shared/LazyDatePicker"),
  {
    ssr: false,
    loading: () => <div className="card-premium-calendar-wrap--compact h-[260px]" aria-hidden />,
  },
);
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
  fieldLabelClass,
  initialDateYmd,
  parseListUnitUsd,
  todayYmdLocal,
  ymdFromLocalDate,
  ymdToLocalDate,
} from "@/components/product-tour-static/_shared/bookingShared";

import "react-datepicker/dist/react-datepicker.css";

export type TourDesktopBookingCardProps = Pick<EastSignatureNatureCoreDetailViewModel, "price"> & {
  checkout?: TourProductCheckoutContext | null;
  selectedPortLabel?: string;
  sectionUi?: TourProductSectionUiV1;
  pricingTiers?: EastSignatureNatureCoreDetailViewModel["pricingTiers"];
};

/**
 * Desktop right-rail booking card. Self-contained — owns its own date / guest /
 * language state independent of the mobile sticky bar (only one is visible at a
 * time via responsive show/hide).
 */
export function TourDesktopBookingCard({
  price,
  checkout,
  selectedPortLabel,
  sectionUi,
  pricingTiers,
}: TourDesktopBookingCardProps) {
  const portCtaPrefix = sectionUi?.portSelectorCtaPrefix ?? "Docking at";
  const router = useRouter();
  const currencyCtx = useCurrencyOptional();
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [dateYmd, setDateYmd] = useState(initialDateYmd);
  const [guestCount, setGuestCount] = useState(DEFAULT_GUESTS);
  const [guestEditValue, setGuestEditValue] = useState(String(DEFAULT_GUESTS));
  const [guestFieldEditing, setGuestFieldEditing] = useState(false);
  const guestFieldEditingRef = useRef(false);
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>("en");
  const [availability, setAvailability] = useState<AvailabilityState>({ status: "idle" });
  /** Selected duration key for pricingTiers (charter/private products only). */
  const [selectedDuration, setSelectedDuration] = useState<string | null>(
    pricingTiers && pricingTiers.durations.length > 0 ? pricingTiers.durations[0]! : null,
  );

  /**
   * For private/charter products with `pricingTiers`, resolve the matched tier
   * price based on the current guestCount + selectedDuration. When guestCount
   * exceeds the last tier and `extraPerPaxAbove` is set, scale linearly.
   */
  const tierPriceUsd = useMemo(() => {
    if (!pricingTiers || !selectedDuration) return null;
    const matched = pricingTiers.tiers.find(
      (tr) => guestCount >= tr.paxMin && guestCount <= tr.paxMax,
    );
    if (matched) {
      const v = matched.prices[selectedDuration];
      return typeof v === "number" && v > 0 ? v : null;
    }
    const e = pricingTiers.extraPerPaxAbove;
    if (e && guestCount > e.anchorPax) {
      return e.basePrice + e.perPaxAdd * (guestCount - e.anchorPax);
    }
    const last = pricingTiers.tiers[pricingTiers.tiers.length - 1];
    const v = last?.prices[selectedDuration];
    return typeof v === "number" && v > 0 ? v : null;
  }, [pricingTiers, selectedDuration, guestCount]);

  const minYmd = todayYmdLocal();
  const minDateObj = useMemo(() => ymdToLocalDate(minYmd), [minYmd]);
  const selectedDate = useMemo(() => ymdToLocalDate(dateYmd), [dateYmd]);
  const datePickerLocale = preferredLanguage === "ko" ? ko : preferredLanguage === "zh" ? zhCN : enUS;

  /**
   * Auto-check availability whenever date or guests change. Debounced 300ms so
   * rapid clicks (e.g. dragging the guest stepper, picking through dates) don't
   * fire a request per keystroke — the previous version sent up to 5 fetches
   * per second under aggressive interaction.
   */
  useEffect(() => {
    if (!checkout?.tourId) return;
    if (!dateYmd || dateYmd < minYmd) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
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
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [checkout?.tourId, dateYmd, guestCount, minYmd]);

  const unitPriceUsd = useMemo(() => {
    /** Tier-based pricing is authoritative — guest/duration changes must always win over the
     * coarse availability-API price (which returns the DB base price regardless of group size). */
    if (tierPriceUsd != null) return tierPriceUsd;
    if (availability.status === "available" && availability.priceUsd != null && availability.priceUsd > 0) {
      return availability.priceUsd;
    }
    if (checkout?.unitPriceUsd != null && checkout.unitPriceUsd > 0) return checkout.unitPriceUsd;
    return parseListUnitUsd(price);
  }, [availability, checkout, price, tierPriceUsd]);

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

  /** Compare-at (strikethrough) anchor; only shown when authored and higher than sale. */
  const originalUnitPriceUsd =
    typeof price.originalPriceUsd === "number" && price.originalPriceUsd > 0
      ? price.originalPriceUsd
      : null;
  const showOriginalPrice =
    originalUnitPriceUsd != null && unitPriceUsd != null && originalUnitPriceUsd > unitPriceUsd;
  const ctaOriginalFormatted = useMemo(() => {
    if (!showOriginalPrice || originalUnitPriceUsd == null) return null;
    if (currencyCtx) return currencyCtx.formatPrice(originalUnitPriceUsd);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(originalUnitPriceUsd);
  }, [showOriginalPrice, originalUnitPriceUsd, currencyCtx]);
  const discountPercent =
    typeof price.discountPercent === "number" && price.discountPercent > 0
      ? Math.round(price.discountPercent)
      : showOriginalPrice && originalUnitPriceUsd != null && unitPriceUsd != null
        ? Math.round(((originalUnitPriceUsd - unitPriceUsd) / originalUnitPriceUsd) * 100)
        : 0;

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

  const ctaLabel = (() => {
    if (busy) return "…";
    if (availability.status === "checking") return t("tour.checkingAvailability");
    if (availability.status === "unavailable") return t("tour.chooseAnotherDate");
    return t("tour.reserve");
  })();
  const ctaDisabled =
    !canBook || busy || availability.status === "checking" || availability.status === "unavailable";

  return (
    <div className="overflow-visible rounded-[28px] border border-slate-200/70 bg-white/90 backdrop-blur-sm p-5 shadow-[var(--home-shadow-neutral-card)] ring-1 ring-white/80">
      {/* Price header — bold, no italic, color via currency token */}
      <div className="mb-4">
        {selectedPortLabel ? (
          <p className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-foreground">
            <Ship className="h-3 w-3 text-primary" aria-hidden />
            <span className="text-muted-foreground">{portCtaPrefix}:</span>
            <span>{selectedPortLabel}</span>
          </p>
        ) : null}
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t("tour.stickyPriceFrom")}
        </p>
        {showOriginalPrice && ctaOriginalFormatted ? (
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-sm text-muted-foreground line-through tabular-nums">
              {ctaOriginalFormatted}
            </span>
            {discountPercent > 0 && (
              <span className="rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                {discountPercent}% OFF
              </span>
            )}
          </div>
        ) : null}
        <p className="mt-1 flex items-baseline gap-1.5 tabular-nums">
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {ctaUnitFormatted ?? `${price.amountLabel}${price.currency ? " " + price.currency : ""}`}
          </span>
          <span className="text-sm font-medium text-muted-foreground">/ {perUnitLabel}</span>
        </p>
        {price.priceNote ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {price.priceNote}
          </p>
        ) : null}
        {estimatedTotal != null && checkout?.priceType === "person" && estimatedTotalFormatted && guestCount > 1 && (
          <p className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
            <span className="font-semibold text-foreground">{estimatedTotalFormatted}</span>
            {" · "}
            {guestCount} guests
          </p>
        )}
      </div>

      {/* Pricing tiers — duration toggle (when >1) + full matrix (private/charter products) */}
      {pricingTiers && pricingTiers.tiers.length > 0 && (
        <div className="mb-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-3">
          {pricingTiers.durations.length > 1 && (
            <div className="mb-2 flex items-center justify-between">
              <span className={`${fieldLabelClass}`}>Duration</span>
              <div className="inline-flex rounded-full bg-white p-0.5 shadow-sm ring-1 ring-slate-200">
                {pricingTiers.durations.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDuration(d)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      selectedDuration === d
                        ? "bg-foreground text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-100/70 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-semibold">Group size</th>
                  {pricingTiers.durations.map((d) => (
                    <th key={d} className="px-2.5 py-1.5 text-right font-semibold">
                      {pricingTiers.durations.length === 1 ? "Price" : d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pricingTiers.tiers.map((tr) => {
                  const isMatchedPax = guestCount >= tr.paxMin && guestCount <= tr.paxMax;
                  return (
                    <tr key={tr.paxLabel} className={isMatchedPax ? "bg-amber-50/70" : ""}>
                      <td className="px-2.5 py-1.5 font-medium text-foreground">
                        {tr.paxLabel}
                      </td>
                      {pricingTiers.durations.map((d) => {
                        const v = tr.prices[d];
                        const isMatched = isMatchedPax && d === selectedDuration;
                        return (
                          <td
                            key={d}
                            className={`px-2.5 py-1.5 text-right tabular-nums ${
                              isMatched ? "font-bold text-foreground" : "text-foreground"
                            }`}
                          >
                            {typeof v === "number" ? `$${v}` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pricingTiers.extraPerPaxAbove ? (
            <p className="mt-2 text-[10.5px] text-muted-foreground">
              {pricingTiers.extraPerPaxAbove.anchorPax + 1}+ pax: +${pricingTiers.extraPerPaxAbove.perPaxAdd} per extra guest
            </p>
          ) : null}
          <p className="mt-2 text-[10.5px] text-muted-foreground">
            Per {pricingTiers.unit} · price updates with the guest count below
          </p>
        </div>
      )}

      {/* Calendar */}
      <div className="card-premium-calendar-wrap card-premium-calendar-wrap--compact mb-3">
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
          dayClassName={(date) => (isSameDay(date, selectedDate) ? "premium-cal-day-selected-exact" : "")}
        />
      </div>

      {/* Guests + Language */}
      <div className="mb-3 grid grid-cols-1 gap-3">
        <div>
          <span className={`${fieldLabelClass} mb-0.5 block`}>Guests</span>
          <div className="tour-premium-guest-stepper flex h-9 items-center gap-0.5 rounded-xl px-0.5">
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
        <div className="min-w-0">
          <PremiumLanguageSelect
            labelId="tour-desktop-booking-lang-label"
            value={preferredLanguage}
            onChange={setPreferredLanguage}
            menuPlacement="bottom"
          />
        </div>
      </div>

      {/* Availability badge */}
      <div className="mb-3 min-h-[24px]">
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

      {/* CTA */}
      <button
        type="button"
        onClick={goToCheckout}
        disabled={ctaDisabled}
        title={!canBook ? "Tour checkout is not linked yet (missing tours row or env)." : undefined}
        className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-foreground text-[15px] font-semibold text-white shadow-md transition-all outline-none hover:bg-foreground/90 hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        {ctaLabel}
      </button>

      {/* Reassurance */}
      <div className="mt-3 flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          {t("tour.freeCancellation")}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
          <Wallet className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          {t("tour.payLater")}
        </span>
      </div>
    </div>
  );
}
