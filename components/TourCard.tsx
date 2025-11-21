// components/TourCard.tsx
import Link from "next/link";

export type Tour = {
  slug: string;
  city: "Seoul" | "Busan" | "Jeju";
  tag: string;
  title: string;
  desc: string;
  price: string;
  href: string;
};

export default function TourCard({ tour }: { tour: Tour }) {
  return (
    <Link
      href={tour.href}
      className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 hover:shadow-md transition"
    >
      <div className="mb-1 text-[11px] text-gray-500">{tour.tag}</div>
      <div className="mb-1 text-[14px] font-semibold">{tour.title}</div>
      <div className="mb-2 text-[12px] text-gray-600">{tour.desc}</div>
      <div className="text-[12px] font-semibold text-[#0c66ff]">
        {tour.price}
      </div>
    </Link>
  );
}
