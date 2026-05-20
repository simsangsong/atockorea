"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Ship, Car, Sparkles } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";

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

  const reveal = useRevealContainerProps();

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

  // Track-card style tokens. Selected gets a tinted ring + glow halo;
  // unselected stays minimal. Single source so private/cruise stay symmetric.
  const trackCard = (active: boolean, accent: "amber" | "sky") => {
    if (!active) {
      return "border-slate-200/70 bg-white/70 backdrop-blur-sm hover:border-slate-300 hover:bg-white/90";
    }
    return accent === "amber"
      ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]"
      : "border-sky-500 bg-sky-50 ring-2 ring-sky-200 shadow-[0_0_0_3px_rgba(2,132,199,0.18)]";
  };

  return (
    <motion.form
      {...reveal}
      onSubmit={handleSubmit}
      className="space-y-6 md:space-y-8"
    >
      {/* Track toggle (private vs cruise) */}
      <motion.fieldset variants={REVEAL_ITEM_VARIANTS}>
        <legend className="mb-3 text-eyebrow">{t("trackLegend")}</legend>
        {/* V2 Phase 7 — track cards tightened: icon + label only.
            Hint line dropped to equalize visual weight with the region
            row below (which is single-line icon + label too). */}
        <div className="grid grid-cols-2 gap-3">
          <label
            className={`group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-3 text-center transition-all duration-200 ease-out ${trackCard(track === "private", "amber")}`}
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
              className={`h-5 w-5 transition-colors duration-200 ${track === "private" ? "text-amber-700" : "text-slate-500"}`}
              aria-hidden
            />
            <span className="text-caption font-bold text-slate-900">{t("trackPrivateLabel")}</span>
          </label>
          <label
            className={`group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-3 text-center transition-all duration-200 ease-out ${trackCard(track === "cruise", "sky")}`}
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
              className={`h-5 w-5 transition-colors duration-200 ${track === "cruise" ? "text-sky-700" : "text-slate-500"}`}
              aria-hidden
            />
            <span className="text-caption font-bold text-slate-900">{t("trackCruiseLabel")}</span>
          </label>
        </div>
      </motion.fieldset>

      {/* Region */}
      <motion.fieldset variants={REVEAL_ITEM_VARIANTS}>
        <legend className="mb-3 text-eyebrow">{t("regionLegend")}</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["busan", "jeju"] as RegionSlug[]).map((r) => (
            <label
              key={r}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-4 py-3.5 transition-all duration-200 ease-out ${
                region === r
                  ? "border-slate-900 bg-white/90 ring-2 ring-slate-200 shadow-[0_0_0_3px_rgba(15,23,42,0.08)] backdrop-blur-sm"
                  : "border-slate-200/70 bg-white/70 backdrop-blur-sm hover:border-slate-400 hover:bg-white/90"
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
                className={`h-4 w-4 transition-colors duration-200 ${region === r ? "text-slate-900" : "text-slate-400"}`}
                aria-hidden
              />
              <span className="text-caption font-bold capitalize text-slate-900">{r}</span>
            </label>
          ))}
        </div>
      </motion.fieldset>

      {/* Cruise: hours window — mobile snap rail, desktop wrap */}
      {track === "cruise" ? (
        <motion.fieldset variants={REVEAL_ITEM_VARIANTS}>
          <legend className="mb-2 text-eyebrow">{t("cruiseHoursLegend")}</legend>
          <p className="mb-3 text-micro text-slate-500">{t("cruiseHoursHint")}</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x snap-mandatory scrollbar-hide md:flex-wrap md:overflow-visible">
            {[4, 6, 8, 10, 12].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHours(String(h))}
                className={`flex-shrink-0 snap-start rounded-full px-4 py-2 text-caption font-semibold transition-all duration-200 ease-out ${
                  hours === String(h)
                    ? "bg-sky-700 text-white shadow-md"
                    : "bg-white/70 text-slate-700 ring-1 ring-slate-200/80 backdrop-blur-sm hover:bg-white/90 hover:ring-slate-300"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </motion.fieldset>
      ) : null}

      {/* Cruise: ship name (optional) */}
      {track === "cruise" ? (
        <motion.label variants={REVEAL_ITEM_VARIANTS} className="block">
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
        </motion.label>
      ) : null}

      {/* V2 Phase 7 — submit area density. 3 helper lines collapsed
          to 1 (the auto-quote reassurance — the line that earns trust).
          dateAndPartyDeferredHint is implicit (date/party fields aren't
          here so users won't expect them); browsePackagesInstead moved
          to the page footer where alternative paths belong, not
          adjacent to the primary submit. */}
      <motion.div variants={REVEAL_ITEM_VARIANTS} className="space-y-3">
        <button
          type="submit"
          className={`${homeBtnPrimary} group inline-flex items-center justify-center gap-2 shadow-lg hover:gap-3 md:mx-auto md:max-w-sm`}
        >
          {t("submit")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>

        <p className="inline-flex w-full items-center justify-center gap-1.5 text-center text-micro text-slate-500">
          <Sparkles className="h-3 w-3 text-amber-600" aria-hidden />
          {t("autoQuoteReassurance")}
        </p>
      </motion.div>
    </motion.form>
  );
}
