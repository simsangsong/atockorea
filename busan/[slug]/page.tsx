// app/busan/[slug]/page.tsx
import { notFound } from "next/navigation";

type Props = {
  params: { slug: string };
};

const busanTourData = {
  "gamcheon-haeundae-small-group": {
    title: "Gamcheon Culture Village + Haeundae Small-group Tour",
    duration: "8 hours",
    groupSize: "6–8 guests",
    price: "from US$79 / person",
  },
  "gwangalli-night-food": {
    title: "Gwangalli Night View & Local Food",
    duration: "3–4 hours",
    groupSize: "2–8 guests",
    price: "from US$65 / person",
  },
};

export default function BusanTourDetailPage({ params }: Props) {
  const tour = (busanTourData as any)[params.slug];
  if (!tour) return notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <h1 className="mb-2 text-[20px] font-semibold">{tour.title}</h1>
      <div className="mb-4 text-[12px] text-gray-600">
        <span className="mr-3">⏱ {tour.duration}</span>
        <span className="mr-3">👥 {tour.groupSize}</span>
        <span className="font-semibold text-[#0c66ff]">{tour.price}</span>
      </div>

      {/* 这里后面可以写详细行程、包含/不含、注意事项、退款规则等 */}
      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <h2 className="mb-1 text-[15px] font-semibold">Overview</h2>
        <p className="text-[12px] text-gray-700">
          Local-based Busan day tour operated by licensed agencies and
          certified guides. We focus on small-group & private tours to keep
          the experience comfortable and flexible.
        </p>
      </section>

      {/* 预约按钮以后可以连到 /checkout 或直接弹出预约表单 */}
      <button className="mt-2 w-full rounded-full bg-[#0c66ff] py-2.5 text-[13px] font-semibold text-white hover:bg-[#0050d0]">
        Book now (Deposit)
      </button>
    </div>
  );
}
