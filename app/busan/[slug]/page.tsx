// app/busan/[slug]/page.tsx
import { notFound } from "next/navigation";

const busanTourData: Record<string, any> = {
  "jeju-eastern-unesco-spots-day-tour": {
    title: "Jeju: Eastern Jeju UNESCO Spots Day Tour",
    duration: "10 hours",
    price: "from €46 / person",
  },
  "gwangalli-night-food": {
    title: "Gwangalli Night View & Local Food",
    duration: "3–4 hours",
    price: "from US$65 / person",
  },
};

type Props = {
  params: { slug: string };
};

export default function BusanSlugPage({ params }: Props) {
  const tour = busanTourData[params.slug];

  if (!tour) return notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <h1 className="text-[18px] font-bold text-gray-800 sm:text-[22px] mb-2 leading-tight">{tour.title}</h1>

      <p className="text-[12px] text-gray-600 mb-4">
        ⏱ {tour.duration} · {tour.price}
      </p>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <p className="text-[13px] text-gray-700">
          This is a sample Busan tour detail page.
        </p>
      </div>
    </div>
  );
}
