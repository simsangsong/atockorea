"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2, AlertCircle, Clock, ChevronRight } from "lucide-react";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";
import { useTranslations } from "@/lib/i18n";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

interface Props {
  region: RegionSlug;
  pois: MatchPoiRow[];
  onAccept: (poiKeys: string[]) => void;
  /** R2 — open the shared detail drawer lifted to BuilderShell (RR2/RR-R3).
   *  Map focus is now accessible via the drawer's "See on map" button,
   *  so the old `onFocusPoi` prop has been retired. */
  onOpenDetail?: (poi: MatchPoiRow) => void;
  track?: string | null;
  origin?: string | null;
}

interface MatchResponse {
  ok: boolean;
  region?: string;
  recommended_pois?: string[];
  per_poi_score?: { poi_key: string; name_en: string; total: number; rationale?: string[] }[];
  total_drive_min?: number;
  total_stay_min?: number;
  total_minutes?: number;
  message?: string;
  error?: string;
}

// V2 redesign Phase 6 — 5 preset chips that fill intent + auto-submit.
// Keys map to `itineraryBuilder.ai.presets.*` i18n; values are the
// untranslated English seed text we send to the matcher (the backend
// matches on free-text intent, not the localized label).
const PRESETS: { key: string; intent: string }[] = [
  { key: "firstTime", intent: "first-time highlights, iconic must-see landmarks, balanced pace" },
  { key: "family", intent: "family with kids, easy walking, stroller friendly, no hiking" },
  { key: "unesco", intent: "UNESCO heritage, history, temples and culture" },
  { key: "foodie", intent: "foodie day, traditional markets, seafood and street food" },
  { key: "beachesCafes", intent: "beaches, ocean views, cafes, relaxed pace" },
];

/**
 * V2 redesign Phase 6 — AI matcher evolved.
 * R2 (2026-05-21): result stripe upgraded from badge horizontal-scroll chips
 * to the R1 large card stack (compose photo strip + sequence node + header +
 * rationale pills). No drag/remove — preview-only. Tap card → shared
 * POIDetailModal via onOpenDetail lifted to BuilderShell. "Apply this day"
 * CTA kept. Sequence amber nodes obey V5 amber discipline.
 *
 * Layout changes from earlier phases:
 *   • Gradient amber card → plain `bg-white ring-slate-200` (aligns
 *     with the rest of the rail; V5 amber discipline).
 *   • New preset chip row reduces blank-page friction — clicking a
 *     chip fills the intent input + auto-submits.
 *   • After a successful match, the input form collapses to a small
 *     "✨ Get another suggestion" pill. Clicking re-expands. The
 *     result stripe (large preview cards + Apply day CTA) renders
 *     inline so it visually reads as the prequel to the timeline below.
 */
