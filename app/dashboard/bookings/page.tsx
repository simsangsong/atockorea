// app/dashboard/bookings/page.tsx
export default function AdminBookingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <h1 className="mb-2 text-[20px] font-semibold">Bookings</h1>
      <p className="mb-4 text-[12px] text-gray-600">
        See and manage all tour bookings.
      </p>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="min-w-full text-[12px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">
                Date
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">
                Tour
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">
                Guest
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {/* 之后在这里 map API 数据 */}
            <tr>
              <td className="px-3 py-2 border-t text-gray-700">–</td>
              <td className="px-3 py-2 border-t text-gray-700">–</td>
              <td className="px-3 py-2 border-t text-gray-700">–</td>
              <td className="px-3 py-2 border-t text-gray-700">–</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
