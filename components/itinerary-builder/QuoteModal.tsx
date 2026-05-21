"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, X, Loader2, Mail, Sparkles, ImageIcon, Info } from "lucide-react";
import { useTranslations, useI18n } from "@/lib/i18n";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import {
  quote,
  tierForLocale,
  jejuZone,
  type JejuPickupZone,
  type PriceLine,
  type PricingTrack,
} from "@/lib/quote-engine/pricing-policy";

interface Props {
  open: boolean;
  onClose: () => void;
  cart: string[];
  region: RegionSlug;
  pois?: MatchPoiRow[];
}

const GUIDE_LANGS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文 (简体)" },
  { code: "zh-TW", label: "中文 (繁體)" },
  { code: "es", label: "Español" },
];
const DURATION_HOURS = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const PICKUP_ZONES: JejuPickupZone[] = ["city", "north", "outer", "cross_island"];
const KRW = (n: number) => `₩${n.toLocaleString()}`;

/**
 * Custom-quote modal with a LIVE price (Phase 9). The price is computed
 * client-side by the SAME `lib/quote-engine/pricing-policy` module the server
 * recomputes at submit, so what the customer sees is what gets quoted.
 *
 * Controls that drive the price (guide language, duration, party size, Jeju
 * pickup zone) live here; the cart's regions/coordinates supply the
 * sub-region + Jeju cross-region surcharges. Solati groups (10-13) disable
 * the 4h/5h durations (§2). DMZ is a fixed-price-by-pax product.
 */
