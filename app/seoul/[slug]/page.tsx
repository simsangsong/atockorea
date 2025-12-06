// app/seoul/[slug]/page.tsx
import { notFound } from "next/navigation";

const seoulTourData: Record<string, any> = {
  "seoul-palace-market-tour": {
    title: "Seoul Palace & Market Tour",
    duration: "Half day",
    price: "from US$69 / person",
  },
  "seoul-culture-village-tour": {
    title: "Seoul Culture Village & Traditional Experience",
    duration: "Full day",
    price: "from US$75 / person",
  },
};

type Props = {
  params: { slug: string };
};

export default function SeoulSlugPage({ params }: Props) {
  const tour = seoulTourData[params.slug];

  if (!tour) return notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <h1 className="text-[20px] font-semibold mb-2">{tour.title}</h1>

      <p className="text-[12px] text-gray-600 mb-4">
        ⏱ {tour.duration} · {tour.price}
      </p>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <p className="text-[13px] text-gray-700">
          This is a sample Seoul tour detail page.
        </p>
      </div>
    </div>
  );
}

