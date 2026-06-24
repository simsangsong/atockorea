"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, Check, Sparkles, ArrowRight, X } from "lucide-react";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { trackEvent } from "@/src/design/analytics";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

interface Props {
  region: RegionSlug;
  pois: MatchPoiRow[];
  /** Replace the cart with the recommended sequence. Phase 11 D28 made
   *  every match auto-apply via this callback; Phase 13 D38 removed the
   *  separate "Apply this day" CTA and the result preview stripe, leaving
   *  this as the single hand-off into ResultTimeline. */
  onAccept: (poiKeys: string[]) => void;
  /** R4 — surface the matched stops to the map as a preview while the
   *  match is in flight. ResultTimeline takes over after the match
   *  resolves (cart auto-applies). */
  onPreview?: (poiKeys: string[] | null) => void;
  track?: string | null;
  origin?: string | null;
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
// Phase 13 D38 — `formatMinutes` was used by the removed per-POI result
// stripe; ResultTimeline has its own copy in lib/itinerary-builder/distance.

export default function AIRecommendPanel({
  region,
  pois,
  onAccept,
  onPreview,
  track,
  origin,
}: Props) {
  const t = useTranslations("itineraryBuilder.ai");
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  // pois is still accepted for forward-compat with the lifted detail drawer
  // (BuilderShell looks up POI rows by key when the timeline opens one), but
  // AIRecommendPanel itself no longer needs to read the catalog after the
  // result preview stripe was removed in Phase 13 D38.
  void pois;
  const [intent, setIntent] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("intent")?.trim() ?? "",
  );
  // Phase 11 D28 — preset chips are multi-select toggles, not single-fire
  // triggers. Selecting a chip toggles it into the set; running the matcher
  // is a separate explicit click on the CTA.
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The panel is now a slim trigger button; the intent input + example
  // prompts live inside a tap-to-open dialog (user 2026-06-23). A successful
  // match closes the dialog and the itinerary lands in ResultTimeline below.
  const [dialogOpen, setDialogOpen] = useState(false);

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
   * Tracks the last AI-loaded recommendation so we can hide the "Load into
   * cart" CTA when the cart already matches it (avoids a no-op button).
   */
  const lastAcceptedSetRef = useRef<string[]>([]);

  /**
   * Build the combined intent string the matcher will see. Phase 11 D28 —
   * selected preset chips contribute their seed text (joined with " · "),
   * then the user's custom intent text is appended if present.
   */
  function buildCombinedIntent(): string {
    const presetIntents = PRESETS
      .filter((p) => selectedPresets.has(p.key))
      .map((p) => p.intent);
    const customTrimmed = intent.trim();
    const parts = [...presetIntents];
    if (customTrimmed) parts.push(customTrimmed);
    return parts.join(" · ");
  }