export default function QuoteModal({ open, onClose, cart, region, pois }: Props) {
  const t = useTranslations("itineraryBuilder.quote");
  const { locale } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();

  const track = (searchParams?.get("track") as PricingTrack) || "private";
  const isDmz = track === "dmz";
  const initialDate = searchParams?.get("date") ?? "";
  const initialParty = searchParams?.get("party") ?? "";
  const initialLang = searchParams?.get("lang") ?? "";
  const initialDuration = searchParams?.get("duration") ?? searchParams?.get("hours") ?? "8";
  const initialShip = searchParams?.get("ship") ?? "";
  const initialPickup = (searchParams?.get("pickup") as JejuPickupZone) ?? "city";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(initialDate);
  const [party, setParty] = useState(initialParty);
  const [guideLang, setGuideLang] = useState(
    GUIDE_LANGS.some((g) => g.code === initialLang) ? initialLang : locale
  );
  const [duration, setDuration] = useState(initialDuration);
  const [pickup, setPickup] = useState<JejuPickupZone>(
    PICKUP_ZONES.includes(initialPickup) ? initialPickup : "city"
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paxNum = party && Number(party) > 0 ? Math.round(Number(party)) : 2;
  const durationNum = Number(duration) > 0 ? Number(duration) : 8;
  const isSolati = paxNum >= 10 && paxNum <= 13;

  // Solati (10-13 pax) needs ≥6h — bump the selection if it's too short (§2).
  useEffect(() => {
    if (isSolati && Number(duration) < 6) setDuration("6");
  }, [isSolati, duration]);

  // Cart POIs → sub-region tags + Jeju zones for the surcharge inputs.
  const cartPois = useMemo(() => {
    if (!pois) return [];
    const byKey = new Map(pois.map((p) => [p.poi_key, p]));
    return cart.map((k) => byKey.get(k)).filter((p): p is MatchPoiRow => !!p);
  }, [cart, pois]);

  const price = useMemo(() => {
    const poiRegions = cartPois.map((p) => p.region);
    const jejuPoiZones =
      region === "jeju" ? cartPois.map((p) => jejuZone(p.lat, p.lng)) : undefined;
    return quote({
      track,
      region,
      guideLanguageTier: tierForLocale(guideLang),
      durationHours: durationNum,
      pax: paxNum,
      requestedDate: date || null,
      jejuPickupZone: region === "jeju" ? pickup : null,
      poiRegions,
      jejuPoiZones,
    });
  }, [track, region, guideLang, durationNum, paxNum, date, pickup, cartPois]);

  const cartThumbs = useMemo(() => cartPois.slice(0, 5), [cartPois]);
  const cartOverflow = Math.max(0, cartPois.length - cartThumbs.length);

  if (!open) return null;

  // Human label for a price line (localized).
  function lineLabel(line: PriceLine): string {
    const meta = line.meta ?? {};
    switch (line.code) {
      case "base":
        return t("pricing.lines.base", { hours: Number(meta.hours ?? durationNum) });
      case "pax_tier":
        if (meta.vehicle === "van") return t("pricing.lines.van");
        return meta.peak ? t("pricing.lines.solatiPeak") : t("pricing.lines.solati");
      case "region":
        return t("pricing.lines.region");
      case "jeju_cross_region":
        return t("pricing.lines.jejuCrossRegion");
      case "jeju_pickup":
        return t("pricing.lines.jejuPickup", { zone: t(`pricing.pickupZones.${meta.zone ?? "city"}`) });
      case "dmz_base":
        return t("pricing.lines.dmzBase", { pax: Number(meta.pax ?? paxNum) });
      default:
        return line.code;
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError(t("errorEmailRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        poi_keys: cart,
        region,
        track,
        guide_language: guideLang,
        duration_hours: isDmz ? undefined : durationNum,
        party_size: party ? Number(party) : null,
        jeju_pickup_zone: region === "jeju" && !isDmz ? pickup : undefined,
        requested_date: date || null,
        contact_email: email.trim(),
        contact_name: name.trim() || null,
        language: guideLang,
        notes: notes.trim() || null,
        locale,
        intake: {
          ...(initialShip ? { ship: initialShip } : {}),
          ...(track === "cruise" ? { hours: durationNum } : {}),
        },
        source_url: typeof window !== "undefined" ? window.location.href : null,
      };
      const res = await fetch("/api/itinerary/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || t("errorGeneric"));
        setSubmitting(false);
        return;
      }
      router.push(`/itinerary-builder/thanks?quote_id=${encodeURIComponent(data.quote_id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200";

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6"
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
          onClick={() => !submitting && onClose()}
          aria-hidden
        />
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 max-h-[92vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl md:rounded-2xl"
        >
          {/* Hero — gradient identity shared with /thanks auto-quote variant */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 px-5 py-4 md:px-6 md:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 inline-flex items-center gap-1.5 text-eyebrow text-amber-300">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {t("eyebrow")}
                </p>
                <h2 className="text-h3 text-white">{t("title")}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                aria-label={t("close")}
                className="flex-shrink-0 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="max-h-[calc(92vh-88px)] space-y-4 overflow-y-auto p-5 md:p-6">
            {/* Cart thumbnail strip (skipped for DMZ — fixed itinerary) */}
            {!isDmz && cartThumbs.length > 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
                <p className="mb-2 text-eyebrow !text-slate-500">{t("cartHeader")}</p>
                <ul className="flex items-center gap-1.5">
                  {cartThumbs.map((p) => {
                    const img = p.default_image_url || p.images?.[0] || null;
                    return (
                      <li
                        key={p.poi_key}
                        title={p.name_en}
                        className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-slate-100 ring-2 ring-white"
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="absolute inset-0 m-auto h-3 w-3 text-slate-400" aria-hidden />
                        )}
                      </li>
                    );
                  })}
                  {cartOverflow > 0 ? (
                    <li className="ml-1 text-micro font-semibold text-slate-500">
                      {t("andNMore", { n: cartOverflow })}
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {/* ── Pricing controls ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-caption font-semibold text-slate-700">
                  {t("guideLanguageLabel")}
                </span>
                <select value={guideLang} onChange={(e) => setGuideLang(e.target.value)} className={inputCls}>
                  {GUIDE_LANGS.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-caption font-semibold text-slate-700">{t("partyLabel")}</span>
                <input
                  type="number"
                  min={1}
                  max={isDmz ? 28 : 30}
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  placeholder="2"
                  className={inputCls}
                />
              </label>
            </div>

            {/* Tour duration (private/cruise only) */}
            {!isDmz ? (
              <label className="block">
                <span className="mb-1.5 block text-caption font-semibold text-slate-700">
                  {t("durationLabel")}
                </span>
                <select value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls}>
                  {DURATION_HOURS.map((h) => (
                    <option key={h} value={h} disabled={isSolati && h < 6}>
                      {t("hoursOption", { hours: h })}
                      {isSolati && h < 6 ? ` — ${t("solatiUnavailable")}` : ""}
                    </option>
                  ))}
                </select>
                {isSolati ? <p className="mt-1 text-micro text-amber-700">{t("pricing.solatiMinHint")}</p> : null}
              </label>
            ) : null}

            {/* Jeju pickup zone */}
            {region === "jeju" && !isDmz ? (
              <label className="block">
                <span className="mb-1.5 block text-caption font-semibold text-slate-700">
                  {t("pickupLabel")}
                </span>
                <select
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value as JejuPickupZone)}
                  className={inputCls}
                >
                  {PICKUP_ZONES.map((z) => (
                    <option key={z} value={z}>
                      {t(`pricing.pickupZones.${z}`)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {/* ── Live price card ───────────────────────────────────────── */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="mb-2.5 inline-flex items-center gap-1.5 text-eyebrow !text-amber-800">
                <Sparkles className="h-3 w-3" aria-hidden />
                {t("pricing.title")}
              </p>
              {price.autoQuotable ? (
                <>
                  <ul className="space-y-1.5">
                    {price.lines.map((line) => (
                      <li key={line.code} className="flex items-baseline justify-between gap-3 text-caption">
                        <span className="text-slate-600">{lineLabel(line)}</span>
                        <span className="font-semibold text-slate-800 tabular-nums">{KRW(line.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2.5 flex items-baseline justify-between border-t border-amber-200 pt-2.5">
                    <span className="text-caption font-bold text-slate-900">{t("pricing.total")}</span>
                    <span className="text-h3 font-bold text-slate-900 tabular-nums">{KRW(price.total)}</span>
                  </div>
                  <p className="mt-1.5 text-micro text-slate-500">{t("pricing.estimateNote")}</p>
                </>
              ) : (
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" aria-hidden />
                  <div>
                    <p className="text-caption font-bold text-slate-800">{t("pricing.manualTitle")}</p>
                    <p className="mt-0.5 text-micro text-slate-600">{t("pricing.manualNote")}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Not-included + Jeju single-region notices (§5, §6) */}
            <div className="space-y-1.5 rounded-lg bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200">
              <p className="flex items-start gap-1.5 text-micro text-slate-600">
                <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" aria-hidden />
                {t("pricing.notIncluded")}
              </p>
              {region === "jeju" ? (
                <p className="flex items-start gap-1.5 text-micro text-slate-600">
                  <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" aria-hidden />
                  {t("pricing.jejuSingleRegion")}
                </p>
              ) : null}
            </div>

            {/* ── Contact ───────────────────────────────────────────────── */}
            <label className="block">
              <span className="mb-1.5 block text-caption font-semibold text-slate-700">{t("nameLabel")}</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputCls} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-caption font-semibold text-slate-700">
                {t("emailLabel")} <span className="text-rose-600">*</span>
              </span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputCls} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-caption font-semibold text-slate-700">{t("dateLabel")}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-caption font-semibold text-slate-700">{t("notesLabel")}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={t("notesPlaceholder")}
                className={`${inputCls} placeholder:text-slate-300`}
              />
            </label>

            {error ? (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 ring-1 ring-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" aria-hidden />
                <p className="text-caption font-semibold text-rose-700">{error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || (!isDmz && cart.length === 0)}
              className={`${homeBtnPrimary} inline-flex items-center justify-center gap-2 shadow-md disabled:cursor-not-allowed disabled:bg-slate-300 ${submitting ? "opacity-90" : ""}`}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
              {submitting ? t("submitting") : t("submit")}
            </button>
            <p className="text-center text-micro text-slate-500">{t("responseHint")}</p>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