/** Format stay minutes into a compact string, e.g. 90 → "1h 30m", 45 → "45m". */
function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function AIRecommendPanel({
  region,
  pois,
  onAccept,
  onOpenDetail,
  track,
  origin,
}: Props) {
  const t = useTranslations("itineraryBuilder.ai");
  const reveal = useRevealContainerProps();
  const poiByKey = new Map(pois.map((p) => [p.poi_key, p]));
  const [intent, setIntent] = useState("");
  const [maxHours, setMaxHours] = useState(8);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Collapse the form panel once the user has a result. Re-expand when
  // they click the "Get another suggestion" pill (or another preset).
  const [collapsed, setCollapsed] = useState(false);

  // Unified planner Phase 4 — prefill the intent input from the URL when the
  // user arrives from the home planner's "Build" mode (`?intent=...`). Read
  // client-side after mount so the ISR-static page stays cacheable and there
  // is no SSR hydration mismatch. Prefill ONLY — never auto-submit (avoids
  // surprise API spend and a jarring auto-result on arrival).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const carried = new URLSearchParams(window.location.search).get("intent");
    if (carried && carried.trim()) {
      setIntent((prev) => (prev ? prev : carried.trim()));
    }
  }, []);

  async function runMatch(intentText: string) {
    setError(null);
    setResult(null);
    if (intentText.trim().length < 2) {
      setError(t("errorMin"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/itinerary/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: intentText.trim(),
          region,
          max_hours: maxHours,
          track,
          origin,
        }),
      });
      const data = (await res.json()) as MatchResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      setResult(data);
      setCollapsed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request_failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runMatch(intent);
  }

  function handlePreset(presetIntent: string) {
    setIntent(presetIntent);
    // Re-run from a preset always re-opens the form briefly then
    // collapses after match returns.
    setCollapsed(false);
    void runMatch(presetIntent);
  }

  const recommended = result?.recommended_pois ?? [];
  const totalH = result?.total_minutes
    ? Math.round((result.total_minutes / 60) * 10) / 10
    : 0;

  return (
    <section className="px-4 pt-4 pb-3 md:px-6 md:pt-5 md:pb-4">
      <motion.div
        {...reveal}
        className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.28)] backdrop-blur-md"
      >
        {/* Header — always visible */}
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="px-5 pt-5 pb-3 md:px-6 md:pt-5">
          <p className="mb-2 inline-flex items-center gap-1.5 text-eyebrow text-amber-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("eyebrow")}
          </p>
          {!collapsed ? (
            <p className="text-body text-slate-600">{t("intro")}</p>
          ) : null}
        </motion.div>

        {/* Collapsed mode — show "Get another suggestion" pill */}
        {collapsed && !loading ? (
          <div className="border-t border-slate-100 px-5 py-3 md:px-6">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-micro font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors duration-200 ease-out hover:bg-white hover:ring-slate-300"
            >
              <Sparkles className="h-3 w-3 text-amber-600" aria-hidden />
              {t("getAnother")}
            </button>
          </div>
        ) : (
          <>
            {/* Preset chips */}
            <motion.div
              variants={REVEAL_ITEM_VARIANTS}
              className="px-5 pb-2 md:px-6"
            >
              <p className="mb-2 text-micro font-semibold uppercase tracking-wide text-slate-500">
                {t("presetsLabel")}
              </p>
              <div className="-mx-1 flex flex-wrap gap-1.5 px-1 pb-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handlePreset(p.intent)}
                    disabled={loading}
                    className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-micro font-semibold text-amber-800 ring-1 ring-amber-100 transition-colors duration-150 ease-out hover:bg-amber-100 hover:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t(`presets.${p.key}`)}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Custom intent input + submit */}
            <motion.form
              variants={REVEAL_ITEM_VARIANTS}
              onSubmit={onSubmit}
              className="flex flex-col gap-3 px-5 pb-5 md:flex-row md:items-end md:gap-3 md:px-6 md:pb-6"
            >
              <div className="flex-1">
                <label htmlFor="ai-intent" className="mb-1.5 block text-caption font-semibold text-slate-700">
                  {t("intentLabel")}
                </label>
                <input
                  id="ai-intent"
                  type="text"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder={t("intentPlaceholder")}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>
              <label className="md:w-24">
                <span className="mb-1.5 block text-caption font-semibold text-slate-700">
                  {t("hoursLabel")}
                </span>
                <select
                  value={maxHours}
                  onChange={(e) => setMaxHours(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                >
                  {[4, 6, 8, 10, 12].map((h) => (
                    <option key={h} value={h}>{h}h</option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-caption font-bold text-slate-900 shadow-sm ring-1 ring-slate-300 transition-colors duration-200 ease-out hover:bg-slate-50 hover:ring-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 md:w-auto"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-4 w-4 text-amber-600" aria-hidden />
                )}
                {loading ? t("submitting") : t("submit")}
              </button>
            </motion.form>
          </>
        )}

        {/* Error banner */}
        {error ? (
          <div className="border-t border-slate-100 px-5 py-3 md:px-6">
            <p className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-3 py-2 text-caption font-semibold text-rose-700 ring-1 ring-rose-100">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              {error}
            </p>
          </div>
        ) : null}

        {/* Result stripe — renders inline so it visually reads as the
            prequel to the timeline below (BuilderShell DOM order:
            AI panel → ResultTimeline, so this stripe sits ABOVE the
            timeline's first card). */}
        {result?.ok && recommended.length > 0 ? (
          <motion.div
            variants={REVEAL_ITEM_VARIANTS}
            initial="hidden"
            animate="visible"
            className="border-t border-amber-100 bg-amber-50/40 px-5 py-4 md:px-6"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-caption font-bold text-slate-900">
                {t("resultsSummary", { count: recommended.length, hours: totalH })}
              </p>
              <button
                type="button"
                onClick={() => onAccept(recommended)}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1.5 text-micro font-bold text-white shadow-sm transition-colors hover:bg-amber-600"
              >
                {t("loadIntoCart")}
                <ChevronRight className="h-3 w-3" aria-hidden />
              </button>
            </div>
            {/* R2 — large card stack (preview / Apply variant).
                No drag, no remove. Tap card → shared POIDetailModal via
                onOpenDetail (lifted to BuilderShell). Sequence amber node
                sits on the relative <li> so overflow-hidden on the card
                button does not clip it. Rationale labels inside card footer.
                V5: amber = sequence only; V4: no bi-sync needed here (map
                focus available via drawer's focus button). RR6: previewHint
                i18n'd via translate-itinerary-builder-messages.mjs. */}
            <ol className="flex flex-col gap-2.5">
              {(result.per_poi_score ?? []).map((p, i) => {
                const poi = poiByKey.get(p.poi_key) ?? null;
                const photos =
                  Array.isArray(poi?.images) && poi!.images!.length > 0
                    ? (poi!.images as string[])
                    : poi?.default_image_url
                    ? [poi.default_image_url]
                    : [];
                return (
                  <li key={p.poi_key} className="relative">
                    {/* Amber sequence node — on <li> (relative), above card
                        button's overflow-hidden boundary (V5 amber = sequence
                        identity only). */}
                    <span
                      aria-hidden
                      className="absolute left-3 top-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold leading-none text-white ring-2 ring-white shadow-sm"
                    >
                      {i + 1}
                    </span>

                    {/* Card body — tap opens shared detail drawer (RR2). */}
                    <button
                      type="button"
                      onClick={() => { if (poi && onOpenDetail) onOpenDetail(poi); }}
                      className="group block w-full overflow-hidden rounded-2xl bg-white text-left ring-1 ring-slate-200/70 shadow-[0_4px_14px_-6px_rgba(15,23,42,0.16)] transition-shadow duration-200 ease-out hover:shadow-[0_8px_22px_-8px_rgba(15,23,42,0.24)]"
                    >
                      {/* Compose photo strip */}
                      {photos.length > 0 ? (
                        <div className="flex gap-1.5 overflow-x-auto px-3 pb-1.5 pt-3 scrollbar-hide">
                          {photos.map((src, pi) => (
                            <span
                              key={`${src}-${pi}`}
                              className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-900/5"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={src}
                                alt=""
                                width={80}
                                height={56}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex px-3 pb-1.5 pt-3">
                          <span className="flex h-14 w-20 items-center justify-center rounded-md bg-slate-100 text-2xl font-bold text-slate-300 ring-1 ring-slate-900/5">
                            {(poi?.name_en?.[0] ?? p.name_en?.[0] ?? "?").toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Header: duration + name + category + chevron */}
                      <div className="px-3.5 pb-3 pt-2">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0 flex-1">
                            {poi?.default_stay_minutes ? (
                              <div className="flex items-center gap-1 text-micro text-slate-500">
                                <Clock className="h-3 w-3" aria-hidden />
                                <span className="tabular-nums">
                                  {formatMinutes(poi.default_stay_minutes)}
                                </span>
                              </div>
                            ) : null}
                            <h3 className="mt-1 truncate text-caption font-semibold leading-snug tracking-tight text-slate-900">
                              {poi?.name_en ?? p.name_en}
                            </h3>
                            {poi?.name_ko ? (
                              <p className="mt-0.5 truncate text-micro text-slate-500">
                                {poi.name_ko}
                              </p>
                            ) : null}
                            {poi?.category ? (
                              <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                {poi.category}
                              </p>
                            ) : null}
                          </div>
                          <ChevronRight
                            className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-slate-600"
                            aria-hidden
                          />
                        </div>
                        {/* Rationale pills — slate (not amber), V5 compliant */}
                        {p.rationale && p.rationale.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.rationale.slice(0, 3).map((label) => (
                              <span
                                key={`${p.poi_key}-${label}`}
                                className="rounded-full bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-500 ring-1 ring-slate-200"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-micro text-slate-500">{t("previewHint")}</p>
          </motion.div>
        ) : result?.ok && recommended.length === 0 ? (
          <div className="border-t border-slate-100 px-5 py-3 md:px-6">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-caption text-amber-800 ring-1 ring-amber-100">
              {result.message || t("noMatchFallback")}
            </p>
          </div>
        ) : null}
      </motion.div>
    </section>
  );
}
