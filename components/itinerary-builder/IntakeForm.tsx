"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Ship, Car, Sparkles, ShieldAlert } from "lucide-react";
import { useTranslations, useI18n } from "@/lib/i18n";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";

type Track = "private" | "cruise" | "dmz";
type RegionSlug = "busan" | "jeju" | "seoul";

/** Guide languages offered. Endonyms — no translation needed. */
const GUIDE_LANGS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文 (简体)" },
  { code: "zh-TW", label: "中文 (繁體)" },
  { code: "es", label: "Español" },
];
const PRIVATE_HOURS = [4, 5, 6, 7, 8, 9, 10, 11, 12];

function readInitialRegion(sp: URLSearchParams | null): RegionSlug {
  const r = sp?.get("region");
  if (r === "jeju") return "jeju";
  if (r === "seoul") return "seoul";
  return "busan";
}
function readInitialTrack(sp: URLSearchParams | null): Track {
  const t = sp?.get("track");
  if (t === "cruise") return "cruise";
  if (t === "dmz") return "dmz";
  return "private";
}

/**
 * Intake form. Three-branch flow (Phase 9):
 *  - private: region + guide language + tour duration (4-12h)
 *  - cruise:  region + guide language + hours-ashore window + ship name
 *  - dmz:     guide language only (fixed-price-by-pax product, Seoul/DMZ area)
 *
 * Submit pushes the answers into the URL of `/itinerary-builder/[region]`
 * so the cart + quote modal can read them via `useSearchParams` (D5: URL
 * params carry state). The QuoteModal recomputes the live price from these.
 */
