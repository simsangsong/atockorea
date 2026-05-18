"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2, AlertCircle, ImageIcon } from "lucide-react";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

interface Props {
  region: RegionSlug;
  pois: MatchPoiRow[];
  onAccept: (poiKeys: string[]) => void;
  onFocusPoi?: (poiKey: string) => void;
}

interface MatchResponse {
  ok: boolean;
  region?: string;
  recommended_pois?: string[];
  per_poi_score?: { poi_key: string; name_en: string; total: number }[];
  total_drive_min?: number;
  total_stay_min?: number;
  total_minutes?: number;
  message?: string;
  error?: string;
}

/**
 * AI recommendation panel — sits above the map on /itinerary-builder/[region].
 * User types intent → /api/itinerary/match → recommended POI list →
 * "Load into cart" replaces the cart with the recommended sequence.
 */
export default function AIRecommendPanel({ region, pois, onAccept, onFocusPoi }: Props) {
  const reveal = useRevealContainerProps();
  const poiByKey = new Map(pois.map((p) => [p.poi_key, p]));
  const [intent, setIntent] = useState("");
  const [maxHours, setMaxHours] = useState(8);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (intent.trim().length < 2) {
      setError("Tell us a little more about your trip.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/itinerary/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: intent.trim(), region, max_hours: maxHours }),
      });
      const data = (await res.json()) as MatchResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request_failed");
    } finally {
      setLoading(false);
    }
  }

  const recommended = result?.recommended_pois ?? [];
  const totalH = result?.total_minutes ? Math.round((result.total_minutes / 60) * 10) / 10 : 0;

  return (
    <section className="bg-slate-50 px-4 pt-5 pb-3 md:px-6 md:pt-7 md:pb-4">
      <motion.div
        {...reveal}
        className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-white to-white shadow-md ring-1 ring-amber-100"
      >
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="px-5 pt-5 pb-3 md:px-7 md:pt-6">
          <p className="mb-3 inline-flex items-center gap-1.5 text-eyebrow">
            <Sparkles className="h-4 w-4" aria-hidden />
            Let AI suggest your day
          </p>
          <p className="text-body text-slate-600">
            Tell us what you like — UNESCO, beaches, cafes, family-friendly — and we&apos;ll
            sequence a route from the curated stops above.
          </p>
        </motion.div>

        <motion.form
          variants={REVEAL_ITEM_VARIANTS}
          onSubmit={onSubmit}
          className="flex flex-col gap-3 px-5 pb-5 md:flex-row md:items-end md:gap-3 md:px-7 md:pb-7"
        >
          <div className="flex-1">
            <label htmlFor="ai-intent" className="mb-1.5 block text-caption font-semibold text-slate-700">
              Your interests
            </label>
            <input
              id="ai-intent"
              type="text"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="e.g. first time, family, UNESCO + beaches, relaxed pace"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <label className="md:w-24">
            <span className="mb-1.5 block text-caption font-semibold text-slate-700">Hours</span>
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {loading ? "Matching…" : "Recommend"}
          </button>
        </motion.form>

        {error ? (
          <div className="border-t border-amber-100 px-5 py-3 md:px-7">
            <p className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-3 py-2 text-caption font-semibold text-rose-700 ring-1 ring-rose-100">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              {error}
            </p>
          </div>
        ) : null}

        {result?.ok && recommended.length > 0 ? (
          <motion.div
            variants={REVEAL_ITEM_VARIANTS}
            initial="hidden"
            animate="visible"
            className="border-t border-amber-100 bg-white/60 px-5 py-4 md:px-7"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-caption font-bold text-slate-900">
                {recommended.length} stops matched · ~{totalH}h day
              </p>
              <button
                type="button"
                onClick={() => onAccept(recommended)}
                className="rounded-full bg-amber-500 px-4 py-1.5 text-caption font-bold text-white shadow-sm transition-colors hover:bg-amber-600"
              >
                Load into cart
              </button>
            </div>
            <ol className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1 snap-x snap-mandatory scrollbar-hide md:flex-wrap md:overflow-visible">
              {(result.per_poi_score ?? []).map((p, i) => {
                const poi = poiByKey.get(p.poi_key);
                const img = poi?.default_image_url || poi?.images?.[0] || null;
                return (
                  <li key={p.poi_key} className="flex-shrink-0 snap-start">
                    <button
                      type="button"
                      onClick={() => onFocusPoi?.(p.poi_key)}
                      title="See on map"
                      className="group flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 ring-1 ring-slate-200 transition-all duration-200 ease-out hover:bg-amber-50 hover:ring-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <span className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-slate-100">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="absolute inset-0 m-auto h-4 w-4 text-slate-400" aria-hidden />
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white shadow-sm ring-1 ring-white">
                          {i + 1}
                        </span>
                      </span>
                      <span className="text-micro font-semibold text-slate-700 group-hover:text-amber-800">
                        {p.name_en}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-micro text-slate-500">
              Tap a stop to preview it on the map →
            </p>
          </motion.div>
        ) : result?.ok && recommended.length === 0 ? (
          <div className="border-t border-amber-100 px-5 py-3 md:px-7">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-caption text-amber-800 ring-1 ring-amber-100">
              {result.message || "Try broader interests or a different region."}
            </p>
          </div>
        ) : null}
      </motion.div>
    </section>
  );
}