  async function runMatch(intentText: string) {
    setError(null);
    onPreview?.(null);
    const trimmed = intentText.trim();
    if (trimmed.length < 2) {
      setError(t("errorMin"));
      return;
    }
    setLoading(true);
    try {
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
        const errorCode = data.error || `HTTP ${res.status}`;
        setError(errorCode);
        trackEvent("itinerary_recommend_failed", {
          region,
          errorCode,
        });
        setLoading(false);
        return;
      }
      setResult(data);
      setDialogOpen(false);
      onPreview?.(data.recommended_pois ?? null);
      if ((data.recommended_pois?.length ?? 0) > 0) {
        const recs = data.recommended_pois!;
        lastAcceptedSetRef.current = recs;
        onAccept(recs);
        trackEvent("itinerary_recommend_succeeded", {
          region,
          poiCount: recs.length,
          totalMinutes: data.total_minutes ?? 0,
        });
        // Phase 12 D34 — smooth-scroll the ResultTimeline into the viewport
        // so the customer SEES the itinerary land. Phase 11 had cart
        // auto-application working but the timeline rendered far below the
        // AI panel; users reported "nothing happens" because the result was
        // offscreen. requestAnimationFrame + 80ms timeout lets React commit
        // the cart-driven re-render before we measure offsets.
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            const el = document.querySelector("[data-result-timeline]") as HTMLElement | null;
            if (!el) return;
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 80);
        }
      } else {
        // Phase 11 audit fix #7 — replaces the Phase-10 auto-run analytics
        // for the empty-result case. Without this ops can't see when the
        // matcher returns ok=true but no POIs (silent no-suggestion).
        trackEvent("itinerary_recommend_empty", {
          region,
        });
      }
    } catch (e) {
      const errorCode = e instanceof Error ? e.message : "request_failed";
      setError(errorCode);
      trackEvent("itinerary_recommend_failed", {
        region,
        errorCode,
      });
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runMatch(buildCombinedIntent());
  }

  function togglePreset(presetKey: string) {
    setSelectedPresets((prev) => {
      const next = new Set(prev);
      if (next.has(presetKey)) next.delete(presetKey);
      else next.add(presetKey);
      return next;
    });
  }

  /**
   * Phase 12 D33 — bounded auto-run.
   *
   * The hero "Build myself" CTA pushes `?autoRun=1` so the matcher fires
   * automatically once the user arrives in the builder section. After
   * firing (whether success or failure), the autoRun param is stripped via
   * `router.replace` so a refresh or any subsequent URL patch does NOT
   * re-fire the matcher. In-builder edits keep Phase 11 D28's "every
   * match is explicit" contract.
   *
   * Gates:
   *  - `?autoRun=1` URL param present
   *  - intent text OR at least one preset selected
   *  - not already loading (in flight)
   *  - hasn't already auto-fired in this mount
   */
  const autoRunFiredRef = useRef(false);
  const autoRunRequested = sp?.get("autoRun") === "1";
  useEffect(() => {
    if (!autoRunRequested) return;
    if (autoRunFiredRef.current) return;
    if (loading) return;
    // Read the intent from the reactive search params (route-consistent)
    // rather than only `buildCombinedIntent()`, whose `intent` state is seeded
    // from `window.location.search` in a useState initializer. On a soft
    // client navigation from the landing planner that seed can be empty,
    // making `combined` < 2 chars so the auto-run silently no-ops and the user
    // has to press the CTA again (the reported bug). The URL `intent` param is
    // always set by the landing build-submit, so prefer it.
    const urlIntent = (sp?.get("intent") ?? "").trim();
    const combined = urlIntent.length >= 2 ? urlIntent : buildCombinedIntent();
    if (combined.trim().length < 2) return;
    autoRunFiredRef.current = true;
    // Strip autoRun from URL so refresh/patch doesn't re-fire.
    const next = new URLSearchParams(sp?.toString() ?? "");
    next.delete("autoRun");
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    void runMatch(combined);
    // runMatch is stable in this component (closure over current state);
    // we only want this to fire once per mount when autoRun is set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunRequested]);

  // Close the dialog on Escape (a11y — mirrors the PlannerTopRail sheet).
  useEffect(() => {
    if (!dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDialogOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen]);

  const recommended = result?.recommended_pois ?? [];
  const totalH = result?.total_minutes
    ? Math.round((result.total_minutes / 60) * 10) / 10
    : 0;
  // Disable the submit until something to feed the matcher exists.
  const combinedReady =
    selectedPresets.size > 0 || intent.trim().length >= 2;
  const hasResult = !!result?.ok && recommended.length > 0;

  return (
    <section className="px-4 pt-4 pb-3 md:px-6 md:pt-5 md:pb-4">
      {/* Slim trigger button (user 2026-06-23) — replaces the big always-open
          card. Tapping opens the dialog with the intent input + example
          prompts. Keeps the Phase 11 D29 near-white mint identity in a
          compact form (emerald icon chip + ring). After a match it shows the
          one-line result summary; tap again to refine. */}
      <button
        type="button"
        onClick={() => {
          setError(null);
          setDialogOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={dialogOpen}
        className="focus-ring group mx-auto flex w-full max-w-3xl items-center gap-3 rounded-card bg-emerald-50/40 px-4 py-3 text-left ring-1 ring-emerald-100/60 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_18px_44px_-24px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(15,23,42,0.06),0_26px_60px_-22px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)]"
      >
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-white text-emerald-600 ring-1 ring-emerald-100">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-caption font-bold text-slate-900">
            {loading
              ? t("submitting")
              : hasResult
                ? t("resultsSummary", { count: recommended.length, hours: totalH })
                : t("triggerTitle")}
          </span>
          <span className="truncate text-micro text-slate-500">
            {hasResult ? t("appliedToTimelineHint") : t("triggerSub")}
          </span>
        </span>
        <ArrowRight
          className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </button>

      {/* Empty-result fallback (match returned ok but no stops) — kept inline
          under the button so the user isn't left without feedback. */}
      {result?.ok && recommended.length === 0 ? (
        <p className="mx-auto mt-2 max-w-3xl rounded-md bg-amber-50 px-3 py-2 text-caption text-amber-800 ring-1 ring-amber-100">
          {result.message || t("noMatchFallback")}
        </p>
      ) : null}

      {/* Dialog — bottom sheet on mobile, centered card on md+. Holds the
          "type anything" guidance + free-text input + example prompt chips. */}
      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-dialog-title"
        >
          <div
            className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
            onClick={() => setDialogOpen(false)}
            aria-hidden
          />
          <form
            onSubmit={onSubmit}
            className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl md:m-4 md:w-auto md:min-w-[26rem] md:max-w-md md:rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
              <span
                id="ai-dialog-title"
                className="inline-flex items-center gap-2 text-caption font-bold text-slate-900"
              >
                <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden />
                {t("dialogTitle")}
              </span>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                aria-label={t("dialogClose")}
                className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <p className="text-caption leading-relaxed text-slate-600">{t("dialogGuide")}</p>

              <textarea
                id="ai-intent"
                rows={3}
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder={t("intentPlaceholder")}
                autoFocus
                className="focus-ring w-full resize-none rounded-button bg-slate-50 px-3.5 py-3 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] transition-shadow duration-200 placeholder:text-slate-400 focus:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)]"
              />

              {/* Example prompts — tap to combine (multi-select). The matcher
                  uses each chip's seed intent; the user's free text is added
                  on top (buildCombinedIntent). */}
              <div>
                <p className="mb-2 text-eyebrow text-slate-500">{t("examplesLabel")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => {
                    const selected = selectedPresets.has(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => togglePreset(p.key)}
                        disabled={loading}
                        aria-pressed={selected}
                        className={cn(
                          "focus-ring inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-micro font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200/70 bg-slate-50 text-slate-700 hover:bg-slate-100",
                        )}
                      >
                        {selected ? <Check className="h-3 w-3" aria-hidden /> : null}
                        {t(`presets.${p.key}`)}
                      </button>
                    );
                  })}
                </div>
                {selectedPresets.size > 0 ? (
                  <p className="mt-2 text-micro text-slate-500">
                    {t("presetsSelectedHint", { count: selectedPresets.size })}
                  </p>
                ) : null}
              </div>

              {error ? (
                <p className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-3 py-2 text-caption font-semibold text-rose-700 ring-1 ring-rose-100">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  {error}
                </p>
              ) : null}
            </div>

            {/* Footer — submit */}
            <div className="border-t border-slate-100 px-5 py-3.5">
              <button
                type="submit"
                disabled={loading || !combinedReady}
                className={cn(
                  homeBtnPrimary,
                  "group !h-auto !w-full !py-3 inline-flex items-center justify-center gap-2 shadow-md hover:gap-3 disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden />
                )}
                {loading ? t("submitting") : t("submit")}
                {!loading ? (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                ) : null}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
