// app/dashboard/stats/page.tsx
export default function AdminStatsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <h1 className="mb-2 text-[20px] font-semibold">Statistics</h1>
      <p className="mb-4 text-[12px] text-gray-600">
        View detailed analytics and performance metrics.
      </p>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="text-[11px] text-gray-500">Total Tours</div>
          <div className="mt-1 text-[20px] font-semibold">0</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="text-[11px] text-gray-500">Active Bookings</div>
          <div className="mt-1 text-[20px] font-semibold">0</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="text-[11px] text-gray-500">Total Revenue</div>
          <div className="mt-1 text-[20px] font-semibold">$0</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="text-[11px] text-gray-500">Average Rating</div>
          <div className="mt-1 text-[20px] font-semibold">0.0</div>
        </div>
      </div>
    </div>
  );
}

