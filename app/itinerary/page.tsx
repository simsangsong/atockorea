'use client';

import { useState, useRef } from 'react';
import { Loader2, MapPin, Clock } from 'lucide-react';

type PipelineStatus = 'idle' | 'drafting' | 'validating' | 'refining' | 'complete';

interface ScheduleItem {
  name: string;
  address?: string;
}

interface GenerateResult {
  schedule?: ScheduleItem[];
  travel_times?: number;
  feasibility_score?: 'Green' | 'Yellow' | 'Red';
  guide_message?: string;
}

export default function ItineraryPipeline() {
  const [theme, setTheme] = useState('Relaxation & Spa');
  const [duration, setDuration] = useState('3 days');
  const [status, setStatus] = useState<PipelineStatus>('idle');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  const generateItinerary = async () => {
    setError(null);
    setResult(null);
    setStatus('drafting');

    timeoutRefs.current.forEach((t) => clearTimeout(t));
    timeoutRefs.current = [
      setTimeout(() => setStatus('validating'), 1800),
      setTimeout(() => setStatus('refining'), 3600),
    ];

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, duration }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate itinerary.');
        setStatus('idle');
        return;
      }

      timeoutRefs.current.forEach((t) => clearTimeout(t));
      setResult(data);
      setStatus('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('idle');
      timeoutRefs.current.forEach((t) => clearTimeout(t));
    }
  };

  const schedule = result?.schedule ?? [];
  const feasibilityScore = result?.feasibility_score ?? 'Green';
  const travelMins = result?.travel_times ?? 0;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
      <div className="max-w-3xl mx-auto py-16 sm:py-20 px-4 sm:px-6">
        <header className="mb-14 text-center">
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight mb-3 text-neutral-900">
            Curate Your Journey
          </h1>
          <p className="text-neutral-500 font-light tracking-wide text-sm sm:text-base">
            Experience the essence of ATOCKOREA
          </p>
        </header>

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-neutral-100 mb-8">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <input
              className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-neutral-300 focus:border-transparent outline-none transition-all font-light text-neutral-900 placeholder:text-neutral-400"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Theme (e.g., Luxury Dining)"
              aria-label="Trip theme"
            />
            <select
              className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 font-light text-neutral-900 focus:ring-2 focus:ring-neutral-300 focus:border-transparent outline-none cursor-pointer"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              aria-label="Trip duration"
            >
              <option value="1 day">1 day</option>
              <option value="2 days">2 days</option>
              <option value="3 days">3 days</option>
              <option value="4 days">4 days</option>
              <option value="5 days">5 days</option>
            </select>
            <button
              type="button"
              onClick={generateItinerary}
              disabled={status !== 'idle' && status !== 'complete'}
              className="bg-neutral-900 text-white px-8 py-3.5 rounded-xl font-medium tracking-wide hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              Generate
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm font-medium">
              {error}
            </div>
          )}

          {status !== 'idle' && status !== 'complete' && (
            <div className="flex flex-col items-center justify-center py-14 space-y-6 text-neutral-400">
              <Loader2 className="w-10 h-10 animate-spin text-neutral-700" aria-hidden />
              <div className="flex items-center gap-2 text-xs sm:text-sm uppercase tracking-widest font-medium">
                <span className={status === 'drafting' ? 'text-neutral-900' : ''}>Drafting</span>
                <span className="text-neutral-300">•</span>
                <span className={status === 'validating' ? 'text-neutral-900' : ''}>Validating</span>
                <span className="text-neutral-300">•</span>
                <span className={status === 'refining' ? 'text-neutral-900' : ''}>Refining</span>
              </div>
            </div>
          )}
        </div>

        {status === 'complete' && result && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Feasibility Gauge */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-2xl border border-neutral-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-neutral-100">
                  <Clock className="w-5 h-5 text-neutral-600" aria-hidden />
                </div>
                <div>
                  <p className="font-medium tracking-wide text-xs uppercase text-neutral-500">
                    Pace Assessment
                  </p>
                  <p className="text-sm text-neutral-400 mt-0.5">
                    {travelMins} min total drive time
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-3.5 h-3.5 rounded-full shrink-0 ${
                    feasibilityScore === 'Red'
                      ? 'bg-red-500'
                      : feasibilityScore === 'Yellow'
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                  }`}
                  aria-hidden
                />
                <span className="text-sm font-medium text-neutral-700">{feasibilityScore}</span>
              </div>
            </div>

            {/* Guide message */}
            {result.guide_message && (
              <div className="bg-neutral-900 text-neutral-100 p-6 sm:p-8 rounded-2xl font-light leading-relaxed text-sm sm:text-base">
                <p className="italic">&ldquo;{result.guide_message}&rdquo;</p>
              </div>
            )}

            {/* Timeline */}
            <div className="relative border-l-2 border-neutral-200 pl-6 sm:pl-8 space-y-8">
              {schedule.length === 0 ? (
                <p className="text-neutral-500 font-light text-sm">No stops in this itinerary.</p>
              ) : (
                schedule.map((item, i) => (
                  <div key={i} className="relative flex gap-4">
                    <div className="absolute -left-[29px] top-1 w-5 h-5 rounded-full bg-white border-2 border-neutral-300 flex items-center justify-center shrink-0">
                      <MapPin className="w-2.5 h-2.5 text-neutral-700" aria-hidden />
                    </div>
                    <div className="pt-0.5">
                      <h3 className="text-lg sm:text-xl font-medium text-neutral-900 mb-1">
                        {item.name}
                      </h3>
                      {item.address && (
                        <p className="text-neutral-500 font-light text-sm">{item.address}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
