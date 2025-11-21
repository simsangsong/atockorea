// app/my/page.tsx
export default function MyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <h1 className="mb-2 text-[20px] font-semibold">My Page</h1>
      <p className="mb-4 text-[12px] text-gray-600">
        View your upcoming tours, past bookings, and profile.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-2 text-[14px] font-semibold">Upcoming bookings</h2>
          <p className="text-[12px] text-gray-600">
            No upcoming bookings yet. Book your first tour in Korea.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-2 text-[14px] font-semibold">Profile</h2>
          <p className="text-[12px] text-gray-600">
            Name, email, preferred language, etc.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 md:col-span-2">
          <h2 className="mb-2 text-[14px] font-semibold">
            Past tours & receipts
          </h2>
          <p className="text-[12px] text-gray-600">
            You can see your completed tours and download payment receipts.
          </p>
        </section>
      </div>
    </div>
  );
}
