"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, MapPin, Ship, Car, Sparkles, ShieldAlert } from "lucide-react";
import { useTranslations, useI18n } from "@/lib/i18n";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
import { cn } from "@/lib/utils";
import { REVEAL_ITEM_VARIANTS } from "@/components/home/v2/ui/reveal";
import IntakeDateField from "./IntakeDateField";

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

// ── Shared premium tokens (inherit the landing planner-card tone) ──────────
// Selected = solid navy; idle = slate-50 surface with a hairline border.
const OPTION_BASE =
  "focus-ring rounded-button border transition-colors duration-200 ease-out";
const optionTone = (active: boolean) =>
  active
    ? "border-slate-900 bg-slate-900 text-white shadow-1"
    : "border-slate-200/70 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-slate-100";
const FIELD_LABEL = "mb-2 block text-caption font-semibold text-slate-700";
const INPUT_BASE =
  "focus-ring w-full rounded-button border border-slate-200/70 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 transition-colors duration-200 focus:border-slate-300 focus:bg-white";

/**
 * Intake form. Three-branch flow (Phase 9), premium tone matched to the home
 * landing planner card (navy-selected options, slate-50 surfaces, compact).
 *  - private: region + guide language + tour duration (4-12h)
 *  - cruise:  region + guide language + hours-ashore window + ship name
 *  - dmz:     guide language only (fixed-price-by-pax product, Seoul/DMZ area)
 *
 * Submit pushes the answers into the URL of `/itinerary-builder/[region]` so
 * the cart + quote modal read them via `useSearchParams` (D5: URL params carry
 * state). The QuoteModal recomputes the live price from these.
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
  // Travel date is required (drives peak-season pricing + the T-7 booking
  // deadline downstream); party size drives the pax-tier surcharge + vehicle
  // class. Both used to live in QuoteModal — pulled up so the first quote is
  // accurate. QuoteModal still reads them from `?date=` / `?party=`.
  const [date, setDate] = useState<string>(() => searchParams?.get("date") ?? "");
  const [party, setParty] = useState<string>(() => searchParams?.get("party") ?? "2");
  const [dateError, setDateError] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [guideLang, setGuideLang] = useState<string>(() => {
    const initial = searchParams?.get("lang") || locale;
    return GUIDE_LANGS.some((g) => g.code === initial) ? initial : "en";
  });

  // Mount-reveal (NOT scroll-reveal). The shared whileInView container left
  // conditional fields (region / cruise hours / ship) that mount on track
  // change stuck at opacity:0 — they revealed once, never re-fired, and showed
  // as blank gaps. Animating on mount makes the parent's "visible" state
  // propagate to any child that mounts later, so conditional fields appear.
  const reduceMotion = useReducedMotion();
  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: reduceMotion
        ? { duration: 0 }
        : { staggerChildren: 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!date) {
      setDateError(true);
      return;
    }
    const params = new URLSearchParams();
    params.set("track", track);
    params.set("lang", guideLang);
    if (date) params.set("date", date);
    const paxNum = Number(party);
    if (Number.isFinite(paxNum) && paxNum > 0) params.set("party", String(Math.round(paxNum)));
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
    const carriedIntent = searchParams?.get("intent")?.trim();
    if (carriedIntent) params.set("intent", carriedIntent);
    router.push(`/itinerary-builder/${destRegion}?${params.toString()}`);
  }

  return (
    <motion.form
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      {/* Track toggle (private / cruise / DMZ) */}
      <motion.fieldset variants={REVEAL_ITEM_VARIANTS}>
        <legend className={FIELD_LABEL}>{t("trackLegend")}</legend>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: "private", label: t("trackPrivateLabel"), Icon: Car, sub: null },
            { value: "cruise", label: t("trackCruiseLabel"), Icon: Ship, sub: t("trackCruiseSub") },
            { value: "dmz", label: t("trackDmzLabel"), Icon: ShieldAlert, sub: null },
          ]).map(({ value, label, Icon, sub }) => {
            const active = track === value;
            return (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1.5 px-2 py-3 text-center",
                  OPTION_BASE,
                  optionTone(active)
                )}
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
                  className={cn("h-5 w-5 transition-colors duration-200", active ? "text-white" : "text-slate-400")}
                  aria-hidden
                />
                <span className="text-[13px] font-semibold tracking-tight md:text-caption">{label}</span>
                {sub ? (
                  <span
                    className={cn(
                      "text-[10px] font-medium leading-tight tracking-tight",
                      active ? "text-white/70" : "text-slate-400"
                    )}
                  >
                    {sub}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </motion.fieldset>

      {/* Region (hidden for DMZ — it's always the Seoul/DMZ area) */}
      {track !== "dmz" ? (
        <motion.fieldset variants={REVEAL_ITEM_VARIANTS}>
          <legend className={FIELD_LABEL}>{t("regionLegend")}</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["busan", "jeju", "seoul"] as RegionSlug[]).map((r) => {
              const active = region === r;
              return (
                <label
                  key={r}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1.5 px-2 py-3 text-center",
                    OPTION_BASE,
                    optionTone(active)
                  )}
                >
                  <input
                    type="radio"
                    name="region"
                    value={r}
                    checked={active}
                    onChange={() => setRegion(r)}
                    className="sr-only"
                  />
                  <MapPin
                    className={cn("h-4 w-4 transition-colors duration-200", active ? "text-white" : "text-slate-400")}
                    aria-hidden
                  />
                  <span className="text-[13px] font-semibold capitalize tracking-tight md:text-caption">{r}</span>
                </label>
              );
            })}
          </div>
        </motion.fieldset>
      ) : null}

      {/* Guide language — drives the price tier (English vs Chinese/Korean) */}
      <motion.label variants={REVEAL_ITEM_VARIANTS} className="block">
        <span className={FIELD_LABEL}>{t("guideLanguageLegend")}</span>
        <select
          value={guideLang}
          onChange={(e) => setGuideLang(e.target.value)}
          className={cn(INPUT_BASE, "font-semibold")}
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
          <legend className={FIELD_LABEL}>{t("durationLegend")}</legend>
          <p className="mb-2.5 text-micro text-slate-500">{t("durationHint")}</p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 snap-x snap-mandatory scrollbar-none md:flex-wrap md:overflow-visible">
            {PRIVATE_HOURS.map((h) => {
              const active = duration === String(h);
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDuration(String(h))}
                  className={cn(
                    "focus-ring flex-shrink-0 snap-start rounded-full border px-3.5 py-1.5 text-caption font-semibold transition-colors duration-200 ease-out",
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-1"
                      : "border-slate-200/70 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                  )}
                >
                  {h}h
                </button>
              );
            })}
          </div>
        </motion.fieldset>
      ) : null}

      {/* Cruise: hours window */}
      {track === "cruise" ? (
        <motion.fieldset variants={REVEAL_ITEM_VARIANTS}>
          <legend className={FIELD_LABEL}>{t("cruiseHoursLegend")}</legend>
          <p className="mb-2.5 text-micro text-slate-500">{t("cruiseHoursHint")}</p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 snap-x snap-mandatory scrollbar-none md:flex-wrap md:overflow-visible">
            {[4, 6, 8, 10, 12].map((h) => {
              const active = hours === String(h);
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHours(String(h))}
                  className={cn(
                    "focus-ring flex-shrink-0 snap-start rounded-full border px-3.5 py-1.5 text-caption font-semibold transition-colors duration-200 ease-out",
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-1"
                      : "border-slate-200/70 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                  )}
                >
                  {h}h
                </button>
              );
            })}
          </div>
        </motion.fieldset>
      ) : null}

      {/* Cruise: ship name (optional) */}
      {track === "cruise" ? (
        <motion.label variants={REVEAL_ITEM_VARIANTS} className="block">
          <span className={FIELD_LABEL}>
            {t("shipLabel")} <span className="font-normal text-slate-400">{t("optionalSuffix")}</span>
          </span>
          <input
            type="text"
            value={ship}
            onChange={(e) => setShip(e.target.value)}
            placeholder="MS Westerdam, Norwegian Spirit…"
            className={cn(INPUT_BASE, "placeholder:text-slate-400")}
          />
        </motion.label>
      ) : null}

      {/* DMZ: fixed-price note */}
      {track === "dmz" ? (
        <motion.p
          variants={REVEAL_ITEM_VARIANTS}
          className="rounded-button border border-slate-200/70 bg-slate-50 px-3.5 py-3 text-caption leading-relaxed text-slate-600"
        >
          {t("dmzHint")}
        </motion.p>
      ) : null}

      {/* Travel date (required) + party size — both feed the live quote
          (peak-season + pax-tier). Pulled up from QuoteModal. */}
      <motion.div variants={REVEAL_ITEM_VARIANTS} className="space-y-4">
        <div className="block">
          <span className={FIELD_LABEL} id="intake-date-label">
            {t("dateLabel")} <span className="font-normal text-rose-500">*</span>
          </span>
          <IntakeDateField
            id="intake-date"
            value={date}
            onChange={(v) => {
              setDate(v);
              setDateError(false);
            }}
            min={today}
            locale={locale}
            invalid={dateError}
            placeholder={t("dateSelect")}
            todayLabel={t("dateToday")}
            tomorrowLabel={t("dateTomorrow")}
          />
          {dateError ? (
            <span className="mt-1 block text-micro font-medium text-rose-600">
              {t("dateRequired")}
            </span>
          ) : null}
        </div>
        <label className="block">
          <span className={FIELD_LABEL}>{t("partyLabel")}</span>
          <input
            type="number"
            min={1}
            max={30}
            inputMode="numeric"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            placeholder="2"
            className={cn(INPUT_BASE, "max-w-[7.5rem] tabular-nums")}
          />
        </label>
      </motion.div>

      <motion.div variants={REVEAL_ITEM_VARIANTS} className="space-y-2.5 pt-1">
        <button
          type="submit"
          className={cn(homeBtnPrimary, "group inline-flex w-full items-center justify-center gap-2 shadow-1 hover:gap-3")}
        >
          {t("submit")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>

        <p className="inline-flex w-full items-center justify-center gap-1.5 text-center text-micro text-slate-500">
          <Sparkles className="h-3 w-3 text-amber-500" aria-hidden />
          {t("autoQuoteReassurance")}
        </p>
      </motion.div>
    </motion.form>
  );
}
