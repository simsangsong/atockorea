"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, Clock, ChevronRight, Sparkles, ArrowRight } from "lucide-react";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
import { cn } from "@/lib/utils";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";
import { useTranslations } from "@/lib/i18n";
import { trackEvent } from "@/src/design/analytics";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

interface Props {
  region: RegionSlug;
  pois: MatchPoiRow[];
  /** Current cart — used by the auto-run gate (Phase 10.4) to decide
   *  whether the AI is still "owning" the cart or the user took over. */
  cart: string[];
  /** Replace the cart with the recommended sequence (auto-load + manual
   *  Apply both route through this). */
  onAccept: (poiKeys: string[]) => void;
  /** R2 — open the shared detail drawer lifted to BuilderShell (RR2/RR-R3).
   *  Map focus is now accessible via the drawer's "See on map" button,
   *  so the old `onFocusPoi` prop has been retired. */
  onOpenDetail?: (poi: MatchPoiRow) => void;
  /** R4 — surface the matched stops to the map as a PREVIEW before the user
   *  presses Apply, so they can see where the suggested stops are. null clears it. */
  onPreview?: (poiKeys: string[] | null) => void;
  track?: string | null;
  origin?: string | null;
}

/** Per-session cap to avoid runaway Haiku spend on misbehaving auto-runs. */
const AUTO_RUN_CAP = 3;
const AUTO_RUN_STORAGE_KEY = "itinerary_auto_run_count";

function readAutoRunCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = window.sessionStorage.getItem(AUTO_RUN_STORAGE_KEY);
    const n = v ? Number(v) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function bumpAutoRunCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const next = readAutoRunCount() + 1;
    window.sessionStorage.setItem(AUTO_RUN_STORAGE_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

/**
 * Shallow ORDERED equal for cart-vs-recommendation comparison. Exported for
 * unit testing — see __tests__/components/itinerary-builder/AIRecommendPanel.gate.test.ts.
 */
export function isSameKeySet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
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
  cart,
  onAccept,
  onOpenDetail,
  onPreview,
  track,
  origin,
}: Props) {
  const t = useTranslations("itineraryBuilder.ai");
  const reveal = useRevealContainerProps();
  const sp = useSearchParams();
  const poiByKey = new Map(pois.map((p) => [p.poi_key, p]));
  const [intent, setIntent] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("intent")?.trim() ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Collapse the form panel once the user has a result. Re-expand when
  // they click the "Get another suggestion" pill (or another preset).
  const [collapsed, setCollapsed] = useState(false);

  /**
   * Phase 10.4 — duration is owned by PlannerTopRail in the URL (`?duration`
   * for private, `?hours` for cruise). The AI's `max_hours` cap was a
   * duplicate control here; we now read the same URL source so the
   * recommendation always respects the trip duration the user picked above.
   */
  const maxHours = (() => {
    const raw = sp?.get("duration") ?? sp?.get("hours") ?? "8";
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 8;
  })();

  /**
   * Phase 10.4 — auto-run guard. The cart "tracks" the AI recommendation by
   * default; once the user manually edits the cart (cart ≠ lastAutoSet) the
   * auto-run goes silent so we don't fight their edits.
   */
  const lastAutoSetRef = useRef<string[]>([]);
  const lastFingerprintRef = useRef<string>("");

  async function runMatch(intentText: string, opts?: { auto?: boolean }) {
    setError(null);
    onPreview?.(null);
    const trimmed = intentText.trim();
    if (trimmed.length < 2) {
      if (!opts?.auto) setError(t("errorMin"));
      return;
    }
    setLoading(true);
    try {
      if (opts?.auto) {
        trackEvent("itinerary_auto_recommend_fired", {
          region,
          duration: maxHours,
          fingerprint: lastFingerprintRef.current,
        });
      }
      const res = await fetch("/api/itinerary/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: trimmed,
          region,
          max_hours: maxHours,
          track,
          origin,
        }),
      });
      const data = (await res.json()) as MatchResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || `HTTP ${res.status}`);
        if (opts?.auto) {
          trackEvent("itinerary_auto_recommend_failed", {
            region,
            errorCode: data.error || `HTTP ${res.status}`,
          });
        }
        setLoading(false);
        return;
      }
      setResult(data);
      setCollapsed(true);
      onPreview?.(data.recommended_pois ?? null);
      // Phase 10.4 — auto-runs load the recommendation directly into the cart
      // (no separate "Apply this day" click). The manual flow also calls
      // onAccept; same `acceptRecommendation` callback in BuilderShell.
      if ((data.recommended_pois?.length ?? 0) > 0) {
        const recs = data.recommended_pois!;
        lastAutoSetRef.current = recs;
        onAccept(recs);
        if (opts?.auto) {
          trackEvent("itinerary_auto_recommend_succeeded", {
            region,
            poiCount: recs.length,
            totalMinutes: data.total_minutes ?? 0,
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "request_failed");
      if (opts?.auto) {
        trackEvent("itinerary_auto_recommend_failed", {
          region,
          errorCode: e instanceof Error ? e.message : "request_failed",
        });
      }
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

  /**
   * Phase 10.4 (4a) — auto-run useEffect.
   *
   * Fires `/api/itinerary/match` automatically when (intent, region, track,
   * maxHours) change AND the cart is either empty OR still matches the last
   * auto-loaded set (i.e., the user hasn't taken over editing). Debounced
   * 500ms. Per-session cap of AUTO_RUN_CAP fires to bound Haiku spend.
   *
   * Dedup fingerprint: changing only the ship name or pickup zone (params
   * the matcher doesn't read) doesn't re-fire.
   */
  useEffect(() => {
    const trimmedIntent = intent.trim();
    if (!trimmedIntent || trimmedIntent.length < 2) return;
    if (loading) return;

    const userOwnsCart = cart.length > 0 && !isSameKeySet(cart, lastAutoSetRef.current);
    if (userOwnsCart) return;

    const fingerprint = `${region}|${track ?? ""}|${maxHours}|${trimmedIntent.toLowerCase()}`;
    if (fingerprint === lastFingerprintRef.current) return;

    if (readAutoRunCount() >= AUTO_RUN_CAP) {
      trackEvent("itinerary_auto_recommend_exceeded", {
        region,
        cap: AUTO_RUN_CAP,
      });
      return;
    }

    const timer = window.setTimeout(() => {
      lastFingerprintRef.current = fingerprint;
      bumpAutoRunCount();
      void runMatch(trimmedIntent, { auto: true });
    }, 500);

    return () => window.clearTimeout(timer);
    // runMatch reads region/track/origin/maxHours via closure — we depend on
    // their primitive values, not on the function identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, region, track, maxHours, cart]);

  const recommended = result?.recommended_pois ?? [];
  const totalH = result?.total_minutes
    ? Math.round((result.total_minutes / 60) * 10) / 10
    : 0;
  /** Hide the "Apply this day" CTA when the cart already matches the
   *  recommendation (auto-run flow); manual flow can still see + use it. */
  const cartMatchesResult = recommended.length > 0 && isSameKeySet(cart, recommended);

  return (
    <section className="px-4 pt-4 pb-3 md:px-6 md:pt-5 md:pb-4">
      <motion.div
        {...reveal}
        className="relative mx-auto max-w-3xl overflow-hidden rounded-card bg-emerald-50/50 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_24px_56px_-22px_rgba(15,23,42,0.22)] transition-shadow duration-300 ease-out hover:shadow-[0_4px_14px_rgba(15,23,42,0.06),0_32px_72px_-22px_rgba(15,23,42,0.28)]"
      >
        {/* Header — Sparkles eyebrow (landing convention), but the amber
            accent moves to the icon only so the eyebrow text stays neutral
            slate. No yellow tint on surfaces or borders anywhere on this
            card. */}
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="px-5 pt-5 pb-3 md:px-6 md:pt-6">
          <p className="mb-2 inline-flex items-center gap-1.5 text-eyebrow text-slate-500">
            <Sparkles className="h-3 w-3 text-emerald-600" aria-hidden />
            {t("eyebrow")}
          </p>
          {!collapsed ? (
            <p className="text-body leading-relaxed text-slate-600">{t("intro")}</p>
          ) : null}
        </motion.div>

        {/* Collapsed mode — show "Get another suggestion" pill */}
        {collapsed && !loading ? (
          <div className="border-t border-slate-100 px-5 py-3 md:px-6">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-micro font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_6px_-2px_rgba(15,23,42,0.10)] transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_8px_18px_-4px_rgba(15,23,42,0.16)]"
            >
              <Sparkles className="h-3 w-3 text-emerald-600" aria-hidden />
              {t("getAnother")}
            </button>
          </div>
        ) : (
          <>
            {/* Preset chips — premium white-surface pills, amber hover hint */}
            <motion.div variants={REVEAL_ITEM_VARIANTS} className="px-5 pb-3 md:px-6">
              <p className="mb-2 text-micro font-semibold uppercase tracking-wider text-slate-500">
                {t("presetsLabel")}
              </p>
              <div className="-mx-1 flex flex-wrap gap-1.5 px-1 pb-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handlePreset(p.intent)}
                    disabled={loading}
                    className="focus-ring inline-flex items-center rounded-full bg-white px-3 py-1.5 text-micro font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_6px_-2px_rgba(15,23,42,0.08)] transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_8px_18px_-4px_rgba(15,23,42,0.14)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:hover:translate-y-0"
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
                  className="focus-ring w-full rounded-button bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.04)] transition-shadow duration-200 placeholder:text-slate-400 focus:shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_0_0_1px_rgba(15,23,42,0.08)]"
                />
              </div>
              {/* Phase 10.4 — hours select removed; PlannerTopRail's
                  duration/hours field is the single source. The recommendation
                  caps at the same value so the AI never proposes a day longer
                  than the trip the user picked. */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  homeBtnPrimary,
                  "group !h-auto !w-full !py-3 inline-flex items-center justify-center gap-2 shadow-md hover:gap-3 md:!w-auto md:!px-6 md:!py-2.5",
                )}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                {loading ? t("submitting") : t("submit")}
                {!loading ? <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden /> : null}
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
            className="border-t border-slate-100 bg-white px-5 py-4 md:px-6"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-caption font-bold text-slate-900">
                {t("resultsSummary", { count: recommended.length, hours: totalH })}
              </p>
              {/* Phase 10.4 — Apply CTA hidden when the cart already matches
                  the recommendation (auto-run flow). Still shown for the rare
                  case where the user manually re-ran but didn't accept. */}
              {!cartMatchesResult ? (
                <button
                  type="button"
                  onClick={() => {
                    lastAutoSetRef.current = recommended;
                    onAccept(recommended);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-micro font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
                >
                  {t("loadIntoCart")}
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
            </div>
            {/* R2 — large card stack (preview / Apply variant).
                No drag, no remove. Tap card → shared POIDetailModal via
                onOpenDetail (lifted to BuilderShell). Sequence amber node
                sits on the relative <li> so overflow-hidden on the card
                button does not clip it. Rationale labels inside card footer.
                V5: amber = sequence only; V4: no bi-sync needed here (map
                focus available via drawer's focus button). RR6: previewHint
                i18n'd via translate-itinerary-builder-messages.mjs. */}
            <ol className="relative space-y-2.5 pl-9">
              {/* Subtle slate connector — same tour-detail timeline language
                  as ResultTimeline so the suggestion reads as a preview of the
                  day. Amber sequence identity lives on the map photo-pins. */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-[17px] top-5 bottom-5 w-px bg-slate-200"
              />
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
                    {/* White/slate sequence node in the left gutter — tour-detail
                        parity (amber sequence identity now lives on the map). */}
                    <span
                      aria-hidden
                      className="absolute -left-9 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-medium tabular-nums tracking-[0.04em] text-slate-600 ring-1 ring-white"
                      style={{
                        background: "#ffffff",
                        boxShadow:
                          "0 1px 2px rgba(15,23,42,0.06), 0 4px 12px -4px rgba(15,23,42,0.10), inset 0 0.5px 0 rgba(255,255,255,0.9)",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    {/* Card body — tap opens shared detail drawer (RR2). */}
                    <button
                      type="button"
                      onClick={() => { if (poi && onOpenDetail) onOpenDetail(poi); }}
                      className="group block w-full overflow-hidden rounded-2xl bg-white text-left ring-1 ring-slate-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-2px_rgba(15,23,42,0.06)] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_8px_20px_-4px_rgba(15,23,42,0.10)] motion-reduce:transition-none"
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
