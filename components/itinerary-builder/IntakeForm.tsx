"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, MapPin, Ship, Car } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";

type Track = "private" | "cruise";
type RegionSlug = "busan" | "jeju";

function readInitialRegion(sp: URLSearchParams | null): RegionSlug {
  const r = sp?.get("region");
  return r === "jeju" ? "jeju" : "busan";
}
function readInitialTrack(sp: URLSearchParams | null): Track {
  return sp?.get("track") === "cruise" ? "cruise" : "private";
}

/**
 * Phase 4c intake form. Two-branch flow:
 *  - private track: pick region + (optional) date + party + language
 *  - cruise track: pick region (port-local) + hours window + (optional) date + ship name
 *
 * Submit pushes the answers into the URL of `/itinerary-builder/[region]`
 * so the cart + quote modal can read them via `useSearchParams`. No
 * sign-up required (D5: URL params carry state).
 */
export default function IntakeForm() {
  const t = useTranslations("itineraryBuilder.intake");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [track, setTrack] = useState<Track>(() => readInitialTrack(searchParams));
  const [region, setRegion] = useState<RegionSlug>(() => readInitialRegion(searchParams));
  const [hours, setHours] = useState<string>("6");
  const [ship, setShip] = useState<string>("");

  // Date + party were removed from the intake form (2026-05-17) — the native
  // `<input type="date">` calendar popup was occluding the submit button on
  // Korean Chrome mobile, and both fields are already collected (with
  // proper UI) inside `<QuoteModal />` at quote-submit time. Keeping intake
  // minimal: "what kind of trip" only.

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("track", track);
    if (track === "cruise") {
      const h = Number(hours);
      if (Number.isFinite(h) && h > 0) params.set("hours", String(h));
      if (ship.trim()) params.set("ship", ship.trim());
    }
    router.push(`/itinerary-builder/${region}?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
      {/* Track toggle (private vs cruise) */}
      <fieldset>
        <legend className="mb-3 text-eyebrow">{t("trackLegend")}</legend>
        <div className="grid grid-cols-2 gap-3">
          <label
            className={`group flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
              track === "private"
                ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="track"
              value="private"
              checked={track === "private"}
              onChange={() => setTrack("private")}
              className="sr-only"
            />
            <Car
              className={`h-6 w-6 ${track === "private" ? "text-amber-700" : "text-slate-500"}`}
              aria-hidden
            />
            <span className="text-caption font-bold text-slate-900">{t("trackPrivateLabel")}</span>
            <span className="text-micro text-slate-500">{t("trackPrivateHint")}</span>
          </label>
          <label
            className={`group flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
              track === "cruise"
                ? "border-sky-500 bg-sky-50 ring-2 ring-sky-200"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="track"
              value="cruise"
              checked={track === "cruise"}
              onChange={() => setTrack("cruise")}
              className="sr-only"
            />
            <Ship
              className={`h-6 w-6 ${track === "cruise" ? "text-sky-700" : "text-slate-500"}`}
              aria-hidden
            />
            <span className="text-caption font-bold text-slate-900">{t("trackCruiseLabel")}</span>
            <span className="text-micro text-slate-500">{t("trackCruiseHint")}</span>
          </label>
        </div>
      </fieldset>

      {/* Region */}
      <fieldset>
        <legend className="mb-3 text-eyebrow">{t("regionLegend")}</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["busan", "jeju"] as RegionSlug[]).map((r) => (
            <label
              key={r}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-3 transition-all ${
                region === r
                  ? "border-slate-900 bg-slate-50 ring-2 ring-slate-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="region"
                value={r}
                checked={region === r}
                onChange={() => setRegion(r)}
                className="sr-only"
              />
              <MapPin
                className={`h-4 w-4 ${region === r ? "text-slate-900" : "text-slate-400"}`}
                aria-hidden
              />
              <span className="text-caption font-bold capitalize text-slate-900">{r}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Cruise: hours window */}
      {track === "cruise" ? (
        <fieldset>
          <legend className="mb-2 text-eyebrow">{t("cruiseHoursLegend")}</legend>
          <p className="mb-3 text-micro text-slate-500">{t("cruiseHoursHint")}</p>
          <div className="flex flex-wrap gap-2">
            {[4, 6, 8, 10, 12].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHours(String(h))}
                className={`rounded-full px-4 py-2 text-caption font-semibold transition-all ${
                  hours === String(h)
                    ? "bg-sky-700 text-white shadow"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {/* Cruise: ship name (optional) */}
      {track === "cruise" ? (
        <label className="block">
          <span className="mb-1.5 block text-caption font-semibold text-slate-700">
            {t("shipLabel")}{" "}
            <span className="text-slate-400">{t("optionalSuffix")}</span>
          </span>
          <input
            type="text"
            value={ship}
            onChange={(e) => setShip(e.target.value)}
            placeholder="MS Westerdam, Norwegian Spirit…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-300 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </label>
      ) : null}

      <p className="text-center text-micro text-slate-500">
        {t("dateAndPartyDeferredHint")}
      </p>

      <button
        type="submit"
        className={`${homeBtnPrimary} group inline-flex items-center justify-center gap-2 shadow-lg hover:gap-3`}
      >
        {t("submit")}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>

      <p className="text-center text-micro text-slate-500">
        <Link href="/tours" className="underline-offset-2 hover:underline">
          {t("browsePackagesInstead")}
        </Link>
      </p>
    </form>
  );
}
