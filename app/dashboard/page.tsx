// app/dashboard/page.tsx
export default function AdminDashboard() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <h1 className="mb-2 text-[20px] font-semibold">Admin Dashboard</h1>
      <p className="mb-4 text-[12px] text-gray-600">
        Overview of bookings, members, and sales performance.
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="text-[11px] text-gray-500">Today&apos;s bookings</div>
          <div className="mt-1 text-[20px] font-semibold">0</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="text-[11px] text-gray-500">Total members</div>
          <div className="mt-1 text-[20px] font-semibold">0</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="text-[11px] text-gray-500">Monthly revenue</div>
          <div className="mt-1 text-[20px] font-semibold">$0</div>
        </div>
      </div>
    </div>
  );
}
