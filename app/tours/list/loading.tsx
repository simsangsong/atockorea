/**
 * Route-level loading boundary for the catalogue. With ISR + bottom-nav
 * prefetch this rarely shows, but on a cache MISS (or un-prefetched hard
 * navigation) the tab tap paints this shelves-shaped skeleton instantly
 * instead of freezing on the previous page.
 */
export default function ToursListLoading() {
  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <div className="mx-auto w-full max-w-[1320px] px-2 py-4 sm:px-4 sm:py-5">
        {/* Hero band */}
        <div className="mb-6 h-40 animate-pulse rounded-3xl bg-slate-200/70 sm:h-52" />
        {/* Filter rail */}
        <div className="mb-6 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-slate-200/70" />
          ))}
        </div>
        {/* Shelf rows */}
        {Array.from({ length: 2 }).map((_, row) => (
          <div key={row} className="mb-8">
            <div className="mb-3 h-6 w-44 animate-pulse rounded-lg bg-slate-200/70" />
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 lg:grid-cols-3 lg:gap-x-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={i === 2 ? 'hidden lg:block' : undefined}>
                  <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-slate-200/70" />
                  <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-200/70" />
                  <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-slate-200/60" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
