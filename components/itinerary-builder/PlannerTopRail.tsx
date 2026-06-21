"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, MapPin, Ship, Car, ShieldAlert, X } from "lucide-react";
import { useI18n, useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import type {
  CruisePort,
  JejuPickupZone,
  PricingTrack,
} from "@/lib/quote-engine/pricing-policy";
import IntakeDateField from "./IntakeDateField";
import SelectDropdown from "./SelectDropdown";

interface Props {
  /** Active region (always resolved at the server; if user changes via the
   *  rail, it triggers a hard navigation that re-fetches POIs). */
  region: RegionSlug;
  /**
   * Phase 11 D27/D31 — where this rail is mounted.
   *  - "page" (legacy): top-rail sits on `/itinerary-builder` (still routed
   *    here for QA / fallback) and writes URL updates back to that path.
   *  - "home" (default): rail sits on `/` (matcher-pattern unified planner)
   *    and writes URL updates back to `/`. Mobile trigger is a labeled
   *    "Edit trip" button (NOT a summary chip) per user feedback 2026-05-29.
   *  - When omitted, defaults to "page" to preserve any caller that does
   *    not yet pass the prop.
   */
  placement?: "page" | "home";
}

const GUIDE_LANGS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文 (简体)" },
  { code: "zh-TW", label: "中文 (繁體)" },
  { code: "es", label: "Español" },
];
// Premium-dropdown option shape ({ code, label }) so the time picker renders
// through the shared SelectDropdown (same on-brand popover as the hero + date
// field) instead of the native OS <select> sheet.
const PRIVATE_HOUR_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => ({
  code: String(h),
  label: `${h}h`,
}));
const CRUISE_HOUR_OPTIONS = [4, 6, 8, 10, 12].map((h) => ({
  code: String(h),
  label: `${h}h`,
}));
const PICKUP_ZONES: JejuPickupZone[] = ["city", "north", "outer", "cross_island"];

const TRACK_OPTIONS: Array<{ value: PricingTrack; Icon: typeof Car }> = [
  { value: "private", Icon: Car },
  { value: "cruise", Icon: Ship },
  { value: "dmz", Icon: ShieldAlert },
];

function readTrack(sp: URLSearchParams | null): PricingTrack {
  const v = sp?.get("track");
  if (v === "cruise" || v === "dmz") return v;
  return "private";
}
function readLang(sp: URLSearchParams | null, fallback: string): string {
  const v = sp?.get("lang") ?? fallback;
  return GUIDE_LANGS.some((g) => g.code === v) ? v : "en";
}
function readPickup(sp: URLSearchParams | null): JejuPickupZone {
  const v = sp?.get("pickup") as JejuPickupZone | null;
  return v && PICKUP_ZONES.includes(v) ? v : "city";
}
function readPort(sp: URLSearchParams | null): CruisePort {
  return sp?.get("port") === "jeju_port" ? "jeju_port" : "gangjeong";
}

/**
 * Unified planner top rail (Phase 10.3 D21/D24).
 *
 * Collapses the old `IntakeForm` (separate intake page) + the duplicate
 * controls inside `QuoteModal` into a single sticky bar at the top of the
 * planner. Every change writes the URL via `router.replace({scroll:false})`
 * so the rail, the live price card, and the booking modal all read from the
 * same source of truth (URL params per D5). Region changes trigger a hard
 * navigation because POIs are fetched server-side.
 *
 *  - Desktop (md+): horizontal sticky bar always expanded.
 *  - Mobile (<md): 1-line summary chip; tap to open a full-height sheet
 *    with the full controls.
 *
 * Track / region semantics inherited from `IntakeForm`:
 *  - private: region + lang + duration (4-12h) + date + party + (Jeju pickup)
 *  - cruise:  region + lang + hours (4-12) + ship + date + party + (Jeju port)
 *  - dmz:     lang + date + party (region forced to Seoul, no duration)
 */
