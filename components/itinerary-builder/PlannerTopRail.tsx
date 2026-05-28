"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

interface Props {
  /** Active region (always resolved at the server; if user changes via the
   *  rail, it triggers a hard navigation that re-fetches POIs). */
  region: RegionSlug;
}

const GUIDE_LANGS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文 (简体)" },
  { code: "zh-TW", label: "中文 (繁體)" },
  { code: "es", label: "Español" },
];
const PRIVATE_HOURS = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const CRUISE_HOURS = [4, 6, 8, 10, 12];
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
export default function PlannerTopRail({ region }: Props) {
  const t = useTranslations("itineraryBuilder.planner");
  const tIntake = useTranslations("itineraryBuilder.intake");
  const { locale } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

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

  /** Write a partial URL update, preserving any existing params. */
  const patch = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(sp?.toString() ?? "");
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      // Region change is special — POIs are fetched server-side, so this is a
      // hard navigation (page replays). Everything else is `replace` to keep
      // the planner mounted.
      const qs = params.toString();
      const href = `/itinerary-builder${qs ? `?${qs}` : ""}`;
      if (updates.region) router.push(href);
      else router.replace(href, { scroll: false });
    },
    [router, sp],
  );

  // Hide the date error as soon as the user fills it.
  useEffect(() => {
    if (dateError && date) setDateError(false);
  }, [date, dateError]);

  // Solati (10-13 pax) needs ≥6h. Bump duration if it's too short.
  useEffect(() => {
    const p = Number(party);
    if (Number.isFinite(p) && p >= 10 && p <= 13 && Number(duration) < 6) {
      patch({ duration: "6" });
    }
  }, [party, duration, patch]);

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

  /** Inline form body — re-used by both the desktop bar and the mobile sheet. */
  function FormBody({ inSheet }: { inSheet: boolean }) {
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
            <select
              value={isCruise ? hours : duration}
              onChange={(e) =>
                patch(isCruise ? { hours: e.target.value } : { duration: e.target.value })
              }
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-caption font-semibold tabular-nums focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              {(isCruise ? CRUISE_HOURS : PRIVATE_HOURS).map((h) => (
                <option key={h} value={h}>
                  {h}h
                </option>
              ))}
            </select>
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
  }

  return (
    <>
      {/* Desktop bar — full expanded controls on md+ */}
      <div className="sticky top-16 z-30 hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-md md:block">
        <FormBody inSheet={false} />
      </div>

      {/* Mobile chip — collapsed summary; tap to open sheet */}
      <div className="sticky top-16 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          aria-expanded={sheetOpen}
        >
          <span className="min-w-0 flex-1 truncate text-caption font-semibold text-slate-700">
            {summary}
          </span>
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
            <FormBody inSheet />
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
