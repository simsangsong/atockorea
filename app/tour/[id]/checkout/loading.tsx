/**
 * Checkout route loading boundary — paints a checkout-shaped skeleton the
 * instant the tap lands instead of freezing on the previous page while the
 * (client) checkout page hydrates and fetches the tour + session.
 */
export default function TourCheckoutLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-16 w-full border-b border-slate-200/70 bg-white" />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200/70" />
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-200/60" />
            <div className="h-56 w-full animate-pulse rounded-2xl bg-slate-200/50" />
          </div>
          <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-5">
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-slate-200/70" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200/50" />
            <div className="h-32 w-full animate-pulse rounded-xl bg-slate-200/50" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200/70" />
          </div>
        </div>
      </div>
    </div>
  );
}