export default function IntakeForm() {
  const t = useTranslations("itineraryBuilder.intake");
  const { locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [track, setTrack] = useState<Track>(() => readInitialTrack(searchParams));
  const [region, setRegion] = useState<RegionSlug>(() => readInitialRegion(searchParams));
  const [hours, setHours] = useState<string>("6");
  const [duration, setDuration] = useState<string>("8");
  const [ship, setShip] = useState<string>("");
  const [guideLang, setGuideLang] = useState<string>(() => {
    const initial = searchParams?.get("lang") || locale;
    return GUIDE_LANGS.some((g) => g.code === initial) ? initial : "en";
  });

  const reveal = useRevealContainerProps();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("track", track);
    params.set("lang", guideLang);
    // DMZ is a fixed-price Seoul-area product — always routes to the seoul shell.
    const destRegion: RegionSlug = track === "dmz" ? "seoul" : region;
    if (track === "private") {
      const d = Number(duration);
      if (Number.isFinite(d) && d > 0) params.set("duration", String(d));
    }
    if (track === "cruise") {
      const h = Number(hours);
      if (Number.isFinite(h) && h > 0) params.set("hours", String(h));
      if (ship.trim()) params.set("ship", ship.trim());
    }
    // Unified planner Phase 4 — carry the free-text intent typed in the home
    // planner's "Build" mode through to the builder's AI panel (prefill only).
    const carriedIntent = searchParams?.get("intent")?.trim();
    if (carriedIntent) params.set("intent", carriedIntent);
    router.push(`/itinerary-builder/${destRegion}?${params.toString()}`);
  }

  // Track-card style tokens. Selected gets a tinted ring + glow halo;
  // unselected stays minimal. Single source so the cards stay symmetric.
  const trackCard = (active: boolean, accent: "amber" | "sky" | "slate") => {
    if (!active) {
      return "border-slate-200/70 bg-white/70 backdrop-blur-sm hover:border-slate-300 hover:bg-white/90";
    }
    if (accent === "amber")
      return "border-amber-500 bg-amber-50 ring-2 ring-amber-200 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]";
    if (accent === "sky")
      return "border-sky-500 bg-sky-50 ring-2 ring-sky-200 shadow-[0_0_0_3px_rgba(2,132,199,0.18)]";
    return "border-slate-700 bg-slate-50 ring-2 ring-slate-300 shadow-[0_0_0_3px_rgba(15,23,42,0.12)]";
  };

  return (
    <motion.form {...reveal} onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
      {/* Track toggle (private / cruise / DMZ) */}
      <motion.fieldset variants={REVEAL_ITEM_VARIANTS}>
        <legend className="mb-3 text-eyebrow">{t("trackLegend")}</legend>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: "private", label: t("trackPrivateLabel"), Icon: Car, accent: "amber" as const },
            { value: "cruise", label: t("trackCruiseLabel"), Icon: Ship, accent: "sky" as const },
            { value: "dmz", label: t("trackDmzLabel"), Icon: ShieldAlert, accent: "slate" as const },
          ]).map(({ value, label, Icon, accent }) => {
            const active = track === value;
            const iconColor =
              accent === "amber" ? "text-amber-700" : accent === "sky" ? "text-sky-700" : "text-slate-700";
            return (
              <label
                key={value}
                className={`group flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-center transition-all duration-200 ease-out ${trackCard(active, accent)}`}
              >
                <input
                  type="radio"
                  name="track"
                  value={value}
                  checked={active}
                  onChange={() => setTrack(value as Track)}
                  className="sr-only"
                />
                <Icon
                  className={`h-5 w-5 transition-colors duration-200 ${active ? iconColor : "text-slate-500"}`}
                  aria-hidden
                />
                <span className="text-caption font-bold text-slate-900">{label}</span>
              </label>
            );
          })}
        </div>
      </motion.fieldset>

      {/* Region (hidden for DMZ — it's always the Seoul/DMZ area) */}
      {track !== "dmz" ? (
        <motion.fieldset variants={REVEAL_ITEM_VARIANTS}>
          <legend className="mb-3 text-eyebrow">{t("regionLegend")}</legend>
          <div className="grid grid-cols-3 gap-3">
            {(["busan", "jeju", "seoul"] as RegionSlug[]).map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-3 py-3.5 transition-all duration-200 ease-out ${
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
      ) : null}

      {/* Guide language — drives the price tier (English vs Chinese/Korean) */}
      <motion.label variants={REVEAL_ITEM_VARIANTS} className="block">
        <span className="mb-1.5 block text-eyebrow">{t("guideLanguageLegend")}</span>
        <select
          value={guideLang}
          onChange={(e) => setGuideLang(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        >
          {GUIDE_LANGS.map((g) => (
            <option key={g.code} value={g.code}>
              {g.label}
            </option>
          ))}
        </select>
      </motion.label>

      {/* Private: tour duration (4-12h) */}
      {track === "private" ? (
        <motion.fieldset variants={REVEAL_ITEM_VARIANTS}>
          <legend className="mb-2 text-eyebrow">{t("durationLegend")}</legend>
          <p className="mb-3 text-micro text-slate-500">{t("durationHint")}</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x snap-mandatory scrollbar-hide md:flex-wrap md:overflow-visible">
            {PRIVATE_HOURS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setDuration(String(h))}
                className={`flex-shrink-0 snap-start rounded-full px-4 py-2 text-caption font-semibold transition-all duration-200 ease-out ${
                  duration === String(h)
                    ? "bg-amber-600 text-white shadow-md"
                    : "bg-white/70 text-slate-700 ring-1 ring-slate-200/80 backdrop-blur-sm hover:bg-white/90 hover:ring-slate-300"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </motion.fieldset>
      ) : null}

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
            {t("shipLabel")} <span className="text-slate-400">{t("optionalSuffix")}</span>
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

      {/* DMZ: fixed-price note */}
      {track === "dmz" ? (
        <motion.p
          variants={REVEAL_ITEM_VARIANTS}
          className="rounded-lg bg-slate-50 px-3.5 py-3 text-caption text-slate-600 ring-1 ring-slate-200"
        >
          {t("dmzHint")}
        </motion.p>
      ) : null}

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
