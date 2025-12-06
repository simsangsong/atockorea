// app/dashboard/members/page.tsx
export default function AdminMembersPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <h1 className="mb-2 text-[20px] font-semibold">Members</h1>
      <p className="mb-4 text-[12px] text-gray-600">
        Manage user accounts and memberships.
      </p>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="min-w-full text-[12px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">
                Name
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">
                Email
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">
                Joined
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

