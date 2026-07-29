/**
 * Builder route loading boundary — the planner is a server-dynamic render
 * (region POIs + optional auto-match), so this paints a map + POI-grid shaped
 * skeleton immediately instead of freezing on the previous page.
 */
export default function ItineraryBuilderLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-16 w-full border-b border-slate-200/70 bg-white" />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="h-5 w-56 animate-pulse rounded-full bg-slate-200/70" />
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
          <div className="h-[420px] w-full animate-pulse rounded-2xl bg-slate-200/60" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
                <div className="h-40 w-full animate-pulse bg-slate-200/60" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-200/70" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200/50" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