export default function PlannerTopRail({ region, placement = "page" }: Props) {
  const t = useTranslations("itineraryBuilder.planner");
  const tIntake = useTranslations("itineraryBuilder.intake");
  const { locale } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname() ?? "/";
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  // Phase 11 audit fix #2 — for placement="home" we must preserve the
  // locale-prefixed pathname (`/ko`, `/ja`, `/zh`, `/zh-TW`, `/es`),
  // NOT hardcode `/`. Otherwise every rail interaction on a non-EN home
  // silently navigates the user to the English home and loses locale.
  // For placement="page" the legacy `/itinerary-builder` route is not
  // locale-prefixed today, so we keep it literal.
  const basePath = placement === "home" ? pathname : "/itinerary-builder";

  // URL-derived state (no local mirror — every change re-writes the URL).
  const track = readTrack(sp);
  const date = sp?.get("date") ?? "";
  const party = sp?.get("party") ?? "2";
  const lang = readLang(sp, locale);
  const duration = sp?.get("duration") ?? "8";
  const hours = sp?.get("hours") ?? "6";
  const ship = sp?.get("ship") ?? "";
  const pickup = readPickup(sp);
  const port = readPort(sp);

  const [dateError, setDateError] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isCruise = track === "cruise";
  const isDmz = track === "dmz";
  const isJejuLand = region === "jeju" && !isDmz && !isCruise;
  const isJejuCruise = region === "jeju" && isCruise;

  /**
   * Write a partial URL update, preserving any existing params.
   *
   * Audit fix #2/#3/#6 (Phase 10.3.2): some updates trigger an implicit
   * "clean slate" for related params:
   *   - region change → drop `?pois=` (the cart from the OLD region's POIs
   *     would byKey-miss against the NEW region's POI set and silently
   *     produce a 0-stop quote).
   *   - track=dmz → force region=seoul (DMZ is Seoul-only; deep-links like
   *     `?region=jeju&track=dmz` previously produced contradictory state)
   *     AND drop cruise/private-only params (hours, ship, port, pickup,
   *     duration) so a private→dmz→back-to-private toggle returns clean.
   *   - track=cruise → drop the private-only `duration` param so
   *     QuoteModal.handleSubmit's `duration ?? hours` fallback resolves to
   *     `hours` as intended.
   *   - track=private → drop cruise-only params (hours, ship, port).
   */
  const patch = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(sp?.toString() ?? "");
      // Apply explicit updates first.
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      // Then apply implicit cleanups derived from those updates.
      if ("region" in updates) {
        params.delete("pois");
      }
      if (updates.track === "dmz") {
        params.set("region", "seoul");
        params.delete("hours");
        params.delete("ship");
        params.delete("port");
        params.delete("pickup");
        params.delete("duration");
      } else if (updates.track === "cruise") {
        params.delete("duration");
      } else if (updates.track === "private") {
        params.delete("hours");
        params.delete("ship");
        params.delete("port");
      }

      // Region change is special — on the legacy "/itinerary-builder" placement
      // POIs are fetched server-side so it must be a hard navigation. On the
      // "home" placement region changes drive a client-side POI refetch, so
      // they can stay within the SPA — replace() keeps the planner mounted
      // and avoids scrolling the page back to the top.
      //
      // Phase 11 D30 / audit fix #9: single code path so future cleanup-rule
      // additions (e.g. "on region change also delete ?intent=") apply to
      // both the cold first-call and warm subsequent-call cases.
      if (placement === "home" && !params.has("builder")) {
        params.set("builder", "open");
      }
      const qs = params.toString();
      const href = `${basePath}${qs ? `?${qs}` : ""}`;
      const requiresHardNav = placement === "page" && ("region" in updates || updates.track === "dmz");
      if (requiresHardNav) router.push(href);
      else router.replace(href, { scroll: false });
    },
    [router, sp, basePath, placement],
  );

  // Hide the date error as soon as the user fills it.
  useEffect(() => {
    if (dateError && date) setDateError(false);
  }, [date, dateError]);

  // Solati (10-13 pax) needs ≥6h. Bump the relevant duration param if it's
  // too short. Audit fix #4 — read `hours` on cruise track, `duration` on
  // private; ignore DMZ entirely (no duration concept).
  useEffect(() => {
    if (isDmz) return;
    const p = Number(party);
    if (!Number.isFinite(p) || p < 10 || p > 13) return;
    const relevantKey = isCruise ? "hours" : "duration";
    const relevantValue = isCruise ? hours : duration;
    if (Number(relevantValue) < 6) {
      patch({ [relevantKey]: "6" });
    }
  }, [party, duration, hours, isCruise, isDmz, patch]);

  /** Build a compact summary chip ("Busan · 2026-08-20 · 4명 · EN · 8h"). */
  const summary = useMemo(() => {
    const parts: string[] = [region.charAt(0).toUpperCase() + region.slice(1)];
    if (date) parts.push(date);
    if (party) parts.push(`${party}p`);
    const langLabel = GUIDE_LANGS.find((g) => g.code === lang)?.label;
    if (langLabel) parts.push(langLabel);
    if (!isDmz) parts.push(`${isCruise ? hours : duration}h`);
    if (isDmz) parts.push("DMZ");
    return parts.join(" · ");
  }, [region, date, party, lang, duration, hours, isCruise, isDmz]);

  /**
   * Inline form body — re-used by both the desktop bar and the mobile sheet.
   *
   * Audit fix #1 (Phase 10.3.2): previously declared as `function FormBody({inSheet})`
   * and rendered as `<FormBody inSheet={...} />`. Because the function was
   * declared INSIDE the parent component, every parent render created a new
   * function reference, which React treats as a different component type and
   * REMOUNTS the entire subtree on every URL change. Result: input/select
   * focus was lost on every keystroke and Korean/Japanese IME composition
   * broke mid-character. Now rendered as `{renderForm(false)}` — a plain
   * function call that returns JSX (NOT a component), so React reconciles
   * it as part of the parent's own render tree. Focus + IME preserved.
   */
  const renderForm = (inSheet: boolean) => {
    return (
      <div
        className={cn(
          inSheet ? "space-y-4 p-5" : "flex flex-wrap items-end gap-3 px-4 py-3 md:px-6 lg:px-8",
        )}
      >
        {/* Track */}
        <Field label={t("track")} inSheet={inSheet}>
          <div className="flex gap-1.5">
            {TRACK_OPTIONS.map(({ value, Icon }) => {
              const active = track === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => patch({ track: value })}
                  className={chipClass(active)}
                  aria-pressed={active}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {tIntake(`track${value.charAt(0).toUpperCase() + value.slice(1)}Label`)}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Region (hidden for DMZ — forced to Seoul) */}
        {!isDmz ? (
          <Field label={t("region")} inSheet={inSheet}>
            <div className="flex gap-1.5">
              {(["busan", "jeju", "seoul"] as RegionSlug[]).map((r) => {
                const active = region === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => patch({ region: r })}
                    className={chipClass(active)}
                    aria-pressed={active}
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    <span className="capitalize">{r}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        ) : null}

        {/* Date (required) */}
        <Field label={`${t("date")} *`} inSheet={inSheet}>
          <div className="min-w-[180px]">
            <IntakeDateField
              id="planner-date"
              value={date}
              onChange={(v) => patch({ date: v })}
              min={today}
              locale={locale}
              invalid={dateError}
              placeholder={tIntake("dateSelect")}
              todayLabel={tIntake("dateToday")}
              tomorrowLabel={tIntake("dateTomorrow")}
            />
          </div>
        </Field>

        {/* Party */}
        <Field label={t("party")} inSheet={inSheet}>
          <input
            type="number"
            min={1}
            max={isDmz ? 28 : 30}
            inputMode="numeric"
            value={party}
            onChange={(e) => patch({ party: e.target.value })}
            className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-caption font-semibold tabular-nums focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </Field>

        {/* Guide language */}
        <Field label={t("lang")} inSheet={inSheet}>
          <select
            value={lang}
            onChange={(e) => patch({ lang: e.target.value })}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-caption font-semibold focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          >
            {GUIDE_LANGS.map((g) => (
              <option key={g.code} value={g.code}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>

        {/* Duration (private) / Hours (cruise) — hidden for DMZ */}
        {!isDmz ? (
          <Field
            label={isCruise ? t("hours") : t("duration")}
            inSheet={inSheet}
          >
            <div className="min-w-[100px]">
              <SelectDropdown
                id="planner-rail-hours"
                value={isCruise ? hours : duration}
                options={isCruise ? CRUISE_HOUR_OPTIONS : PRIVATE_HOUR_OPTIONS}
                onChange={(code) =>
                  patch(isCruise ? { hours: code } : { duration: code })
                }
                ariaLabel={isCruise ? t("hours") : t("duration")}
              />
            </div>
          </Field>
        ) : null}

        {/* Cruise ship name (optional) */}
        {isCruise ? (
          <Field label={t("ship")} inSheet={inSheet}>
            <input
              type="text"
              value={ship}
              onChange={(e) => patch({ ship: e.target.value || null })}
              placeholder="MS Westerdam…"
              className="w-44 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-caption focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </Field>
        ) : null}

        {/* Jeju hotel pickup (land tours only) */}
        {isJejuLand ? (
          <Field label={t("pickup")} inSheet={inSheet}>
            <select
              value={pickup}
              onChange={(e) => patch({ pickup: e.target.value })}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-caption font-semibold focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              {PICKUP_ZONES.map((z) => (
                <option key={z} value={z}>
                  {t(`pickupZones.${z}`)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {/* Cruise port (Jeju cruise — Gangjeong adds a surcharge) */}
        {isJejuCruise ? (
          <Field label={t("port")} inSheet={inSheet}>
            <select
              value={port}
              onChange={(e) => patch({ port: e.target.value })}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-caption font-semibold focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              <option value="gangjeong">{t("ports.gangjeong")}</option>
              <option value="jeju_port">{t("ports.jeju_port")}</option>
            </select>
          </Field>
        ) : null}
      </div>
    );
  };

  const isHome = placement === "home";
  // Phase 11 D31 — on "home" placement the rail is not sticky (it scrolls
  // with the section) and the mobile mobile trigger is a labeled "Edit
  // trip" button rather than a compact summary chip (Phase 10 chip was
  // reported as invisible-as-interactive by user 2026-05-29).
  const desktopBarClass = isHome
    ? "hidden rounded-card bg-white/95 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_22px_50px_-20px_rgba(15,23,42,0.20)] ring-1 ring-emerald-100/40 md:block"
    : "sticky top-16 z-30 hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-md md:block";
  const mobileTriggerWrapClass = isHome
    ? "rounded-card bg-white/95 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_22px_50px_-20px_rgba(15,23,42,0.20)] ring-1 ring-emerald-100/40 md:hidden"
    : "sticky top-16 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md md:hidden";

  return (
    <>
      {/* Desktop bar — full expanded controls on md+ */}
      <div className={desktopBarClass}>
        {renderForm(false)}
      </div>

      {/* Mobile trigger — on "home" placement a labeled "Edit trip" button;
          on legacy "page" placement a compact summary chip. Both tap to
          open the sheet with the full controls. */}
      <div className={mobileTriggerWrapClass}>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          aria-expanded={sheetOpen}
        >
          {isHome ? (
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-eyebrow text-slate-500">{t("editTrip")}</span>
              <span className="truncate text-caption font-semibold text-slate-800">
                {summary}
              </span>
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-caption font-semibold text-slate-700">
              {summary}
            </span>
          )}
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden />
        </button>
      </div>

      {/* Mobile sheet — full controls */}
      {sheetOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
              <h2 className="text-caption font-semibold text-slate-900">{t("editTrip")}</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label={t("close")}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {renderForm(true)}
            <div className="border-t border-slate-200 p-4">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-caption font-semibold text-white"
              >
                {t("done")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({
  label,
  inSheet,
  children,
}: {
  label: string;
  inSheet: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={inSheet ? "block" : "flex min-w-0 flex-col gap-1"}>
      <span className="text-micro font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </div>
  );
}

function chipClass(active: boolean): string {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-semibold transition-colors duration-150 ease-out",
    active
      ? "border-slate-900 bg-slate-900 text-white"
      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100",
  );
}
