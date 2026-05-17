"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";

interface Props {
  region: RegionSlug;
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
export default function AIRecommendPanel({ region, onAccept, onFocusPoi }: Props) {
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
    <section className="border-b border-amber-100 bg-gradient-to-r from-amber-50/60 via-white to-white px-4 py-4 md:px-6">
      <div className="mx-auto max-w-5xl">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-1.5 inline-flex items-center gap-1.5 text-eyebrow">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Get AI recommendations
            </label>
            <input
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
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-caption font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 md:w-auto"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {loading ? "Matching..." : "Recommend"}
          </button>
        </form>

        {error ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-3 py-2 text-caption font-semibold text-rose-700 ring-1 ring-rose-100">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            {error}
          </p>
        ) : null}

        {result?.ok && recommended.length > 0 ? (
          <div className="mt-3 rounded-lg bg-white px-4 py-3 ring-1 ring-amber-200">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-caption font-bold text-slate-900">
                {recommended.length} stops matched · ~{totalH}h day
              </p>
              <button
                type="button"
                onClick={() => onAccept(recommended)}
                className="rounded-full bg-amber-500 px-4 py-1.5 text-caption font-bold text-white hover:bg-amber-600"
              >
                Load into cart
              </button>
            </div>
            <ol className="flex flex-wrap gap-1.5 text-micro">
              {(result.per_poi_score ?? []).map((p, i) => (
                <li key={p.poi_key} className="inline-flex">
                  <button
                    type="button"
                    onClick={() => onFocusPoi?.(p.poi_key)}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 transition-colors hover:bg-amber-100 hover:text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                    title="See on map"
                  >
                    <span className="text-slate-400">{i + 1}.</span>
                    {p.name_en}
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-micro text-slate-500">
              Tap a stop to preview it on the map →
            </p>
          </div>
        ) : result?.ok && recommended.length === 0 ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-caption text-amber-800 ring-1 ring-amber-100">
            {result.message || "Try broader interests or a different region."}
          </p>
        ) : null}
      </div>
    </section>
  );
}
