'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookmarkPlus, Clock, Loader2 } from 'lucide-react';
import type { GeneratedItineraryResponse } from '@/lib/itinerary/types';
import { ItineraryStopCard } from './ItineraryStopCard';
import { ItineraryStopDetailsModal } from './ItineraryStopDetailsModal';

export function ItineraryResult(props: {
  data: GeneratedItineraryResponse;
  /** Original generator request; required for save-to-account. */
  requestPayload?: Record<string, unknown> | null;
  showSaveAction?: boolean;
}) {
  const { data, requestPayload = null, showSaveAction = true } = props;
  const [detail, setDetail] = useState<GeneratedItineraryResponse['stops'][number] | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const canSave = showSaveAction && requestPayload != null;

  const saveItinerary = async () => {
    if (!requestPayload) return;
    setSaveError(null);
    setSaveState('saving');
    try {
      const { supabase } = await import('@/lib/supabase');
      if (!supabase) {
        setSaveError('Sign in is not available.');
        setSaveState('error');
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setSaveError('Sign in to save this itinerary.');
        setSaveState('error');
        return;
      }
      const itineraryJson = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
      const res = await fetch('/api/saved-itineraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: data.tourTitle,
          summary: data.tourSummary.slice(0, 800),
          requestJson: requestPayload,
          itineraryJson,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(typeof body.error === 'string' ? body.error : 'Save failed.');
        setSaveState('error');
        return;
      }
      setSaveState('done');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed.');
      setSaveState('error');
    }
  };

  const repairMsgSet = new Set(
    (data.generationMeta.validationRepairs ?? []).map((r) => r.message),
  );
  const noteWarnings = data.warnings.filter((w) => !repairMsgSet.has(w));

  const feasibility =
    data.warnings.length > 3 ? 'Yellow' : data.warnings.length === 0 ? 'Green' : 'Yellow';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-100 shadow-sm">
        <h2 className="text-2xl font-light text-neutral-900 mb-2">{data.tourTitle}</h2>
        <p className="text-neutral-600 font-light text-sm leading-relaxed">{data.tourSummary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
          {canSave && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => void saveItinerary()}
                disabled={saveState === 'saving' || saveState === 'done'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-60"
              >
                {saveState === 'saving' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                ) : (
                  <BookmarkPlus className="w-3.5 h-3.5" aria-hidden />
                )}
                {saveState === 'done' ? 'Saved' : 'Save to my account'}
              </button>
              {saveState === 'done' && (
                <Link
                  href="/mypage/saved-itineraries"
                  className="text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
                >
                  View saved
                </Link>
              )}
              {saveError && <span className="text-red-600 text-[11px]">{saveError}</span>}
            </div>
          )}
          <span>
            Candidates: {data.generationMeta.candidateCount} · Gemini: {data.generationMeta.geminiModel}{' '}
            · Claude: {data.generationMeta.claudeModel}
            {data.generationMeta.usedFallback ? ' · fallback used' : ''}
            {data.generationMeta.claudeReviewSummary != null
              ? ` · Claude review: ${data.generationMeta.claudeReviewSummary.changed ? 'edited' : 'unchanged'}`
              : ''}
          </span>
          {data.routeMetrics != null && data.routeMetrics.totalLegCount > 0 && (
            <span className="text-neutral-400 w-full sm:w-auto">
              Est. driving ~{data.routeMetrics.estimatedTotalTravelMinutes} min · visits ~
              {data.routeMetrics.estimatedTotalVisitMinutes} min · day ~
              {data.routeMetrics.estimatedTotalDayMinutes} min
              {data.routeMetrics.totalTravelDistanceKm != null
                ? ` · ~${data.routeMetrics.totalTravelDistanceKm} km line distance`
                : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-2xl border border-neutral-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-neutral-100">
            <Clock className="w-5 h-5 text-neutral-600" aria-hidden />
          </div>
          <div>
            <p className="font-medium tracking-wide text-xs uppercase text-neutral-500">Quality check</p>
            <p className="text-sm text-neutral-400 mt-0.5">{data.warnings.length} note(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-3.5 h-3.5 rounded-full shrink-0 ${
              feasibility === 'Yellow' ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
            aria-hidden
          />
          <span className="text-sm font-medium text-neutral-700">{feasibility}</span>
        </div>
      </div>

      {(noteWarnings.length > 0 ||
        (data.generationMeta.validationRepairs?.length ?? 0) > 0 ||
        data.generationMeta.validationMeta != null) && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-900 font-light space-y-4">
          {data.generationMeta.validationMeta != null && (
            <p className="text-xs text-amber-800/90">
              Estimated time ~{Math.round(data.generationMeta.validationMeta.totalEstimatedMin)} min
              (budget {Math.round(data.generationMeta.validationMeta.budgetMin)} min for this trip
              window)
              {data.routeMetrics != null ? (
                <>
                  {' '}
                  · driving ~{data.routeMetrics.estimatedTotalTravelMinutes} min · at stops ~
                  {data.routeMetrics.estimatedTotalVisitMinutes} min
                </>
              ) : null}
            </p>
          )}
          {data.generationMeta.validationRepairs != null &&
            data.generationMeta.validationRepairs.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-900/80 mb-2">
                  Route adjustments
                </p>
                <ul className="space-y-2">
                  {data.generationMeta.validationRepairs.map((r, i) => (
                    <li
                      key={`${r.category}-${i}`}
                      className="flex flex-col gap-0.5 border-b border-amber-100/80 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-[11px] uppercase tracking-wide text-amber-700/90">
                        {r.category.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm">{r.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          {noteWarnings.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-900/80 mb-2">
                Notes
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {noteWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="space-y-6">
        {data.stops.map((stop) => (
          <ItineraryStopCard
            key={`${stop.contentId}-${stop.sortOrder}`}
            stop={stop}
            onViewDetails={(s) => {
              setDetail(s);
              setReason(s.reason);
            }}
          />
        ))}
      </div>

      <ItineraryStopDetailsModal
        open={detail != null}
        stop={detail}
        reason={reason}
        onClose={() => {
          setDetail(null);
          setReason(null);
        }}
      />
    </div>
  );
}
